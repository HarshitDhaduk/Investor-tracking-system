import { paymentService } from "../../services/payment.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { validateRequest } from "../../utils/validateRequest.js";

// Payment Controller — thin HTTP handlers for admin payment operations.
class PaymentController {

    // POST /api/admin/generate-payment-schedule
    generatePaymentSchedule = catchAsync(async (req, res) => {
        validateRequest(req, ["user_id"]);
        const result = await paymentService.generatePaymentSchedule(req.body);
        return ApiResponse.success(res, result, "Payment schedule generated successfully");
    });

    // GET /api/admin/get-upcoming-payments
    getUpcomingPayments = catchAsync(async (req, res) => {
        const result = await paymentService.getUpcomingPayments(req.query);
        return ApiResponse.success(res, result, "Upcoming payments retrieved successfully");
    });

    // POST /api/admin/mark-payment-as-paid
    markPaymentAsPaid = catchAsync(async (req, res) => {
        validateRequest(req, ["payment_id"]);
        const result = await paymentService.markPaymentAsPaid(req.body);
        return ApiResponse.success(res, result, "Payment marked as paid successfully");
    });

    // GET /api/admin/get-investor-payment-history
    getInvestorPaymentHistory = catchAsync(async (req, res) => {
        validateRequest(req, ["user_id"], "query");
        const result = await paymentService.getInvestorPaymentHistory(req.query);
        return ApiResponse.success(res, result, "Payment history retrieved successfully");
    });

    // POST /api/admin/process-overdue-payments
    processOverduePayments = catchAsync(async (req, res) => {
        const result = await paymentService.processOverduePayments();
        return ApiResponse.success(res, result, "Overdue payments processed successfully");
    });

    // POST /api/admin/send-payment-reminders
    sendPaymentReminders = catchAsync(async (req, res) => {
        const result = await paymentService.sendPaymentReminders(req.body);
        return ApiResponse.success(res, result, "Payment reminders sent successfully");
    });

    // POST /api/admin/bulk-process-monthly-payments
    bulkProcessMonthlyPayments = catchAsync(async (req, res) => {
        validateRequest(req, ["month", "year"]);
        const result = await paymentService.bulkProcessMonthlyPayments({
            ...req.body,
            admin_id: req._id
        });
        return ApiResponse.success(res, result, "Monthly payments processed successfully");
    });
}

const paymentController = new PaymentController();
export { paymentController };
