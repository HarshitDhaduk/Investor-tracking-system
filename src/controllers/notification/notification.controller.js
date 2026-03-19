import { notificationCleanService } from "../../services/notification.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { validateRequest } from "../../utils/validateRequest.js";

// Notification Controller — thin HTTP handlers.
class NotificationController {

    // GET /api/notification
    getNotifications = catchAsync(async (req, res) => {
        const userId = req._id;
        const limit = req.query.limit ? parseInt(req.query.limit) : 20;
        const offset = req.query.offset ? parseInt(req.query.offset) : 0;
        const status = req.query.status !== undefined && req.query.status !== null && req.query.status !== ""
            ? parseInt(req.query.status)
            : null;

        const result = await notificationCleanService.getNotifications(userId, { limit, offset, status });
        return ApiResponse.success(res, result, "Notifications fetched successfully");
    });

    // GET /api/notification/counts
    getNotificationCounts = catchAsync(async (req, res) => {
        const counts = await notificationCleanService.getNotificationCounts(req._id);
        return ApiResponse.success(res, counts, "Notification counts fetched successfully");
    });

    // POST /api/notification/:id/read
    markAsRead = catchAsync(async (req, res) => {
        await notificationCleanService.markAsRead(req.params.id, req._id);
        return ApiResponse.success(res, null, "Notification marked as read successfully");
    });

    // POST /api/notification/read-all
    markAllAsRead = catchAsync(async (req, res) => {
        const result = await notificationCleanService.markAllAsRead(req._id);
        return ApiResponse.success(res, result, "All notifications marked as read successfully");
    });

    // DELETE /api/notification/:id
    deleteNotification = catchAsync(async (req, res) => {
        await notificationCleanService.deleteNotification(req.params.id, req._id);
        return ApiResponse.success(res, null, "Notification deleted successfully");
    });

    // POST /api/notification/register-token
    registerFcmToken = catchAsync(async (req, res) => {
        validateRequest(req, ["fcm_token"]);

        const { fcm_token, device_type } = req.body;
        const result = await notificationCleanService.registerFcmToken(req._id, fcm_token, device_type);
        return ApiResponse.success(res, { token_id: result.token_id }, result.message);
    });
}

const notificationController = new NotificationController();
export { notificationController };
