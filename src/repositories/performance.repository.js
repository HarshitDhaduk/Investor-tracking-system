import { BaseRepository } from "./base.repository.js";

// Performance Repository — data access for investor_portfolio_performance and fund_performance.
class PerformanceRepository extends BaseRepository {

    // Add investor performance record.
    async addInvestorPerformance({ user_id, month, year, profit_percentage, portfolio_value_before, portfolio_value_after, profit_amount, notes, added_by }) {
        return this.insert(
            `INSERT INTO investor_portfolio_performance 
            (user_id, month, year, profit_percentage, portfolio_value_before, portfolio_value_after, portfolio_value, profit_amount, notes, added_by) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [user_id, month, year, profit_percentage, portfolio_value_before, portfolio_value_after, portfolio_value_after, profit_amount, notes, added_by]
        );
    }

    // Get fund performance for a date range.
    async getFundPerformanceRange(startYear, startMonth, endYear, endMonth) {
        return this.select(
            `SELECT month, year, performance_percentage 
             FROM fund_performance 
             WHERE (year > ? OR (year = ? AND month >= ?))
             AND (year < ? OR (year = ? AND month < ?))
             ORDER BY year ASC, month ASC`,
            [startYear, startYear, startMonth, endYear, endYear, endMonth]
        );
    }

    // Add fund performance.
    async addFundPerformance({ month, year, performance_percentage, total_fund_value_before, total_fund_value_after, monthly_payables_total, adjusted_fund_value, adjusted_performance_percentage, notes, added_by }) {
        return this.insert(
            `INSERT INTO fund_performance 
            (month, year, performance_percentage, total_fund_value_before, total_fund_value_after, monthly_payables_total, adjusted_fund_value, adjusted_performance_percentage, notes, added_by) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
            ON CONFLICT (month, year) DO UPDATE SET 
                performance_percentage = EXCLUDED.performance_percentage,
                total_fund_value_before = EXCLUDED.total_fund_value_before,
                total_fund_value_after = EXCLUDED.total_fund_value_after,
                monthly_payables_total = EXCLUDED.monthly_payables_total,
                adjusted_fund_value = EXCLUDED.adjusted_fund_value,
                adjusted_performance_percentage = EXCLUDED.adjusted_performance_percentage,
                notes = EXCLUDED.notes`,
            [month, year, performance_percentage, total_fund_value_before, total_fund_value_after, monthly_payables_total, adjusted_fund_value, adjusted_performance_percentage, notes, added_by]
        );
    }

    // Get investor performance by month and year.
    async getInvestorPerformanceByMonthYear(userId, month, year) {
        return this.selectOne(
            "SELECT * FROM investor_portfolio_performance WHERE user_id = ? AND month = ? AND year = ?",
            [userId, month, year]
        );
    }

    // Get latest investor performance record.
    async getLatestInvestorPerformance(userId) {
        return this.selectOne(
            "SELECT * FROM investor_portfolio_performance WHERE user_id = ? ORDER BY year DESC, month DESC, id DESC LIMIT 1",
            [userId]
        );
    }

    // Get performance by ID.
    async getPerformanceById(performanceId) {
        return this.selectOne(
            "SELECT * FROM investor_portfolio_performance WHERE id = ?",
            [performanceId]
        );
    }

    // Get fund performance by ID.
    async getFundPerformanceById(performanceId) {
        return this.selectOne(
            "SELECT * FROM fund_performance WHERE id = ?",
            [performanceId]
        );
    }

    // Update investor performance.
    async updateInvestorPerformance(performanceId, fields, params) {
        return this.update(
            `UPDATE investor_portfolio_performance SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [...params, performanceId]
        );
    }

    // Delete investor performance.
    async deleteInvestorPerformance(performanceId) {
        return this.delete(
            "DELETE FROM investor_portfolio_performance WHERE id = ?",
            [performanceId]
        );
    }

    // Get historical performance for an investor.
    async getInvestorHistory(userId) {
        return this.select(
            "SELECT id, month, year, profit_percentage, profit_amount, portfolio_value_before, portfolio_value_after, notes, created_at FROM investor_portfolio_performance WHERE user_id = ? ORDER BY year DESC, month DESC",
            [userId]
        );
    }

    // Get historical fund performance.
    async getFundHistory() {
        return this.select(
            "SELECT id, month, year, performance_percentage, created_at FROM fund_performance ORDER BY year DESC, month DESC"
        );
    }

    // Get performance for aggregation/chart (fund).
    async getFundPerformanceChartData() {
        return this.select(
            "SELECT month, year, performance_percentage FROM fund_performance ORDER BY year ASC, month ASC"
        );
    }

    // Get performance for aggregation/chart (investor).
    async getInvestorPerformanceChartData(userId) {
        return this.select(
            "SELECT month, year, profit_percentage FROM investor_portfolio_performance WHERE user_id = ? ORDER BY year ASC, month ASC",
            [userId]
        );
    }
}

const performanceRepository = new PerformanceRepository();
export { performanceRepository, PerformanceRepository };
