import spawn from "cross-spawn";

/**
 * The result of a finished child process.
 */
export interface ProcessResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
}

/**
 * Where a streamed command's output goes: the terminal, or stderr so JSON on stdout stays one document.
 */
export type StreamTarget = "inherit" | "stderr";

/**
 * Runs commands. Injected so tests can run without real executables.
 */
export interface ProcessRunner {
  /** Runs a short command and captures its output. */
  run: (executable: string, args: string[], cwd: string) => ProcessResult;

  /** Runs a long command, such as an install, and passes its output through. */
  stream: (
    executable: string,
    args: string[],
    cwd: string,
    target: StreamTarget,
  ) => Omit<ProcessResult, "stdout" | "stderr">;
}

/**
 * Runs an executable without a shell, resolving Windows `.cmd` shims through cross-spawn.
 */
export const systemRunner: ProcessRunner = {
  run: (executable, args, cwd) => {
    const result = spawn.sync(executable, args, { cwd, encoding: "utf8", windowsHide: true, timeout: 30_000 });

    return {
      status: result.status,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      ...(result.error ? { error: result.error } : {}),
    };
  },
  stream: (executable, args, cwd, target) => {
    const result = spawn.sync(executable, args, {
      cwd,
      stdio: target === "inherit" ? "inherit" : ["ignore", process.stderr, process.stderr],
      windowsHide: true,
    });

    return { status: result.status, ...(result.error ? { error: result.error } : {}) };
  },
};

/**
 * Runs a version command and returns the first version number in its output, or null when the
 * executable is missing or fails.
 */
export function probeVersion(runner: ProcessRunner, executable: string, args: string[], cwd: string): string | null {
  const result = runner.run(executable, args, cwd);

  if (result.error || result.status !== 0) {
    return null;
  }

  return /(\d+\.\d+(?:\.\d+)?)/.exec(`${result.stdout}\n${result.stderr}`)?.[1] ?? null;
}
