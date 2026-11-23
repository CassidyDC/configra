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
 * Runs commands. Injected so tests can run without real executables.
 */
export interface ProcessRunner {
  run: (executable: string, args: string[], cwd: string) => ProcessResult;
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
