import admin from "firebase-admin";
import { notificationRepository } from "../repositories/notification.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { fcmTokenRepository } from "../repositories/fcm-token.repository.js";
import fs from 'fs';
import path from 'path';

// Load Firebase credentials safely
const loadFirebaseCredentials = () => {
    try {
        const credPath = path.resolve(process.cwd(), 'src/config', 'firebase.json');
        if (fs.existsSync(credPath)) {
            const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));
            // Check if already initialized to prevent errors in development reloading
            if (!admin.apps.length) {
                admin.initializeApp({
                    credential: admin.credential.cert(creds),
                });
                console.log("[NotifyService] Firebase Admin initialized.");
            }
            return true;
        } else {
            console.warn("[NotifyService] src/config/firebase.json not found. Push notifications will be disabled.");
            return false;
        }
    } catch (e) {
        console.error("[NotifyService] Error loading Firebase credentials:", e.message);
        return false;
    }
};

const isFirebaseReady = loadFirebaseCredentials();

// Notify Service — manages Firebase Cloud Messaging (FCM) operations.
class NotifyService {
    
    // Subscribe a token to multiple topics.
    async subscribeToTopics(fcmToken, topics) {
        if (!isFirebaseReady) return false;
        
        for (const topic of topics) {
            try {
                await admin.messaging().subscribeToTopic(fcmToken, topic);
                console.log(`[NotifyService] Subscribed to topic: ${topic}`);
            } catch (error) {
                console.error(`[NotifyService] Error subscribing to topic ${topic}:`, error.message);
            }
        }
        return true;
    }

    // Unsubscribe a token from multiple topics.
    async unsubscribeFromTopics(fcmToken, topics) {
        if (!isFirebaseReady) return false;

        for (const topic of topics) {
            try {
                await admin.messaging().unsubscribeFromTopic(fcmToken, topic);
                console.log(`[NotifyService] Unsubscribed from topic: ${topic}`);
            } catch (error) {
                console.error(`[NotifyService] Error unsubscribing from topic ${topic}:`, error.message);
            }
        }
        return true;
    }

    // Send push notification to specific users.
    async sendNotification(uids, title, message, type, typeId, payload, sendBy, isStore = false) {
        if (!isFirebaseReady || !uids || uids.length === 0) return false;

        try {
            const fcmTokens = await fcmTokenRepository.getActiveTokensByUsers(uids);

            const pushPayload = {
                notification: {
                    title: title,
                    body: message,
                },
                data: {
                    type: String(type),
                    type_id: String(typeId || 0),
                    send_by: String(sendBy || 0),
                    payload: typeof payload === "string" ? payload : JSON.stringify(payload || {}),
                    sound: "default",
                },
                android: {
                    notification: { sound: "default" },
                },
                apns: {
                    payload: { aps: { sound: "default" } },
                },
            };

            // Store in database if requested
            if (isStore) {
                for (const uid of uids) {
                    // Check if user is active
                    const user = await userRepository.findById(uid, ["id", "status"]);
                    if (user && user.status === 1) {
                         await notificationRepository.create({
                             user_id: uid,
                             title,
                             message,
                             type,
                             type_id: typeId,
                             payload: pushPayload,
                             send_by: sendBy,
                             status: 0
                         });
                    }
                }
            }

            if (fcmTokens && fcmTokens.length > 0) {
                for (const tokenRow of fcmTokens) {
                    const messageObj = {
                        ...pushPayload,
                        token: tokenRow.fcm_token,
                    };

                    try {
                        const response = await admin.messaging().send(messageObj);
                        console.log(`[NotifyService] Push notification sent successfully (${tokenRow.user_id}):`, response);
                    } catch (error) {
                        console.log(`[NotifyService] Push notification send error (${tokenRow.user_id}):`, error.message);
                    }
                }
            }
            return true;
        } catch (err) {
            console.error("[NotifyService] Error:", err.message);
            return false;
        }
    }

    // Send push notification to a topic.
    async sendTopicNotification(topic, title, message, type, typeId, payload, sendBy, isStore = false) {
        if (!isFirebaseReady) return false;

        try {
            const pushPayload = {
                notification: {
                    title: title,
                    body: message,
                },
                data: {
                    type: String(type),
                    type_id: String(typeId || 0),
                    send_by: String(sendBy || 0),
                    payload: typeof payload === "string" ? payload : JSON.stringify(payload || {}),
                    sound: "default",
                },
                android: {
                    notification: { sound: "default" },
                },
                apns: {
                    payload: { aps: { sound: "default" } },
                },
                topic: topic,
            };

            // Note: Topic notifications store a generic record with user_id = 0 as per legacy logic.
            if (isStore) {
                await notificationRepository.create({
                    user_id: 0,
                    title,
                    message,
                    type,
                    type_id: typeId,
                    payload: { ...pushPayload, topic },
                    send_by: sendBy,
                    status: 0
                });
            }

            try {
                const response = await admin.messaging().send(pushPayload);
                console.log(`[NotifyService] Topic notification sent successfully (${topic}):`, response);
            } catch (error) {
                console.log(`[NotifyService] Error sending topic notification (${topic}):`, error.message);
            }

            return true;
        } catch (err) {
            console.error("[NotifyService] send topic notification error:", err.message);
            return false;
        }
    }
}

const notifyService = new NotifyService();
export { notifyService, NotifyService };
