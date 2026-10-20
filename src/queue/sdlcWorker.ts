import { Worker, type Job } from "bullmq";
import { getRedisConnection } from "../queue/redisConnection";
import { SDLC_QUEUE_NAME, type SdlcJobData } from "../queue/sdlcQueue";
import * as workflowService from "../services/sdlcWorkflowService";
import logger from "../utils/logger";

// 9b: only proves the pipeline works end to end. Stages are added in 9c.
const processWorkflow = async (job: Job<SdlcJobData>): Promise<void> => {
  const { workflowId } = job.data;
  const workflow = await workflowService.getWorkflow(workflowId);
  if (!workflow) {
    throw new Error(`Workflow ${workflowId} not found`);
  }
  logger.info("Worker received workflow", {
    workflowId,
    jobId: job.id,
    status: workflow.status,
  });
};

export const startSdlcWorker = (): Worker<SdlcJobData> => {
  const worker = new Worker<SdlcJobData>(SDLC_QUEUE_NAME, processWorkflow, {
    connection: getRedisConnection(),
    concurrency: 2,
    // Poll Redis less often when idle. Upstash's free tier counts every command.
    drainDelay: 30,
    stalledInterval: 120_000,
  });

  worker.on("completed", (job) => logger.info("Job completed", { jobId: job.id }));
  worker.on("failed", (job, err) =>
    logger.error("Job failed", { jobId: job?.id, error: err.message }),
  );
  worker.on("error", (err) => logger.error("Worker error", { error: err.message }));

  return worker;
};