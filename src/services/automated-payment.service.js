import { BaseRepository } from "../repositories/base.repository.js";
import { notificationCleanService as notificationService } from "./notification.service.js";

// Automated Payment Service processes scheduled payments
class AutomatedPaymentService extends BaseRepository {
    constructor() {
        super();
    }

    // Process overdue payments and send notifications
    async processOverduePayments() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const overduePayments = await this.select(
                `SELECT ps.*, u.f_name, u.l_name, u.email, u.contract_type
                 FROM payment_schedules ps
                 JOIN users u ON ps.user_id = u.id
                 WHERE ps.due_date < ? AND ps.status = 0
                 AND u.role = 1 AND u.status = 1`,
                [today]
            );

            if (!overduePayments || overduePayments.length === 0) {
                return { processed: 0, notifications_sent: 0 };
            }

            let processed = 0;
            let notificationsSent = 0;

            for (const payment of overduePayments) {
                const updated = await this.update(
                    "UPDATE payment_schedules SET status = 2, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    [payment.id]
                );

                if (updated) {
                    processed++;
                    try {
                        await notificationService.sendNotification({
                            user_ids: [payment.user_id],
                            title: "Payment Overdue",
                            message: `Your payment of $${parseFloat(payment.payment_amount).toFixed(2)} due on ${payment.due_date} is now overdue.`,
                            type: "payment_overdue",
                            type_id: payment.id,
                            payload: {
                                payment_id: payment.id,
                                payment_amount: parseFloat(payment.payment_amount),
                                due_date: payment.due_date,
                                days_overdue: Math.floor((new Date() - new Date(payment.due_date)) / (1000 * 60 * 60 * 24))
                            },
                            send_push: true
                        });
                        notificationsSent++;
                    } catch (notificationError) {
                        console.error(`Failed to send overdue notification for payment ${payment.id}:`, notificationError);
                    }
                }
            }

            return { processed, notifications_sent: notificationsSent, total_overdue: overduePayments.length };
        } catch (error) {
            console.error("Error processing overdue payments:", error);
            return { error: error.message };
        }
    }

    // Send upcoming payment reminders
    async sendUpcomingPaymentReminders(daysBefore = 7) {
        try {
            const reminderDate = new Date();
            reminderDate.setDate(reminderDate.getDate() + daysBefore);
            const targetDate = reminderDate.toISOString().split('T')[0];

            const upcomingPayments = await this.select(
                `SELECT ps.*, u.f_name, u.l_name, u.email, u.contract_type
                 FROM payment_schedules ps
                 JOIN users u ON ps.user_id = u.id
                 WHERE ps.due_date = ? AND ps.status = 0
                 AND u.role = 1 AND u.status = 1`,
                [targetDate]
            );

            if (!upcomingPayments || upcomingPayments.length === 0) {
                return { reminders_sent: 0 };
            }

            let remindersSent = 0;

            for (const payment of upcomingPayments) {
                try {
                    await notificationService.sendNotification({
                        user_ids: [payment.user_id],
                        title: "Payment Reminder",
                        message: `Reminder: Your payment of $${parseFloat(payment.payment_amount).toFixed(2)} is due on ${payment.due_date}.`,
                        type: "payment_reminder",
                        type_id: payment.id,
                        payload: {
                            payment_id: payment.id,
                            payment_amount: parseFloat(payment.payment_amount),
                            due_date: payment.due_date,
                            days_until_due: daysBefore
                        },
                        send_push: true
                    });
                    remindersSent++;
                } catch (notificationError) {
                    console.error(`Failed to send reminder for payment ${payment.id}:`, notificationError);
                }
            }

            return { reminders_sent: remindersSent, total_upcoming: upcomingPayments.length };
        } catch (error) {
            console.error("Error sending payment reminders:", error);
            return { error: error.message };
        }
    }

    // Bulk process payments for a specific month
    async bulkProcessMonthlyPayments(month, year, adminId) {
        try {
            const targetDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
            const nextMonth = new Date(year, month, 1).toISOString().split('T')[0];

            const monthlyPayments = await this.select(
                `SELECT ps.*, u.f_name, u.l_name, u.email, u.contract_type, u.current_portfolio
                 FROM payment_schedules ps
                 JOIN users u ON ps.user_id = u.id
                 WHERE ps.due_date >= ? AND ps.due_date < ?
                 AND ps.status = 0 AND u.role = 1 AND u.status = 1`,
                [targetDate, nextMonth]
            );

            if (!monthlyPayments || monthlyPayments.length === 0) {
                return { processed: 0, total_amount: 0 };
            }

            let processed = 0;
            let totalAmount = 0;
            const results = [];

            for (const payment of monthlyPayments) {
                try {
                    const updated = await this.update(
                        "UPDATE payment_schedules SET status = 1, paid_date = CURRENT_DATE, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                        [`Bulk processed by admin ${adminId}`, payment.id]
                    );

                    if (updated) {
                        processed++;
                        totalAmount += parseFloat(payment.payment_amount);

                        results.push({
                            payment_id: payment.id,
                            user_id: payment.user_id,
                            investor_name: `${payment.f_name} ${payment.l_name}`,
                            payment_amount: parseFloat(payment.payment_amount),
                            status: 'processed'
                        });

                        try {
                            await notificationService.sendNotification({
                                user_ids: [payment.user_id],
                                title: "Payment Processed",
                                message: `Your payment of $${parseFloat(payment.payment_amount).toFixed(2)} has been processed.`,
                                type: "payment_processed",
                                type_id: payment.id,
                                payload: {
                                    payment_id: payment.id,
                                    payment_amount: parseFloat(payment.payment_amount),
                                    processed_date: new Date().toISOString().split('T')[0]
                                },
                                send_push: true
                            });
                        } catch (notificationError) {
                            console.error(`Failed to send payment confirmation for ${payment.id}:`, notificationError);
                        }
                    }
                } catch (paymentError) {
                    console.error(`Error processing payment ${payment.id}:`, paymentError);
                    results.push({
                        payment_id: payment.id,
                        user_id: payment.user_id,
                        investor_name: `${payment.f_name} ${payment.l_name}`,
                        status: 'failed',
                        error: paymentError.message
                    });
                }
            }

            return {
                processed,
                total_amount: parseFloat(totalAmount.toFixed(2)),
                total_payments: monthlyPayments.length,
                results
            };
        } catch (error) {
            console.error("Error in bulk payment processing:", error);
            return { error: error.message };
        }
    }
}

const automatedPaymentService = new AutomatedPaymentService();
export { automatedPaymentService, AutomatedPaymentService };
