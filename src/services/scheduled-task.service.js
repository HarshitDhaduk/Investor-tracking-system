import { automatedPaymentService } from "./automated-payment.service.js";

class ScheduledTaskService {
    constructor() {
        this.isRunning = false;
    }

    // Daily task to process overdue payments
    async runDailyPaymentTasks() {
        if (this.isRunning) {
            console.log("[ScheduledTaskService] Daily payment tasks already running, skipping...");
            return;
        }

        this.isRunning = true;
        console.log("[ScheduledTaskService] Starting daily payment tasks...");

        try {
            // Process overdue payments
            const overdueResult = await automatedPaymentService.processOverduePayments();
            console.log("[ScheduledTaskService] Overdue payments processed:", overdueResult);

            // Send 7-day reminders
            const reminderResult = await automatedPaymentService.sendUpcomingPaymentReminders(7);
            console.log("[ScheduledTaskService] Payment reminders sent (7-day):", reminderResult);

            // Send 3-day reminders
            const urgentReminderResult = await automatedPaymentService.sendUpcomingPaymentReminders(3);
            console.log("[ScheduledTaskService] Urgent payment reminders sent (3-day):", urgentReminderResult);

            console.log("[ScheduledTaskService] Daily payment tasks completed successfully");
        } catch (error) {
            console.error("[ScheduledTaskService] Error in daily payment tasks:", error);
        } finally {
            this.isRunning = false;
        }
    }

    // Start scheduled tasks (would integrate with cron or similar in production)
    startScheduledTasks() {
        console.log("[ScheduledTaskService] Payment scheduled tasks service initialized");
        
        // Run daily at 9 AM (this is a simple setInterval implementation, production should use cron)
        setInterval(() => {
            const now = new Date();
            if (now.getHours() === 9 && now.getMinutes() === 0) {
                this.runDailyPaymentTasks();
            }
        }, 60000); // Check every minute
    }
}

const scheduledTaskService = new ScheduledTaskService();
export { scheduledTaskService, ScheduledTaskService };
