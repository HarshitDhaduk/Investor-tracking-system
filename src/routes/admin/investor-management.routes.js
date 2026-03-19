import { Router } from "express";
import { investorManagementController } from "../../controllers/admin/investor-management.controller.js";

const router = Router();

// GET — generate temporary password
router.get("/generate-temp-password", investorManagementController.generateTempPassword);

// POST — regenerate temporary password for existing investor
router.post("/regenerate-temp-password", investorManagementController.regenerateTempPassword);

// POST — create investor account
router.post("/create", investorManagementController.createInvestor);

// GET — get all investors with metrics
router.get("/get-all", investorManagementController.getAllInvestors);

// GET — get all investor names (lightweight)
router.get("/get-names", investorManagementController.getAllInvestorNames);

// PUT — update investor status
router.put("/update", investorManagementController.updateInvestorStatus);

export default router;
