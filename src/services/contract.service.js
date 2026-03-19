import { contractRepository } from "../repositories/contract.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { capitalTrancheRepository } from "../repositories/capital-tranche.repository.js";
import { paymentSchedulingService } from "./payment-scheduling.service.js";
import { notificationCleanService as notificationService } from "./notification.service.js";
import { ApiError } from "../utils/ApiError.js";

// Contract Service — business logic for admin contract management.
class ContractService {

    // Update investor contract details.
    async updateInvestorContract(data) {
        const { user_id, ...updates } = data;

        const investor = await userRepository.findById(user_id);
        if (!investor) {
            throw ApiError.notFound("Investor not found");
        }

        if (investor.status === -1) {
            throw ApiError.badRequest("Cannot update deleted investor");
        }

        // Validate complex fields
        if (updates.contract_type !== undefined && ![0, 1].includes(parseInt(updates.contract_type))) {
            throw ApiError.badRequest("Invalid contract type");
        }

        if (updates.email) {
            const emailExists = await userRepository.findByEmail(updates.email);
            if (emailExists && emailExists.id !== user_id) {
                throw ApiError.badRequest("Email already exists for another user");
            }
        }

        // Construct dynamic update
        const updateFields = [];
        const params = [];
        const allowedFields = [
            'f_name', 'l_name', 'email', 'initial_capital', 'currency',
            'contract_start_date', 'contract_end_date', 'contract_type',
            'fixed_interest_rate', 'investment_day'
        ];

        for (const field of allowedFields) {
            if (data[field] !== undefined) {
                updateFields.push(`${field} = ?`);
                params.push(data[field]);
            }
        }

        if (updateFields.length === 0) {
            throw ApiError.badRequest("No fields to update");
        }

        const updated = await userRepository.updateProfile(user_id, updateFields, params);
        if (!updated) {
            throw ApiError.internal("Failed to update investor contract");
        }

        const updatedInvestor = await userRepository.findById(user_id, allowedFields.concat(['updated_at', 'id']));

        // Regenerate payment schedule if contract fields changed
        const contractChanged = ['contract_type', 'fixed_interest_rate', 'contract_end_date', 'investment_day', 'contract_start_date', 'initial_capital'].some(f => data[f] !== undefined);

        if (contractChanged) {
            try {
                await contractRepository.deletePaymentSchedulesByUserId(user_id);
                if (updatedInvestor.contract_start_date && updatedInvestor.contract_end_date &&
                    updatedInvestor.fixed_interest_rate && updatedInvestor.contract_type !== null) {

                    await paymentSchedulingService.generatePaymentSchedule(
                        user_id,
                        updatedInvestor.contract_start_date,
                        updatedInvestor.contract_end_date,
                        updatedInvestor.contract_type,
                        parseFloat(updatedInvestor.fixed_interest_rate),
                        parseFloat(updatedInvestor.initial_capital)
                    );
                }
            } catch (err) {
                console.error("Error regenerating schedule after contract update:", err);
            }
        }

        // Notification
        try {
            await notificationService.sendNotification({
                user_ids: [user_id],
                title: "Contract Updated",
                message: "Your investment contract details have been updated by admin.",
                type: "contract_update",
                type_id: user_id,
                payload: {
                    contract_type: updatedInvestor.contract_type,
                    fixed_interest_rate: updatedInvestor.fixed_interest_rate
                },
                send_push: true
            });
        } catch (err) {
            console.error("Error sending contract update notification:", err);
        }

        return { user_id, updated_investor: updatedInvestor };
    }

    // Get contracts approaching maturity.
    async getContractsApproachingMaturity(query) {
        const days_ahead = parseInt(query.days_ahead) || 30;
        const limit = parseInt(query.limit) || 50;
        const offset = parseInt(query.offset) || 0;

        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + days_ahead);
        const targetDateString = targetDate.toISOString().split('T')[0];

        const contracts = await contractRepository.getContractsApproachingMaturity({
            targetDate: targetDateString, limit, offset
        });

        const total = await contractRepository.getContractsApproachingMaturityCount(targetDateString);

        const formattedContracts = contracts.map(contract => ({
            ...contract,
            initial_capital: parseFloat(contract.initial_capital),
            current_portfolio: parseFloat(contract.current_portfolio),
            fixed_interest_rate: contract.fixed_interest_rate ? parseFloat(contract.fixed_interest_rate) : null,
            contract_type_text: contract.contract_type === 0 ? 'Monthly Payable' : 'Monthly Compounding'
        }));

        const totalPortfolioValue = formattedContracts.reduce((sum, c) => sum + c.current_portfolio, 0);

        return {
            contracts: formattedContracts,
            total,
            summary: {
                days_ahead,
                target_date: targetDateString,
                total_contracts: formattedContracts.length,
                total_portfolio_value: parseFloat(totalPortfolioValue.toFixed(6)),
                monthly_payable_count: formattedContracts.filter(c => c.contract_type === 0).length,
                compounding_count: formattedContracts.filter(c => c.contract_type === 1).length
            }
        };
    }

    // Manage contract maturity.
    async manageContractMaturity(data) {
        const { user_id, action, notes, ...extra } = data;

        const investor = await userRepository.findById(user_id);
        if (!investor) throw ApiError.notFound("Investor not found");
        if (!investor.contract_end_date) throw ApiError.badRequest("Investor has no contract end date");

        let result = {};
        switch (action) {
            case 'complete':
                await userRepository.updateProfile(user_id, ["status = 0"]);
                await contractRepository.cancelPendingPayments(user_id, 'Contract completed');
                result = { action: 'completed', final_portfolio: parseFloat(investor.current_portfolio) };
                break;

            case 'extend':
                if (!extra.new_end_date) throw ApiError.badRequest("New end date required");
                if (new Date(extra.new_end_date) <= new Date(investor.contract_end_date)) {
                    throw ApiError.badRequest("New end date must be after current end date");
                }
                await userRepository.updateProfile(user_id, ["contract_end_date = ?"], [extra.new_end_date]);
                await contractRepository.cancelPendingPayments(user_id, 'Contract extended - regenerating schedule');
                await paymentSchedulingService.generatePaymentSchedule(
                    user_id, investor.contract_start_date, extra.new_end_date,
                    investor.contract_type, parseFloat(investor.fixed_interest_rate), parseFloat(investor.current_portfolio)
                );
                result = { action: 'extended', new_end_date: extra.new_end_date };
                break;

            case 'renew':
                if (!extra.new_end_date) throw ApiError.badRequest("New end date required");
                const fields = ["contract_end_date = ?"];
                const params = [extra.new_end_date];

                if (extra.new_contract_type !== undefined) {
                    fields.push("contract_type = ?");
                    params.push(extra.new_contract_type);
                }
                if (extra.new_fixed_rate !== undefined) {
                    fields.push("fixed_interest_rate = ?");
                    params.push(extra.new_fixed_rate);
                }
                if (extra.new_initial_capital !== undefined) {
                    fields.push("initial_capital = ?", "current_portfolio = ?");
                    params.push(extra.new_initial_capital, extra.new_initial_capital);
                }

                await userRepository.updateProfile(user_id, fields, params);
                await contractRepository.deletePaymentSchedulesByUserId(user_id);

                const updated = await userRepository.findById(user_id, ['contract_start_date', 'contract_end_date', 'contract_type', 'fixed_interest_rate', 'initial_capital']);
                await paymentSchedulingService.generatePaymentSchedule(
                    user_id, updated.contract_start_date, updated.contract_end_date,
                    updated.contract_type, parseFloat(updated.fixed_interest_rate), parseFloat(updated.initial_capital)
                );
                result = { action: 'renewed', ...extra };
                break;

            default:
                throw ApiError.badRequest("Invalid action");
        }

        // Notification
        try {
            await notificationService.sendNotification({
                user_ids: [user_id],
                title: `Contract ${action.charAt(0).toUpperCase() + action.slice(1)}`,
                message: `Your contract has been ${action}.`,
                type: "contract_maturity",
                payload: { action, notes, ...result },
                send_push: true
            });
        } catch (err) { console.error(err); }

        return { user_id, action, ...result };
    }

    // Calculate performance with fixed rates.
    async calculatePerformanceWithFixedRates(data) {
        const { user_id, month, year, override_rate } = data;
        const investor = await userRepository.findById(user_id, [
            'f_name', 'l_name', 'initial_capital', 'current_portfolio',
            'contract_type', 'fixed_interest_rate', 'contract_start_date', 'contract_end_date'
        ]);
        if (!investor) throw ApiError.notFound("Investor not found");

        const fixedRate = override_rate !== undefined ? parseFloat(override_rate) / 100 : parseFloat(investor.fixed_interest_rate) / 100;
        if (!fixedRate || isNaN(fixedRate)) throw ApiError.badRequest("No fixed rate available");

        const tranches = await capitalTrancheRepository.getActiveByUserId(user_id);
        let totalPrincipal = parseFloat(investor.initial_capital);
        const targetDate = new Date(year, month - 1, 1);

        if (tranches && tranches.length > 0) {
            if (investor.contract_type === 0) {
                totalPrincipal = tranches.reduce((sum, t) => sum + parseFloat(t.capital_amount), 0);
            } else {
                totalPrincipal = parseFloat(investor.initial_capital);
                for (const t of tranches.slice(1)) {
                    const months = this.getMonthsDifference(t.contract_start_date, targetDate);
                    totalPrincipal += parseFloat(t.capital_amount) * Math.pow(1 + fixedRate, months);
                }
            }
        }

        let performanceResult = {};
        if (investor.contract_type === 0) {
            const monthlyPayment = totalPrincipal * fixedRate;
            performanceResult = {
                contract_type: 'Monthly Payable',
                principal_amount: totalPrincipal,
                monthly_payment: monthlyPayment,
                profit_amount: monthlyPayment
            };
        } else {
            const valBefore = totalPrincipal;
            const valAfter = valBefore * (1 + fixedRate);
            performanceResult = {
                contract_type: 'Monthly Compounding',
                principal_amount: valBefore,
                portfolio_value_before: valBefore,
                portfolio_value_after: valAfter,
                profit_amount: valAfter - valBefore
            };
        }

        return {
            user_id, investor_name: `${investor.f_name} ${investor.l_name}`, month, year,
            performance: performanceResult,
            contract_info: {
                contract_start_date: investor.contract_start_date,
                contract_end_date: investor.contract_end_date,
                months_since_investment: this.getMonthsDifference(investor.contract_start_date, targetDate)
            }
        };
    }

    getMonthsDifference(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
        if (end.getDate() < start.getDate()) months--;
        return months;
    }
}

const contractService = new ContractService();
export { contractService, ContractService };
