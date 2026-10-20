import { Queue } from "bullmq";
import { getRedisConnection } from "./redisConnection";

export const SDLC_QUEUE_NAME = "sdlc-workflow";

// The job carries only an id. All state lives in MongoDB (SDLCWorkflow).
export interface SdlcJobData {
  workflowId: string;
}

let queue: Queue<SdlcJobData> | null = null;

// Created lazily, so the API still starts if Redis isn't configured yet.
const getQueue = (): Queue<SdlcJobData> => {
  if (!queue) {
    queue = new Queue<SdlcJobData>(SDLC_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 1, // retries are handled per stage in MongoDB, not here
        removeOnComplete: true,
        removeOnFail: { count: 100 }, // keep the last 100 failed jobs for debugging
      },
    });
  }
  return queue;
};

// jobId = workflowId makes this idempotent: enqueueing the same workflow twice
// while the first job still exists does not create a duplicate job.
export const enqueueWorkflow = async (workflowId: string): Promise<void> => {
  await getQueue().add("run-workflow", { workflowId }, { jobId: workflowId });
};

export const closeQueue = async (): Promise<void> => {
  if (queue) {
    await queue.close();
    queue = null;
  }
};