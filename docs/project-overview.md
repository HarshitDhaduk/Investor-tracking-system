# Interview Preparation Guide: Morval Investor Tracking System

This guide is designed from your perspective ("I built this...") to help you confidently explain your project, the architecture, and how you leveraged AI to build complex financial features.

---

## 1. Project Walkthrough (Non-Technical Explanation)

**The Elevator Pitch:**
"I built the Morval Investor Tracking System to serve as a centralized backend platform for an investment firm. The goal was to manage investors, track their changing portfolio performance, and fully automate their payout schedules—reducing manual calculation errors."

**How It Works:**
- **Onboarding:** As an admin, I can create accounts for new investors and record their initial investment amounts (capital tranches). 
- **Contract Handling:** I designed the system to handle two main investment strategies: 
  1. **Monthly Payable:** The interest/profit is paid out to the investor's bank account every month.
  2. **Monthly Compounding:** The profit is reinvested into the portfolio to grow the principal amount until the contract ends.
- **Automated Payouts:** The system automatically schedules payment due dates and calculable amounts based on the specific investor's contract type and initial investment date. It also automatically flags overdue payments and sends upcoming reminders.
- **Investor Portal:** I built an investor-facing portal where users can log in, view their current portfolio value, track month-over-month growth, and manage their bank details.

---

## 2. Technical Architecture & Enforced Coding Rules

"To ensure the codebase remained scalable, maintainable, and clean, I adopted a strict layered architecture (Model-View-Controller pattern)."

- **`routes/`:** Map incoming API requests. I structured them strictly and applied custom middlewares (like `authMiddleware` and `adminOnly` logic) to handle Role-Based Access Control (RBAC).
- **`controllers/`:** I kept controllers extremely thin. Their only job is to extract requirements from `req.body`, validate them, and pass them down. Absolutely no business logic lives here.
- **`services/`:** The core "brain" of my application.
- **`repositories/`:** I encapsulated all raw PostgreSQL queries inside repository classes to separate database logic from business logic.

### Leveraging AI for Strict Code Governance
"To maintain these high standards rapidly, **I wrote a comprehensive `.agent/workflows/coding-rules.md` file.** This document explicitly mapped out my strict requirements:
1. Controllers must be thin and only use `validateRequest()` for validation.
2. Services cannot contain raw SQL.
3. Repositories handle all database queries.
4. Database tables must have `created_at` and `updated_at` with PostgreSQL database triggers automatically updating them.
5. Strict guidelines on Postman collection organization and documentation.

By creating this strict rulebook, I was able to prompt AI tools to write highly compliant, production-ready code exactly the way I wanted it structured, rather than getting messy, unstructured boilerplate."

---

## 3. Deep Dive: Thin Controllers & Background Processing

"Another crucial component I built is the Performance Distribution system. Calculating and distributing monthly performance (profits/losses) across all active investors is a heavy operation. Here is how I structured this logic to ensure system stability."

### A. The "Thin Controller" Approach (`performance.controller.js`)
"Following my `coding-rules.md`, I ensured the controller doing the heavy lifting remained incredibly thin. Its only job is validation and delegation:"

```javascript
// From performance.controller.js
addPerformance = catchAsync(async (req, res) => {
    // 1. Validates only the required fields
    validateRequest(req, ["type", "month", "year"]);
    
    // 2. Delegates entirely to the service layer for heavy logic
    const result = await performanceService.addMonthlyPerformance(req.body, req._id);
    
    // 3. Immediately returns a standardized response
    return ApiResponse.success(res, result, result.message || "Performance added successfully");
});
```

### B. Business Logic & Background Batching (`performance.service.js`)
"In the service layer, the logic splits between individual calculation and global fund distribution. Distributing profits to potentially thousands of investors in a single API request would cause an HTTP timeout and freeze the Node.js event thread.

To solve this, I designed a non-blocking background processor using chunks and `setImmediate`:"

```javascript
// From performance.service.js
async addMonthlyPerformance(data, adminId) {
    if (data.type === "individual") {
        return await this.processIndividualPerformance(...);
    } else if (data.type === "fund") {
        // Asynchronous background processing ensures the API responds immediately
        // without keeping the admin client waiting for thousands of database writes.
        this.processFundPerformance(...).catch(err => {
            console.error("Critical Error in Background Fund Performance Distribution:", err);
        });
        
        return { message: "Fund performance distribution started in background" };
    }
}
```

**How the logic prevents server crashes:**
"Inside `processFundPerformance()`, the logic separates the operation into two passes:
1. **Aggregation First:** It pulls active investors in bite-sized chunks of 50 from the repository to determine the global performance percentage without loading the entire database into RAM at once.
2. **Distribution with Yielding:** It iterates through the investors and writes the updates in batches of 50. After processing a batch, it recursively calls `setImmediate(distributeBatch)`. This yields the event loop back to Node.js, allowing the server to seamlessly handle other incoming customer API requests while finishing the fund distribution in the background."

---

## 4. Deep Dive: The Intricate Automated Payment System

"Because financial math and edge cases (like leap years, different days of the month, and compounding interest formulas) are prone to human error, **I used AI to develop the intricate automated payment system, strictly bounded by my coding rules.**"

Here is how I structured the system:

### A. Dynamic Payment Scheduling (`payment-scheduling.service.js`)
When an investor is onboarded, the system generates their entire payout schedule up to the end of their contract. The AI helped me implement the core loop that calculates exact days of the month while respecting invalid days (e.g., February 30th).

```javascript
// From payment-scheduling.service.js
while (currentDate <= endDate) {
    // Ensuring we don't schedule a payment on an invalid day of the month
    const targetDay = this.getValidDayForMonth(currentDate.getFullYear(), currentDate.getMonth(), investmentDay);
    currentDate.setDate(targetDay);

    let paymentAmount = 0;
    
    // Contract Type 0: Flat Monthly Payout
    if (contractType === 0) {
        paymentAmount = parseFloat((principalAmount * fixedRate).toFixed(6));
    } 
    // Contract Type 1: Compounding (Paid at maturity)
    else {
        if (currentDate.getTime() === endDate.getTime()) {
            const monthsToMaturity = this.getMonthsDifference(startDate, endDate);
            paymentAmount = parseFloat((principalAmount * Math.pow(1 + fixedRate, monthsToMaturity)).toFixed(6));
        } else {
            currentDate.setMonth(currentDate.getMonth() + 1);
            continue; // Skip creating monthly payouts, wait for maturity
        }
    }
    // ... inserts into payment_schedules
```

### B. Automated Tracking & Processing (`automated-payment.service.js`)
I also built an automated service to scan for upcoming and overdue payments, integrating directly with a notification system to alert users via push notifications (Firebase) and emails.

```javascript
// From automated-payment.service.js
async processOverduePayments() {
    // 1. Fetch overdue payments directly through the repository layer
    const overduePayments = await this.select(
        `SELECT ps.*, u.f_name, u.l_name, u.email, u.contract_type
         FROM payment_schedules ps
         JOIN users u ON ps.user_id = u.id
         WHERE ps.due_date < ? AND ps.status = 0
         AND u.role = 1 AND u.status = 1`,
        [today]
    );

    // 2. Process and trigger cross-service notifications
    for (const payment of overduePayments) {
        const updated = await this.update(
            "UPDATE payment_schedules SET status = 2, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [payment.id]
        );

        if (updated) {
            await notificationService.sendNotification({
                user_ids: [payment.user_id],
                title: "Payment Overdue",
                message: `Your payment of $${parseFloat(payment.payment_amount).toFixed(2)} due on ${payment.due_date} is now overdue.`,
                type: "payment_overdue",
                // ... payload data
            });
        }
    }
}
```

**How AI assisted here:** I provided the database schema and the business laws (e.g., formula for compound maturity), and the AI successfully drafted the date-iteration logic and the raw SQL joins, saving me hours of debugging index out-of-bounds errors on dates. I reviewed, refined, and accepted the architecture because the AI completely adhered to my `coding-rules.md` (separating the repository selection from the service logic).

---

## 5. Anticipated Interview Questions & My Answers

**Q1: How did you ensure your codebase remained consistent as it grew?**
> **My Answer:** "I created a strict `.agent/workflows/coding-rules.md` configuration at the very beginning of the project. It explicitly defined that all controllers must be thin, raw SQL belongs strictly in the repository layer, and services handle business logic. I used AI as a pair programmer, and by feeding it this rulebook, the AI generated code that perfectly matched my intended architecture without needing constant refactoring."

**Q2: Why did you choose PostgreSQL over a NoSQL database like MongoDB?**
> **My Answer:** "Because this is a financial application tracking investments, payments, and capital tranches. I needed absolute data integrity (ACID properties), strict schemas, and relational constraints. I also heavily leveraged PostgreSQL triggers (like `sync_portfolio_value`) to automatically recalculate an investor's total portfolio value at the database level whenever performance data changes."

**Q3: Walk me through the most complex piece of logic you wrote.**
> **My Answer:** "The most complex part was the automated payment scheduling system. Since investors can join on any day of the month and choose between compounding or monthly payouts, the backend has to dynamically calculate exact due dates. I implemented logic to handle edge cases (like months with fewer days) and used math functions to calculate compound interest over specific month durations before writing the schedules to the database."

**Q4: How did you handle performance scaling when dealing with thousands of investors?**
> **My Answer:** "I utilized background batching. For example, when adding global fund performance, calculating and writing updates to thousands of users simultaneously would block the Node thread and timeout the request. I solved this by immediately responding to the client, and running the distribution loop in chunks of 50, using `setImmediate` between iterations to yield the thread back to other API requests."

**Q5: How do you handle security in this API?**
> **My Answer:** "I implemented JWT for session management and stored passwords using bcrypt hashing. I also built strict, modular authentication middlewares (`adminOnly`, `authMiddleware`) that physically block requests before they ever reach the controllers, ensuring robust Role-Based Access Control."
