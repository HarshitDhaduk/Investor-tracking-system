# Investor Management & Bank Details Module

## 1. Module Purpose
Manages the lifecycle of an Investor entity, prioritizing stringent KYC-style workflows for banking information to prevent unauthorized financial disbursement.

## 2. Key Files
- `src/services/investor-management.service.js` (Admin perspective)
- `src/services/investor.service.js` (Investor perspective)
- `src/services/bank-details.service.js` (Approval Workflow)

## 3. Core Business Logic & Code Blocks

### 3.1. Dual Perspective Architecture
Notice we have two different services for "Investors". 
- `investor-management.service.js` is strictly used by Administrator controllers to create, edit, suspend, or view all investors.
- `investor.service.js` is the isolated logic for the end-user (the investor themselves) to view their own profile, submit their own bank details, and view their own capital tranches. This guarantees that an Investor API endpoint can never accidentally query another user's data by referencing the wrong service.

### 3.2. Bank Details KYC Workflow
When it comes to financial payouts, security is paramount. When an investor changes their bank account, the system does not auto-approve it.

```javascript
// From bank-details.service.js -> updateStatus()
async updateStatus(bankDetailsId, status, adminId, remarks = null) {
    // 0 = Pending, 1 = Approved, 2 = Rejected
    const currentDetails = await bankDetailsRepository.findById(bankDetailsId);
    
    // Status Guard Clause
    if (currentDetails.status !== 0) {
        throw ApiError.badRequest("Can only update 'Pending' bank details.");
    }

    // Update the record
    await bankDetailsRepository.updateStatus(bankDetailsId, status, adminId, remarks);

    // Alert the user that their banking info is now ready for payouts
    const user = await userRepository.findById(currentDetails.user_id);
    const statusText = status === 1 ? 'Approved' : 'Rejected';
    
    await notificationService.sendNotification({
        user_ids: [user.id],
        title: `Bank Details ${statusText}`,
        message: `Your updated bank details have been ${statusText.toLowerCase()}.`
    });
}
```

### Interviewer Perspective & Potential Questions

**Q1: What happens to upcoming, automated payments if an Investor's Bank Details are currently set to 'Pending' or 'Rejected'?**
> **Expected Answer:** "This is handled natively by the `AutomatedPaymentService`. The system will not process a payout unless a verified `Approved` bank detail record exists for that User ID. If the cron job triggers a payment, and the bank is pending, the payment sits in a `Pending Execution` state, generating a notification to both the Admin and Investor to resolve the banking situation."

**Q2: Why do you enforce `adminId` inside the `updateStatus` method?**
> **Expected Answer:** "For auditing and financial compliance. If an incorrect bank account is approved and highly sensitive funds are routed to the wrong location, we must look at the database and instantly identify exactly which human Administrator authorized that change. The `adminId` is pulled securely from the JWT token during the incoming request."

**Q3: How do you prevent an investor from submitting malicious code when defining their Account Name or Bank Name?**
> **Expected Answer:** "We rely on Data Transfer Object (DTO) validation inside the Controller layers using a validation library (like JOI or Express-Validator) before the payload even touches the `bank-details.service.js`. We strip out HTML tags and script injections. Furthermore, since we use parameterized queries with the Postgres `pg` connection pool in our Repositories (`VALUES ($1, $2)`), SQL injection attacks are mathematically impossible."
