import { performanceRepository } from "../repositories/performance.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { capitalTrancheRepository } from "../repositories/capital-tranche.repository.js";
import { contractRepository } from "../repositories/contract.repository.js";
import { dashboardRepository } from "../repositories/dashboard.repository.js";
import { notificationCleanService as notificationService } from "./notification.service.js";
import { ApiError } from "../utils/ApiError.js";
import * as perfUtils from "../utils/performance.utils.js";

// Performance Service — business logic for fund and investor performance management.
class PerformanceService {

    // Add monthly performance (individual or fund distribution).
    async addMonthlyPerformance(data, adminId) {
        const { type, user_id, month, year, profit_percentage, profit_amount, notes } = data;

        const monthNum = parseInt(month);
        const yearNum = parseInt(year);

        if (type === "individual") {
            return await this.processIndividualPerformance(user_id, monthNum, yearNum, profit_percentage, profit_amount, notes, adminId);
        } else if (type === "fund") {
            // Background processing for fund to avoid timeout
            this.processFundPerformance(monthNum, yearNum, profit_percentage, profit_amount, notes, adminId).catch(err => {
                console.error("Critical Error in Background Fund Performance Distribution:", err);
            });
            return { message: "Fund performance distribution started in background", month: monthNum, year: yearNum };
        } else {
            throw ApiError.badRequest("Invalid performance type. Must be 'individual' or 'fund'");
        }
    }

    // Process performance for a single investor.
    async processIndividualPerformance(userId, month, year, profit_percentage, profit_amount, notes, adminId) {
        const investor = await userRepository.findById(userId);
        if (!investor) throw ApiError.notFound("Investor not found");

        const existing = await performanceRepository.getInvestorPerformanceByMonthYear(userId, month, year);
        if (existing) throw ApiError.badRequest(`Performance record already exists for ${month}/${year}`);

        // Validate contract dates
        if (!perfUtils.isMonthWithinContract(month, year, investor.contract_start_date, investor.contract_end_date)) {
            throw ApiError.badRequest(`Performance month ${month}/${year} is outside the investor's contract period (${investor.contract_start_date} to ${investor.contract_end_date || 'Present'})`);
        }

        // Get value before: using current_portfolio ensures initial_capital + any tranches are accounted for.
        const valBefore = parseFloat(investor.current_portfolio);

        const consistency = perfUtils.validateMathematicalConsistency(profit_percentage, profit_amount, valBefore);
        if (!consistency.isValid) throw ApiError.badRequest(consistency.message);

        const valAfter = perfUtils.calculatePortfolioValueAfter(investor, valBefore, consistency.finalAmount);

        const performanceId = await performanceRepository.addInvestorPerformance({
            user_id: userId,
            month,
            year,
            profit_percentage: consistency.finalPercentage,
            portfolio_value_before: valBefore,
            portfolio_value_after: valAfter,
            profit_amount: consistency.finalAmount,
            notes: notes || "Monthly performance auto-calculated",
            added_by: adminId
        });

        // Update current portfolio
        await userRepository.updateProfile(userId, ["current_portfolio = ?"], [valAfter]);

        // Notification
        try {
            await notificationService.sendNotification({
                user_ids: [userId],
                title: "Monthly Performance Update",
                message: `Your portfolio performance for ${month}/${year} has been updated.`,
                type: "performance_update",
                payload: { month, year, profit_amount: consistency.finalAmount },
                send_push: true
            });
        } catch (err) { console.error(err); }

        return { performance_id: performanceId, portfolio_value_after: valAfter };
    }

    // Process fund performance: distributes to all investors with batching and pagination.
    async processFundPerformance(month, year, profit_percentage, profit_amount, notes, adminId) {
        const hasPct = profit_percentage !== undefined && profit_percentage !== null && profit_percentage !== "";
        const hasAmt = profit_amount !== undefined && profit_amount !== null && profit_amount !== "";

        const batchSize = 50;
        let offset = 0;
        let effectiveFundValueBefore = 0;
        let expectedTotalProfit = 0;
        let expectedMonthlyPayables = 0;
        let filteredInvestorsCount = 0;

        // First pass: aggregate metrics using pagination
        while (true) {
            const batch = await userRepository.findActiveInvestors(offset, batchSize);
            if (batch.length === 0) break;
            const investorsBatch = batch.filter(investor =>
                perfUtils.isMonthWithinContract(month, year, investor.contract_start_date, investor.contract_end_date)
            );
            for (const investor of investorsBatch) {
                const valBefore = parseFloat(investor.current_portfolio || 0);
                effectiveFundValueBefore += valBefore;
                const pct = hasPct ? parseFloat(profit_percentage) : (parseFloat(investor.fixed_interest_rate) || 0);
                const profit = valBefore * (pct / 100);
                expectedTotalProfit += profit;
                if (investor.contract_type === 0) {
                    expectedMonthlyPayables += profit;
                }
                filteredInvestorsCount++;
            }
            offset += batchSize;
        }

        // Determine global percentage if profit_amount provided
        let globalPct = 0;
        if (hasPct) {
            globalPct = parseFloat(profit_percentage);
        } else if (hasAmt && effectiveFundValueBefore > 0) {
            globalPct = (parseFloat(profit_amount) / effectiveFundValueBefore) * 100;
        }

        const totalFundValueAfter = effectiveFundValueBefore + (expectedTotalProfit - expectedMonthlyPayables);

        // Record fund performance summary
        await performanceRepository.addFundPerformance({
            month,
            year,
            performance_percentage: globalPct,
            total_fund_value_before: effectiveFundValueBefore,
            total_fund_value_after: totalFundValueAfter,
            monthly_payables_total: expectedMonthlyPayables,
            adjusted_fund_value: totalFundValueAfter,
            adjusted_performance_percentage: globalPct,
            notes: notes || "Distributed from fund performance",
            added_by: adminId
        });
        console.log(`Starting background distribution for ${filteredInvestorsCount} investors for ${month}/${year}`);

        // Second pass: actual distribution in batches
        offset = 0;
        const distributeBatch = async () => {
            const batch = await userRepository.findActiveInvestors(offset, batchSize);
            if (batch.length === 0) {
                console.log(`Distribution complete for ${month}/${year}`);
                return;
            }
            const investorsBatch = batch.filter(investor =>
                perfUtils.isMonthWithinContract(month, year, investor.contract_start_date, investor.contract_end_date)
            );
            for (const investor of investorsBatch) {
                try {
                    const existing = await performanceRepository.getInvestorPerformanceByMonthYear(investor.id, month, year);
                    if (existing) continue;
                    const valBefore = parseFloat(investor.current_portfolio);
                    const pctToUse = globalPct > 0 ? globalPct : parseFloat(investor.fixed_interest_rate || 0);
                    const amt = valBefore * (pctToUse / 100);
                    const valAfter = perfUtils.calculatePortfolioValueAfter(investor, valBefore, amt);
                    await performanceRepository.addInvestorPerformance({
                        user_id: investor.id,
                        month,
                        year,
                        profit_percentage: pctToUse,
                        portfolio_value_before: valBefore,
                        portfolio_value_after: valAfter,
                        profit_amount: amt,
                        notes: notes || "Distributed from fund performance",
                        added_by: adminId
                    });
                    await userRepository.updateProfile(investor.id, ["current_portfolio = ?"], [valAfter]);
                } catch (err) {
                    console.error(`Error distributing performance to investor ${investor.id}:`, err);
                }
            }
            offset += batchSize;
            setImmediate(distributeBatch);
        };
        await distributeBatch();
    }


    // Get historical records formatted for Year/Month view.
    async getHistoricalRecords(query) {
        const { type, user_id } = query;
        let records = [];

        if (type === "individual") {
            if (!user_id) throw ApiError.badRequest("User ID required for individual history");
            records = await performanceRepository.getInvestorHistory(user_id);
        } else {
            records = await performanceRepository.getFundHistory();
            // rename property for consistency if needed, but repository already uses performance_percentage
        }

        return this.formatHistoryByYear(records);
    }

    // Format flat array into { year: { month: data } } structure.
    formatHistoryByYear(records) {
        const years = {};
        for (const rec of records) {
            if (!years[rec.year]) {
                years[rec.year] = { year: rec.year, months: {} };
            }
            years[rec.year].months[rec.month] = {
                id: rec.id,
                percentage: rec.profit_percentage || rec.performance_percentage,
                amount: rec.profit_amount || null,
                notes: rec.notes || null,
                created_at: rec.created_at
            };
        }
        return Object.values(years).sort((a, b) => b.year - a.year);
    }

    // Get chart data.
    async getChartData(query) {
        const { type, user_id } = query;
        let data = [];
        if (type === "individual") {
            data = await performanceRepository.getInvestorPerformanceChartData(user_id);
        } else {
            data = await performanceRepository.getFundPerformanceChartData();
        }
        return data.map(d => ({
            period: `${d.year}-${d.month.toString().padStart(2, '0')}`,
            percentage: parseFloat(d.profit_percentage || d.performance_percentage)
        }));
    }

    // Delete performance record and roll back current_portfolio.
    async deletePerformance(performanceId, adminId) {
        const record = await performanceRepository.getPerformanceById(performanceId);
        if (!record) throw ApiError.notFound("Performance record not found");

        // Roll back portfolio value: new_current = current - (after - before)
        // This is safe even if multiple records exist because we subtract only the specific gain
        const investor = await userRepository.findById(record.user_id);
        const diff = parseFloat(record.portfolio_value_after) - parseFloat(record.portfolio_value_before);
        const newPortfolio = parseFloat(investor.current_portfolio) - diff;

        await userRepository.updateProfile(record.user_id, ["current_portfolio = ?"], [newPortfolio]);
        await performanceRepository.deleteInvestorPerformance(performanceId);

        return { deleted_id: performanceId, user_id: record.user_id, rolled_back_portfolio: newPortfolio };
    }
}

const performanceService = new PerformanceService();
export { performanceService, PerformanceService };
