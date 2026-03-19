import { BaseRepository } from "./base.repository.js";

// Contract Repository — data access for the contract_history and payment_schedules tables.
class ContractRepository extends BaseRepository {
    constructor() {
        super();
    }

    // Insert a contract history record.
    async createContractHistory({ user_id, contract_type, fixed_interest_rate, effective_from_month, effective_from_year, notes, created_by }) {
        return this.insert(
            `INSERT INTO contract_history (user_id, contract_type, fixed_interest_rate, effective_from_month, effective_from_year, notes, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [user_id, contract_type, fixed_interest_rate, effective_from_month, effective_from_year, notes, created_by]
        );
    }

    // Get contracts approaching maturity.
    async getContractsApproachingMaturity({ targetDate, limit, offset }) {
        return this.select(
            `SELECT 
                u.id, u.f_name, u.l_name, u.email,
                u.initial_capital, u.current_portfolio, u.currency,
                u.contract_start_date, u.contract_end_date, u.contract_type,
                u.fixed_interest_rate, u.investment_day,
                (u.contract_end_date - CURRENT_DATE) AS days_to_maturity,
                u.created_at, u.updated_at
            FROM users u
            WHERE u.role = 1 AND u.status = 1 
            AND u.contract_end_date IS NOT NULL
            AND u.contract_end_date <= ?
            AND u.contract_end_date >= CURRENT_DATE
            ORDER BY u.contract_end_date ASC, u.f_name ASC
            LIMIT ? OFFSET ?`,
            [targetDate, limit, offset]
        );
    }

    // Get total count of contracts approaching maturity.
    async getContractsApproachingMaturityCount(targetDate) {
        const result = await this.selectOne(
            `SELECT COUNT(*) AS total
            FROM users u
            WHERE u.role = 1 AND u.status = 1 
            AND u.contract_end_date IS NOT NULL
            AND u.contract_end_date <= ?
            AND u.contract_end_date >= CURRENT_DATE`,
            [targetDate]
        );
        return result?.total || 0;
    }

    // Mark all pending payments for a user as cancelled/completed.
    async cancelPendingPayments(userId, notes = 'Contract completed') {
        return this.update(
            "UPDATE payment_schedules SET status = 2, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND status = 0",
            [notes, userId]
        );
    }
}

const contractRepository = new ContractRepository();
export { contractRepository, ContractRepository };
