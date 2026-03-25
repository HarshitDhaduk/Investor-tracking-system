import { dashboardRepository } from "../repositories/dashboard.repository.js";
import { ApiError } from "../utils/ApiError.js";

// Dashboard Service — business logic for admin dashboard statistics.
class DashboardService {

    // Get dashboard statistics with calculated and configurable data.
    async getDashboardStats() {
        const [investorCount, capitalStats, avgReturn, pendingBankDetails, configurableStats] = await Promise.all([
            dashboardRepository.getActiveInvestorCount(),
            dashboardRepository.getCapitalStats(),
            dashboardRepository.getAverageReturn(),
            dashboardRepository.getPendingBankDetailsCount(),
            dashboardRepository.getActiveConfigurableStats(),
        ]);

        const totalProfit = Math.max(0, (capitalStats.total_portfolio || 0) - (capitalStats.total_capital || 0));

        const response = {
            total_active_investors: investorCount.total || 0,
            total_capital_under_management: parseFloat(capitalStats.total_capital || 0),
            total_portfolio_value: parseFloat(capitalStats.total_portfolio || 0),
            total_profit_generated: parseFloat(totalProfit.toFixed(2)),
            average_monthly_return: parseFloat(Number(avgReturn.avg_return || 0).toFixed(2)),
            pending_bank_details: pendingBankDetails.total || 0,
        };

        // Add configurable statistics
        if (Array.isArray(configurableStats)) {
            configurableStats.forEach(stat => {
                const key = stat.stat_name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
                response[key] = {
                    value: parseFloat(stat.stat_value),
                    label: stat.stat_name,
                    is_percentage: false, // Defaulting as these columns do not exist
                    is_currency: true, 
                };
            });
        }

        return response;
    }

    // Create or update a dashboard statistic.
    async updateDashboardStat(adminId, { stat_name, stat_value, display_order }) {
        const statValue = parseFloat(stat_value);
        if (isNaN(statValue)) {
            throw ApiError.badRequest("Invalid stat value. Must be a valid number");
        }

        const existingStat = await dashboardRepository.findByStatName(stat_name);

        if (existingStat) {
            const updated = await dashboardRepository.updateStat(existingStat.id, statValue, display_order);
            if (!updated) {
                throw ApiError.internal("Failed to update dashboard statistic");
            }
            return {
                action: "updated",
                stat_id: existingStat.id,
                stat_name,
                stat_value: parseFloat(statValue.toFixed(2)),
                display_order: display_order !== undefined ? parseInt(display_order) : null,
            };
        }

        const statId = await dashboardRepository.createStat(stat_name, statValue, display_order, adminId);
        if (!statId) {
            throw ApiError.internal("Failed to create dashboard statistic");
        }
        return {
            action: "created",
            stat_id: statId,
            stat_name,
            stat_value: parseFloat(statValue.toFixed(2)),
            display_order: display_order !== undefined ? parseInt(display_order) : null,
        };
    }

    // Get all dashboard stats with creator info for management.
    async getDashboardStatsManagement() {
        const allStats = await dashboardRepository.getAllStatsWithCreator();

        const formattedStats = Array.isArray(allStats) ? allStats.map(stat => ({
            id: stat.id,
            stat_name: stat.stat_name,
            stat_value: parseFloat(stat.stat_value),
            display_order: stat.display_order,
            status: stat.status,
            created_by: {
                id: stat.created_by,
                name: stat.f_name && stat.l_name ? `${stat.f_name} ${stat.l_name}` : "Unknown Admin",
            },
            created_at: stat.created_at,
            updated_at: stat.updated_at,
        })) : [];

        return {
            statistics: formattedStats,
            total: formattedStats.length,
            active_count: formattedStats.filter(s => s.status === 1).length,
            inactive_count: formattedStats.filter(s => s.status === 0).length,
        };
    }

    // Delete a dashboard statistic by ID.
    async deleteDashboardStat(statId) {
        const existingStat = await dashboardRepository.findStatById(statId);
        if (!existingStat) {
            throw ApiError.notFound("Dashboard statistic not found");
        }

        const deleted = await dashboardRepository.deleteStat(statId);
        if (!deleted) {
            throw ApiError.internal("Failed to delete dashboard statistic");
        }

        return {
            deleted_stat_id: statId,
            deleted_stat_name: existingStat.stat_name,
        };
    }
}

const dashboardService = new DashboardService();
export { dashboardService, DashboardService };
