import { BaseRepository } from "./base.repository.js";

// Auth Repository — data access for the user_auth table.
class AuthRepository extends BaseRepository {
    constructor() {
        super();
    }

    // Create a new auth record for a user.
    async createAuth(userId, apikey, token) {
        return this.insert(
            "INSERT INTO user_auth (user_id, apikey, token, status) VALUES (?, ?, ?, ?)",
            [userId, apikey, token, 1]
        );
    }

    // Create or update auth record (UPSERT) on login.
    async upsertAuth(userId, apikey, token) {
        return this.insert(
            `INSERT INTO user_auth (user_id, apikey, token, status, updated_at) 
       VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET 
       apikey = EXCLUDED.apikey, token = EXCLUDED.token, status = 1, updated_at = CURRENT_TIMESTAMP`,
            [userId, apikey, token]
        );
    }

    // Find auth record by apikey and token (for middleware authentication).
    async findByCredentials(apikey, token) {
        return this.selectOne(
            `SELECT ua.user_id, u.role FROM user_auth ua 
       JOIN users u ON ua.user_id = u.id 
       WHERE ua.apikey = ? AND ua.token = ? AND u.status != -1`,
            [apikey, token]
        );
    }

    // Find existing auth record for a user.
    async findByUserId(userId) {
        return this.selectOne(
            "SELECT id FROM user_auth WHERE user_id = ?",
            [userId]
        );
    }

    // Store forgot-password token (update existing auth record).
    async updateFpToken(userId, fpToken) {
        return this.update(
            "UPDATE user_auth SET fp_token = ? WHERE user_id = ?",
            [fpToken, userId]
        );
    }

    // Create auth record with forgot-password token (when no auth record exists).
    async createAuthWithFpToken(userId, apikey, token, fpToken) {
        return this.insert(
            "INSERT INTO user_auth (user_id, apikey, token, fp_token, status) VALUES (?, ?, ?, ?, ?)",
            [userId, apikey, token, fpToken, 1]
        );
    }

    // Find user by forgot-password token (joined with users table).
    async findByFpToken(fpToken) {
        return this.selectOne(
            `SELECT ua.user_id, u.password, u.status, u.temp_signup
       FROM user_auth ua
       INNER JOIN users u ON ua.user_id = u.id
       WHERE ua.fp_token = ?`,
            [fpToken]
        );
    }

    // Clear the forgot-password token after successful reset.
    async clearFpToken(userId) {
        return this.update(
            "UPDATE user_auth SET fp_token = NULL WHERE user_id = ?",
            [userId]
        );
    }

    // Invalidate auth tokens for a user (on account deletion, etc.).
    async invalidateAuth(userId) {
        return this.update(
            "UPDATE user_auth SET status = 0 WHERE user_id = ?",
            [userId]
        );
    }
}

// Export singleton instance
const authRepository = new AuthRepository();
export { authRepository, AuthRepository };
