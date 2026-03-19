import { dashboardService } from "../../services/dashboard.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { validateRequest } from "../../utils/validateRequest.js";

// Dashboard Controller — thin HTTP handlers for admin dashboard stats.
class DashboardController {

    // GET /api/admin/dashboard-stats
    getDashboardStats = catchAsync(async (req, res) => {
        const result = await dashboardService.getDashboardStats();
        return ApiResponse.success(res, result, "Dashboard statistics fetched successfully");
    });

    // PUT /api/admin/dashboard-stat
    updateDashboardStat = catchAsync(async (req, res) => {
        validateRequest(req, ["stat_name", "stat_value"]);

        const result = await dashboardService.updateDashboardStat(req._id, req.body);
        return ApiResponse.success(res, result, `Dashboard statistic ${result.action} successfully`);
    });

    // GET /api/admin/dashboard-stats-management
    getDashboardStatsManagement = catchAsync(async (req, res) => {
        const result = await dashboardService.getDashboardStatsManagement();
        return ApiResponse.success(res, result, "Dashboard statistics management data retrieved successfully");
    });

    // DELETE /api/admin/dashboard-stat
    deleteDashboardStat = catchAsync(async (req, res) => {
        validateRequest(req, ["stat_id"]);

        const result = await dashboardService.deleteDashboardStat(req.body.stat_id);
        return ApiResponse.success(res, result, "Dashboard statistic deleted successfully");
    });
}

const dashboardController = new DashboardController();
export { dashboardController };
