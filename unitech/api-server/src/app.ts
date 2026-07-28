import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";

import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

/**
 * Trust proxy (required for Render, Railway and other reverse proxies)
 */
app.set("trust proxy", true);

/**
 * HTTP Logger
 */
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

/**
 * CORS
 */
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  }),
);

/**
 * Body Parsers
 */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Session
 */
app.use(
  session({
    secret: process.env.SESSION_SECRET || "unitech-secret",
    resave: false,
    saveUninitialized: false,

    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  }),
);

/**
 * API Routes
 */
app.use("/api", router);

/**
 * Root Route
 */
app.get("/", (req, res) => {
  res.json({
    success: true,
    application: "UNITECH Inventory API",
    status: "Running",
  });
});

/**
 * 404 Handler
 */
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found.",
  });
});

export default app;