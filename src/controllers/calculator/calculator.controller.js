import { calculatorService } from "../../services/calculator.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { validateRequest } from "../../utils/validateRequest.js";

// Calculator Controller — thin HTTP handler.
class CalculatorController {

    // POST /api/calculator/calculate-return
    calculateReturn = catchAsync(async (req, res) => {
        validateRequest(req, ["invested_amount", "expected_monthly_return", "duration"]);

        const result = calculatorService.calculateReturn(req.body);

        return ApiResponse.success(res, result, "Returns calculated successfully");
    });
}

const calculatorController = new CalculatorController();
export { calculatorController };
