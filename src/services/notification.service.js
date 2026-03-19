import { notificationRepository } from "../repositories/notification.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { fcmTokenRepository } from "../repositories/fcm-token.repository.js";
import { mailService } from "./mail.service.js";
import { notifyService } from "./notify.service.js";
import { ApiError } from "../utils/ApiError.js";

// Notification Service — Core business logic for sending and managing notifications.
// It orchestrates email delivery, in-app database notifications, and Firebase push notifications.
class NotificationService {

    // Send notification through multiple channels (email, in-app, push)
    async sendNotification({
        user_ids,
        title,
        message,
        type,
        type_id = null,
        payload = null,
        email_template = null,
        email_data = null,
        send_push = true,
        send_by = 0,
    }) {
        try {
            console.log(`[NotificationService] Sending notification: ${type} to ${user_ids.length} users`);

            if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
                console.error("[NotificationService] Invalid user_ids provided");
                return false;
            }

            // Get recipient user data
            const users = await userRepository.select(
                `SELECT id, email, f_name, l_name FROM users WHERE id IN (${user_ids.map(() => '?').join(',')}) AND status = 1`,
                user_ids
            );

            if (!users || users.length === 0) {
                console.log("[NotificationService] No active users found for notification");
                return false;
            }

            console.log(`[NotificationService] Found ${users.length} active users`);

            const operations = [];

            // 1. Send emails if template provided
            if (email_template && email_data) {
                for (const user of users) {
                    const userEmailData = {
                        ...email_data,
                        user_name: `${user.f_name} ${user.l_name}`,
                        investor_name: `${user.f_name} ${user.l_name}`,
                    };

                    operations.push(
                        mailService.sendMail({
                            to: user.email,
                            subject: title,
                            templateName: email_template,
                            data: userEmailData,
                        }).catch(error => {
                            console.error(`[NotificationService] Email error for ${user.email}:`, error.message);
                            return false;
                        })
                    );
                }
            }

            // 2. Create in-app notifications
            for (const user of users) {
                operations.push(
                    notificationRepository.create({
                        user_id: user.id,
                        title,
                        message,
                        type,
                        type_id,
                        payload,
                        send_by,
                        status: 0
                    }).catch(error => {
                        console.error(`[NotificationService] Database error for user ${user.id}:`, error.message);
                        return false;
                    })
                );
            }

            // 3. Send push notifications if enabled
            if (send_push) {
                operations.push(
                    notifyService.sendNotification(
                        users.map(u => u.id),
                        title,
                        message,
                        type,
                        type_id || 0,
                        payload || {},
                        send_by,
                        false // isStore = false, because we already stored it in step 2
                    ).catch(error => {
                        console.error("[NotificationService] Push notification error:", error.message);
                        return false;
                    })
                );
            }

            // Execute all operations in parallel
            await Promise.allSettled(operations);

            console.log(`[NotificationService] Notification sending completed for ${user_ids.join(', ')}`);
            return true;
        } catch (error) {
            console.error("[NotificationService] Error in sendNotification:", error.message);
            return false;
        }
    }

    // Get paginated notifications for a user.
    async getNotifications(userId, { limit = 20, offset = 0, status = null } = {}) {
        const notifications = await notificationRepository.getUserNotifications(userId, { limit, offset, status });
        const counts = await notificationRepository.getNotificationCounts(userId);

        return {
            notifications,
            pagination: { limit, offset, total: counts.total },
        };
    }

    // Get notification counts for a user.
    async getNotificationCounts(userId) {
        return notificationRepository.getNotificationCounts(userId);
    }

    // Mark a single notification as read.
    async markAsRead(notificationId, userId) {
        if (!notificationId) {
            throw ApiError.badRequest("Notification ID is required");
        }

        const success = await notificationRepository.markAsRead(notificationId, userId);
        if (!success) {
            throw ApiError.notFound("Notification not found or already read");
        }
    }

    // Mark all notifications as read for a user.
    async markAllAsRead(userId) {
        const count = await notificationRepository.markAllAsRead(userId);
        return { updated_count: count };
    }

    // Delete a notification.
    async deleteNotification(notificationId, userId) {
        if (!notificationId) {
            throw ApiError.badRequest("Notification ID is required");
        }

        const success = await notificationRepository.deleteNotification(notificationId, userId);
        if (!success) {
            throw ApiError.notFound("Notification not found or could not be deleted");
        }
    }

    // Register or update an FCM token for push notifications.
    async registerFcmToken(userId, fcmToken, deviceType) {
        if (!fcmToken || fcmToken.length < 10) {
            throw ApiError.badRequest("Invalid FCM token format");
        }

        const existingToken = await fcmTokenRepository.findByUserAndToken(userId, fcmToken);

        if (existingToken) {
            await fcmTokenRepository.activateToken(existingToken.id, deviceType);
            return { token_id: existingToken.id, message: "FCM token updated successfully" };
        }

        const tokenId = await fcmTokenRepository.registerToken(userId, fcmToken, deviceType);
        if (!tokenId) {
            throw ApiError.internal("Failed to register FCM token");
        }

        return { token_id: tokenId, message: "FCM token registered successfully" };
    }

    // Get all active admin user IDs
    async getAllAdminUserIds() {
        try {
            const admins = await userRepository.select(
                "SELECT id FROM users WHERE role = 2 AND status = 1",
                []
            );
            return admins ? admins.map(a => a.id) : [];
        } catch (error) {
            console.error("[NotificationService] Error getting admin IDs:", error.message);
            return [];
        }
    }
}

const notificationCleanService = new NotificationService();
export { notificationCleanService, NotificationService as NotificationServiceClass };
