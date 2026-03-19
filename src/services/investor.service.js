import { userRepository } from "../repositories/user.repository.js";
import { performanceRepository } from "../repositories/performance.repository.js";
import { bankDetailsRepository } from "../repositories/bank-details.repository.js";
import { paymentRepository } from "../repositories/payment.repository.js";
import { capitalTrancheRepository } from "../repositories/capital-tranche.repository.js";
import { notificationCleanService as notificationService } from "./notification.service.js";
import { ApiError } from "../utils/ApiError.js";
import * as perfUtils from "../utils/performance.utils.js";

// Investor Service — business logic for investor-facing features.
class InvestorService {

    // Get investor dashboard data.
    async getDashboard(userId) {
        const investor = await userRepository.findById(userId, ["id", "f_name", "l_name", "initial_capital", "current_portfolio", "currency", "contract_start_date"]);
        if (!investor) throw ApiError.notFound("Investor not found");

        const latestPerf = await performanceRepository.getLatestInvestorPerformance(userId);

        const totalProfit = parseFloat(investor.current_portfolio) - parseFloat(investor.initial_capital);
        const totalProfitPercentage = investor.initial_capital > 0 ? (totalProfit / investor.initial_capital) * 100 : 0;

        const history = await performanceRepository.getInvestorHistory(userId);

        return {
            investor,
            current_month_profit: latestPerf ? {
                amount: parseFloat(latestPerf.profit_amount),
                percentage: parseFloat(latestPerf.profit_percentage),
                month: latestPerf.month,
                year: latestPerf.year
            } : { amount: 0, percentage: 0, month: null, year: null },
            metrics: {
                total_profit: parseFloat(totalProfit.toFixed(2)),
                total_profit_percentage: parseFloat(totalProfitPercentage.toFixed(2)),
                months_invested: history.length
            }
        };
    }

    // Get portfolio performance details (contract-specific).
    async getPortfolioPerformance(userId) {
        const investor = await userRepository.findById(userId);
        if (!investor) throw ApiError.notFound("Investor not found");

        const tranches = await capitalTrancheRepository.getAllByUserId(userId);
        const activeTratches = tranches.filter(t => t.status === 1);

        const perfHistory = await performanceRepository.getInvestorHistory(userId);
        const paymentStats = await paymentRepository.getInvestorPaymentStats(userId);

        const initialCapital = parseFloat(investor.initial_capital);
        const currentPortfolio = parseFloat(investor.current_portfolio);
        const fixedRate = parseFloat(investor.fixed_interest_rate || 0) / 100;

        let portfolioDisplay = {
            contract_type: investor.contract_type === 0 ? "Monthly Payable" : "Monthly Compounding",
            initial_capital: initialCapital,
            current_portfolio: currentPortfolio,
            currency: investor.currency
        };

        if (investor.contract_type === 0) {
            const totalPrincipal = activeTratches.reduce((sum, t) => sum + parseFloat(t.capital_amount), initialCapital);
            portfolioDisplay.locked_principal = totalPrincipal;
            portfolioDisplay.monthly_payment_amount = totalPrincipal * fixedRate;
            portfolioDisplay.total_payments_made = paymentStats.payment_count;
            portfolioDisplay.cumulative_total_paid = parseFloat(paymentStats.total_paid);
        } else {
            // Compounding
            const months = perfUtils.getMonthsDifference(investor.contract_start_date, new Date());
            portfolioDisplay.months_since_investment = months;
            portfolioDisplay.theoretical_value = initialCapital * Math.pow(1 + fixedRate, months);
        }

        return {
            display: portfolioDisplay,
            tranches: activeTratches,
            performance_history: perfHistory.slice(0, 12)
        };
    }

    // Add bank details for a user.
    async addBankDetails(data, authenticatedUserId, role) {
        const targetUserId = role === 2 ? data.user_id : authenticatedUserId;

        const existing = await bankDetailsRepository.getLatestByUserId(targetUserId);
        if (existing && existing.status === 0) throw ApiError.badRequest("Pending bank details already exist");
        if (existing && existing.status === 1 && role !== 2) throw ApiError.badRequest("Approved bank details already exist, use update");

        const detailsId = await bankDetailsRepository.create({
            ...data,
            user_id: targetUserId,
            status: 0
        });

        await userRepository.updateProfile(targetUserId, ["is_bank_details = 1"], []);

        // Admin notification
        if (role !== 2) {
            const investor = await userRepository.findById(targetUserId, ["f_name", "l_name", "email"]);
            const adminIds = await notificationService.getAllAdminUserIds();
            if (adminIds.length > 0) {
                await notificationService.sendNotification({
                    user_ids: adminIds,
                    title: "Bank Details Submitted",
                    message: `${investor.f_name} ${investor.l_name} submitted bank details for review`,
                    type: "bank_details_submitted",
                    payload: { investor_id: targetUserId, details_id: detailsId },
                    send_push: true
                });
            }
        }

        return { details_id: detailsId, status: 0 };
    }

    // Update bank details for a user.
    async updateBankDetails(data, authenticatedUserId, role) {
        const targetUserId = role === 2 ? data.user_id : authenticatedUserId;

        const existing = await bankDetailsRepository.getLatestByUserId(targetUserId);
        if (!existing) throw ApiError.notFound("Bank details not found");
        if (existing.status === 1) throw ApiError.badRequest("Approved bank details cannot be updated");

        await bankDetailsRepository.updateBankDetailsData(existing.id, {
            ...data,
            status: 0
        });

        return { details_id: existing.id, status: 0 };
    }

    // Get latest bank details for a user.
    async getBankDetails(userId) {
        const details = await bankDetailsRepository.getLatestByUserId(userId);
        if (!details) throw ApiError.notFound("Bank details not found");
        return details;
    }
}

const investorService = new InvestorService();
export { investorService, InvestorService };
