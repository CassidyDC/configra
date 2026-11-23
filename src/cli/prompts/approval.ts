/**
 * Terminal conflict prompts and preview approval, shared by flag runs and the setup wizard.
 */

import type { Conflict, ConflictAction } from "../../contracts.js";
import type { PlannedWorkflow } from "../commands/workflow.js";
import { canceled, type Canceled, type Prompter } from "./prompter.js";

/**
 * Plans the run again with the conflict decisions answered so far.
 */
export type Replan = (decisions: Record<string, ConflictAction>) => PlannedWorkflow;

const actionLabels: Record<ConflictAction, { label: string; hint: string }> = {
  retain: { label: "Keep the existing content", hint: "Configra saves the decision and leaves it alone" },
  replace: { label: "Use Configra's content", hint: "Configra overwrites it and takes ownership" },
};

/**
 * Returns the conflicts that still need a decision.
 */
export function unresolvedConflicts(planned: PlannedWorkflow): Conflict[] {
  return planned.plan?.conflicts.filter((conflict) => !conflict.decision) ?? [];
}

/**
 * Asks how to settle each unresolved conflict and replans after each round, since a decision can change
 * the plan and raise new conflicts. Stops after a few rounds and leaves anything still unresolved to the
 * caller, which blocks the run.
 */
export async function settleConflicts(
  prompter: Prompter,
  planned: PlannedWorkflow,
  replan: Replan,
  decisions: Record<string, ConflictAction> = {},
): Promise<PlannedWorkflow | Canceled> {
  let current = planned;

  for (let round = 0; round < 5; round++) {
    const unresolved = unresolvedConflicts(current);

    if (unresolved.length === 0 || current.document.status === "error") {
      return current;
    }

    for (const conflict of unresolved) {
      const answer = await prompter.select<ConflictAction>({
        message: `${conflict.message} What should Configra do?`,
        choices: conflict.options.map((action) => ({ value: action, ...actionLabels[action] })),
        initial: conflict.options.includes("retain") ? "retain" : "replace",
      });

      if (answer === canceled) {
        return canceled;
      }

      decisions[conflict.id] = answer;
    }

    current = replan(decisions);
  }

  return current;
}

/**
 * Asks for approval to apply the previewed plan.
 */
export async function approve(prompter: Prompter, message = "Apply these changes?"): Promise<boolean> {
  const answer = await prompter.confirm({ message, initial: true });

  return answer === true;
}
