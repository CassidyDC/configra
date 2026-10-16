import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

/** Returns an explicit conflict decision without applying any changes. */
export async function decide(conflicts) {
  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await prompt.question(`Replace the ${conflicts.length} reported generated conflict(s)? [y/N]: `);
    return /^(y|yes)$/i.test(answer.trim());
  } finally {
    prompt.close();
  }
}
