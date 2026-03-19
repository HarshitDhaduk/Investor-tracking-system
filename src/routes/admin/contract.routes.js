import { Router } from "express";
import { contractController } from "../../controllers/admin/contract.controller.js";

const router = Router();

// POST — update investor contract details
router.post("/update", contractController.updateInvestorContract);

// GET — get contracts approaching maturity
router.get("/maturity-upcoming", contractController.getContractsApproachingMaturity);

// POST — manage contract maturity (complete, extend, renew)
router.post("/manage-maturity", contractController.manageContractMaturity);

// POST — calculate performance with fixed rates
router.post("/calculate-performance", contractController.calculateInvestorPerformanceWithFixedRates);

export default router;
