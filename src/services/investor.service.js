import { userRepository } from "../repositories/user.repository.js";
import { performanceRepository } from "../repositories/performance.repository.js";
import { capitalTrancheRepository } from "../repositories/capital-tranche.repository.js";
import { paymentRepository } from "../repositories/payment.repository.js";
import { bankDetailsRepository } from "../repositories/bank-details.repository.js";
import { notificationCleanService as notificationService } from "./notification.service.js";
import { ApiError } from "../utils/ApiError.js";

// Investor Service — business logic for investor-facing features.
class InvestorService {

    // Get investor dashboard data.
    async getDashboard(userId) {
        // [Existing dashboard logic kept unchanged]
        const investor = await userRepository.findById(userId, ["id", "f_name", "l_name", "initial_capital", "current_portfolio", "currency", "contract_start_date"]);
        if (!investor) throw ApiError.notFound("Investor not found");

        const latestPerf = await performanceRepository.getLatestInvestorPerformance(userId);

        const totalProfit = parseFloat(investor.current_portfolio) - parseFloat(investor.initial_capital);
        const totalProfitPercentage = investor.initial_capital > 0 ? (totalProfit / investor.initial_capital) * 100 : 0;

        const totalMonths = await performanceRepository.getTotalMonthsInvested(userId);

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
                months_invested: totalMonths
            }
        };
    }

    // Get investor by ID
    async getInvestorById(target_user_id) {
        // Get investor data
        const investor = await userRepository.findById(target_user_id);

        if (!investor) {
            throw ApiError.notFound("Investor not found");
        }

        // Get latest performance record for this user
        const latestPerformance = await performanceRepository.getLatestInvestorPerformance(target_user_id);

        // Calculate total metrics based on contract type
        let totalProfit, totalProfitPercentage;
        
        if (investor.contract_type === 0) {
            // Monthly payable: sum all monthly profits from performance records
            const totalProfitAmount = await performanceRepository.getTotalProfitAmount(target_user_id);
            totalProfit = parseFloat(totalProfitAmount);
            totalProfitPercentage = parseFloat(investor.initial_capital) > 0
                ? (totalProfit / parseFloat(investor.initial_capital)) * 100
                : 0;
        } else {
            // Monthly compounding: use current_portfolio - initial_capital
            totalProfit = parseFloat(investor.current_portfolio) - parseFloat(investor.initial_capital);
            totalProfitPercentage = parseFloat(investor.initial_capital) > 0
                ? (totalProfit / parseFloat(investor.initial_capital)) * 100
                : 0;
        }

        // Get total months invested
        const totalMonths = await performanceRepository.getTotalMonthsInvested(target_user_id);

        // Get all tranches for this investor
        const allTranches = await capitalTrancheRepository.getAllByUserId(target_user_id);

        const formattedTranches = Array.isArray(allTranches) ? allTranches.map(tranche => ({
            id: tranche.id,
            tranche_number: tranche.tranche_number,
            capital_amount: parseFloat(tranche.capital_amount),
            investment_date: tranche.investment_date,
            status: tranche.status,
            created_at: tranche.created_at
        })) : [];

        // Calculate total capital across all active tranches (status === 1)
        const totalCapital = formattedTranches
            .filter(tranche => tranche.status === 1)
            .reduce((sum, tranche) => sum + tranche.capital_amount, 0);

        return {
            investor: {
                id: investor.id,
                role: investor.role,
                profile_img: investor.profile_img,
                f_name: investor.f_name,
                l_name: investor.l_name,
                email: investor.email,
                initial_capital: parseFloat(investor.initial_capital),
                current_portfolio: parseFloat(investor.current_portfolio),
                currency: investor.currency,
                contract_type: investor.contract_type,
                contract_start_date: investor.contract_start_date,
                fixed_interest_rate: investor.fixed_interest_rate,
                contract_end_date: investor.contract_end_date,
                is_bank_details: investor.is_bank_details,
                email_verified: investor.email_verified,
                temp_signup: investor.temp_signup,
                status: investor.status,
                last_login_at: investor.last_login_at,
                created_at: investor.created_at,
                updated_at: investor.updated_at
            },
            current_month_profit: latestPerformance ? {
                amount: parseFloat(latestPerformance.profit_amount),
                percentage: parseFloat(latestPerformance.profit_percentage),
                month: latestPerformance.month,
                year: latestPerformance.year
            } : {
                amount: 0,
                percentage: 0,
                month: null,
                year: null
            },
            metrics: {
                total_profit: parseFloat(totalProfit.toFixed(2)),
                total_profit_percentage: parseFloat(totalProfitPercentage.toFixed(2)),
                months_invested: totalMonths
            },
            all_tranches: formattedTranches,
            total_capital: parseFloat(totalCapital.toFixed(2))
        };
    }


    // Get portfolio performance with contract type differentiation
    async getPortfolioPerformance(target_user_id) {
        // Get investor data with contract details
        const investor = await userRepository.findById(target_user_id);

        if (!investor) throw ApiError.notFound("Investor not found");

        // Get all capital tranches for this investor
        const tranches = await capitalTrancheRepository.getAllByUserId(target_user_id);

        // Get performance history
        const performanceHistory = await performanceRepository.getInvestorHistory(target_user_id, null, 12);

        // Calculate contract-specific display data
        let portfolioDisplay = {};
        const contractType = investor.contract_type;
        const fixedRate = parseFloat(investor.fixed_interest_rate || 0) / 100;
        const initialCapital = parseFloat(investor.initial_capital);
        const currentPortfolio = parseFloat(investor.current_portfolio);

        if (contractType === 0) {
            // Monthly Payable Contract Display
            
            // Calculate total capital including tranches
            let totalCapital = initialCapital;
            if (tranches && tranches.length > 0) {
                for (const tranche of tranches) {
                    if (tranche.status === 1) { // Active tranches only
                        totalCapital += parseFloat(tranche.capital_amount);
                    }
                }
            }

            // Fixed monthly payment amount based on contracted rate
            const monthlyPaymentAmount = totalCapital * fixedRate;

            // Get payment history to calculate cumulative payments
            const paymentStats = await paymentRepository.getInvestorPaymentStats(target_user_id) || { payment_count: 0, total_paid: 0 };

            portfolioDisplay = {
                contract_type: "Monthly Payable",
                locked_principal: parseFloat(totalCapital.toFixed(6)),
                monthly_payment_amount: parseFloat(monthlyPaymentAmount.toFixed(6)),
                total_payments_made: parseInt(paymentStats.payment_count),
                cumulative_total_paid: parseFloat(paymentStats.total_paid || 0),
                fixed_interest_rate: fixedRate,
                principal_breakdown: {
                    initial_capital: parseFloat(initialCapital.toFixed(6)),
                    additional_tranches: tranches.map(tranche => ({
                        tranche_number: tranche.tranche_number,
                        amount: parseFloat(tranche.capital_amount),
                        contract_start_date: tranche.contract_start_date,
                        status: tranche.status === 1 ? 'Active' : 'Inactive'
                    }))
                }
            };
        } else if (contractType === 1) {
            // Compounding Contract Display

            // Calculate months since investment
            const investmentDate = new Date(investor.contract_start_date);
            const currentDate = new Date();
            const monthsDiff = (currentDate.getFullYear() - investmentDate.getFullYear()) * 12 +
                (currentDate.getMonth() - investmentDate.getMonth());

            // Add tranches with their respective compound growth
            let compoundedValue = initialCapital;
            if (tranches && tranches.length > 0) {
                for (const tranche of tranches) {
                    if (tranche.status === 1) { // Active tranches only
                        const trancheDate = new Date(tranche.contract_start_date);
                        const trancheMonths = (currentDate.getFullYear() - trancheDate.getFullYear()) * 12 +
                            (currentDate.getMonth() - trancheDate.getMonth());

                        // Compound this tranche based on its investment duration
                        const trancheCompounded = parseFloat(tranche.capital_amount) * Math.pow(1 + fixedRate, trancheMonths);
                        compoundedValue += trancheCompounded - parseFloat(tranche.capital_amount);
                    }
                }
            }

            // Apply compound interest to initial capital
            const theoreticalValue = initialCapital * Math.pow(1 + fixedRate, monthsDiff);
            const totalGrowth = theoreticalValue - initialCapital;

            portfolioDisplay = {
                contract_type: "Monthly Compounding",
                growing_principal: parseFloat(currentPortfolio.toFixed(6)),
                theoretical_compound_value: parseFloat(theoreticalValue.toFixed(6)),
                total_compound_growth: parseFloat(totalGrowth.toFixed(6)),
                fixed_interest_rate: fixedRate,
                months_compounded: monthsDiff,
                compound_breakdown: {
                    initial_capital: parseFloat(initialCapital.toFixed(6)),
                    compound_growth_on_initial: parseFloat((theoreticalValue - initialCapital).toFixed(6)),
                    additional_tranches: tranches.map(tranche => {
                        const trancheDate = new Date(tranche.contract_start_date);
                        const trancheMonths = (currentDate.getFullYear() - trancheDate.getFullYear()) * 12 +
                            (currentDate.getMonth() - trancheDate.getMonth());
                        const trancheCompounded = parseFloat(tranche.capital_amount) * Math.pow(1 + fixedRate, trancheMonths);

                        return {
                            tranche_number: tranche.tranche_number,
                            original_amount: parseFloat(tranche.capital_amount),
                            compounded_value: parseFloat(trancheCompounded.toFixed(6)),
                            growth: parseFloat((trancheCompounded - parseFloat(tranche.capital_amount)).toFixed(6)),
                            contract_start_date: tranche.contract_start_date,
                            months_compounded: trancheMonths,
                            status: tranche.status === 1 ? 'Active' : 'Inactive'
                        };
                    })
                }
            };
        } else {
            // No contract type set or unknown type
            portfolioDisplay = {
                contract_type: "Not Set",
                current_portfolio: parseFloat(currentPortfolio.toFixed(6)),
                initial_capital: parseFloat(initialCapital.toFixed(6)),
                message: "Contract type not configured. Please contact administrator."
            };
        }

        // Contract maturity information
        let maturityInfo = null;
        if (investor.contract_end_date) {
            const endDate = new Date(investor.contract_end_date);
            const today = new Date();
            const isExpired = endDate <= today;
            const daysToMaturity = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

            maturityInfo = {
                contract_end_date: investor.contract_end_date,
                is_expired: isExpired,
                days_to_maturity: isExpired ? 0 : daysToMaturity,
                status: isExpired ? 'Expired' : 'Active'
            };
        }

        return {
            investor: {
                id: investor.id,
                name: `${investor.f_name} ${investor.l_name}`,
                email: investor.email,
                contract_start_date: investor.contract_start_date,
                currency: investor.currency
            },
            portfolio_display: portfolioDisplay,
            contract_maturity: maturityInfo,
            performance_history: performanceHistory.map(record => ({
                month: record.month,
                year: record.year,
                portfolio_value: parseFloat(record.portfolio_value),
                profit_amount: parseFloat(record.profit_amount),
                profit_percentage: parseFloat(record.profit_percentage),
                created_at: record.created_at
            })),
            tranches_summary: {
                total_tranches: tranches.length,
                active_tranches: tranches.filter(t => t.status === 1).length,
                total_additional_capital: tranches
                    .filter(t => t.status === 1)
                    .reduce((sum, t) => sum + parseFloat(t.capital_amount), 0)
            }
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
