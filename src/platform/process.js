import { spawn } from "node:child_process";

export function execute(operation, { stdio = "inherit" } = {}) {
  return new Promise((resolve) => {
    const child = spawn(operation.command, operation.args, { cwd: operation.cwd, stdio, shell: false });
    child.once("error", (error) => resolve({ ...operation, success: false, error: error.message }));
    child.once("close", (code, signal) => resolve({ ...operation, success: code === 0, code, signal }));
  });
}

export const quote = (value) => "'" + String(value).replaceAll("'", "'\"'\"'") + "'";
