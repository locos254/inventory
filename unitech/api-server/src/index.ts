import app from "./app";
import { logger } from "./lib/logger";

const PORT = Number(process.env.PORT) || 5000;

app.listen(PORT, () => {
  logger.info(`🚀 UNITECH API Server is running on port ${PORT}`);
});

process.on("SIGINT", () => {
  logger.info("🛑 Server shutting down...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("🛑 Server terminated.");
  process.exit(0);
});