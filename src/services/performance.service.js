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


    // Get historical records formatted with charts
    async getHistoricalRecords(query) {
        const { type, user_id, months = 12, year } = query;
        const limitMonths = parseInt(months);
        const filterYear = year ? parseInt(year) : null;

        if (type === "individual") {
            if (!user_id) throw ApiError.badRequest("User ID required for individual history");
            
            const performance = await performanceRepository.getInvestorHistory(user_id, filterYear, limitMonths);

            // Format data for response
            const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            const monthNamesShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

            const formattedPerformance = performance.map(record => ({
                id: record.id,
                month: record.month,
                year: record.year,
                month_name: monthNames[record.month - 1],
                portfolio_value: parseFloat(record.portfolio_value),
                profit_amount: parseFloat(record.profit_amount),
                profit_percentage: parseFloat(record.profit_percentage),
                notes: record.notes,
                created_at: record.created_at
            }));

            const reversedPerformance = [...formattedPerformance].reverse();
            const chartData = {
                labels: reversedPerformance.map(r => monthNamesShort[r.month - 1]),
                portfolio_values: reversedPerformance.map(r => r.portfolio_value),
                profit_amounts: reversedPerformance.map(r => r.profit_amount)
            };

            return { performance: formattedPerformance, chart_data: chartData };

        } else {
            // Fund History Logic
            const performance = await performanceRepository.getFundHistory(filterYear, limitMonths);

            const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            const monthNamesShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

            const formattedPerformance = performance.map(record => ({
                id: record.id,
                month: record.month,
                year: record.year,
                month_name: monthNames[record.month - 1],
                portfolio_value: parseFloat(record.portfolio_value || 0),
                profit_amount: parseFloat(record.profit_amount || 0),
                profit_percentage: parseFloat(record.profit_percentage || 0),
                notes: record.notes,
                created_at: record.created_at
            }));

            const reversedPerformance = [...formattedPerformance].reverse();
            const chartData = {
                labels: reversedPerformance.map(r => monthNamesShort[r.month - 1]),
                portfolio_values: reversedPerformance.map(r => r.portfolio_value),
                profit_amounts: reversedPerformance.map(r => r.profit_amount)
            };

            return { performance: formattedPerformance, chart_data: chartData };
        }
    }

    // Get chart data padded with missing months.
    async getChartData(queryParams) {
        const { type, user_id, period = 12, chart_type = "line" } = queryParams;
        const periodNum = parseInt(period);

        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;

        const monthNamesShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const allMonths = [];

        for (let i = periodNum - 1; i >= 0; i--) {
            let targetMonth = currentMonth - i;
            let targetYear = currentYear;
            while (targetMonth <= 0) {
                targetMonth += 12;
                targetYear -= 1;
            }
            allMonths.push({
                month: targetMonth,
                year: targetYear,
                label: `${monthNamesShort[targetMonth - 1]} ${targetYear}`
            });
        }

        const dateConditions = [];
        for (const monthData of allMonths) {
            dateConditions.push(`(year = ${monthData.year} AND month = ${monthData.month})`);
        }
        const periodFilter = dateConditions.length > 0 ? ` AND (${dateConditions.join(' OR ')})` : '';

        let chartData = [];
        let summaryValues = {
            initial_capital: 0,
            current_portfolio: 0
        };

        if (type === "individual") {
            if (!user_id) throw ApiError.badRequest("User ID required");
            const dateConditionsStr = dateConditions.join(' OR ');
            chartData = await performanceRepository.getInvestorPerformanceByPeriod(user_id, dateConditionsStr);

            const investorStats = await userRepository.findById(user_id);
            if (investorStats) {
                summaryValues.initial_capital = investorStats.initial_capital;
                summaryValues.current_portfolio = investorStats.current_portfolio;
            }
        } else {
            const dateConditionsStr = dateConditions.join(' OR ');
            chartData = await performanceRepository.getFundPerformanceByPeriod(dateConditionsStr);
        }

        const dataMap = new Map();
        chartData.forEach(record => {
            dataMap.set(`${record.year}-${record.month}`, record);
        });

        const labels = [];
        const portfolioValues = [];
        const profitAmounts = [];
        const profitPercentages = [];

        for (const monthData of allMonths) {
            const record = dataMap.get(`${monthData.year}-${monthData.month}`);
            labels.push(monthData.label);
            if (record) {
                portfolioValues.push(parseFloat(record.portfolio_value || 0));
                profitAmounts.push(parseFloat(record.profit_amount || 0));
                profitPercentages.push(parseFloat(record.profit_percentage || 0));
            } else {
                portfolioValues.push(0);
                profitAmounts.push(0);
                profitPercentages.push(0);
            }
        }

        let latestPortfolioValue = 0;
        for (let i = portfolioValues.length - 1; i >= 0; i--) {
            if (portfolioValues[i] !== 0) {
                latestPortfolioValue = portfolioValues[i];
                break;
            }
        }
        const totalProfit = profitAmounts.reduce((sum, profit) => sum + profit, 0);
        const nonZeroPercentages = profitPercentages.filter(pct => pct !== 0);
        const avgProfitPercentage = nonZeroPercentages.length > 0
            ? nonZeroPercentages.reduce((sum, pct) => sum + pct, 0) / nonZeroPercentages.length
            : 0;

        return {
            labels,
            datasets: [
                { label: "Portfolio Value", data: portfolioValues, type: chart_type },
                { label: "Monthly Profit", data: profitAmounts, type: chart_type },
                { label: "Profit Percentage", data: profitPercentages, type: chart_type }
            ],
            summary: {
                initial_capital: parseFloat(summaryValues.initial_capital || 0),
                current_portfolio: parseFloat(summaryValues.current_portfolio || 0),
                latest_portfolio_value: parseFloat(latestPortfolioValue.toFixed(6)),
                total_profit: parseFloat(totalProfit.toFixed(2)),
                avg_profit_percentage: parseFloat(avgProfitPercentage.toFixed(2)),
                period_months: periodNum
            }
        };
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
