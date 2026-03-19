import { contractService } from "../../services/contract.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { validateRequest } from "../../utils/validateRequest.js";

// Contract Controller — handles investor contract management.
class ContractController {

    // POST /api/admin/update-investor-contract
    updateInvestorContract = catchAsync(async (req, res) => {
        validateRequest(req, ["user_id"]);
        const result = await contractService.updateInvestorContract(req.body);
        return ApiResponse.success(res, result, "Investor contract updated successfully");
    });

    // GET /api/admin/get-contracts-approaching-maturity
    getContractsApproachingMaturity = catchAsync(async (req, res) => {
        const result = await contractService.getContractsApproachingMaturity(req.query);
        return ApiResponse.success(res, result, "Contracts approaching maturity retrieved successfully");
    });

    // POST /api/admin/manage-contract-maturity
    manageContractMaturity = catchAsync(async (req, res) => {
        validateRequest(req, ["user_id", "action"]);
        const result = await contractService.manageContractMaturity(req.body);
        return ApiResponse.success(res, result, `Contract ${req.body.action}d successfully`);
    });

    // POST /api/admin/calculate-investor-performance-with-fixed-rates
    calculateInvestorPerformanceWithFixedRates = catchAsync(async (req, res) => {
        validateRequest(req, ["user_id", "month", "year"]);
        const result = await contractService.calculatePerformanceWithFixedRates(req.body);
        return ApiResponse.success(res, result, "Investor performance calculated successfully");
    });
}

const contractController = new ContractController();
export { contractController };
