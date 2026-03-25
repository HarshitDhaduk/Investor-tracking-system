import { BaseRepository } from "./base.repository.js";

// Dashboard Repository — handles admin_dashboard_stats table and related aggregation queries.
class DashboardRepository extends BaseRepository {

    // Get count of active investors.
    async getActiveInvestorCount() {
        return this.selectOne(
            "SELECT COUNT(*) AS total FROM users WHERE role = 1 AND status = 1"
        );
    }

    // Get capital and portfolio totals for active investors.
    async getCapitalStats() {
        return this.selectOne(
            "SELECT SUM(initial_capital) AS total_capital, SUM(current_portfolio) AS total_portfolio FROM users WHERE role = 1 AND status = 1"
        );
    }

    // Get average monthly return from last 12 months.
    async getAverageReturn() {
        return this.selectOne(
            `SELECT AVG(profit_percentage) AS avg_return 
             FROM investor_portfolio_performance 
             WHERE created_at >= NOW() - INTERVAL '12 months'`
        );
    }

    // Get count of pending bank details (excluding deleted users).
    async getPendingBankDetailsCount() {
        return this.selectOne(
            `SELECT COUNT(*) AS total FROM investor_bank_details bd 
             INNER JOIN users u ON bd.user_id = u.id 
             WHERE bd.status = 0 AND u.status != -1`
        );
    }

    // Get active configurable dashboard stats ordered by display_order.
    async getActiveConfigurableStats() {
        return this.select(
            "SELECT stat_name, stat_value FROM admin_dashboard_stats WHERE status = 1 ORDER BY display_order ASC"
        );
    }

    // Find a stat by its name.
    async findByStatName(statName) {
        return this.selectOne(
            "SELECT id FROM admin_dashboard_stats WHERE stat_name = ?",
            [statName]
        );
    }

    // Update an existing stat's value and optionally display_order.
    async updateStat(statId, statValue, displayOrder) {
        const updateFields = ["stat_value = ?", "updated_at = CURRENT_TIMESTAMP"];
        const params = [statValue];

        if (displayOrder !== undefined && displayOrder !== null) {
            const orderValue = parseInt(displayOrder);
            if (!isNaN(orderValue)) {
                updateFields.push("display_order = ?");
                params.push(orderValue);
            }
        }

        params.push(statId);
        return this.update(
            `UPDATE admin_dashboard_stats SET ${updateFields.join(", ")} WHERE id = ?`,
            params
        );
    }

    // Create a new dashboard stat.
    async createStat(statName, statValue, displayOrder, createdBy) {
        const orderValue = displayOrder !== undefined && displayOrder !== null ? parseInt(displayOrder) : 0;
        return this.insert(
            "INSERT INTO admin_dashboard_stats (stat_name, stat_value, display_order, status, created_by) VALUES (?, ?, ?, 1, ?)",
            [statName, statValue, orderValue, createdBy]
        );
    }

    // Get all stats with creator info for management view.
    async getAllStatsWithCreator() {
        return this.select(
            `SELECT ads.id, ads.stat_name, ads.stat_value, ads.display_order, ads.status, 
                    ads.created_at, ads.updated_at, ads.created_by,
                    u.f_name, u.l_name
             FROM admin_dashboard_stats ads
             LEFT JOIN users u ON ads.created_by = u.id
             ORDER BY ads.display_order ASC, ads.stat_name ASC`
        );
    }

    // Find a stat by ID with its name.
    async findStatById(statId) {
        return this.selectOne(
            "SELECT id, stat_name FROM admin_dashboard_stats WHERE id = ?",
            [statId]
        );
    }

    // Hard delete a stat.
    async deleteStat(statId) {
        return this.delete(
            "DELETE FROM admin_dashboard_stats WHERE id = ?",
            [statId]
        );
    }
}

const dashboardRepository = new DashboardRepository();
export { dashboardRepository, DashboardRepository };
