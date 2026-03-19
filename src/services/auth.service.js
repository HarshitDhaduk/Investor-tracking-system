import { ApiError } from "../utils/ApiError.js";
import {
    encryptPassword,
    validatePassword,
    generateApiKey,
    generateToken,
    generateRandomString,
    generateStrongPassword,
} from "../utils/crypto.utils.js";
import { uploadFile } from "../utils/file.utils.js";
import { userRepository } from "../repositories/user.repository.js";
import { authRepository } from "../repositories/auth.repository.js";
import { mailService as mail } from "./mail.service.js";
import { CONFIG } from "../config/flavour.js";
import { paymentSchedulingService } from "./payment-scheduling.service.js";
import { contractRepository } from "../repositories/contract.repository.js";

// Auth Service — pure business logic. No req/res objects.
class AuthService {

    // Register a new admin user.
    async signup({ f_name, l_name, email, password }, profileImgFile = null) {
        // Check for duplicate email
        const existingUser = await userRepository.findByEmail(email);
        if (existingUser) {
            throw ApiError.badRequest("Email already exists");
        }

        // Hash password
        const hashedPassword = encryptPassword(password);

        // Upload profile image if provided
        let profileImg = null;
        if (profileImgFile) {
            profileImg = await uploadFile(profileImgFile, "profile_img");
        }

        // Create admin user (role=2, temp_signup=0, email_verified=1, status=1)
        const userId = await userRepository.create({
            role: 2,
            profile_img: profileImg,
            f_name,
            l_name,
            email,
            password: hashedPassword,
            email_verified: 1,
            temp_signup: 0,
            status: 1,
        });

        if (!userId) {
            throw ApiError.internal("Failed to create admin account");
        }

        // Generate auth tokens
        const apikey = generateApiKey(userId);
        const token = generateToken(userId);

        // Create auth record
        await authRepository.createAuth(userId, apikey, token);

        return {
            user: { id: userId, role: 2, f_name, l_name, email },
            auth: { apikey, token },
        };
    }

    // Authenticate user with email/password/role.
    async login({ email, password, role }) {
        const roleNum = parseInt(role);
        if (roleNum !== 1 && roleNum !== 2) {
            throw ApiError.badRequest("Invalid role");
        }

        // Find user
        const user = await userRepository.findByEmailAndRole(email, roleNum);
        if (!user) {
            throw ApiError.badRequest("Invalid email or password");
        }

        // Check account status
        if (user.status === -1 || user.status === 2) {
            throw ApiError.badRequest("Account is not active");
        }

        // Validate password (temp or permanent)
        let isAuthenticated = false;
        if (user.temp_signup === 1) {
            if (user.temp_password) {
                isAuthenticated = validatePassword(user.temp_password, password);
            }
        } else {
            if (user.password) {
                isAuthenticated = validatePassword(user.password, password);
            }
        }

        if (!isAuthenticated) {
            throw ApiError.badRequest("Invalid email or password");
        }

        // Update login time and email verification
        const setEmailVerified = user.temp_signup === 1 && user.email_verified === 0;
        await userRepository.updateLastLogin(user.id, setEmailVerified);
        if (setEmailVerified) {
            user.email_verified = 1;
        }

        // Generate/upsert auth tokens
        const apikey = generateApiKey(user.id);
        const token = generateToken(user.id);
        await authRepository.upsertAuth(user.id, apikey, token);

        return {
            user: {
                id: user.id,
                role: user.role,
                profile_img: user.profile_img,
                f_name: user.f_name,
                l_name: user.l_name,
                email: user.email,
                initial_capital: user.role === 1 ? parseFloat(user.initial_capital || 0) : undefined,
                current_portfolio: user.role === 1 ? parseFloat(user.current_portfolio || 0) : undefined,
                currency: user.role === 1 ? user.currency : undefined,
                contract_start_date: user.role === 1 ? user.contract_start_date : undefined,
                email_verified: user.email_verified,
                temp_signup: user.temp_signup,
                status: user.status,
                last_login_at: user.last_login_at,
                created_at: user.created_at,
                updated_at: user.updated_at,
            },
            auth: { apikey, token },
            requires_password_change: user.temp_signup === 1,
        };
    }

    // Change password from temporary to permanent.
    async changeTempPassword({ temp_password, new_password, user_id }) {
        const user = await userRepository.findById(user_id, ["id", "temp_password", "temp_signup"]);
        if (!user) {
            throw ApiError.notFound("User not found");
        }

        if (user.temp_signup !== 1) {
            throw ApiError.badRequest("Account is not in temporary state");
        }

        if (!user.temp_password || !validatePassword(user.temp_password, temp_password)) {
            throw ApiError.badRequest("Invalid temporary password");
        }

        const hashedNewPassword = encryptPassword(new_password);
        const updated = await userRepository.updatePassword(user_id, hashedNewPassword, {
            clearTemp: true,
            status: 1,
        });

        if (!updated) {
            throw ApiError.internal("Failed to update password");
        }
    }

    // Generate reset token and send email. Always returns success to prevent account enumeration.
    async forgotPassword({ email }) {
        const user = await userRepository.findByEmailAnyStatus(email);
        const fpToken = generateRandomString();

        if (user) {
            // Check if auth record exists
            const existingAuth = await authRepository.findByUserId(user.id);

            if (existingAuth) {
                await authRepository.updateFpToken(user.id, fpToken);
            } else {
                const apikey = generateApiKey(user.id);
                const token = generateToken(user.id);
                await authRepository.createAuthWithFpToken(user.id, apikey, token, fpToken);
            }

            // Send reset email (best-effort)
            try {
                const resetLink = `${CONFIG.API_URL}/${CONFIG.STATIC_ROUTE}/forgot-password/${fpToken}`;
                await mail.sendMail({
                    to: user.email,
                    subject: "Reset Your Password - Morval Investments",
                    templateName: "forgot_password",
                    data: {
                        name: `${user.f_name} ${user.l_name}`,
                        resetLink,
                    },
                });
            } catch (emailError) {
                console.error("Error sending password reset email:", emailError);
            }
        }

        // Always return generic message (prevent account enumeration)
    }

    // Check if a forgot-password token is valid.
    async checkFpToken({ fp_token }) {
        const result = await authRepository.findByFpToken(fp_token);
        if (!result) {
            throw ApiError.badRequest("Invalid or expired reset token");
        }

        return {
            valid: true,
            user_id: result.user_id,
        };
    }

    // Reset password using forgot-password token.
    async resetPassword({ fp_token, new_password }) {
        const result = await authRepository.findByFpToken(fp_token);
        if (!result) {
            throw ApiError.badRequest("Invalid or expired reset token");
        }

        const hashedPassword = encryptPassword(new_password);

        if (hashedPassword === result.password) {
            throw ApiError.badRequest("New password cannot be the same as the old password");
        }

        const updated = await userRepository.updatePassword(result.user_id, hashedPassword, {
            clearTemp: true,
        });

        if (!updated) {
            throw ApiError.internal("Failed to reset password");
        }

        // Clear fp_token
        await authRepository.clearFpToken(result.user_id);
    }

    // Change password for authenticated users.
    async changePassword({ user_id, old_password, new_password }) {
        const user = await userRepository.findById(user_id, ["id", "password", "role"]);
        if (!user) {
            throw ApiError.notFound("User not found");
        }

        if (!user.password || !validatePassword(user.password, old_password)) {
            throw ApiError.badRequest("Invalid old password");
        }

        // Check if new password is same as old
        if (validatePassword(user.password, new_password)) {
            throw ApiError.badRequest("New password cannot be the same as the old password");
        }

        const hashedNewPassword = encryptPassword(new_password);
        const updated = await userRepository.updatePassword(user_id, hashedNewPassword);

        if (!updated) {
            throw ApiError.internal("Failed to change password");
        }
    }

    // Update user profile.
    async updateUser({ authenticated_user_id, authenticated_user_role, body, files }) {
        // Determine target user
        let targetUserId;
        if (body.user_id) {
            if (authenticated_user_role !== 2) {
                throw ApiError.forbidden("Insufficient privileges to update other users");
            }
            targetUserId = body.user_id;
        } else {
            targetUserId = authenticated_user_id;
        }

        // Load current user data
        const user = await userRepository.findById(targetUserId);
        if (!user) {
            throw ApiError.notFound("User not found");
        }

        // Define allowed fields
        const allowed = ["f_name", "l_name", "email", "currency"];
        const adminOnlyFields = [
            "initial_capital", "current_portfolio", "contract_start_date",
            "contract_type", "fixed_interest_rate", "contract_end_date",
            "investment_day", "status"
        ];

        if (authenticated_user_role === 2) {
            allowed.push(...adminOnlyFields);
        }

        const updates = [];
        const params = [];
        let initialCapitalChanged = false;
        let capitalDifference = 0;
        let newInitialCapital = 0;

        for (const key of allowed) {
            if (Object.prototype.hasOwnProperty.call(body, key) && body[key] !== undefined) {
                const value = body[key];

                // Email uniqueness check
                if (key === "email" && value !== user.email) {
                    const existing = await userRepository.findByEmailExcluding(value, targetUserId);
                    if (existing) {
                        throw ApiError.badRequest("Email already exists");
                    }
                }

                // Initial capital handling
                if (key === "initial_capital") {
                    const parsed = parseFloat(value);
                    if (isNaN(parsed) || parsed <= 0) {
                        throw ApiError.badRequest("Invalid initial capital amount");
                    }
                    if (parseFloat(user.initial_capital) !== parsed) {
                        initialCapitalChanged = true;
                        newInitialCapital = parsed;
                        capitalDifference = parsed - parseFloat(user.initial_capital || 0);
                    }
                    continue;
                }

                // Contract field validations
                if (key === "contract_start_date") {
                    const d = new Date(value);
                    if (isNaN(d.getTime())) throw ApiError.badRequest("Invalid contract start date");
                    if (d.getFullYear() < 2010) throw ApiError.badRequest("Contract start date cannot be before year 2010");
                    updates.push("contract_start_date = ?");
                    params.push(value);
                    continue;
                }

                if (key === "contract_type") {
                    const ct = parseInt(value);
                    if (![0, 1].includes(ct)) throw ApiError.badRequest("Invalid contract type. Must be 0 (monthly payable) or 1 (monthly compounding)");
                    updates.push("contract_type = ?");
                    params.push(ct);
                    continue;
                }

                if (key === "fixed_interest_rate") {
                    const fir = parseFloat(value);
                    if (isNaN(fir) || fir < 0 || fir > 100) throw ApiError.badRequest("Invalid fixed interest rate. Must be between 0 and 100 (e.g., 6.5 for 6.5%)");
                    updates.push("fixed_interest_rate = ?");
                    params.push(fir);
                    continue;
                }

                if (key === "contract_end_date") {
                    const d = new Date(value);
                    if (isNaN(d.getTime())) throw ApiError.badRequest("Invalid contract end date");
                    if (d.getFullYear() > 2050) throw ApiError.badRequest("Contract end date cannot be after year 2050");
                    updates.push("contract_end_date = ?");
                    params.push(value);
                    continue;
                }

                if (key === "investment_day") {
                    const dayValue = parseInt(value);
                    if (isNaN(dayValue) || dayValue < 1 || dayValue > 31) throw ApiError.badRequest("Invalid investment day. Must be between 1 and 31");
                    updates.push("investment_day = ?");
                    params.push(dayValue);
                    continue;
                }

                if (key === "status") {
                    const statusValue = parseInt(value);
                    if (![0, 1, 2].includes(statusValue)) throw ApiError.badRequest("Invalid status. Must be 0 (pending), 1 (active), or 2 (disabled)");
                    updates.push("status = ?");
                    params.push(statusValue);
                    continue;
                }

                // Default: push field directly
                updates.push(`${key} = ?`);
                params.push(value);
            }
        }

        // Handle profile image upload
        if (files && files.profile_img) {
            const profileImg = await uploadFile(files.profile_img, "profile_img");
            updates.push("profile_img = ?");
            params.push(profileImg);
        }

        // If initial capital changed, adjust current_portfolio
        if (initialCapitalChanged) {
            updates.push("initial_capital = ?", "current_portfolio = current_portfolio + ?");
            params.push(newInitialCapital, capitalDifference);
        }

        if (updates.length === 0) {
            throw ApiError.badRequest("No valid fields provided for update");
        }

        // Execute update
        const updated = await userRepository.updateProfile(targetUserId, updates, params);
        if (!updated) {
            throw ApiError.internal("Failed to update profile");
        }

        // Fetch updated user
        const updatedUser = await userRepository.findById(targetUserId);

        // Handle contract field changes
        const contractFieldsChanged = [
            "contract_start_date", "contract_type", "fixed_interest_rate",
            "contract_end_date", "investment_day"
        ].some((field) => Object.prototype.hasOwnProperty.call(body, field));

        if (contractFieldsChanged) {
            await this._handleContractChanges(targetUserId, authenticated_user_id, body, updatedUser);
        }

        return { user: updatedUser };
    }

    // Handle contract field changes — regenerate payment schedules, track history, send notifications.
    async _handleContractChanges(targetUserId, authenticatedUserId, body, updatedUser) {
        try {
            if (body.contract_type !== undefined || body.fixed_interest_rate !== undefined) {
                const currentDate = new Date();
                const currentMonth = currentDate.getMonth() + 1;
                const currentYear = currentDate.getFullYear();

                await contractRepository.createContractHistory({
                    user_id: targetUserId,
                    contract_type: updatedUser.contract_type || 0,
                    fixed_interest_rate: updatedUser.fixed_interest_rate || 0,
                    effective_from_month: currentMonth,
                    effective_from_year: currentYear,
                    notes: "Contract terms updated by admin",
                    created_by: authenticatedUserId,
                });
            }

            await contractRepository.deletePaymentSchedulesByUserId(targetUserId);

            if (
                updatedUser.contract_start_date &&
                updatedUser.contract_end_date &&
                updatedUser.fixed_interest_rate != null &&
                updatedUser.contract_type !== null
            ) {
                try {
                    await paymentSchedulingService.generatePaymentSchedule(
                        targetUserId,
                        updatedUser.contract_start_date,
                        updatedUser.contract_end_date,
                        updatedUser.contract_type,
                        parseFloat(updatedUser.fixed_interest_rate),
                        parseFloat(updatedUser.initial_capital || 0)
                    );
                } catch (paymentError) {
                    console.error("Error generating payment schedule:", paymentError);
                }
            }
        } catch (scheduleError) {
            console.error("Error regenerating payment schedule:", scheduleError);
        }

        // Send notification (best-effort, fire-and-forget)
        try {
            // Dynamic import to avoid circular dependency
            const { notificationCleanService: notificationService } = await import("./notification.service.js");
            await notificationService.sendNotification({
                user_ids: [updatedUser.id],
                title: "Contract Updated",
                message: "Your investment contract details have been updated.",
                type: "contract_update",
                type_id: targetUserId,
                payload: {
                    contract_type: updatedUser.contract_type,
                    fixed_interest_rate: updatedUser.fixed_interest_rate,
                    contract_start_date: updatedUser.contract_start_date,
                },
                send_push: true,
            });
        } catch (notificationError) {
            console.error("Error sending contract update notification:", notificationError);
        }
    }

    // Soft delete an investor account.
    async deleteAccount({ user_id }) {
        const user = await userRepository.findById(user_id, ["id", "f_name", "l_name", "email", "status"]);
        if (!user) {
            throw ApiError.notFound("User not found");
        }

        if (user.status === -1) {
            throw ApiError.badRequest("Account is already deleted");
        }

        // Soft delete user
        await userRepository.softDelete(user_id);

        // Invalidate auth tokens
        await authRepository.invalidateAuth(user_id);

        // Send confirmation email (best-effort)
        try {
            await mail.sendMail({
                to: user.email,
                subject: "Account Deletion Confirmation - Morval Investments",
                templateName: "account_deleted",
                data: {
                    name: `${user.f_name} ${user.l_name}`,
                },
            });
        } catch (emailError) {
            console.error("Error sending account deletion email:", emailError);
        }
    }
}

// Export singleton instance
const authService = new AuthService();
export { authService, AuthService };
