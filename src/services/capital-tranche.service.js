import { capitalTrancheRepository } from "../repositories/capital-tranche.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { performanceRepository } from "../repositories/performance.repository.js";
import { notificationCleanService as notificationService } from "./notification.service.js";
import { ApiError } from "../utils/ApiError.js";
import bcrypt from "bcrypt";
import crypto from "crypto";

// Capital Tranche Service — business logic for capital tranches and backdating.
class CapitalTrancheService {

    // Add a capital tranche.
    async addCapitalTranche(data) {
        const { user_id, capital_amount, investment_date } = data;

        const investor = await userRepository.findById(user_id);
        if (!investor) throw ApiError.notFound("Investor not found");
        if (investor.status === -1) throw ApiError.badRequest("Investor is deleted");

        const nextNumber = await capitalTrancheRepository.getNextTrancheNumber(user_id);
        const trancheId = await capitalTrancheRepository.create({
            user_id,
            tranche_number: nextNumber,
            capital_amount,
            investment_date
        });

        // Update portfolio (simple add for both types as per legacy logic)
        const newPortfolioValue = parseFloat(investor.current_portfolio) + parseFloat(capital_amount);
        await userRepository.updateProfile(user_id, ["current_portfolio = ?"], [newPortfolioValue]);

        const allTranches = await capitalTrancheRepository.getAllByUserId(user_id);
        const totalCapital = allTranches.filter(t => t.status === 1).reduce((sum, t) => sum + parseFloat(t.capital_amount), 0);

        // Notification
        try {
            await notificationService.sendNotification({
                user_ids: [user_id],
                title: "Capital Tranche Added",
                message: `A new capital tranche of ${capital_amount} has been added.`,
                type: "capital_tranche",
                payload: { tranche_id: trancheId, new_portfolio_value: newPortfolioValue },
                send_push: true
            });
        } catch (err) { console.error(err); }

        return {
            tranche_id: trancheId,
            user_id,
            tranche_number: nextNumber,
            new_portfolio_value: newPortfolioValue,
            all_tranches: allTranches,
            total_capital: totalCapital
        };
    }

    // Create backdated investor.
    async createBackdatedInvestor(data, adminId) {
        const {
            f_name, l_name, email, initial_capital, currency, contract_start_date,
            historical_performance, temp_password, ...contractFields
        } = data;

        const existing = await userRepository.findByEmail(email);
        if (existing) throw ApiError.badRequest("Email already exists");

        // Prepare password
        const rawPassword = temp_password || crypto.randomBytes(6).toString('hex');
        const hashedPassword = await bcrypt.hash(rawPassword, 10);

        // Insert User
        // Note: initial values for contract_type, fixed_interest_rate, contract_end_date
        const userId = await userRepository.create({
            f_name, l_name, email, temp_password: hashedPassword, role: 1, status: 1, temp_signup: 1,
            initial_capital, current_portfolio: initial_capital, currency, contract_start_date,
            ...contractFields
        });

        if (!userId) throw ApiError.internal("Failed to create investor account");

        // Process historical performance
        historical_performance.sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));

        let currentVal = parseFloat(initial_capital);
        const performanceResults = [];

        for (const record of historical_performance) {
            const valBefore = currentVal;
            const valAfter = valBefore * (1 + parseFloat(record.profit_percentage) / 100);
            const profit = valAfter - valBefore;

            const perfId = await performanceRepository.addInvestorPerformance({
                user_id: userId,
                month: record.month,
                year: record.year,
                profit_percentage: record.profit_percentage,
                portfolio_value_before: valBefore,
                portfolio_value_after: valAfter,
                profit_amount: profit,
                notes: record.notes || 'Backdated performance data',
                added_by: adminId
            });

            if (perfId) {
                currentVal = valAfter;
                performanceResults.push({ ...record, performance_id: perfId, profit_amount: profit });
            }
        }

        // Final portfolio update
        await userRepository.updateProfile(userId, ["current_portfolio = ?"], [currentVal]);

        return {
            user_id: userId,
            temp_password: rawPassword,
            final_portfolio_value: currentVal,
            historical_performance: performanceResults
        };
    }

    // Validate backdating.
    async validateBackdating(startDate, endDate = null) {
        const start = new Date(startDate);
        const now = new Date();
        if (start >= now) throw ApiError.badRequest("Start date must be in the past");

        const required = [];
        let y = start.getFullYear(), m = start.getMonth() + 1;
        const cy = now.getFullYear(), cm = now.getMonth() + 1;

        while (y < cy || (y === cy && m < cm)) {
            m++;
            if (m > 12) { m = 1; y++; }
            if (y < cy || (y === cy && m <= cm)) required.push({ month: m, year: y });
        }

        const available = await performanceRepository.getFundPerformanceRange(
            start.getFullYear(), start.getMonth() + 1, cy, cm
        );

        const missing = required.filter(r => !available.find(a => a.month === r.month && a.year === r.year));

        return {
            validation: {
                total_required: required.length,
                available: available.length,
                missing: missing.length
            },
            missing_months: missing,
            can_proceed: missing.length === 0
        };
    }
}

const capitalTrancheService = new CapitalTrancheService();
export { capitalTrancheService, CapitalTrancheService };
