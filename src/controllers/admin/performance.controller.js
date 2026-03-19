import { performanceService } from "../../services/performance.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { validateRequest } from "../../utils/validateRequest.js";

// Performance Controller — handles fund and investor performance management.
class PerformanceController {

    // POST /api/admin/performance/add
    addPerformance = catchAsync(async (req, res) => {
        validateRequest(req, ["type", "month", "year"]);
        const result = await performanceService.addMonthlyPerformance(req.body, req._id);
        return ApiResponse.success(res, result, result.message || "Performance added and distributed successfully");
    });

    // GET /api/admin/historical-performance
    getHistoricalPerformance = catchAsync(async (req, res) => {
        const result = await performanceService.getHistoricalRecords(req.query);
        return ApiResponse.success(res, result, "Historical performance records retrieved");
    });

    // GET /api/admin/performance-chart
    getPerformanceChart = catchAsync(async (req, res) => {
        const result = await performanceService.getChartData(req.query);
        return ApiResponse.success(res, result, "Performance chart data retrieved");
    });

    // DELETE /api/admin/delete-performance/:id
    deletePerformance = catchAsync(async (req, res) => {
        const result = await performanceService.deletePerformance(req.params.id, req._id);
        return ApiResponse.success(res, result, "Performance record deleted and portfolio rolled back");
    });
}

const performanceController = new PerformanceController();
export { performanceController };
