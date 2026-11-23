// Types for tests that import the generated commit-message script. Not copied into dist/.

export function readSubject(message: string): string;

export function checkSubject(subject: string, mode: "plain" | "conventional"): string[];

export function main(argv: string[]): number;
