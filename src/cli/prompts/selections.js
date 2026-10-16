import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { projects, tools } from "../../components/registry.js";

/** Prompt modules only collect structured selections; they never write project files. */
export async function collect(defaults = {}) {
  const prompt = createInterface({ input: stdin, output: stdout });
  const ask = async (label, fallback) => (await prompt.question(`${label} [${fallback}]: `)).trim() || fallback;
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
