import { readVersion } from "./version.js";

/**
 * Output streams the CLI writes to, injectable for tests.
 */
export interface CliIo {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

const defaultIo: CliIo = {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};

/**
 * Runs the CLI with the given arguments and returns the exit code.
 */
export async function run(argv: readonly string[], io: CliIo = defaultIo): Promise<number> {
  if (argv.includes("-v") || argv.includes("--version")) {
    io.stdout(`${readVersion()}\n`);

    return 0;
  }

  io.stdout("Usage: configra <command> [options]\n");

  return 0;
}
