// Types for tests that import the generated helper script. Not copied into dist/.

export const MAX_COMMAND_LENGTH: number;

export const MULTI_FILE_VERSION_ID: number;

export function isExcluded(path: string, excluded: string[]): boolean;

export function collectFiles(paths: string[], excluded: string[], root?: string): string[];

export function batches(files: string[], baseLength: number, limit?: number): string[][];

export function lint(files: string[]): number;
