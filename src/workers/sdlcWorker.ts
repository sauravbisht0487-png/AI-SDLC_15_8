import { Worker, type Job } from "bullmq";
import { getRedisConnection } from "../queue/redisConnection";
import { SDLC_QUEUE_NAME, type SdlcJobData } from "../queue/sdlcQueue";
import { runWorkflow } from "../services/pipelineRunner";
import logger from "../utils/logger";

const processWorkflow = async (job: Job<SdlcJobData>): Promise<void> => {
  logger.info("Worker picked up workflow", {
    workflowId: job.data.workflowId,
    jobId: job.id,
  });
  await runWorkflow(job.data.workflowId);
};

export const startSdlcWorker = (): Worker<SdlcJobData> => {
  const worker = new Worker<SdlcJobData>(SDLC_QUEUE_NAME, processWorkflow, {
    connection: getRedisConnection(),
    concurrency: 2,
    // Poll Redis less often when idle. Upstash's free tier counts every command.
    drainDelay: 30,
    stalledInterval: 120_000,
  });

  worker.on("completed", (job) =>
    logger.info("Job completed", { jobId: job.id }),
  );
  worker.on("failed", (job, err) =>
    logger.error("Job failed", { jobId: job?.id, error: err.message }),
  );
  worker.on("error", (err) =>
    logger.error("Worker error", { error: err.message }),
  );

  return worker;
};
