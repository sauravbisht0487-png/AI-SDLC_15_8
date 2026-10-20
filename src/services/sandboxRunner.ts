import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { normalizePath } from "../ai/validateFiles";

export interface SandboxFile {
  path: string; // e.g. "backend/tests/a.test.ts"
  content: string;
}

export interface SandboxResult {
  exitCode: number | null; // null when the run timed out
  timedOut: boolean;
  durationMs: number;
  stdout: string;
  stderr: string;
  resultJson: string | null; // vitest's JSON report, if it was produced
}

export class SandboxError extends Error {
  code: string;
  detail: string;
  constructor(code: string, message: string, detail = "") {
    super(message);
    this.name = "SandboxError";
    this.code = code;
    this.detail = detail.slice(0, 500);
  }
}

const DEFAULT_IMAGE = "ai-sdlc-sandbox";
const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_OUTPUT_CHARS = 200_000;

// The isolation. Everything here is deliberate:
const ISOLATION_ARGS = [
  "--network", "none", //                 no internet, no access to your local network
  "--memory", "512m", //                  hard memory cap
  "--memory-swap", "512m", //             and no swap on top of it
  "--cpus", "1", //                       one CPU at most
  "--pids-limit", "256", //               stops fork bombs
  "--cap-drop", "ALL", //                 no Linux capabilities
  "--security-opt", "no-new-privileges", // no privilege escalation
  "--user", "node", //                    not root
];

const TEST_COMMAND = [
  "node",
  "node_modules/vitest/vitest.mjs",
  "run",
  "--root", "/work/backend",
  "--reporter=json",
  "--outputFile=/tmp/vitest-result.json",
  "--testTimeout=10000",
];

interface DockerResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

const appendCapped = (current: string, chunk: Buffer): string =>
  current.length >= MAX_OUTPUT_CHARS
    ? current
    : (current + chunk.toString("utf-8")).slice(0, MAX_OUTPUT_CHARS);

// Always spawns "docker" with an argument array: no shell, so nothing can be injected.
const runDocker = (
  args: string[],
  timeoutMs: number,
  onTimeout?: () => void,
): Promise<DockerResult> =>
  new Promise((resolve, reject) => {
       const child = spawn("docker", args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"], // never leave stdin open
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    child.stdout.on("data", (chunk: Buffer) => {
      stdout = appendCapped(stdout, chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = appendCapped(stderr, chunk);
    });

    const timer = setTimeout(() => {
      timedOut = true;
      onTimeout?.();
      child.kill();
    }, timeoutMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
    });
  });

const dockerOrThrow = async (args: string[], timeoutMs: number): Promise<DockerResult> => {
  try {
    return await runDocker(args, timeoutMs);
  } catch {
    throw new SandboxError("SANDBOX_UNAVAILABLE", "Docker is not installed or not reachable");
  }
};

export const runTestsInSandbox = async (
  files: SandboxFile[],
  options: { timeoutMs?: number | undefined } = {},
): Promise<SandboxResult> => {
  const image = process.env.SANDBOX_IMAGE?.trim() || DEFAULT_IMAGE;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const containerName = `sdlc-sandbox-${randomUUID()}`;
  const workDir = await mkdtemp(path.join(tmpdir(), "sdlc-sandbox-"));

  try {
    // 1) Write the files into a temp folder. Paths are re-validated even though
    //    they were validated earlier: this is the last line of defence.
    for (const file of files) {
      const relative = normalizePath(file.path);
      const target = path.resolve(workDir, relative);
      if (!target.startsWith(workDir + path.sep)) {
        throw new SandboxError("SANDBOX_BAD_PATH", `Path escapes the sandbox folder: ${file.path}`);
      }
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, file.content, "utf-8");
    }
    if (!files.some((f) => normalizePath(f.path).startsWith("backend/"))) {
      throw new SandboxError("SANDBOX_NO_FILES", "No backend files to run");
    }

    // 2) Create the container (not started yet).
    const create = await dockerOrThrow(
      ["create", "--name", containerName, ...ISOLATION_ARGS, image, ...TEST_COMMAND],
      120_000,
    );
    if (create.code !== 0) {
      if (/No such image|Unable to find image/i.test(create.stderr)) {
        throw new SandboxError(
          "SANDBOX_IMAGE_MISSING",
          "Sandbox image not found. Build it with: docker build -t ai-sdlc-sandbox sandbox",
        );
      }
      if (/daemon|pipe|connect/i.test(create.stderr)) {
        throw new SandboxError("SANDBOX_UNAVAILABLE", "Docker is not running", create.stderr);
      }
               const reason = create.timedOut
        ? "docker create timed out after 120s"
        : create.stderr || create.stdout || `docker create exited with code ${create.code}`;
      throw new SandboxError("SANDBOX_FAILED", "Could not create the sandbox container", reason);
    }

    // 3) Copy only the backend folder in. It merges with /work/backend, which
    //    already holds node_modules from the image.
    const copyIn = await dockerOrThrow(
      ["cp", path.join(workDir, "backend"), `${containerName}:/work`],
      30_000,
    );
    if (copyIn.code !== 0) {
      throw new SandboxError("SANDBOX_FAILED", "Could not copy files into the sandbox", copyIn.stderr);
    }

    // 4) Run, with a hard time limit. Killing the docker CLI does not stop the
    //    container, so on timeout we ask Docker to kill the container itself.
    const startedAt = Date.now();
    let run: DockerResult;
    try {
      run = await runDocker(["start", "-a", containerName], timeoutMs, () => {
        void runDocker(["kill", containerName], 10_000).catch(() => undefined);
      });
    } catch {
      throw new SandboxError("SANDBOX_UNAVAILABLE", "Docker is not installed or not reachable");
    }
    const durationMs = Date.now() - startedAt;

    // 5) Fetch vitest's JSON report (a stopped container can still be copied from).
    let resultJson: string | null = null;
    if (!run.timedOut) {
      const resultPath = path.join(workDir, "vitest-result.json");
      const copyOut = await runDocker(
        ["cp", `${containerName}:/tmp/vitest-result.json`, resultPath],
        15_000,
      ).catch(() => null);
      if (copyOut && copyOut.code === 0) {
        resultJson = await readFile(resultPath, "utf-8")
          .then((text) => text.slice(0, 2_000_000))
          .catch(() => null);
      }
    }

    return {
      exitCode: run.timedOut ? null : run.code,
      timedOut: run.timedOut,
      durationMs,
      stdout: run.stdout,
      stderr: run.stderr,
      resultJson,
    };
  } finally {
    // Always clean up, even when something above threw.
    await runDocker(["rm", "-f", containerName], 15_000).catch(() => undefined);
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
};