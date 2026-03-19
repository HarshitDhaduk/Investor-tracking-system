import { BaseRepository } from "./base.repository.js";

// Bank Details Repository — handles investor_bank_details table operations.
class BankDetailsRepository extends BaseRepository {

    // Get bank details with user info, supporting status/search filters and pagination.
    async getBankDetailsWithUserInfo({ status, search, offset, limit }) {
        let filter = "";
        const params = [];

        if (status !== null) {
            filter += " AND bd.status = ?";
            params.push(status);
        }

        if (search) {
            filter += " AND (u.f_name LIKE ? OR u.l_name LIKE ? OR u.email LIKE ? OR bd.account_holder_name LIKE ? OR bd.bank_name LIKE ?)";
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }

        const bankDetails = await this.select(
            `SELECT 
                bd.id, bd.user_id, bd.account_holder_name, bd.account_number, 
                bd.bank_name, bd.swift_code, bd.bsb_number, bd.beneficiary_address, bd.iban,
                bd.status, bd.reject_reason, bd.created_at, bd.updated_at,
                u.f_name, u.l_name, u.email, u.initial_capital, u.current_portfolio
            FROM investor_bank_details bd
            JOIN users u ON bd.user_id = u.id
            WHERE u.role = 1 ${filter}
            ORDER BY bd.created_at DESC 
            LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        const totalCount = await this.selectOne(
            `SELECT COUNT(*) AS total 
            FROM investor_bank_details bd
            JOIN users u ON bd.user_id = u.id
            WHERE u.role = 1 ${filter}`,
            params
        );

        return { bankDetails, total: totalCount.total || 0 };
    }

    // Find bank details by ID with user info.
    async findByIdWithUser(bankDetailsId) {
        return this.selectOne(
            `SELECT bd.id, bd.user_id, bd.account_holder_name, bd.bank_name, bd.status,
                u.f_name, u.l_name, u.email
            FROM investor_bank_details bd
            JOIN users u ON bd.user_id = u.id
            WHERE bd.id = ?`,
            [bankDetailsId]
        );
    }

    // Update bank details review status.
    async updateReviewStatus(bankDetailsId, statusValue, rejectReason, adminId) {
        return this.update(
            `UPDATE investor_bank_details
            SET status = ?, reject_reason = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
            [statusValue, rejectReason || null, adminId, bankDetailsId]
        );
    }

    // Set user's is_bank_details flag.
    async setUserBankDetailsFlag(userId) {
        return this.update(
            "UPDATE users SET is_bank_details = 1 WHERE id = ?",
            [userId]
        );
    }

    // Get latest bank details for a user with user info.
    async getLatestByUserId(userId) {
        return this.selectOne(
            `SELECT bd.id, bd.user_id, bd.account_holder_name, bd.bank_name, bd.account_number, bd.swift_code, bd.bsb_number, bd.beneficiary_address, bd.iban, bd.status, bd.reject_reason, bd.reviewed_by, bd.reviewed_at, bd.created_at, bd.updated_at,
            u.f_name, u.l_name, u.email
            FROM investor_bank_details bd
            INNER JOIN users u ON bd.user_id = u.id
            WHERE bd.user_id = ?
            ORDER BY bd.id DESC LIMIT 1`,
            [userId]
        );
    }

    // Create new bank details entry.
    async create(data) {
        const { user_id, account_holder_name, bank_name, account_number, swift_code, bsb_number, beneficiary_address, iban, status = 0 } = data;
        return this.insert(
            `INSERT INTO investor_bank_details (user_id, account_holder_name, bank_name, account_number, swift_code, bsb_number, beneficiary_address, iban, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [user_id, account_holder_name, bank_name, account_number || null, swift_code || null, bsb_number || null, beneficiary_address || null, iban || null, status]
        );
    }

    // Update existing bank details entry using dynamic query builder.
    async updateBankDetailsData(id, data) {
        const validFields = ["account_holder_name", "bank_name", "account_number", "swift_code", "bsb_number", "beneficiary_address", "iban", "status"];
        
        const updates = [];
        const params = [];

        for (const field of validFields) {
            if (data[field] !== undefined) {
                updates.push(`${field} = ?`);
                params.push(data[field] === "" ? null : data[field]);
            }
        }

        if (updates.length === 0) return true;

        const query = `UPDATE investor_bank_details SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        params.push(id);

        return this.update(query, params);
    }
}

const bankDetailsRepository = new BankDetailsRepository();
export { bankDetailsRepository, BankDetailsRepository };
