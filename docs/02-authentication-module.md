# Authentication & Authorization Module

## 1. Module Purpose
Handles secure JWT generation, administrative onboarding, and cryptographic security for investor credentials. 

## 2. Key Files
- `src/services/auth.service.js`
- `src/repositories/auth.repository.js`
- `src/utils/crypto.utils.js`

## 3. Core Business Logic & Code Blocks

### 3.1. Admin Super-Powers vs Investor Limits
When a user logs in, the `AuthService` issues a split-role JWT. The `role` flag inside the JWT governs access throughout the application using an `isAdmin` or `isInvestor` middleware.

```javascript
// From auth.service.js -> login()
const token = generateToken({
    id: user.id,
    role: user.role, // 2 = admin, 1 = investor
    email: user.email
});
```

### 3.2. Automated Investor Provisioning
When an Admin creates an Investor, the system securely generates a random password, hashes it using `bcrypt` (Salt Rounds = 10), saves it, and then emails the plaintext version.

```javascript
// Inside auth.service.js -> createInvestor()
const textPassword = generateStrongPassword(10);
const hashedPassword = await encryptPassword(textPassword);

await userRepository.create({
    f_name, l_name, email, 
    password: hashedPassword,
    role: 1 // hardcoded investor role
});

// Immediately send the plaintext password via mail
await mail.sendCredentials(email, textPassword, f_name);
```

### Interviewer Perspective & Potential Questions

**Q1: Why do you generate a password for the investor instead of letting them create one?**
> **Expected Answer:** "In a wealth management firm like Morval Investments, onboarding is a highly controlled administrative process. The Admin provisions the account. To ensure security, the Admin never sees the password; the system generates it chronologically, hashes it into Postgres, and sends the temporary plaintext string directly to the client's email via Nodemailer. We do not store plaintext passwords anywhere."

**Q2: Are there any security risks with emailing a plaintext password?**
> **Expected Answer:** "There is an inherent risk, which is why the system's email flow is strictly HTTPS and uses TLS-secured SMTP servers. Furthermore, we enforce a 'Change Password on First Login' policy, rendering the emailed temporary password obsolete almost immediately."

**Q3: How do you handle JWT revocation if a user's access needs to be terminated immediately?**
> **Expected Answer:** "Our JWTs have a relatively short expiry. More importantly, critical backend operations check the user's `status` flag in the database (via `UserRepository.findById`). If an Admin suspends an account (`status = 0`), the active JWT becomes effectively useless for any sensitive database mutations."
