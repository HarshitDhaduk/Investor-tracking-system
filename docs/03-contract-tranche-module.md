# Contract & Capital Tranche Module

## 1. Module Purpose
This module handles the core financial domain: Investors, their Contracts, and their multi-deposit Capital Tranches.

## 2. Key Files
- `src/services/contract.service.js`
- `src/services/capital-tranche.service.js`

## 3. Core Business Logic & Code Blocks

### 3.1. Contract Types (Monthly vs Compounding)
The entire math of the application acts based on the `contract_type` boolean in the database.
- `0 = Monthly Payable`: Fixed amount disbursed every 30 days.
- `1 = Compounding`: Reinvested monthly, disbursed as a lump sum upon contract maturity.

### 3.2 Capital Tranche Approval Flow
An investor can add multiple blocks of money (Tranches). When an Admin approves a Tranche, it becomes active. Crucially, the system must synchronize the `PaymentSchedulingService` when the underlying principal changes.

```javascript
// From capital-tranche.service.js
async updateTrancheStatus(trancheId, status, adminId) {
    const tranche = await capitalTrancheRepository.findById(trancheId);
    
    // Status 1 = Approved
    if (status === 1) {
        // Update the tranche to Active
        await capitalTrancheRepository.updateStatus(trancheId, 1);
        
        // Fetch investor's contract to calculate new obligations
        const user = await userRepository.findById(tranche.user_id);
        
        // Dynamic re-run of payment scheduling for future dates given the new Capital total
        await paymentSchedulingService.generatePaymentSchedule(
            user.id,
            tranche.contract_start_date,
            user.contract_end_date,
            user.contract_type,
            user.fixed_interest_rate,
            tranche.capital_amount
        );
        
        // Notify the user via the Notification Engine
        await notificationService.sendNotification(...);
    }
}
```

### Interviewer Perspective & Potential Questions

**Q1: What is a Capital Tranche and why not just update the 'Total Balance'?**
> **Expected Answer:** "In finance, simply updating a total balance destroys the audit trail. A Capital Tranche represents a discrete financial transaction or deposit with a specific timestamp. Especially for Compounding contracts, the time-value of money means a Tranche deposited in January earns more lifetime interest than a Tranche deposited in June. Keeping them in separate DB rows allows accurate per-tranche interest calculation."

**Q2: What happens to the payment schedule if a new tranche is approved mid-contract?**
> **Expected Answer:** "When `updateTrancheStatus` acts on an approval, it triggers `paymentSchedulingService.generatePaymentSchedule()`. The architecture handles this elegantly by retaining the old payment projections for the old balance, but creating new proportional payment obligations corresponding specifically to the new tranche's amount starting from its respective `contract_start_date`."
