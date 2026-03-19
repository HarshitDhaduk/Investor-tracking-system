import { Router } from "express";
import authRoutes from "./auth.routes.js";
import calculatorRoutes from "./calculator.routes.js";
import notificationRoutes from "./notification.routes.js";
import adminRoutes from "./admin/admin.routes.js";

// Migrated Investor Routes
import investorModuleRoutes from "./investor.routes.js";

import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = Router();

// Public routes
router.use("/auth", authRoutes);
router.use("/calculator", calculatorRoutes);

// Protected routes
router.use(authMiddleware());
router.use("/notification", notificationRoutes);
router.use("/admin", adminRoutes);


// Investor Module Routes
router.use("/investor", investorModuleRoutes);

export default router;
