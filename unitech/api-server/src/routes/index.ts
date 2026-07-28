import { Router, type IRouter } from "express";

import healthRouter from "./health";
import authRouter from "./auth";
import categoriesRouter from "./categories";
import brandsRouter from "./brands";
import screenTypesRouter from "./screen-types";
import productsRouter from "./products";
import salesRouter from "./sales";
import dashboardRouter from "./dashboard";
import reportsRouter from "./reports";

const router: IRouter = Router();

// Health Check
router.use("/api/health", healthRouter);

// Authentication
router.use("/api/auth", authRouter);

// Inventory
router.use("/api/categories", categoriesRouter);
router.use("/api/brands", brandsRouter);
router.use("/api/screen-types", screenTypesRouter);
router.use("/api/products", productsRouter);

// Sales
router.use("/api/sales", salesRouter);

// Dashboard
router.use("/api/dashboard", dashboardRouter);

// Reports
router.use("/api/reports", reportsRouter);

// Default API Route
router.get("/api", (req, res) => {
  res.json({
    success: true,
    message: "UNITECH Inventory API is running successfully."
  });
});

// 404 Handler
router.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found."
  });
});

export default router;