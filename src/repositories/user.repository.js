import { BaseRepository } from "./base.repository.js";

// User Repository — data access for the users table.
class UserRepository extends BaseRepository {
    constructor() {
        super();
    }

    // Find a user by email (active accounts only).
    async findByEmail(email) {
        return this.selectOne(
            "SELECT id FROM users WHERE email = ? AND status != -1",
            [email]
        );
    }

    // Find a user by email and role with full profile data.
    async findByEmailAndRole(email, role) {
        return this.selectOne(
            `SELECT id, role, profile_img, f_name, l_name, email, initial_capital, current_portfolio, currency, 
       contract_start_date, temp_password, password, email_verified, temp_signup, status, 
       last_login_at, created_at, updated_at 
       FROM users WHERE email = ? AND role = ? AND status != -1`,
            [email, role]
        );
    }

    // Find a user by ID.
    async findById(userId, fields = null) {
        const selectFields = fields
            ? fields.join(", ")
            : `id, role, profile_img, f_name, l_name, email, initial_capital, current_portfolio, currency,
         contract_start_date, contract_type, fixed_interest_rate, contract_end_date, investment_day,
         last_login_at, created_at, updated_at, status`;
        return this.selectOne(
            `SELECT ${selectFields} FROM users WHERE id = ? AND status != -1`,
            [userId]
        );
    }

    // Create a new user.
    async create(userData) {
        const { role, profile_img, f_name, l_name, email, password, email_verified, temp_signup, status } = userData;
        return this.insert(
            `INSERT INTO users (role, profile_img, f_name, l_name, email, password, email_verified, temp_signup, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [role, profile_img || null, f_name, l_name, email, password, email_verified, temp_signup, status]
        );
    }

    // Update the last login timestamp and optionally set email_verified.
    async updateLastLogin(userId, setEmailVerified = false) {
        const fields = ["last_login_at = CURRENT_TIMESTAMP"];
        if (setEmailVerified) {
            fields.push("email_verified = 1");
        }
        return this.update(
            `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
            [userId]
        );
    }

    // Update user password and related temp fields.
    async updatePassword(userId, hashedPassword, options = {}) {
        const fields = ["password = ?"];
        const params = [hashedPassword];

        if (options.clearTemp) {
            fields.push("temp_signup = 0", "temp_password = NULL");
        }

        if (options.status !== undefined) {
            fields.push("status = ?");
            params.push(options.status);
        }

        fields.push("updated_at = CURRENT_TIMESTAMP");
        params.push(userId);

        return this.update(
            `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
            params
        );
    }

    // Dynamically update user profile fields.
    async updateProfile(userId, updateClauses, params) {
        updateClauses.push("updated_at = CURRENT_TIMESTAMP");
        params.push(userId);
        return this.update(
            `UPDATE users SET ${updateClauses.join(", ")} WHERE id = ?`,
            params
        );
    }

    // Soft delete a user (set status = -1).
    async softDelete(userId) {
        return this.update(
            "UPDATE users SET status = -1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [userId]
        );
    }

    // Check if an email is already taken by another user.
    async findByEmailExcluding(email, excludeUserId) {
        return this.selectOne(
            "SELECT id FROM users WHERE email = ? AND status != -1 AND id != ?",
            [email, excludeUserId]
        );
    }

    // Find a user by email (any status, for forgot-password flow).
    async findByEmailAnyStatus(email) {
        return this.selectOne(
            "SELECT id, f_name, l_name, email, status FROM users WHERE email = ?",
            [email]
        );
    }

    // Find all investors with optional pagination.
    async findActiveInvestors(offset = 0, limit = null) {
        if (limit !== null) {
            return this.select(
                `SELECT * FROM users WHERE role = 1 AND status IN (0, 1) LIMIT ? OFFSET ?`,
                [limit, offset]
            );
        }
        return this.select(
            "SELECT * FROM users WHERE role = 1 AND status IN (0, 1)"
        );
    }
}

// Export singleton instance
const userRepository = new UserRepository();
export { userRepository, UserRepository };
