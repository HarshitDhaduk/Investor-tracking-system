import { Router } from "express";
import DashboardRoutes from "./dashboard.routes.js";
import BankDetailsRoutes from "./bank-details.routes.js";
import InvestorManagementRoutes from "./investor-management.routes.js";
import PaymentRoutes from "./payment.routes.js";
import ContractRoutes from "./contract.routes.js";
import CapitalTrancheRoutes from "./capital-tranche.routes.js";
import PerformanceRoutes from "./performance.routes.js";
import { adminOnly } from "../../middlewares/auth.middleware.js";

const router = Router();

// Admin Module Routes
router.use(adminOnly);
router.use("/dashboard", DashboardRoutes);
router.use("/bank-details", BankDetailsRoutes);
router.use("/investors", InvestorManagementRoutes);
router.use("/payments", PaymentRoutes);
router.use("/contracts", ContractRoutes);
router.use("/tranches", CapitalTrancheRoutes);
router.use("/performance", PerformanceRoutes);

export default router;
