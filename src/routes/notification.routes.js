import { Router } from "express";
import { notificationController } from "../controllers/notification/notification.controller.js";

const router = Router();

// GET /api/notification — get user notifications with pagination
router.get("/", notificationController.getNotifications);

// GET /api/notification/counts — get notification counts
router.get("/counts", notificationController.getNotificationCounts);

// POST /api/notification/:id/read — mark notification as read
router.post("/:id/read", notificationController.markAsRead);

// POST /api/notification/read-all — mark all notifications as read
router.post("/read-all", notificationController.markAllAsRead);

// DELETE /api/notification/:id — delete notification
router.delete("/:id", notificationController.deleteNotification);

// POST /api/notification/register-token — register FCM token
router.post("/register-token", notificationController.registerFcmToken);

export default router;
