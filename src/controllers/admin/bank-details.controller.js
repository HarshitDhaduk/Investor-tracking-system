import { bankDetailsService } from "../../services/bank-details.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { validateRequest } from "../../utils/validateRequest.js";

// Bank Details Controller — thin HTTP handlers.
class BankDetailsController {

    // GET /api/admin/bank-details/pending?count=0&limit=50&search=&status=
    getPendingBankDetails = catchAsync(async (req, res) => {
        const count = req.query.count ? parseInt(req.query.count) : 0;
        const limit = req.query.limit ? parseInt(req.query.limit) : 50;
        const search = req.query.search || null;
        const status = req.query.status !== undefined && req.query.status !== null && req.query.status !== ""
            ? parseInt(req.query.status) : null;

        const result = await bankDetailsService.getPendingBankDetails({ count, limit, search, status });
        return ApiResponse.success(res, result, "Bank details retrieved successfully");
    });

    // POST /api/admin/bank-details/review
    reviewBankDetails = catchAsync(async (req, res) => {
        validateRequest(req, ["bank_details_id", "action"]);

        const result = await bankDetailsService.reviewBankDetails(req._id, req.body);
        return ApiResponse.success(res, result, `Bank details ${result.action_label} successfully`);
    });
}

const bankDetailsController = new BankDetailsController();
export { bankDetailsController };
