# Dashboard & Performance Module

## 1. Module Purpose
Provides high-level analytical aggregations for Administrative oversight, summarizing liquidity, outstanding obligations, capital raised, and user growth across the platform.

## 2. Key Files
- `src/services/dashboard.service.js`
- `src/services/performance.service.js`
- `src/repositories/dashboard.repository.js`
- `src/repositories/performance.repository.js`

## 3. Core Business Logic & Code Blocks

### 3.1. Dashboard Aggregations
The Admin Dashboard requires a macroscopic view of the entire financial system. Instead of pulling all records into memory and looping over them in Node.js (which would crash at scale), we push the heavy lifting to PostgreSQL.

```javascript
// From dashboard.repository.js -> getStats()
const stats = await this.selectOne(`
    SELECT 
        (SELECT COUNT(id) FROM users WHERE role = 1 AND status = 1) as total_active_investors,
        (SELECT COALESCE(SUM(capital_amount), 0) FROM capital_tranches WHERE status = 1) as total_active_capital,
        (SELECT COALESCE(SUM(payment_amount), 0) FROM payment_schedules WHERE status = 0) as upcoming_financial_obligations
`);
```

### 3.2. Performance History Snapshotting
The Performance Service generates a month-by-month historical track record. It analyzes historical `payment_schedules` to determine actual funds disbursed versus theoretical projected interest.

```javascript
// From performance.service.js
async getAdminPerformance(filters) {
    // 1. Fetch total capital currently managed
    const activeCapital = await capitalTrancheRepository.getTotalActiveCapital();
    
    // 2. Calculate actual realized payouts based on 'Paid' payment entries
    const historicalPayouts = await paymentRepository.getTotalPaidAmount();
    
    // 3. Calculate future liabilities based on 'Pending' scheduling entries
    const futureLiabilities = await paymentRepository.getTotalPendingAmount();

    return {
        aum: activeCapital,
        total_returns_paid: historicalPayouts,
        projected_liabilities: futureLiabilities
    };
}
```

### Interviewer Perspective & Potential Questions

**Q1: Why did you choose to run multiple sub-queries in a single `SELECT` for the dashboard stats instead of running them separately using `Promise.all`?**
> **Expected Answer:** "Running them as sub-queries in a single PostgreSQL statement minimizes network round-trips between the Node.js server and the database server. While `Promise.all` fires off concurrent connections from the connection pool, a single composite query is parsed, optimized, and executed internally by the PostgreSQL engine much faster, saving both network latency and connection pool overhead."

**Q2: If the system scales to 1,000,000 payment schedules, a massive `SUM()` query for performance might become slow. How would you optimize it?**
> **Expected Answer:** "Currently, the active DB is small enough for live aggregations. However, for a scale of millions of records, I would introduce **Read-Models** or **Materialized Views**. Instead of calculating the `SUM()` live on every dashboard request, we would update a cached `system_statistics` table via DB Triggers or a background Cron Job (like our `ScheduledTaskService`) every night at midnight. The dashboard API would then just read a pre-calculated single row in 1 millisecond."

**Q3: How do you handle pagination and large datasets for the performance lists?**
> **Expected Answer:** "We strictly enforce `LIMIT` and `OFFSET` in our Repository queries natively. By accepting `page` and `limit` parameters in our Controllers, we pass those to the Repositories to ensure PostgreSQL only ever returns highly restricted data chunks over the wire, protecting Node's V8 memory heap from Out-Of-Memory (OOM) crashes."
