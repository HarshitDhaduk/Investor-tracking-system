import { BaseRepository } from "./base.repository.js";

// Notification Repository — handles notifications table operations.
class NotificationRepository extends BaseRepository {

    // Insert a new notification.
    async create(data) {
        const { user_id, title, message, type, type_id, payload, send_by = 0, status = 0 } = data;
        return this.insert(
            `INSERT INTO notifications (user_id, title, message, type, type_id, payload, send_by, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [user_id, title, message, type, type_id || null, payload ? JSON.stringify(payload) : null, send_by, status]
        );
    }

    // Insert a notification conditionally (if user is active).
    async createIfActiveUser(data) {
        const { user_id, title, message, type, type_id, payload, send_by = 0 } = data;
        return this.insert(
            `INSERT INTO notifications (user_id, title, message, type, type_id, payload, send_by, status) 
             SELECT id, ?, ?, ?, ?, ?, ?, 0 FROM users WHERE id = ? AND status = 1`,
            [title, message, type, type_id || null, payload ? JSON.stringify(payload) : null, send_by, user_id]
        );
    }

    // Get notifications for a user with status filter and pagination.
    async getUserNotifications(userId, { limit = 20, offset = 0, status = null } = {}) {
        let query = "SELECT id, user_id, title, message, type, type_id, payload, status, created_at, updated_at FROM notifications WHERE user_id = ?";
        const params = [userId];

        if (status !== null) {
            query += " AND status = ?";
            params.push(status);
        }

        query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
        params.push(limit, offset);

        const results = await this.select(query, params);
        
        // Parse JSON payload
        if (results && results.length > 0) {
            return results.map(n => {
                let parsedPayload = null;
                if (n.payload) {
                    try {
                        parsedPayload = typeof n.payload === 'object' ? n.payload : JSON.parse(n.payload);
                    } catch (e) {
                        try {
                            const cleanPayload = n.payload
                                .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
                                .replace(/:\s*'([^']*)'/g, ': "$1"')
                                .replace(/:\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*([,}])/g, ': "$1"$2');
                            parsedPayload = JSON.parse(cleanPayload);
                        } catch (err) {
                            parsedPayload = null;
                        }
                    }
                }
                return { ...n, payload: parsedPayload };
            });
        }
        return results;
    }

    // Get notification counts (total, read, unread) for a user.
    async getNotificationCounts(userId) {
        const result = await this.selectOne(
            `SELECT 
              COUNT(*) as total,
              SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) as unread,
              SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as "read"
             FROM notifications 
             WHERE user_id = ?`,
            [userId]
        );
        return {
            total: parseInt(result?.total) || 0,
            unread: parseInt(result?.unread) || 0,
            read: parseInt(result?.read) || 0,
        };
    }

    // Mark a notification as read.
    async markAsRead(notificationId, userId) {
        return this.update(
            "UPDATE notifications SET status = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
            [notificationId, userId]
        );
    }

    // Mark all unread notifications as read.
    async markAllAsRead(userId) {
        return this.update(
            "UPDATE notifications SET status = 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND status = 0",
            [userId]
        );
    }

    // Delete a notification.
    async deleteNotification(notificationId, userId) {
        return this.delete(
            "DELETE FROM notifications WHERE id = ? AND user_id = ?",
            [notificationId, userId]
        );
    }
}

const notificationRepository = new NotificationRepository();
export { notificationRepository, NotificationRepository };
