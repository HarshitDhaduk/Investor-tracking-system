import { Router } from "express";
import { bankDetailsController } from "../../controllers/admin/bank-details.controller.js";

const router = Router();

// GET — pending bank details with filters
router.get("/pending", bankDetailsController.getPendingBankDetails);

// POST — review (approve/reject) bank details
router.post("/review", bankDetailsController.reviewBankDetails);

export default router;
