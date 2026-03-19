import { ApiError } from "../utils/ApiError.js";

// Calculator Service — pure business logic for investment return calculations.
class CalculatorService {

    // Calculate estimated returns based on investment parameters.
    calculateReturn({ invested_amount, expected_monthly_return, duration }) {
        const investedAmount = parseFloat(invested_amount);
        const monthlyReturnRate = parseFloat(expected_monthly_return);
        const durationMonths = parseInt(duration);

        if (isNaN(investedAmount) || investedAmount <= 0) {
            throw ApiError.badRequest("Invalid investment amount");
        }

        if (isNaN(monthlyReturnRate) || monthlyReturnRate < 0) {
            throw ApiError.badRequest("Invalid expected monthly return");
        }

        if (isNaN(durationMonths) || durationMonths <= 0) {
            throw ApiError.badRequest("Invalid duration");
        }

        // Compound interest: A = P(1 + r)^n
        const monthlyRate = monthlyReturnRate / 100;
        const finalAmount = investedAmount * Math.pow(1 + monthlyRate, durationMonths);
        const totalReturns = finalAmount - investedAmount;
        const annualReturnRate = (Math.pow(1 + monthlyRate, 12) - 1) * 100;
        const avgMonthlyReturn = totalReturns / durationMonths;

        return {
            invested_amount: investedAmount,
            expected_monthly_return: monthlyReturnRate,
            duration_months: durationMonths,
            avg_monthly_return: parseFloat(avgMonthlyReturn.toFixed(2)),
            total_returns: parseFloat(totalReturns.toFixed(2)),
            final_amount: parseFloat(finalAmount.toFixed(2)),
            effective_annual_return: parseFloat(annualReturnRate.toFixed(2)),
        };
    }
}

const calculatorService = new CalculatorService();
export { calculatorService, CalculatorService };
