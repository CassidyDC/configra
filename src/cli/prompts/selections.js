/**
 * Project Selection Prompts
 * @file Interactive collection of project, language, tool, and package selections.
 */

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { projects, tools } from "../../components/registry.js";

/**
 * @typedef {import("../../contracts.js").ProjectInput} ProjectInput
 */

/**
 * Collect structured project selections without writing any project files.
 *
 * @param {ProjectInput} [defaults={}] Initial or saved selections.
 * @returns {Promise<ProjectInput>} Answers ready for request normalization.
 * @throws {Error} If the selected project identifier is unsupported.
 */
export async function collect(defaults = {}) {
  const prompt = createInterface({ input: stdin, output: stdout });

  /**
   * Ask one question, retaining the fallback when the answer is empty.
   *
   * @param {string} label Prompt description.
   * @param {string} fallback Default answer.
   * @returns {Promise<string>} Trimmed answer or the supplied fallback.
   */
  const ask = async (label, fallback) => (await prompt.question(`${label} [${fallback}]: `)).trim() || fallback;

  /**
   * Normalize a comma-separated answer into nonempty selection values.
   *
   * @param {string} value Answer text.
   * @returns {string[]} Trimmed values in answer order.
   */
  const split = (value) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  try {
    const project = await ask(`Project (${Object.keys(projects).join(", ")})`, defaults.project ?? "node");
    const definition = projects[project];

    if (!definition) throw new Error(`Unsupported project: ${project}`);

    const languages = split(
      await ask("Languages (comma separated)", (defaults.languages ?? definition.languages).join(",")),
    );
    const capabilities = split(
      await ask("Capabilities (react, typescript; comma separated)", (defaults.capabilities ?? []).join(",")),
    );
    const standards = {};

    for (const language of languages)
      standards[language] = await ask(
        `${language} standard`,
        defaults.standards?.[language] ??
          (definition.environment === "wordpress" && language !== "python" ? "wordpress" : "community"),
      );

    const selectedTools = split(
      await ask(
        `Tools (${Object.keys(tools).join(", ")})`,
        (
          defaults.tools ??
          definition.tools.filter(
            (id) => !tools[id].languages.length || tools[id].languages.some((language) => languages.includes(language)),
          )
        ).join(","),
      ),
    );

    const layout = await ask("Layout (single, nested, workspaces)", defaults.layout ?? "single");

    const packages =
      layout === "single"
        ? []
        : split(
            await ask(
              "Selected package paths (comma separated)",
              (defaults.packages ?? []).map((item) => item.path).join(","),
            ),
          ).map((path) => defaults.packages?.find((item) => item.path === path) ?? { path });
    return { ...defaults, project, languages, capabilities, standards, tools: selectedTools, layout, packages };
  } finally {
    prompt.close();
  }
}
