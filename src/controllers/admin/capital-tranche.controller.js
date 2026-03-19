import { capitalTrancheService } from "../../services/capital-tranche.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { validateRequest } from "../../utils/validateRequest.js";

// Capital Tranche Controller — handles investor tranches and backdating.
class CapitalTrancheController {

    // POST /api/admin/add-capital-tranche
    addCapitalTranche = catchAsync(async (req, res) => {
        validateRequest(req, ["user_id", "capital_amount", "investment_date"]);
        const result = await capitalTrancheService.addCapitalTranche(req.body);
        return ApiResponse.success(res, result, "Capital tranche added successfully");
    });

    // POST /api/admin/create-backdated-investor
    createBackdatedInvestor = catchAsync(async (req, res) => {
        validateRequest(req, ["f_name", "l_name", "email", "initial_capital", "currency", "contract_start_date", "historical_performance"]);
        const result = await capitalTrancheService.createBackdatedInvestor(req.body, req._id);
        return ApiResponse.success(res, result, "Backdated investor created successfully");
    });

    // POST /api/admin/validate-backdating
    validateBackdatingRequirements = catchAsync(async (req, res) => {
        validateRequest(req, ["contract_start_date"]);
        const result = await capitalTrancheService.validateBackdating(req.body.contract_start_date, req.body.contract_end_date);
        return ApiResponse.success(res, result, "Backdating requirements validated successfully");
    });
}

const capitalTrancheController = new CapitalTrancheController();
export { capitalTrancheController };
