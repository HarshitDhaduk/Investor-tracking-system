import { authService } from "../../services/auth.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { validateRequest } from "../../utils/validateRequest.js";

// Auth Controller — thin HTTP handler. All methods wrapped in catchAsync.
class AuthController {

    // POST /api/auth/signup
    signup = catchAsync(async (req, res) => {
        validateRequest(req, ["f_name", "l_name", "email", "password"]);

        const profileImgFile = req.files?.profile_img || null;
        const result = await authService.signup(req.body, profileImgFile);

        return ApiResponse.success(res, result, "Admin account created successfully", 201);
    });

    // POST /api/auth/login
    login = catchAsync(async (req, res) => {
        validateRequest(req, ["email", "password", "role"]);

        const result = await authService.login(req.body);

        return ApiResponse.success(res, result, "Login successful");
    });

    // POST /api/auth/change-temp-password
    changeTempPassword = catchAsync(async (req, res) => {
        validateRequest(req, ["temp_password", "new_password"]);

        const user_id = req.body.user_id || req._id;
        await authService.changeTempPassword({
            temp_password: req.body.temp_password,
            new_password: req.body.new_password,
            user_id,
        });

        return ApiResponse.success(res, null, "Password changed successfully");
    });

    // POST /api/auth/forgot-password
    forgotPassword = catchAsync(async (req, res) => {
        validateRequest(req, ["email"]);

        await authService.forgotPassword({ email: req.body.email });

        return ApiResponse.success(
            res,
            null,
            "If an account exists with this email, a password reset link has been sent"
        );
    });

    // POST /api/auth/check-fp-token
    checkFpToken = catchAsync(async (req, res) => {
        validateRequest(req, ["fp_token"]);

        const result = await authService.checkFpToken({ fp_token: req.body.fp_token });

        return ApiResponse.success(res, result, "Token is valid");
    });

    // POST /api/auth/reset-password
    resetPassword = catchAsync(async (req, res) => {
        validateRequest(req, ["fp_token", "new_password"]);

        await authService.resetPassword({
            fp_token: req.body.fp_token,
            new_password: req.body.new_password,
        });

        return ApiResponse.success(res, null, "Password reset successfully");
    });

    // POST /api/auth/change-password
    changePassword = catchAsync(async (req, res) => {
        validateRequest(req, ["old_password", "new_password"]);

        await authService.changePassword({
            user_id: req._id,
            old_password: req.body.old_password,
            new_password: req.body.new_password,
        });

        return ApiResponse.success(res, null, "Password changed successfully");
    });

    // PUT /api/auth/update-user
    updateUser = catchAsync(async (req, res) => {
        const result = await authService.updateUser({
            authenticated_user_id: req._id,
            authenticated_user_role: req._role,
            body: req.body,
            files: req.files || null,
        });

        return ApiResponse.success(res, result, "Profile updated successfully");
    });

    // DELETE /api/auth/delete-account
    deleteAccount = catchAsync(async (req, res) => {
        await authService.deleteAccount({ user_id: req._id });

        return ApiResponse.success(res, null, "Account deleted successfully");
    });
}

// Export singleton
const authController = new AuthController();
export { authController };
