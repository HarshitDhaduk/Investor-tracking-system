# Notification Engine

## 1. Module Purpose
A centralized, decoupled ecosystem responsible for alerting users to systemic changes via Database (In-App), Email, and Firebase Push Notifications.

## 2. Key Files
- `src/services/notification.service.js` (The Orchestrator)
- `src/services/mail.service.js` (EJS & Nodemailer)
- `src/services/notify.service.js` (Firebase Cloud Messaging)

## 3. Core Business Logic & Code Blocks

### 3.1. Clean Orchestration
Instead of having 20 different services injecting the `Nodemailer` plugin, all services call `NotificationService`. 

```javascript
// From notification.service.js -> sendNotification()
async sendNotification(params) {
    const { user_ids, title, message, send_email = false, send_push = false } = params;

    // 1. ALWAYS store natively in the DB repository for the User's Notification Bell
    for (const userId of user_ids) {
        await notificationRepository.create({ userId, title, message });
    }

    // 2. Dispatch Push to mobile devices asynchronously
    if (send_push) {
        const tokens = await fcmTokenRepository.getActiveTokensByUsers(user_ids);
        if (tokens.length > 0) {
            await notifyService.sendMulticast(tokens, { title, body: message });
        }
    }

    // 3. Dispatch Emails
    if (send_email) {
       // calls mailService
    }
}
```

### 3.2 Safe External Dependency Loading
We utilize an external `config/firebase.json` for Push functionality. Sometimes, in development environments this file is missing. The engine safely handles this without a crash loop.

```javascript
// from notify.service.js
const credPath = path.resolve(process.cwd(), 'src/config', 'firebase.json');
if (fs.existsSync(credPath)) {
    // Initialize admin
} else {
    // Fallback gracefully 
    console.warn("Firebase config not found. Push notifications disabled.");
}
```

### Interviewer Perspective & Potential Questions

**Q1: What is the design pattern used in the Notification Service?**
> **Expected Answer:** "It acts primarily as an **Adapter** and **Facade** pattern. It provides a highly simplified, unified interface (`sendNotification`) to the rest of the application, hiding the extreme complexities of SMTP transport buffering, Firebase token multiplexing, and direct PostgreSQL repository INSERTS."

**Q2: What happens if the Firebase server times out or Nodemailer throws a connection error? Does it crash the API request?**
> **Expected Answer:** "No. You'll notice in our implementation inside services like `payment.service.js` or `auth.service.js`, the call to notifications is wrapped inside an inner `try/catch` distinct from the main operation. Notifications are treated as 'best-effort, fire-and-forget'. If an email fails, we log it, but the Investor's payment is still successfully processed."

**Q3: How do you handle multiple push devices for the same user?**
> **Expected Answer:** "We created an `FcmTokenRepository`. When a user logs in on their iPhone, and their iPad, both tokens are registered against their User ID. When `notificationRepository` prepares to dispatch a Push, we select an array of active tokens for that specific user. Firebase `sendMulticast` natively handles blasting a single payload payload concurrently to that array of devices."
