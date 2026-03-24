# Payment Scheduling & Automation Engine

## 1. Module Purpose
A highly mathematical module designed to project, schedule, and automate the execution lifecycle of financial payouts. 

## 2. Key Files
- `src/services/payment-scheduling.service.js`
- `src/services/automated-payment.service.js`
- `src/services/scheduled-task.service.js`

## 3. Core Business Logic & Code Blocks

### 3.1. Schedule Generation Algorithm
The heart of the financial calendar. It loops from `Start Date` to `End Date` calculating exactly how much is due on what day.

```javascript
// From payment-scheduling.service.js
while (currentDate <= endDate) {
    let paymentAmount = 0;

    if (contractType === 0) {
        // Monthly Payable math: Capital * Rate
        paymentAmount = parseFloat((principalAmount * fixedRate).toFixed(6));
    } else {
        // Compounding logic: Only issue a schedule record mathematically at Maturity
        if (currentDate.getTime() === endDate.getTime()) {
            const monthsToMaturity = this.getMonthsDifference(startDate, endDate);
            paymentAmount = parseFloat((principalAmount * Math.pow(1 + fixedRate, monthsToMaturity)).toFixed(6));
        } else {
            // Skip intermediate months for compounding
            currentDate.setMonth(currentDate.getMonth() + 1);
            continue; 
        }
    }

    scheduleRecords.push({
        user_id: userId,
        due_date: currentDate.toISOString().split('T')[0],
        payment_amount: paymentAmount,
        status: 0 // 0 = Pending Execution
    });
}
```

### 3.2 Backend CRON Automation
Scheduled jobs are critical because time passes whether the Admin is logged in or not. `scheduled-task.service.js` runs intervals that invoke the automated processing.

```javascript
// inside automated-payment.service.js
async processOverduePayments() {
    const today = new Date().toISOString().split('T')[0];
    
    // Select all where due_date has passed but status is still Pending (0)
    const overduePayments = await this.select(
        `SELECT * FROM payment_schedules WHERE due_date < ? AND status = 0`, 
        [today]
    );

    for (const payment of overduePayments) {
        // Mark as 2 (Overdue)
        await this.update("UPDATE payment_schedules SET status = 2 WHERE id = ?", [payment.id]);
        
        // Dispatch alert to user and system
        await notificationService.sendNotification({ type: 'payment_overdue' });
    }
}
```

### Interviewer Perspective & Potential Questions

**Q1: How do you handle edge cases like February 29th or months with 30 days when a contract started on the 31st?**
> **Expected Answer:** "We built a mathematical helper `getValidDayForMonth(year, month, day)`. If an investment started on January 31st, when the `while` loop hits February, it asks the Date object for the maximum valid day of that specific month and year. In this case, it safely caps the target day at 28 (or 29 on leap years), preventing invalid date overflows."

**Q2: What happens if your server shuts off and the Cron job misses a day? Do you lose the payment trigger?**
> **Expected Answer:** "No, because the scheduling system is heavily state-driven and idempotent. The queries to flag an Overdue payment look for `due_date < ? AND status = 0`. Even if the server is off for 48 hours, the moment it turns back on, it pulls all records matching that query constraint and processes them. It does not rely on exact micro-second precision firing."

**Q3: Floating point math in JavaScript is famously terrible (e.g., 0.1 + 0.2 = 0.30000000000000004). How do you handle exact financial calculations?**
> **Expected Answer:** "Ideally, we use a library like `decimal.js` for financial arithmetic. But natively, we handle JS floating point drift by applying standard mathematical fixed precision truncation utilizing `.toFixed(6)` down to the micro-cent for database insertion, and parsing that string block back to `parseFloat` prior to return wrappers."
