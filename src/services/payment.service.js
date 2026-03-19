import { paymentRepository } from "../repositories/payment.repository.js";
import { investorManagementRepository } from "../repositories/investor-management.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { paymentSchedulingService } from "./payment-scheduling.service.js";
import { automatedPaymentService } from "./automated-payment.service.js";
import { notificationCleanService as notificationService } from "./notification.service.js";
import { ApiError } from "../utils/ApiError.js";

// Payment Service — business logic for admin payment operations.
class PaymentService {

    // Generate payment schedule for an investor.
    async generatePaymentSchedule({ user_id, force_regenerate }) {
        const investor = await investorManagementRepository.findInvestorById(user_id);
        if (!investor) {
            throw ApiError.notFound("Investor not found");
        }

        // Get full details including contract info (fields from old controller)
        const fullInvestor = await userRepository.findById(user_id, [
            "contract_start_date", "contract_end_date", "contract_type",
            "fixed_interest_rate", "initial_capital", "current_portfolio", "f_name", "l_name"
        ]);

        // Validate required contract data
        if (!fullInvestor.contract_start_date || !fullInvestor.contract_end_date ||
            fullInvestor.fixed_interest_rate === null || fullInvestor.contract_type === null) {
            throw ApiError.badRequest("Investor contract is incomplete. Missing investment date, contract end date, fixed rate, or contract type");
        }

        // Check for existing schedule
        const existingCount = await paymentRepository.getCountByUserId(user_id);
        if (existingCount.count > 0 && !force_regenerate) {
            throw ApiError.badRequest("Payment schedule already exists. Use force_regenerate=true to recreate");
        }

        // Delete existing if force regenerating
        if (force_regenerate && existingCount.count > 0) {
            await paymentRepository.deleteByUserId(user_id);
        }

        // Delegate generation to legacy service logic
        const scheduleGenerated = await paymentSchedulingService.generatePaymentSchedule(
            user_id,
            fullInvestor.contract_start_date,
            fullInvestor.contract_end_date,
            fullInvestor.contract_type,
            parseFloat(fullInvestor.fixed_interest_rate),
            parseFloat(fullInvestor.current_portfolio)
        );

        if (!scheduleGenerated) {
            throw ApiError.badRequest("Failed to generate payment schedule");
        }

        const generatedSchedule = await paymentRepository.getByUserId(user_id);

        const formattedSchedule = generatedSchedule.map(payment => ({
            id: payment.id,
            due_date: payment.due_date,
            payment_amount: parseFloat(payment.payment_amount),
            payment_type: payment.payment_type,
            payment_type_text: payment.payment_type === 0 ? 'Monthly Interest' : 'Compound Maturity',
            principal_amount: parseFloat(payment.principal_amount),
            status: payment.status,
            status_text: payment.status === 0 ? 'Pending' : payment.status === 1 ? 'Paid' : 'Overdue',
            created_at: payment.created_at
        }));

        const totalPayments = formattedSchedule.reduce((sum, payment) => sum + payment.payment_amount, 0);
        const pendingPayments = formattedSchedule.filter(p => p.status === 0).length;

        return {
            user_id,
            investor_name: `${fullInvestor.f_name} ${fullInvestor.l_name}`,
            contract_details: {
                contract_start_date: fullInvestor.contract_start_date,
                contract_end_date: fullInvestor.contract_end_date,
                contract_type: fullInvestor.contract_type,
                contract_type_text: fullInvestor.contract_type === 0 ? 'Monthly Payable' : 'Monthly Compounding',
                fixed_interest_rate: parseFloat(fullInvestor.fixed_interest_rate),
                principal_amount: parseFloat(fullInvestor.current_portfolio)
            },
            payment_schedule: formattedSchedule,
            summary: {
                total_payments_count: formattedSchedule.length,
                total_payment_amount: parseFloat(totalPayments.toFixed(2)),
                pending_payments_count: pendingPayments,
                force_regenerated: !!(force_regenerate && existingCount.count > 0)
            }
        };
    }

    // Get upcoming payments with filters.
    async getUpcomingPayments(query) {
        const limit = parseInt(query.limit) || 50;
        const offset = parseInt(query.offset) || 0;
        const startDate = query.start_date || null;
        const endDate = query.end_date || null;
        const status = query.status !== undefined ? parseInt(query.status) : null;
        const userId = query.user_id ? parseInt(query.user_id) : null;

        const payments = await paymentRepository.getUpcomingPayments({
            limit, offset, startDate, endDate, status, userId
        });

        const total = await paymentRepository.getUpcomingPaymentsCount({
            startDate, endDate, status, userId
        });

        const formattedPayments = payments.map(payment => ({
            id: payment.id,
            user_id: payment.user_id,
            investor_name: `${payment.f_name} ${payment.l_name}`,
            investor_email: payment.email,
            due_date: payment.due_date,
            payment_amount: parseFloat(payment.payment_amount),
            payment_type: payment.payment_type,
            payment_type_text: payment.payment_type === 0 ? 'Monthly Interest' : 'Compound Maturity',
            principal_amount: parseFloat(payment.principal_amount),
            status: payment.status,
            status_text: payment.status === 0 ? 'Pending' : payment.status === 1 ? 'Paid' : 'Overdue',
            paid_date: payment.paid_date,
            notes: payment.notes,
            contract_type: payment.contract_type,
            contract_type_text: payment.contract_type === 0 ? 'Monthly Payable' : 'Monthly Compounding',
            fixed_interest_rate: parseFloat(payment.fixed_interest_rate),
            created_at: payment.created_at
        }));

        const totalAmount = formattedPayments.reduce((sum, payment) => sum + payment.payment_amount, 0);
        const pendingCount = formattedPayments.filter(p => p.status === 0).length;
        const paidCount = formattedPayments.filter(p => p.status === 1).length;
        const overdueCount = formattedPayments.filter(p => p.status === 2).length;

        return {
            payments: formattedPayments,
            pagination: {
                total,
                limit,
                offset,
                current_count: formattedPayments.length
            },
            summary: {
                total_amount: parseFloat(totalAmount.toFixed(2)),
                pending_count: pendingCount,
                paid_count: paidCount,
                overdue_count: overdueCount
            },
            filters_applied: {
                start_date: startDate,
                end_date: endDate,
                status,
                user_id: userId
            }
        };
    }

    // Mark payment as paid and update portfolio.
    async markPaymentAsPaid({ payment_id, paid_date, notes }) {
        const payment = await paymentRepository.findByIdWithInvestor(payment_id);
        if (!payment) {
            throw ApiError.notFound("Payment not found");
        }

        if (payment.status === 1) {
            throw ApiError.badRequest("Payment is already marked as paid");
        }

        const finalPaidDate = paid_date || new Date().toISOString().split('T')[0];
        const marked = await paymentSchedulingService.markPaymentAsPaid(payment_id, finalPaidDate, notes);

        if (!marked) {
            throw ApiError.internal("Failed to mark payment as paid");
        }

        // Update portfolio
        let portfolioUpdateResult = null;
        try {
            portfolioUpdateResult = await this.updateInvestorPortfolioAfterPayment(payment);
        } catch (err) {
            console.error("Error updating investor portfolio after payment:", err);
        }

        // Notification
        try {
            await notificationService.sendNotification({
                user_ids: [payment.user_id],
                title: "Payment Received",
                message: `Your payment of $${payment.payment_amount} due on ${payment.due_date} has been received and processed.`,
                type: "payment_received",
                type_id: payment_id,
                payload: {
                    payment_id,
                    payment_amount: parseFloat(payment.payment_amount),
                    due_date: payment.due_date,
                    paid_date: finalPaidDate,
                    notes: notes || null,
                    contract_type: payment.contract_type
                },
                send_push: true
            });
        } catch (err) {
            console.error("Error sending payment notification:", err);
        }

        return {
            payment_id,
            user_id: payment.user_id,
            investor_name: `${payment.f_name} ${payment.l_name}`,
            payment_amount: parseFloat(payment.payment_amount),
            due_date: payment.due_date,
            paid_date: finalPaidDate,
            notes: notes || null,
            contract_type: payment.contract_type,
            portfolio_update: portfolioUpdateResult
        };
    }

    // Get payment history for an investor.
    async getInvestorPaymentHistory(queryParams) {
        const { user_id, status } = queryParams;
        const limit = parseInt(queryParams.limit) || 50;
        const offset = parseInt(queryParams.offset) || 0;
        const statusValue = status !== undefined ? parseInt(status) : null;

        const investor = await investorManagementRepository.findInvestorById(user_id);
        if (!investor) {
            throw ApiError.notFound("Investor not found");
        }

        // Get full details for response
        const fullInvestor = await userRepository.findById(user_id, [
            "f_name", "l_name", "email", "contract_type", "fixed_interest_rate",
            "initial_capital", "current_portfolio"
        ]);

        const payments = await paymentRepository.getPaymentHistory({
            userId: user_id, status: statusValue, limit, offset
        });

        const summary = await paymentRepository.getInvestorPaymentSummary(user_id);

        const formattedPayments = payments.map(payment => ({
            id: payment.id,
            due_date: payment.due_date,
            payment_amount: parseFloat(payment.payment_amount),
            payment_type: payment.payment_type,
            payment_type_text: payment.payment_type === 0 ? 'Monthly Interest' : 'Compound Maturity',
            status: payment.status,
            status_text: payment.status === 0 ? 'Pending' : payment.status === 1 ? 'Paid' : 'Overdue',
            paid_date: payment.paid_date,
            notes: payment.notes,
            created_at: payment.created_at
        }));

        return {
            investor: {
                id: user_id,
                name: `${fullInvestor.f_name} ${fullInvestor.l_name}`,
                email: fullInvestor.email,
                contract_type: fullInvestor.contract_type,
                contract_type_text: fullInvestor.contract_type === 0 ? 'Monthly Payable' : 'Monthly Compounding',
                fixed_interest_rate: parseFloat(fullInvestor.fixed_interest_rate),
                initial_capital: parseFloat(fullInvestor.initial_capital),
                current_portfolio: parseFloat(fullInvestor.current_portfolio)
            },
            payment_history: formattedPayments,
            summary: {
                total_payments: parseInt(summary.total_payments || 0),
                total_paid: parseFloat((parseFloat(summary.total_paid || 0)).toFixed(2)),
                total_pending: parseFloat((parseFloat(summary.total_pending || 0)).toFixed(2)),
                payments_made: parseInt(summary.payments_made || 0),
                payments_pending: parseInt(summary.payments_pending || 0)
            },
            pagination: { limit, offset, current_count: formattedPayments.length }
        };
    }

    // Process overdue payments.
    async processOverduePayments() {
        const result = await automatedPaymentService.processOverduePayments();
        if (result.error) {
            throw ApiError.internal("Failed to process overdue payments: " + result.error);
        }
        return {
            processed_count: result.processed,
            notifications_sent: result.notifications_sent,
            total_overdue: result.total_overdue,
            processed_at: new Date().toISOString()
        };
    }

    // Send upcoming payment reminders.
    async sendPaymentReminders({ days_before }) {
        const daysBefore = days_before ? parseInt(days_before) : 7;
        const result = await automatedPaymentService.sendUpcomingPaymentReminders(daysBefore);
        if (result.error) {
            throw ApiError.internal("Failed to send payment reminders: " + result.error);
        }
        return {
            reminders_sent: result.reminders_sent,
            total_upcoming: result.total_upcoming,
            days_before: daysBefore,
            sent_at: new Date().toISOString()
        };
    }

    // Bulk process monthly interest payments.
    async bulkProcessMonthlyPayments({ month, year, admin_id }) {
        const monthNum = parseInt(month);
        const yearNum = parseInt(year);

        if (monthNum < 1 || monthNum > 12) {
            throw ApiError.badRequest("Invalid month. Must be between 1 and 12");
        }

        const result = await automatedPaymentService.bulkProcessMonthlyPayments(monthNum, yearNum, admin_id);
        if (result.error) {
            throw ApiError.internal("Failed to bulk process monthly payments: " + result.error);
        }

        return {
            month: monthNum,
            year: yearNum,
            processed_count: result.processed,
            total_amount: result.total_amount,
            total_payments: result.total_payments,
            success_rate: result.total_payments > 0 ? ((result.processed / result.total_payments) * 100).toFixed(2) + '%' : '0%',
            processed_at: new Date().toISOString(),
            detailed_results: result.results
        };
    }

    // Helper to update portfolio (ported from old controller)
    async updateInvestorPortfolioAfterPayment(payment) {
        const { contract_type, user_id, payment_amount, current_portfolio, initial_capital } = payment;
        let newPortfolioValue = parseFloat(current_portfolio);
        let updateReason = "";

        if (contract_type === 0) {
            newPortfolioValue = parseFloat(initial_capital);
            updateReason = "Monthly payable - portfolio locked at initial capital";
        } else if (contract_type === 1) {
            updateReason = "Compounding - portfolio value maintained (grows with performance entries)";
        }

        const updated = await userRepository.updateProfile(user_id, ["current_portfolio = ?"], [newPortfolioValue]);
        if (!updated) {
            throw ApiError.internal("Failed to update investor portfolio");
        }

        const totalPaid = await paymentRepository.getTotalPaidAmount(user_id);

        return {
            previous_portfolio: parseFloat(current_portfolio),
            new_portfolio: newPortfolioValue,
            update_reason: updateReason,
            total_payments_made: totalPaid,
            payment_amount: parseFloat(payment_amount)
        };
    }

}

const paymentService = new PaymentService();
export { paymentService, PaymentService };
