import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

/**
 * Collect an explicit replacement decision without applying any project changes.
 *
 * @param {import("../../contracts.js").GenerationConflict[]} conflicts Reported conflicts requiring a decision.
 * @returns {Promise<boolean>} Whether the user explicitly approved replacement.
 */
export async function decide(conflicts) {
  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await prompt.question(`Replace the ${conflicts.length} reported generated conflict(s)? [y/N]: `);
    return /^(y|yes)$/i.test(answer.trim());
  } finally {
    prompt.close();
  }
}
