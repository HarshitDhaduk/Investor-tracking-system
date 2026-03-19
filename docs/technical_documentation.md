# Morval Investments API - Technical Documentation

## 1. Project Overview & Business Requirements
**Morval Investments API** is a comprehensive backend platform designed to manage investor portfolios, capital investments, return computations, and financial scheduling. 

### Core Business Requirements:
- **Investor Management:** Secure onboarding and management of investor profiles with automated credential generation.
- **Contract & Portfolio Tracking:** Handling multiple capital investments (tranches) under distinct contract types.
- **Financial Return Calculations:** Supporting both **Monthly Payable** interest and **Compounding** interest formulas.
- **Automated Scheduling:** Programmatic generation of payment schedules spanning the lifetime of an investment contract.
- **Admin Dashboard & Performance:** Generating aggregations for KPIs (Capital Raised, Interest Obligations, Active Funds).
- **Multi-Channel Notifications:** Alerting investors of payment reminders, processing statuses, and contract updates via Email, Push, and In-App notifications.

---

## 2. System Architecture
The application was migrated from a legacy coupled structure to a modern, highly-cohesive **Clean Architecture**. This separation of concerns ensures scalability, testability, and maintainability.

- **Controllers (Presentation Layer):** Responsible for parsing incoming HTTP requests, validating payload structures, extracting authentication tokens, and delegating the payload to the respective Services. They format the standard API response.
- **Services (Business Logic Layer):** The "brain" of the application. This layer holds 100% of the business rules, algorithmic calculations (like compound interest), orchestrates multiple repositories, and triggers notification dispatches.
- **Repositories (Data Access Layer):** The only layer aware of the database schema. It abstracts raw SQL queries into Javascript methods, ensuring the Service layer remains DB-agnostic.

---

## 3. Technology Stack
- **Runtime:** Node.js
- **Framework:** Express.js (REST API architecture)
- **Database:** PostgreSQL (Migrated from a legacy structure, utilizing the `pg` driver with connection pooling).
- **Authentication:** JWT (JSON Web Tokens) for stateless session management and `bcrypt` for secure password hashing.
- **Notifications:** `Nodemailer` with `EJS` templates for dynamic HTML emails, and `Firebase Admin SDK` (FCM) for mobile/web push notifications.

---

## 4. Core Business Modules (Module-Wise Breakdown)

### 4.1. Contract & Capital Tranche Module
*Files: [contract.service.js](file:///d:/Harshit-Projects/Office%20Projects/Morval-Investments/morval-investment-new-structure/src/services/contract.service.js), [capital-tranche.service.js](file:///d:/Harshit-Projects/Office%20Projects/Morval-Investments/morval-investment-new-structure/src/services/capital-tranche.service.js)*

**Business Logic:**
Investors don't just put money into an account; they sign a **Contract** that dictates the terms. A single investor can have multiple **Capital Tranches** (distinct deposits). 

There are two primary Contract Types:
1. **Monthly Payable (Type 0):** The fixed interest rate is paid out to the investor every single month. The original principal amount remains untouched until the contract maturity date.
2. **Compounding (Type 1):** No monthly payouts are made. The interest generated each month is immediately reinvested into the principal, causing exponential growth. The total accumulated amount is paid out as a lump sum at the end of the contract.

### 4.2. Payment Scheduling & Automation Module
*Files: [payment-scheduling.service.js](file:///d:/Harshit-Projects/Office%20Projects/Morval-Investments/morval-investment-new-structure/service/payment-scheduling.service.js), [automated-payment.service.js](file:///d:/Harshit-Projects/Office%20Projects/Morval-Investments/morval-investment-new-structure/service/automated-payment.service.js), [scheduled-task.service.js](file:///d:/Harshit-Projects/Office%20Projects/Morval-Investments/morval-investment-new-structure/service/scheduled-task.service.js)*

**Business Logic:**
When a capital tranche is approved, the system mathematically projects the future.
- **Generation:** [payment-scheduling.service.js](file:///d:/Harshit-Projects/Office%20Projects/Morval-Investments/morval-investment-new-structure/service/payment-scheduling.service.js) loops from the `investment_date` to the `contract_end_date`. If it's a *Monthly* contract, it generates a database record for every single month calculating `Principal * Fixed Rate`. If it's *Compounding*, it calculates `Principal * (1 + Fixed Rate)^Months` and creates a single payment record strictly on the maturity date.
- **Automation:** A running cron-like interval ([scheduled-task.service.js](file:///d:/Harshit-Projects/Office%20Projects/Morval-Investments/morval-investment-new-structure/service/scheduled-task.service.js)) triggers [AutomatedPaymentService](file:///d:/Harshit-Projects/Office%20Projects/Morval-Investments/morval-investment-new-structure/src/services/automated-payment.service.js#5-202) daily. This service queries the DB for upcoming payments, dispatching 7-day and 3-day **Payment Reminders**. If a payment date passes without being fulfilled, it flags the status as [Overdue](file:///d:/Harshit-Projects/Office%20Projects/Morval-Investments/morval-investment-new-structure/src/services/automated-payment.service.js#10-66) and alerts the Admin and Investor.

### 4.3. Authentication & Authorization Module
*Files: [auth.service.js](file:///d:/Harshit-Projects/Office%20Projects/Morval-Investments/morval-investment-new-structure/src/services/auth.service.js)*

**Business Logic:**
Handles standard JWT issuance. Passwords are never stored in plaintext (`bcrypt` hashing). 
- **Roles:** The system enforces strict role-based access. Administrative operations (bulk processing payments, approving capital tranches) reject tokens belonging to standard investors.
- **Automated Issuance:** When an Admin creates a new investor, the Auth service generates a cryptographically strong random password, hashes it, saves the user, and immediately hooks into the Notification Service to email the plaintext password once to the user.

### 4.4. Investor Management & Bank Details Review
*Files: [investor-management.service.js](file:///d:/Harshit-Projects/Office%20Projects/Morval-Investments/morval-investment-new-structure/src/services/investor-management.service.js), [bank-details.service.js](file:///d:/Harshit-Projects/Office%20Projects/Morval-Investments/morval-investment-new-structure/src/services/bank-details.service.js)*

**Business Logic:**
- **KYC/Bank Review:** Investors submit their banking details where their returns will be deposited. These enter a [Pending](file:///d:/Harshit-Projects/Office%20Projects/Morval-Investments/morval-investment-new-structure/src/repositories/contract.repository.js#53-60) state. The API blocks any automated payouts to [Pending](file:///d:/Harshit-Projects/Office%20Projects/Morval-Investments/morval-investment-new-structure/src/repositories/contract.repository.js#53-60) bank accounts. An Admin must review and transition the account to `Approved`. If `Rejected`, the investor is notified to resubmit.

### 4.5. Multi-Channel Notification Ecosystem
*Files: [notification.service.js](file:///d:/Harshit-Projects/Office%20Projects/Morval-Investments/morval-investment-new-structure/src/services/notification.service.js), [mail.service.js](file:///d:/Harshit-Projects/Office%20Projects/Morval-Investments/morval-investment-new-structure/src/services/mail.service.js), [notify.service.js](file:///d:/Harshit-Projects/Office%20Projects/Morval-Investments/morval-investment-new-structure/src/services/notify.service.js)*

**Business Logic:**
Notifications aren't hardcoded into modules. We built a centralized, decoupled Notification Engine.
Whenever a module requests a notification (e.g., "Payment Processed"), the orchestration service coordinates three parallel actions:
1. **In-App:** Writes a persistent record to the `notifications` PostgreSQL table for the user's dashboard bell icon.
2. **Email:** Passes data payloads to [mail.service.js](file:///d:/Harshit-Projects/Office%20Projects/Morval-Investments/morval-investment-new-structure/src/services/mail.service.js) which renders responsive HTML via EJS templates (`src/views/emails/`) and dispatches via SMTP.
3. **Push:** Queries `fcm-token.repository.js` for all active mobile device tokens owned by the user and dispatches a low-latency push notification via Firebase (`notify.service.js`).

### 4.6. Admin Dashboard & Performance Analytics
*Files: `dashboard.service.js`, `performance.service.js`*

**Business Logic:**
Calculates real-time financial health.
- Identifies **Total Active Capital** vs **Total Pending Capital**.
- Uses aggregation queries to sum up the upcoming month's **Interest Obligations** (how much liquid cash the firm needs to payout this month to Monthly Payable investors).
- Compiles systemic performance histories (Total funds disbursed over time, active investor count growth) preventing the need for complex, heavy calculations on the frontend interface.
