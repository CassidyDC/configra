/**
 * Sample Configuration Generation
 * @file Registry-driven sample catalog generation using the real project generator.
 */

import * as fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { projects, capabilities, standards, tools } from "../src/components/registry.js";
import { normalizeRequest, resolve } from "../src/generator/resolve.js";
import { packageGraph } from "../src/generator/package-graph.js";
import { plan } from "../src/generator/plan.js";
import { apply } from "../src/generator/apply.js";
import { json, relativePath } from "../src/platform/filesystem.js";

/**
 * @typedef {import("../src/contracts.js").ProjectInput} ProjectInput
 * @typedef {import("../src/contracts.js").ProjectRequest} ProjectRequest
 * @typedef {import("../src/contracts.js").ProjectDefinition} ProjectDefinition
 * @typedef {import("../src/contracts.js").CapabilityDefinition} CapabilityDefinition
 * @typedef {import("../src/contracts.js").StandardDefinition} StandardDefinition
 * @typedef {import("../src/contracts.js").ToolIntegration} ToolIntegration
 */

/**
 * Registered component collections used to enumerate examples.
 * @typedef {object} SampleRegistry
 * @property {Object<string, ProjectDefinition>} projects Registered project defaults.
 * @property {Object<string, CapabilityDefinition>} capabilities Optional language features.
 * @property {Object<string, Object<string, StandardDefinition>>} standards Language standards.
 * @property {Object<string, ToolIntegration>} tools Registered tool integrations.
 */

/**
 * One generated setup and its catalog description.
 * @typedef {object} SampleSetup
 * @property {string} path Catalog-relative setup directory.
 * @property {string} description Human-readable variation from project defaults.
 * @property {ProjectInput} input Generator selections for the setup.
 */

/**
 * Enumerate compact project, standard, capability, tool, and layout examples.
 *
 * @param {SampleRegistry} [registry] Component collections, defaulting to the real registry.
 * @returns {SampleSetup[]} Stable catalog derived from registered components.
 */
export function sampleSetups(registry = { projects, capabilities, standards, tools }) {
  const entries = [];
  const definitions = Object.values(registry.projects).sort((a, b) => a.id.localeCompare(b.id));

  for (const project of definitions) {
    const availableCapabilities = Object.values(registry.capabilities)
      .filter((item) => project.languages.includes(item.language))
      .map((item) => item.id)
      .sort();

    const defaultStandard = project.environment === "wordpress" ? "wordpress" : "community";
    const defaultTools = project.tools.filter(
      (id) =>
        !registry.tools[id].languages.length ||
        registry.tools[id].languages.some((language) => project.languages.includes(language)),
    );

    entries.push({ path: `${project.id}/default`, description: "Project defaults", input: { project: project.id } });

    for (const language of project.languages) {
      for (const id of Object.keys(registry.standards[language]).sort()) {
        if (id === defaultStandard) continue;

        entries.push({
          path: `${project.id}/standards/${language}-${id}`,
          description: `${language} uses ${id}; other languages keep their defaults`,
          input: { project: project.id, standards: { [language]: id } },
        });
      }
    }

    for (const id of availableCapabilities) {
      entries.push({
        path: `${project.id}/capabilities/${id}`,
        description: `${id} capability with default tools`,
        input: { project: project.id, capabilities: [id] },
      });
    }

    if (availableCapabilities.length > 1) {
      entries.push({
        path: `${project.id}/capabilities/all`,
        description: `Combined capabilities: ${availableCapabilities.join(", ")}`,
        input: { project: project.id, capabilities: availableCapabilities },
      });
    }

    for (const tool of Object.values(registry.tools).sort((a, b) => a.id.localeCompare(b.id))) {
      if (defaultTools.includes(tool.id)) continue;

      if (tool.languages.length && !tool.languages.some((language) => project.languages.includes(language))) continue;

      entries.push({
        path: `${project.id}/tools/${tool.id}`,
        description: `${tool.id} added to default tools with all compatible capabilities`,
        input: {
          project: project.id,
          capabilities: availableCapabilities,
          tools: [
            ...new Set([
              ...defaultTools,
              ...availableCapabilities.flatMap((id) => registry.capabilities[id].tools),
              tool.id,
            ]),
          ].sort(),
        },
      });
    }
  }

  for (const layout of ["nested", "workspaces"]) {
    entries.push({
      path: `layouts/${layout}`,
      description: `${layout} layout with one child for every registered project`,
      input: {
        project: definitions[0].id,
        layout,
        packages: definitions.map((project) => ({ path: `packages/${project.id}`, project: project.id })),
      },
    });
  }

  return entries;
}

/**
 * Write a minimal fixture manifest with deterministic names and workspace registration.
 *
 * @param {string} root Absolute sample package directory.
 * @param {string} name Stable npm package name.
 * @param {boolean} [workspaceRoot=false] Whether child packages are npm workspaces.
 * @returns {Promise<void>} Completes after creating the fixture package.
 */
async function seedPackage(root, name, workspaceRoot = false) {
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(
    path.join(root, "package.json"),
    json({ name, private: true, ...(workspaceRoot ? { workspaces: ["packages/*"] } : {}) }),
  );
}

/**
 * Render and apply one setup inside an isolated temporary Git boundary.
 *
 * @param {string} root Absolute setup directory inside the staging catalog.
 * @param {ProjectRequest} request Normalized generator selections.
 * @returns {Promise<void>} Completes after all generated files have been written.
 * @throws {Error} If generation reports conflicts, diagnostics, or write failures.
 */
async function generateSetup(root, request) {
  await seedPackage(root, "sample-root", request.layout === "workspaces");
  await fs.mkdir(path.join(root, ".git"));

  for (const child of request.packages) {
    await seedPackage(path.join(root, child.path), `sample-${child.path.replaceAll("/", "-")}`);
  }

  const graph = await packageGraph(root, request);
  const proposal = await plan(resolve(request, graph));

  if (proposal.diagnostics.length) throw new Error(proposal.diagnostics.join("\n"));

  const result = await apply(proposal);

  if (!result.generated || result.failed.length) throw new Error(`Sample writes failed: ${json(result.failed)}`);

  // The marker enables root hook generation without shipping a nested Git repository.
  await fs.rmdir(path.join(root, ".git"));
}

/**
 * Build the catalog index with stable relative links and regeneration guidance.
 *
 * @param {SampleSetup[]} entries Generated setup descriptions.
 * @returns {string} Markdown documentation for the generated catalog.
 */
function catalogReadme(entries) {
  return [
    "<!--",
    "Generated Configuration Samples",
    "",
    "Registry-driven examples produced by scripts/generate-samples.js.",
    "-->",
    "",
    "# Configuration samples",
    "",
    "Regenerate this directory from the repository root:",
    "",
    "```sh",
    "npm run samples:generate",
    "```",
    "",
    `This catalog contains ${entries.length} setups generated through the same resolution,`,
    "planning, and application code as the CLI. Each setup includes the generated",
    "configuration, dependency declarations, selections, and ownership state.",
    "",
    "Coverage includes every registered project's default setup, each alternative",
    "standard for its default languages, each compatible capability individually,",
    "combined capabilities, and each compatible tool absent from its defaults.",
    "The nested and workspace examples each contain a child for every project.",
    "This is a compact catalog; arbitrary language overrides, formatting values,",
    "tool subsets, and every combination of choices are not enumerated.",
    "",
    "Generation does not install dependencies or hooks. Minimal package manifests",
    "are seeded to give samples stable names and register the workspace example.",
    "A temporary Git boundary enables Lefthook output; no `.git` markers are kept.",
    "Each setup represents its own repository. To try updates, copy it outside",
    "this repository and initialize Git there so its hooks have the same boundary.",
    "The samples are excluded from the repository's own lint and formatting checks",
    "so their generated formatting and ownership hashes remain intact.",
    "",
    "The entire directory is replaced on regeneration, including obsolete setups.",
    "Make changes to components or the generation script instead of editing samples.",
    "New components must be registered in `src/components/registry.js`; their",
    "language must be present in a project's default languages to appear here.",
    "",
    "## Setups",
    "",
    "| Directory | Setup |",
    "| --- | --- |",
    ...entries.map((entry) => `| [${entry.path}](${entry.path}/) | ${entry.description} |`),
    "",
  ].join("\n");
}

/**
 * Generate a fresh catalog before replacing the previous output directory.
 *
 * @param {string} destination Absolute catalog output directory; its contents are replaced.
 * @param {SampleSetup[]} [entries=sampleSetups()] Selected setups, defaulting to the full compact catalog.
 * @returns {Promise<number>} Number of successfully generated setups.
 * @throws {Error} If paths are invalid, output is a symbolic link, or generation fails.
 */
export async function generateSamples(destination, entries = sampleSetups()) {
  const existing = await fs.lstat(destination).catch((error) => {
    if (error.code !== "ENOENT") throw error;

    return null;
  });

  if (existing && (!existing.isDirectory() || existing.isSymbolicLink()))
    throw new Error("Sample output must be a directory, not a file or symbolic link");

  const staging = await fs.realpath(await fs.mkdtemp(path.join(path.dirname(destination), ".samples-")));

  try {
    for (const entry of entries) {
      const directory = relativePath(entry.path);
      const request = normalizeRequest(entry.input);

      await generateSetup(path.join(staging, directory), request);
    }

    await fs.writeFile(path.join(staging, "README.md"), catalogReadme(entries));
    await fs.rm(destination, { recursive: true, force: true });
    await fs.rename(staging, destination);

    return entries.length;
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const count = await generateSamples(fileURLToPath(new URL("../samples", import.meta.url)));

  console.log(`Generated ${count} configuration setups in samples/.`);
}
