import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { authController } from "../controllers/auth/auth.controller.js";

const router = Router();

// Public Routes

// Admin signup
router.post("/signup", authController.signup);

// Login (admin & investor)
router.post("/login", authController.login);

// Forgot password flow
router.post("/forgot-password", authController.forgotPassword);
router.post("/check-fp-token", authController.checkFpToken);
router.post("/reset-password", authController.resetPassword);

// Authenticated Routes
router.use(authMiddleware());

// Change password from temporary credentials
router.post("/change-temp-password", authController.changeTempPassword);

// Change password (admin & investor)
router.post("/change-password", authController.changePassword);

// Update profile (admin & investor)
router.put("/update-user", authController.updateUser);

// Delete account (investors only)
router.delete("/delete-account", authController.deleteAccount);

export default router;
