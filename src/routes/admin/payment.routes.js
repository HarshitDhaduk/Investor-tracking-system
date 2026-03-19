import { Router } from "express";
import { paymentController } from "../../controllers/admin/payment.controller.js";

const router = Router();

// POST — generate payment schedule for investor
router.post("/generate-schedule", paymentController.generatePaymentSchedule);

// GET — get upcoming payments with pagination/filters
router.get("/upcoming", paymentController.getUpcomingPayments);

// POST — mark payment as paid
router.post("/mark-paid", paymentController.markPaymentAsPaid);

// GET — get payment history for specific investor
router.get("/history", paymentController.getInvestorPaymentHistory);

// POST — process overdue payments
router.post("/process-overdue", paymentController.processOverduePayments);

// POST — send payment reminders
router.post("/send-reminders", paymentController.sendPaymentReminders);

// POST — bulk process monthly payments
router.post("/bulk-process", paymentController.bulkProcessMonthlyPayments);

export default router;
