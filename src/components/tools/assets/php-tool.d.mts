// Types for tests that import the generated helper script. Not copied into dist/.

export function binDirectory(root?: string): string;

export function exitCode(tool: string, status: number | null, output: string): number;

export function runTool(tool: string, args: string[]): number;
