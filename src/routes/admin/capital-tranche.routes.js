import { Router } from "express";
import { capitalTrancheController } from "../../controllers/admin/capital-tranche.controller.js";

const router = Router();

// POST — add capital tranche for investor
router.post("/add", capitalTrancheController.addCapitalTranche);

// POST — create backdated investor with historical performance
router.post("/create-backdated", capitalTrancheController.createBackdatedInvestor);

// POST — validate backdating requirements
router.post("/validate-backdating", capitalTrancheController.validateBackdatingRequirements);

export default router;
