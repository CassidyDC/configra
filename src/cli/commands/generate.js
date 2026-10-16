import { normalizeRequest, resolve } from "../../generator/resolve.js";
import { packageGraph } from "../../generator/package-graph.js";
import { plan } from "../../generator/plan.js";
import { apply } from "../../generator/apply.js";

/**
 * Resolve selections, present a proposal, and optionally apply it and install dependencies.
 *
 * @param {string} root Existing absolute project directory.
 * @param {import("../../contracts.js").ProjectInput} selections Input selections or update overrides.
 * @param {import("../../contracts.js").CommandOptions} options Non-persisted workflow controls.
 * @param {import("../../contracts.js").CliIO} io Output callbacks.
 * @returns {Promise<number>} CLI completion status.
 * @throws {Error} If selections, discovery, planning, or application preflight are invalid.
 */
export async function generate(root, selections, options, io) {
  const request = normalizeRequest(selections);
  const graph = await packageGraph(root, request);
  const proposal = await plan(resolve(request, graph));
  if (options.json && options.dryRun) io.out(JSON.stringify(proposal, null, 2));
  else if (!options.json) {
    io.out(`${options.dryRun ? "Dry run: " : ""}${proposal.changes.length} proposed change(s)`);
    for (const change of proposal.changes)
      io.out(`  ${change.content === null ? "remove" : change.before === null ? "create" : "update"} ${change.path}`);
    for (const conflict of proposal.conflicts) io.out(`  conflict ${conflict.path}: ${conflict.reason}`);
    for (const diagnostic of proposal.diagnostics) io.out(diagnostic);
    if (proposal.installations.length) io.out("Dependencies are installed only with --install.");
  }
  if (options.dryRun) return proposal.conflicts.length ? 2 : 0;
  let force = options.force;
  if (options.interactive && proposal.conflicts.length && !force) {
    const { decide } = await import("../prompts/conflicts.js");
    force = await decide(proposal.conflicts);
  }
  const result = await apply(proposal, {
    force,
    install: options.install,
    stdio: options.json ? ["inherit", 2, 2] : "inherit",
  });
  if (options.json) io.out(JSON.stringify({ ...proposal, result }, null, 2));
  if (!options.json) {
    io.out(
      result.generated
        ? `Generated successfully (${result.applied.length} changed files).`
        : `Generation stopped after ${result.applied.length} file changes.`,
    );
    for (const failure of result.failed)
      io.error(
        `${failure.phase === "installation" ? "Installation failed after successful generation" : "Write failed"}: ${failure.path ?? failure.command}: ${failure.error ?? failure.code ?? failure.signal}`,
      );
  }
  return result.failed.length ? 1 : 0;
}
