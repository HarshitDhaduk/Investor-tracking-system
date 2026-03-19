import { BaseRepository } from "./base.repository.js";

// Payment Repository — handles payment_schedules table operations.
class PaymentRepository extends BaseRepository {

    // Get count of payments for a specific user.
    async getCountByUserId(userId) {
        return this.selectOne(
            "SELECT COUNT(*) AS count FROM payment_schedules WHERE user_id = ?",
            [userId]
        );
    }

    // Delete all payment schedules for a specific user.
    async deleteByUserId(userId) {
        return this.delete(
            "DELETE FROM payment_schedules WHERE user_id = ?",
            [userId]
        );
    }

    // Find a payment by its ID with investor details.
    async findByIdWithInvestor(paymentId) {
        return this.selectOne(
            `SELECT ps.id, ps.user_id, ps.due_date, ps.payment_amount, ps.status, ps.payment_type,
                    u.f_name, u.l_name, u.email, u.contract_type, u.fixed_interest_rate, 
                    u.initial_capital, u.current_portfolio
             FROM payment_schedules ps
             JOIN users u ON ps.user_id = u.id
             WHERE ps.id = ?`,
            [paymentId]
        );
    }

    // Get payment schedule for a specific user.
    async getByUserId(userId) {
        return this.select(
            `SELECT id, due_date, payment_amount, payment_type, principal_amount, status, created_at
             FROM payment_schedules 
             WHERE user_id = ? 
             ORDER BY due_date ASC`,
            [userId]
        );
    }

    // Get payment history with filters and pagination.
    async getPaymentHistory({ userId, status, limit, offset }) {
        let query = `
            SELECT id, due_date, payment_amount, payment_type, status, paid_date, notes, created_at
            FROM payment_schedules 
            WHERE user_id = ?
        `;
        const params = [userId];

        if (status !== null) {
            query += " AND status = ?";
            params.push(status);
        }

        query += " ORDER BY due_date DESC LIMIT ? OFFSET ?";
        params.push(limit, offset);

        return this.select(query, params);
    }

    // Get payment statistics for an investor (paid only).
    async getInvestorPaymentStats(userId) {
        return this.selectOne(
            "SELECT COUNT(*) as payment_count, COALESCE(SUM(payment_amount), 0) as total_paid FROM payment_schedules WHERE user_id = ? AND status = 1",
            [userId]
        );
    }

    // Get payment summary for an investor.
    async getInvestorPaymentSummary(userId) {
        return this.selectOne(
            `SELECT 
                COUNT(*) as total_payments,
                SUM(CASE WHEN status = 1 THEN payment_amount ELSE 0 END) as total_paid,
                SUM(CASE WHEN status = 0 THEN payment_amount ELSE 0 END) as total_pending,
                COUNT(CASE WHEN status = 1 THEN 1 END) as payments_made,
                COUNT(CASE WHEN status = 0 THEN 1 END) as payments_pending
             FROM payment_schedules WHERE user_id = ?`,
            [userId]
        );
    }

    // Get upcoming payments across all investors with filters.
    async getUpcomingPayments({ limit, offset, startDate, endDate, status, userId }) {
        let query = `
            SELECT ps.*, u.f_name, u.l_name, u.email, u.contract_type, u.fixed_interest_rate
            FROM payment_schedules ps
            JOIN users u ON ps.user_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (startDate) {
            query += " AND ps.due_date >= ?";
            params.push(startDate);
        }
        if (endDate) {
            query += " AND ps.due_date <= ?";
            params.push(endDate);
        }
        if (status !== null) {
            query += " AND ps.status = ?";
            params.push(status);
        }
        if (userId) {
            query += " AND ps.user_id = ?";
            params.push(userId);
        }

        query += " ORDER BY ps.due_date ASC LIMIT ? OFFSET ?";
        params.push(limit, offset);

        return this.select(query, params);
    }

    // Get total count of payments across all investors with filters.
    async getUpcomingPaymentsCount({ startDate, endDate, status, userId }) {
        let query = `
            SELECT COUNT(*) AS total 
            FROM payment_schedules ps
            JOIN users u ON ps.user_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (startDate) {
            query += " AND ps.due_date >= ?";
            params.push(startDate);
        }
        if (endDate) {
            query += " AND ps.due_date <= ?";
            params.push(endDate);
        }
        if (status !== null) {
            query += " AND ps.status = ?";
            params.push(status);
        }
        if (userId) {
            query += " AND ps.user_id = ?";
            params.push(userId);
        }

        const result = await this.selectOne(query, params);
        return result?.total || 0;
    }

    // Get total paid amount for a specific user.
    async getTotalPaidAmount(userId) {
        const result = await this.selectOne(
            "SELECT SUM(payment_amount) as total_paid FROM payment_schedules WHERE user_id = ? AND status = 1",
            [userId]
        );
        return parseFloat(result?.total_paid || 0);
    }
}

const paymentRepository = new PaymentRepository();
export { paymentRepository, PaymentRepository };
