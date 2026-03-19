import { Router } from "express";
import { dashboardController } from "../../controllers/admin/dashboard.controller.js";

const router = Router();

// GET — dashboard statistics
router.get("/get", dashboardController.getDashboardStats);

// PUT — create/update dashboard stat
router.put("/update", dashboardController.updateDashboardStat);

// GET — all stats for management
router.get("/get-all", dashboardController.getDashboardStatsManagement);

// DELETE — delete dashboard stat
router.delete("/delete", dashboardController.deleteDashboardStat);

export default router;
