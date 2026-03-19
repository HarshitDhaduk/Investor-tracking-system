// Performance Utilities — Mathematical logic for portfolio performance calculations.

export function toSafeNumber(value, fallback = 0) {
    if (value === null || value === undefined || value === '') return fallback;
    const s = typeof value === 'string' ? value.replace(/,/g, '').trim() : String(value);
    const n = Number(s);
    return Number.isFinite(n) ? n : fallback;
}

export function parsePerformanceValue(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value)) return { type: 'amount', value: value };
    if (typeof value === 'string') {
        const s = value.trim();
        if (s.endsWith('%')) {
            const numStr = s.slice(0, -1).replace(/,/g, '').trim();
            const n = Number(numStr);
            if (Number.isFinite(n)) return { type: 'percentage', value: n };
            return null;
        }
        const n = Number(s.replace(/,/g, ''));
        if (Number.isFinite(n)) return { type: 'amount', value: n };
        return null;
    }
    return null;
}

export function clampToDecimal15_6(n) {
    const MAX = 999999999999.999999;
    if (!Number.isFinite(n)) return null;
    if (Math.abs(n) > MAX) return null;
    return n;
}

export function getMonthsDifference(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    if (end.getDate() < start.getDate()) months--;
    return Math.max(0, months);
}

export function validateMathematicalConsistency(profit_percentage, profit_amount, portfolioValueBefore, tolerance = 0.01) {
    const result = { isValid: true, message: "", finalPercentage: null, finalAmount: null };
    const hasPct = profit_percentage !== undefined && profit_percentage !== null && profit_percentage !== "";
    const hasAmt = profit_amount !== undefined && profit_amount !== null && profit_amount !== "";

    if (hasPct && hasAmt) {
        const pct = parseFloat(profit_percentage);
        const amt = parseFloat(profit_amount);
        const val = parseFloat(portfolioValueBefore);
        if (val === 0) {
            result.isValid = false;
            result.message = "Cannot validate consistency with zero portfolio value";
            return result;
        }
        const calcAmt = val * (pct / 100);
        if (Math.abs(calcAmt - amt) > tolerance) {
            result.isValid = false;
            result.message = "Percentage and amount are inconsistent";
            return result;
        }
        result.finalPercentage = pct;
        result.finalAmount = amt;
    } else if (hasPct) {
        result.finalPercentage = parseFloat(profit_percentage);
        result.finalAmount = parseFloat(portfolioValueBefore || 0) * (result.finalPercentage / 100);
    } else if (hasAmt) {
        result.finalAmount = parseFloat(profit_amount);
        const val = parseFloat(portfolioValueBefore);
        result.finalPercentage = val !== 0 ? (result.finalAmount / val) * 100 : 0;
    }
    return result;
}

export function calculatePortfolioValueAfter(investor, portfolioValueBefore, profitAmount) {
    if (investor.contract_type === 0) {
        // Monthly Payable: Portfolio value remains at principal/before value (profit is paid out)
        return portfolioValueBefore;
    } else {
        // Compounding: Profit is added to portfolio
        return portfolioValueBefore + profitAmount;
    }
}

export function isMonthWithinContract(month, year, startDate, endDate) {
    const perfDate = new Date(year, month - 1, 1);
    
    // Check Start Date: normalize to first of the month for comparison
    if (startDate) {
        const start = new Date(startDate);
        const startComp = new Date(start.getFullYear(), start.getMonth(), 1);
        if (perfDate < startComp) return false;
    }

    // Check End Date: normalize to first of the month for comparison
    if (endDate) {
        const end = new Date(endDate);
        const endComp = new Date(end.getFullYear(), end.getMonth(), 1);
        if (perfDate > endComp) return false;
    }

    return true;
}

