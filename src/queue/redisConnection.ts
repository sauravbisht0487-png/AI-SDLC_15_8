import type { ConnectionOptions } from "bullmq";
import type { ConnectionOptions as TlsOptions } from "node:tls";

interface RedisConnectionOptions {
  host: string;
  port: number;
  username?: string;
  password?: string;
  tls?: TlsOptions;
  maxRetriesPerRequest: null; // required by BullMQ workers
}

// Read env inside the function (dotenv may not have run at import time).
export const getRedisConnection = (): ConnectionOptions => {
  const url = process.env.REDIS_URL?.trim();
  if (!url) throw new Error("REDIS_URL is not configured");

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("REDIS_URL is not a valid URL");
  }

  const connection: RedisConnectionOptions = {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    maxRetriesPerRequest: null,
  };
  if (parsed.username) connection.username = decodeURIComponent(parsed.username);
  if (parsed.password) connection.password = decodeURIComponent(parsed.password);
  if (parsed.protocol === "rediss:") connection.tls = {}; // Upstash requires TLS

  return connection;
};