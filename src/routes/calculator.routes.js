import { Router } from "express";
import { calculatorController } from "../controllers/calculator/calculator.controller.js";

const router = Router();

// Calculate estimated returns (public endpoint, no auth required)
router.post("/calculate-return", calculatorController.calculateReturn);

export default router;
