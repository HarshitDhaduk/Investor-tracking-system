import { investorManagementRepository } from "../repositories/investor-management.repository.js";
import { mailService as mail } from "./mail.service.js";
import { notificationCleanService as notificationService } from "./notification.service.js";
import { generateStrongPassword, encryptPassword } from "../utils/crypto.utils.js";
import { ApiError } from "../utils/ApiError.js";

// Investor Management Service — business logic for admin investor operations.
class InvestorManagementService {

    // Generate a secure temporary password.
    generateTempPassword() {
        return { temp_password: generateStrongPassword(12) };
    }

    // Regenerate temporary password for an existing investor.
    async regenerateTempPassword({ user_id, temp_password }) {
        const user = await investorManagementRepository.findInvestorById(user_id);
        if (!user) {
            throw ApiError.notFound("Investor not found");
        }

        if (user.temp_signup !== 1) {
            throw ApiError.badRequest("Cannot regenerate password - investor has already set permanent password");
        }

        const finalTempPassword = temp_password || generateStrongPassword(12);
        const hashedPassword = encryptPassword(finalTempPassword);

        const updated = await investorManagementRepository.updateTempPassword(user_id, hashedPassword);
        if (!updated) {
            throw ApiError.internal("Failed to regenerate temporary password");
        }

        // Send email with new credentials
        const emailSent = await mail.sendMail({
            to: user.email,
            subject: "Your New Temporary Password",
            templateName: "investor_temp_creds",
            data: {
                name: `${user.f_name} ${user.l_name}`,
                email: user.email,
                temp_password: finalTempPassword,
            },
        });

        if (!emailSent) {
            console.log("Warning: Failed to send new credentials email to", user.email);
        }

        return {
            user_id: user.id,
            temp_password: finalTempPassword,
            email_sent: emailSent,
        };
    }

    // Create a new investor account with temporary credentials.
    async createInvestor(body) {
        const { f_name, l_name, email, initial_capital,
            contract_type, fixed_interest_rate, contract_start_date,
            contract_end_date, temp_password } = body;

        // Duplicate email check
        const existingUser = await investorManagementRepository.findByEmailNonDeleted(email);
        if (existingUser) {
            throw ApiError.badRequest("Email already exists");
        }

        // Validate initial capital
        const initialCapitalAmount = parseFloat(initial_capital);
        if (isNaN(initialCapitalAmount) || initialCapitalAmount <= 0) {
            throw ApiError.badRequest("Invalid initial capital amount");
        }

        // Validate mandatory contract fields
        if (fixed_interest_rate === undefined || fixed_interest_rate === null || fixed_interest_rate === "") {
            throw ApiError.badRequest("Fixed interest rate is required");
        }

        // Validate optional contract fields
        const validated = this._validateContractFields({
            contract_type, fixed_interest_rate, contract_start_date,
            contract_end_date
        });

        // Generate strong password internally
        const finalTempPassword = temp_password || generateStrongPassword(12);
        const hashedTempPassword = encryptPassword(finalTempPassword);

        const userId = await investorManagementRepository.createInvestor({
            f_name, l_name, email,
            hashed_temp_password: hashedTempPassword,
            initial_capital: initialCapitalAmount,
            contract_type: validated.contractType,
            fixed_interest_rate: validated.fixedInterestRate,
            contract_start_date: validated.contractStartDate,
            contract_end_date: validated.contractEndDate,
            investment_day: validated.investmentDay,
        });

        if (!userId) {
            throw ApiError.internal("Failed to create investor account");
        }

        // Send credentials email
        const emailSent = await mail.sendMail({
            to: email,
            subject: "Welcome to Morval Universal - Your Temporary Credentials",
            templateName: "investor_temp_creds",
            data: { name: `${f_name} ${l_name}`, email, temp_password: finalTempPassword },
        });

        if (!emailSent) {
            console.log("Warning: Failed to send credentials email to", email);
        }

        return {
            user_id: userId,
            f_name, l_name, email,
            temp_password: finalTempPassword,
            initial_capital: parseFloat(initialCapitalAmount.toFixed(6)),
            contract_type: validated.contractType,
            fixed_interest_rate: validated.fixedInterestRate,
            contract_start_date: validated.contractStartDate,
            contract_end_date: validated.contractEndDate,
            investment_day: validated.investmentDay,
            email_sent: emailSent,
        };
    }

    // Get all investors with metrics, filters, and pagination.
    async getAllInvestors({ search, count, limit, status }) {
        const { investors, total, filter } = await investorManagementRepository.getInvestors({
            status, search, offset: count, limit,
        });

        const formattedInvestors = [];
        if (Array.isArray(investors)) {
            for (const investor of investors) {
                let totalProfit, totalProfitPercentage;

                if (investor.contract_type === 0) {
                    // Monthly payable: sum from performance records
                    const profitSum = await investorManagementRepository.getProfitSum(investor.id);
                    totalProfit = parseFloat(profitSum?.total_profit || 0);
                    totalProfitPercentage = parseFloat(investor.initial_capital) > 0
                        ? (totalProfit / parseFloat(investor.initial_capital)) * 100 : 0;
                } else {
                    // Monthly compounding: portfolio - initial
                    totalProfit = parseFloat(investor.current_portfolio) - parseFloat(investor.initial_capital);
                    totalProfitPercentage = parseFloat(investor.initial_capital) > 0
                        ? (totalProfit / parseFloat(investor.initial_capital)) * 100 : 0;
                }

                const monthsInvested = await investorManagementRepository.getPerformanceCount(investor.id);

                formattedInvestors.push({
                    id: investor.id,
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
                    status: investor.status,
                    temp_signup: investor.temp_signup,
                    created_at: investor.created_at,
                    updated_at: investor.updated_at,
                    metrics: {
                        total_profit: parseFloat(totalProfit.toFixed(2)),
                        total_profit_percentage: parseFloat(totalProfitPercentage.toFixed(2)),
                        months_invested: monthsInvested.total || 0,
                    },
                });
            }
        }

        return {
            investors: formattedInvestors,
            total,
            filters_applied: {
                status: filter !== null ? filter : "!= -1 (default)",
                search: search || null,
                offset: count,
                limit,
            },
        };
    }

    // Get lightweight investor names with filters.
    async getAllInvestorNames({ search, count, limit, status }) {
        const { investorNames, total, filter } = await investorManagementRepository.getInvestorNames({
            status, search, offset: count, limit,
        });

        const formattedNames = Array.isArray(investorNames) ? investorNames.map(inv => ({
            id: inv.id,
            f_name: inv.f_name,
            l_name: inv.l_name,
            full_name: `${inv.f_name} ${inv.l_name}`,
            email: inv.email,
        })) : [];

        return {
            investor_names: formattedNames,
            total,
            filters_applied: {
                status: filter !== null ? filter : "!= -1 (default)",
                search: search || null,
                offset: count,
                limit,
            },
        };
    }

    // Update investor status (activate, disable, or soft-delete).
    async updateInvestorStatus({ user_id, status, reason }) {
        const statusValue = parseInt(status);
        if (![0, 1, -1].includes(statusValue)) {
            throw ApiError.badRequest("Invalid status. Must be 0 (disabled), 1 (active), or -1 (deleted)");
        }

        const investor = await investorManagementRepository.findInvestorById(user_id);
        if (!investor) {
            throw ApiError.notFound("Investor not found");
        }

        const updated = await investorManagementRepository.updateInvestorStatus(user_id, statusValue);
        if (!updated) {
            throw ApiError.internal("Failed to update investor status");
        }

        // Build notification based on status
        let notificationTitle = "", notificationMessage = "", emailTemplate = null;
        switch (statusValue) {
            case 1:
                notificationTitle = "Account Activated";
                notificationMessage = "Your investor account has been activated.";
                break;
            case 0:
                notificationTitle = "Account Disabled";
                notificationMessage = reason ? `Your account has been disabled. Reason: ${reason}` : "Your account has been disabled.";
                break;
            case -1:
                notificationTitle = "Account Deleted";
                notificationMessage = reason ? `Your account has been deleted. Reason: ${reason}` : "Your account has been deleted.";
                emailTemplate = "account_deleted";
                break;
        }

        try {
            await notificationService.sendNotification({
                user_ids: [user_id],
                title: notificationTitle,
                message: notificationMessage,
                type: "account_status",
                type_id: user_id,
                payload: { status: statusValue, reason: reason || null },
                email_template: emailTemplate,
                email_data: {
                    name: `${investor.f_name} ${investor.l_name}`,
                    reason: reason || "No specific reason provided",
                },
                send_push: true,
            });
        } catch (err) {
            console.error("Error sending status change notification:", err);
        }

        return {
            user_id,
            old_status: investor.status,
            new_status: statusValue,
            reason: reason || null,
        };
    }

    // Validate optional contract fields (private helper).
    _validateContractFields({ contract_type, fixed_interest_rate, contract_start_date, contract_end_date }) {
        let contractType = null, fixedInterestRate = null;
        let contractStartDate = null, contractEndDate = null, investmentDay = null;

        if (contract_type !== undefined && contract_type !== null && contract_type !== "") {
            contractType = parseInt(contract_type);
            if (![0, 1].includes(contractType)) {
                throw ApiError.badRequest("Invalid contract type. Must be 0 (monthly payable) or 1 (monthly compounding)");
            }
        }

        if (fixed_interest_rate !== undefined && fixed_interest_rate !== null && fixed_interest_rate !== "") {
            fixedInterestRate = parseFloat(fixed_interest_rate);
            if (isNaN(fixedInterestRate) || fixedInterestRate <= 0) {
                throw ApiError.badRequest("Invalid fixed interest rate");
            }
        }

        if (contract_start_date !== undefined && contract_start_date !== null && contract_start_date !== "") {
            const d = new Date(contract_start_date);
            if (isNaN(d.getTime())) throw ApiError.badRequest("Invalid contract start date");
            if (d.getFullYear() < 2010) throw ApiError.badRequest("Contract start date cannot be before year 2010");
            contractStartDate = d.toISOString().split("T")[0];
            
            // Automatically derive investment_day from contract_start_date
            investmentDay = d.getDate();
        }

        if (contract_end_date !== undefined && contract_end_date !== null && contract_end_date !== "") {
            const d = new Date(contract_end_date);
            if (isNaN(d.getTime())) throw ApiError.badRequest("Invalid contract end date");
            if (d.getFullYear() > 2050) throw ApiError.badRequest("Contract end date cannot be after year 2050");
            contractEndDate = d.toISOString().split("T")[0];
        }

        return { contractType, fixedInterestRate, contractStartDate, contractEndDate, investmentDay };
    }
}

const investorManagementService = new InvestorManagementService();
export { investorManagementService, InvestorManagementService };
