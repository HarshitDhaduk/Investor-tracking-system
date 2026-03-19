import { BaseRepository } from "./base.repository.js";

// Capital Tranche Repository — data access for the capital_tranches table.
class CapitalTrancheRepository extends BaseRepository {

    // Get all active tranches for an investor.
    async getActiveByUserId(userId) {
        return this.select(
            "SELECT id, capital_amount, contract_start_date, status, created_at FROM capital_tranches WHERE user_id = ? AND status = 1 ORDER BY contract_start_date ASC",
            [userId]
        );
    }

    // Get next tranche number for this investor
    async getNextTrancheNumber(userId) {
        const result = await this.selectOne(
            "SELECT MAX(tranche_number) AS max_tranche FROM capital_tranches WHERE user_id = ?",
            [userId]
        );
        return (result?.max_tranche || 0) + 1;
    }

    // Create a new capital tranche.
    async create({ user_id, tranche_number, capital_amount, investment_date, status = 1 }) {
        return this.insert(
            "INSERT INTO capital_tranches (user_id, tranche_number, capital_amount, investment_date, status) VALUES (?, ?, ?, ?, ?)",
            [user_id, tranche_number, capital_amount, investment_date, status]
        );
    }

    // Get all tranches for an investor.
    async getAllByUserId(userId) {
        return this.select(
            "SELECT id, tranche_number, capital_amount, investment_date, status, created_at FROM capital_tranches WHERE user_id = ? ORDER BY tranche_number ASC",
            [userId]
        );
    }

    // Update a tranche.
    async updateStatus(trancheId, status) {
        return this.update(
            "UPDATE capital_tranches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [status, trancheId]
        );
    }
}

const capitalTrancheRepository = new CapitalTrancheRepository();
export { capitalTrancheRepository, CapitalTrancheRepository };
