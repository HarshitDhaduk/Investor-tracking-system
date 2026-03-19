import { investorService } from "../../services/investor.service.js";
import { performanceService } from "../../services/performance.service.js";
import { paymentService } from "../../services/payment.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { validateRequest } from "../../utils/validateRequest.js";

// Investor Controller — handles investor dashboard, profile, and history.
class InvestorController {

    // GET /api/investor/dashboard
    getDashboard = catchAsync(async (req, res) => {
        const result = await investorService.getDashboard(req._id);
        return ApiResponse.success(res, result, "Dashboard retrieved successfully");
    });

    // GET /api/investor/portfolio-performance
    getPortfolioPerformance = catchAsync(async (req, res) => {
        const result = await investorService.getPortfolioPerformance(req._id);
        return ApiResponse.success(res, result, "Portfolio performance retrieved");
    });

    // GET /api/investor/bank-details/get
    getBankDetails = catchAsync(async (req, res) => {
        const result = await investorService.getBankDetails(req._id);
        return ApiResponse.success(res, result, "Bank details retrieved successfully");
    });

    // POST /api/investor/bank-details/add
    addBankDetails = catchAsync(async (req, res) => {
        validateRequest(req, ["account_holder_name", "bank_name", "account_number"]);
        const result = await investorService.addBankDetails(req.body, req._id, req._role);
        return ApiResponse.success(res, result, "Bank details submitted for review");
    });

    // PUT /api/investor/bank-details/update
    updateBankDetails = catchAsync(async (req, res) => {
        const result = await investorService.updateBankDetails(req.body, req._id, req._role);
        return ApiResponse.success(res, result, "Bank details updated successfully");
    });

    // GET /api/investor/history
    getHistory = catchAsync(async (req, res) => {
        // Reusing performanceService history logic
        const result = await performanceService.getHistoricalRecords({ type: "individual", user_id: req._id });
        return ApiResponse.success(res, result, "Performance history retrieved");
    });
}

const investorController = new InvestorController();
export { investorController };
