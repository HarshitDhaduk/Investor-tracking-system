import { Router } from "express";
import { performanceController } from "../../controllers/admin/performance.controller.js";

const router = Router();

// POST — add monthly performance (single or fund distribution)
router.post("/add", performanceController.addPerformance);

// GET — get historical performance records (Year/Month view)
router.get("/history", performanceController.getHistoricalPerformance);

// GET — get performance chart data
router.get("/chart", performanceController.getPerformanceChart);

// DELETE — delete a specific performance record (includes rollback)
router.delete("/delete/:id", performanceController.deletePerformance);

export default router;
