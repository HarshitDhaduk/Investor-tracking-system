import { Router } from "express";
import { investorController } from "../controllers/investor/investor.controller.js";

const router = Router();

// Dashboard & Stats
router.get("/dashboard", investorController.getDashboard);
router.get("/portfolio", investorController.getPortfolioPerformance);
router.get("/performance/history", investorController.getHistory);

// Bank Details
router.post("/bank-details/add", investorController.addBankDetails);
router.put("/bank-details/update", investorController.updateBankDetails);
router.get("/bank-details/get", investorController.getBankDetails);

export default router;
