import { BaseRepository } from "./base.repository.js";

// Investor Management Repository — handles investor-related admin queries on users table.
class InvestorManagementRepository extends BaseRepository {

    // Find investor by ID (role = 1).
    async findInvestorById(userId) {
        return this.selectOne(
            "SELECT id, f_name, l_name, email, status, temp_signup FROM users WHERE id = ? AND role = 1",
            [userId]
        );
    }

    // Check if email already exists (non-deleted users).
    async findByEmailNonDeleted(email) {
        return this.selectOne(
            "SELECT id FROM users WHERE email = ? AND status != -1",
            [email]
        );
    }

    // Update temp_password for a user.
    async updateTempPassword(userId, hashedPassword) {
        return this.update(
            "UPDATE users SET temp_password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [hashedPassword, userId]
        );
    }

    // Insert a new investor user.
    async createInvestor(data) {
        return this.insert(
            `INSERT INTO users (
                f_name, l_name, email, temp_password, role, status, temp_signup, 
                initial_capital, current_portfolio,
                contract_type, fixed_interest_rate, contract_start_date, contract_end_date, investment_day
            ) VALUES (?, ?, ?, ?, 1, 0, 1, ?, ?, ?, ?, ?, ?, ?)`,
            [
                data.f_name, data.l_name, data.email, data.hashed_temp_password,
                data.initial_capital, data.initial_capital,
                data.contract_type, data.fixed_interest_rate,
                data.contract_start_date, data.contract_end_date,
                data.investment_day,
            ]
        );
    }

    // Get investors with search/status filters and pagination.
    async getInvestors({ status, search, offset, limit }) {
        let filter = " AND status != -1";
        const params = [];

        if (status !== null) {
            filter = " AND status = ?";
            params.push(status);
        }

        if (search) {
            filter += " AND (f_name LIKE ? OR l_name LIKE ? OR email LIKE ?)";
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        const investors = await this.select(
            `SELECT id, f_name, l_name, email, initial_capital, current_portfolio, 
                    currency, contract_type, contract_start_date, fixed_interest_rate, 
                    contract_end_date, investment_day, is_bank_details, status, temp_signup, created_at, updated_at
            FROM users 
            WHERE role = 1 ${filter}
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        const totalCount = await this.selectOne(
            `SELECT COUNT(*) AS total FROM users WHERE role = 1 ${filter}`,
            params
        );

        return { investors, total: totalCount.total || 0, filter: status, search };
    }

    // Get investor names with search/status filters and pagination.
    async getInvestorNames({ status, search, offset, limit }) {
        let filter = " AND status != -1";
        const params = [];

        if (status !== null) {
            filter = " AND status = ?";
            params.push(status);
        }

        if (search) {
            filter += " AND (f_name LIKE ? OR l_name LIKE ? OR email LIKE ?)";
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        const investorNames = await this.select(
            `SELECT id, f_name, l_name, email
            FROM users 
            WHERE role = 1 ${filter}
            ORDER BY f_name ASC, l_name ASC
            LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        const totalCount = await this.selectOne(
            `SELECT COUNT(*) AS total FROM users WHERE role = 1 ${filter}`,
            params
        );

        return { investorNames, total: totalCount.total || 0, filter: status, search };
    }

    // Get total profit sum from performance records for a specific investor (monthly payable).
    async getProfitSum(userId) {
        return this.selectOne(
            "SELECT SUM(profit_amount) AS total_profit FROM investor_portfolio_performance WHERE user_id = ?",
            [userId]
        );
    }

    // Get total performance records count for an investor.
    async getPerformanceCount(userId) {
        return this.selectOne(
            "SELECT COUNT(*) AS total FROM investor_portfolio_performance WHERE user_id = ?",
            [userId]
        );
    }

    // Update investor status.
    async updateInvestorStatus(userId, statusValue) {
        return this.update(
            "UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [statusValue, userId]
        );
    }
}

const investorManagementRepository = new InvestorManagementRepository();
export { investorManagementRepository, InvestorManagementRepository };
