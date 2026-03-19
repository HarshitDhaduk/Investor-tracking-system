import { investorManagementService } from "../../services/investor-management.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { validateRequest } from "../../utils/validateRequest.js";

// Investor Management Controller — thin HTTP handlers for admin investor operations.
class InvestorManagementController {

    // GET /api/admin/generate-temp-password
    generateTempPassword = catchAsync(async (req, res) => {
        const result = investorManagementService.generateTempPassword();
        return ApiResponse.success(res, result, "Temporary password generated successfully");
    });

    // POST /api/admin/regenerate-temp-password
    regenerateTempPassword = catchAsync(async (req, res) => {
        validateRequest(req, ["user_id"]);
        const result = await investorManagementService.regenerateTempPassword(req.body);
        return ApiResponse.success(res, result, "Temporary password regenerated successfully");
    });

    // POST /api/admin/create-investor
    createInvestor = catchAsync(async (req, res) => {
        validateRequest(req, ["f_name", "l_name", "email", "initial_capital", "contract_start_date", "fixed_interest_rate"]);
        const result = await investorManagementService.createInvestor(req.body);
        return ApiResponse.success(res, result, "Investor account created successfully");
    });

    // GET /api/admin/get-all-investors
    getAllInvestors = catchAsync(async (req, res) => {
        const search = req.query.search || null;
        const count = req.query.count ? parseInt(req.query.count) : 0;
        const limit = req.query.limit ? parseInt(req.query.limit) : 50;
        const status = req.query.status !== undefined && req.query.status !== null && req.query.status !== ""
            ? parseInt(req.query.status) : null;

        const result = await investorManagementService.getAllInvestors({ search, count, limit, status });
        return ApiResponse.success(res, result, "Investors retrieved successfully");
    });

    // GET /api/admin/get-all-investor-names
    getAllInvestorNames = catchAsync(async (req, res) => {
        const search = req.query.search || null;
        const count = req.query.count ? parseInt(req.query.count) : 0;
        const limit = req.query.limit ? parseInt(req.query.limit) : 100;
        const status = req.query.status !== undefined && req.query.status !== null && req.query.status !== ""
            ? parseInt(req.query.status) : null;

        const result = await investorManagementService.getAllInvestorNames({ search, count, limit, status });
        return ApiResponse.success(res, result, "Investor names retrieved successfully");
    });

    // PUT /api/admin/update-investor-status
    updateInvestorStatus = catchAsync(async (req, res) => {
        validateRequest(req, ["user_id", "status"]);
        const result = await investorManagementService.updateInvestorStatus(req.body);
        return ApiResponse.success(res, result, "Investor status updated successfully");
    });
}

const investorManagementController = new InvestorManagementController();
export { investorManagementController };
