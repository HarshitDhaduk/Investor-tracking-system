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

    // GET /api/investor/portfolio
    getPortfolioPerformance = catchAsync(async (req, res) => {
        const targetUserId = req._role === 2 && req.query.user_id ? req.query.user_id : req._id;
        if (req._role !== 2 && req._id != targetUserId) {
            return ApiResponse.error(res, "Insufficient privileges to access this portfolio performance", 403);
        }
        const result = await investorService.getPortfolioPerformance(targetUserId);
        return ApiResponse.success(res, result, "Portfolio performance retrieved");
    });

    // GET /api/investor/by-id
    getInvestorById = catchAsync(async (req, res) => {
        const targetUserId = req.query.user_id;
        if (!targetUserId) {
            return ApiResponse.error(res, "User ID is required", 400);
        }
        if (req._role !== 2 && req._id != targetUserId) {
            return ApiResponse.error(res, "Insufficient privileges to access this user's data", 403);
        }
        const result = await investorService.getInvestorById(targetUserId);
        return ApiResponse.success(res, result, "Investor data retrieved successfully");
    });

    // GET /api/investor/performance/chart
    getPerformanceChart = catchAsync(async (req, res) => {
        const targetUserId = req._role === 2 && req.query.user_id ? req.query.user_id : req._id;
        if (req._role !== 2 && req._id != targetUserId) {
            return ApiResponse.error(res, "Insufficient privileges to access this data", 403);
        }
        // Reusing performanceService chart logic
        const result = await performanceService.getChartData({
            type: "individual",
            user_id: targetUserId,
            period: req.query.period,
            chart_type: req.query.chart_type
        });
        return ApiResponse.success(res, result, "Performance chart data retrieved successfully");
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

    // GET /api/investor/performance/history
    getPerformanceHistory = catchAsync(async (req, res) => {
        const targetUserId = req._role === 2 && req.query.user_id ? req.query.user_id : req._id;
        if (req._role !== 2 && req._id != targetUserId) {
            return ApiResponse.error(res, "Insufficient privileges to access this data", 403);
        }
        // Reusing performanceService history logic
        const result = await performanceService.getHistoricalRecords({ 
            type: "individual", 
            user_id: targetUserId,
            months: req.query.months,
            year: req.query.year
        });
        return ApiResponse.success(res, result, "Performance history retrieved");
    });
}

const investorController = new InvestorController();
export { investorController };
