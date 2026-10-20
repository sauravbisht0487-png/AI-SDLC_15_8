import "dotenv/config";
import mongoose from "mongoose";
import logger from "./utils/logger";
import { startSdlcWorker } from "./workers/sdlcWorker";

const main = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) throw new Error("MONGO_URI is not configured");

  await mongoose.connect(mongoUri);
  const worker = startSdlcWorker();
  logger.info("SDLC worker started");

  // Finish the current job before exiting, so Ctrl+C doesn't leave half-done work.
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down worker`);
    await worker.close();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
};

main().catch((err: unknown) => {
  logger.error("Worker failed to start", { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});