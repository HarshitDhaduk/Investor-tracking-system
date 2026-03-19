import { BaseRepository } from "./base.repository.js";

// FCM Token Repository — handles fcm_tokens table operations.
class FcmTokenRepository extends BaseRepository {

    // Find an FCM token for a specific user.
    async findByUserAndToken(userId, fcmToken) {
        return this.selectOne(
            "SELECT id FROM fcm_tokens WHERE user_id = ? AND fcm_token = ?",
            [userId, fcmToken]
        );
    }

    // Activate an existing FCM token and update device type.
    async activateToken(tokenId, deviceType) {
        return this.update(
            "UPDATE fcm_tokens SET status = 1, device_type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [deviceType || null, tokenId]
        );
    }

    // Get active tokens for multiple users.
    async getActiveTokensByUsers(userIds) {
        if (!userIds || userIds.length === 0) return [];
        return this.select(
            `SELECT DISTINCT user_id, fcm_token FROM fcm_tokens WHERE user_id IN (${userIds.map(() => '?').join(',')}) AND status = 1`,
            userIds
        );
    }

    // Register a new FCM token for a user.
    async registerToken(userId, fcmToken, deviceType) {
        return this.insert(
            "INSERT INTO fcm_tokens (user_id, fcm_token, device_type, status) VALUES (?, ?, ?, 1) ON CONFLICT (user_id, fcm_token) DO UPDATE SET status = 1, updated_at = CURRENT_TIMESTAMP",
            [userId, fcmToken, deviceType || null]
        );
    }
}

const fcmTokenRepository = new FcmTokenRepository();
export { fcmTokenRepository, FcmTokenRepository };
