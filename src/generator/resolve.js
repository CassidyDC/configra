import { projects, capabilities, standards, tools } from "../components/registry.js";
import { relativePath } from "../platform/filesystem.js";

/**
 * @typedef {import("../contracts.js").ProjectInput} ProjectInput
 * @typedef {import("../contracts.js").ProjectRequest} ProjectRequest
 * @typedef {import("../contracts.js").Selections} Selections
 * @typedef {import("../contracts.js").PackageNode} PackageNode
 * @typedef {import("../contracts.js").ResolvedPackage} ResolvedPackage
 * @typedef {import("../contracts.js").PackageGraph} PackageGraph
 * @typedef {import("../contracts.js").ResolvedProject} ResolvedProject
 */

/**
 * Validate selection identifiers, remove duplicates, and return a stable ordering.
 *
 * @param {unknown} value Untrusted selection list.
 * @param {string} label Selection category used in diagnostics.
 * @param {string[]} allowed Supported identifiers.
 * @returns {string[]} Unique sorted identifiers.
 * @throws {Error} If the value is not a supported identifier list.
 */
function list(value, label, allowed) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !allowed.includes(item))) {
    throw new Error(`Unsupported ${label}; choose from ${allowed.join(", ")}`);
  }

  return [...new Set(value)].sort();
}

/**
 * Validate selection object fields and formatting override shapes.
 *
 * @param {unknown} input Untrusted selection object.
 * @param {string[]} allowed Accepted field names for this selection level.
 * @returns {void}
 * @throws {Error} If the object contains unknown fields or invalid option shapes.
 */
function validateSelection(input, allowed) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Selections must be a JSON object");

  for (const key of Object.keys(input)) if (!allowed.includes(key)) throw new Error(`Unknown selection: ${key}`);

  for (const key of ["standards", "formatting"]) {
    if (input[key] !== undefined && (!input[key] || typeof input[key] !== "object" || Array.isArray(input[key])))
      throw new Error(`${key} must be an object`);
  }

  if (input.formatting)
    for (const key of Object.keys(input.formatting))
      if (!["indentStyle", "indentSize", "endOfLine", "printWidth"].includes(key))
        throw new Error(`Unsupported formatting option: ${key}`);
}

/**
 * Selection fields shared by root requests and child package overrides.
 *
 * @constant {string[]}
 */
const selectionFields = ["project", "languages", "capabilities", "standards", "tools", "formatting"];

/**
 * Apply request defaults and normalize child paths without resolving component defaults.
 *
 * @param {ProjectInput} [input={}] CLI, prompt, or saved selections.
 * @returns {ProjectRequest} Versioned, normalized request.
 * @throws {Error} If the schema, layout, package paths, or selections are invalid.
 */
export function normalizeRequest(input = {}) {
  validateSelection(input, [...selectionFields, "version", "layout", "packages"]);

  if (input.version !== undefined && input.version !== 1) throw new Error("Unsupported selection schema version");

  const layout = input.layout ?? "single";

  if (!["single", "nested", "workspaces"].includes(layout)) throw new Error(`Unsupported layout: ${layout}`);

  const request = { version: 1, project: input.project ?? "node", layout, packages: [], ...input };

  request.version = 1;
  request.layout = layout;

  if (!Array.isArray(request.packages)) throw new Error("packages must be an array");

  request.packages = request.packages
    .map((item) => {
      if (typeof item === "string") return { path: relativePath(item) };

      validateSelection(item, [...selectionFields, "path"]);

      return { ...item, path: relativePath(item.path) };
    })
    .sort((a, b) => a.path.localeCompare(b.path));

  if (new Set(request.packages.map((item) => item.path)).size !== request.packages.length)
    throw new Error("Duplicate package paths");

  if (layout === "single" && request.packages.length) throw new Error("single layout does not accept child packages");

  // Only persist selection fields, never command-line operational options.
  return Object.fromEntries(
    ["version", "project", "layout", "languages", "capabilities", "standards", "tools", "formatting", "packages"]
      .filter((key) => request[key] !== undefined)
      .map((key) => [key, request[key]]),
  );
}

/**
 * Resolve one package against project defaults, standards, capabilities, and overrides.
 *
 * @param {Selections} selection Effective selections before component resolution.
 * @param {PackageNode} node Selected package ownership information.
 * @returns {ResolvedPackage} Validated effective package settings.
 * @throws {Error} If a component or formatting combination is unsupported.
 */
function resolvePackage(selection, node) {
  const project = Object.hasOwn(projects, selection.project) ? projects[selection.project] : undefined;

  if (!project) throw new Error(`Unsupported project: ${selection.project}`);

  const languages = list(selection.languages ?? project.languages, "languages", Object.keys(standards));
  const selectedCapabilities = list(selection.capabilities ?? [], "capabilities", Object.keys(capabilities));

  for (const id of selectedCapabilities) {
    if (!languages.includes(capabilities[id].language)) throw new Error(`${id} requires JavaScript`);
  }

  if (!languages.length) throw new Error("Select at least one language");

  const chosenStandards = {};

  for (const [language, id] of Object.entries(selection.standards ?? {})) {
    if (!languages.includes(language) || !Object.hasOwn(standards[language], id))
      throw new Error(`Unsupported standard: ${language}=${id}`);
  }

  for (const language of languages)
    chosenStandards[language] =
      standards[language][
        selection.standards?.[language] ??
          (project.environment === "wordpress" && language !== "python" ? "wordpress" : "community")
      ];

  const defaults = project.tools.filter(
    (id) => !tools[id].languages.length || tools[id].languages.some((language) => languages.includes(language)),
  );
  let selectedTools = list(selection.tools ?? defaults, "tools", Object.keys(tools));

  if (selection.tools === undefined)
    selectedTools = [
      ...new Set([...selectedTools, ...selectedCapabilities.flatMap((id) => capabilities[id].tools)]),
    ].sort();

  for (const id of selectedTools) {
    if (tools[id].languages.length && !tools[id].languages.some((language) => languages.includes(language)))
      throw new Error(`${id} does not support the selected languages`);
  }

  const formatting = {
    indentStyle: "space",
    indentSize: 2,
    endOfLine: "lf",
    printWidth: 100,
    ...chosenStandards[languages.includes("javascript") ? "javascript" : languages[0]]?.formatting,
    ...selection.formatting,
  };

  if (
    !["space", "tab"].includes(formatting.indentStyle) ||
    !Number.isInteger(formatting.indentSize) ||
    formatting.indentSize < 1 ||
    !["lf", "crlf"].includes(formatting.endOfLine) ||
    !Number.isInteger(formatting.printWidth) ||
    formatting.printWidth < 40
  )
    throw new Error("Unsupported formatting options");

  const languageFormatting = Object.fromEntries(
    languages.map((language) => [
      language,
      { ...formatting, ...chosenStandards[language].formatting, ...selection.formatting },
    ]),
  );

  for (const language of ["php", "python"]) {
    const format = languageFormatting[language];

    if (chosenStandards[language]?.id === "community" && (format.indentStyle !== "space" || format.indentSize !== 4))
      throw new Error(`${language} community standard requires four-space indentation`);
  }

  if (
    chosenStandards.php?.id === "wordpress" &&
    (languageFormatting.php.indentStyle !== "tab" || languageFormatting.php.indentSize !== 4)
  )
    throw new Error("PHP WordPress standard requires tabs with width four");

  if (chosenStandards.php && formatting.endOfLine !== "lf")
    throw new Error("PHP coding standards require LF line endings");

  return {
    ...node,
    formattingOverrides: selection.formatting,
    toolOverrides: selection.tools,
    project: project.id,
    environment: project.environment,
    languages,
    capabilities: selectedCapabilities,
    standards: chosenStandards,
    tools: selectedTools,
    formatting,
    languageFormatting,
    sourcePaths: project.paths,
  };
}

/**
 * Resolve selected packages in parent-before-child order while applying explicit inheritance.
 *
 * @param {ProjectRequest} request Normalized root and child selections.
 * @param {PackageGraph} graph Selected package ownership graph.
 * @returns {ResolvedProject} Effective settings for all selected packages.
 */
export function resolve(request, graph) {
  request = normalizeRequest(request);
  const root = resolvePackage(request, graph.packages[0]);
  const packages = [root];

  for (const node of graph.packages.slice(1)) {
    const override = request.packages.find((item) => item.path === node.path);
    const parent = packages.find((item) => item.path === node.parent);
    const projectId = override.project ?? parent.project;
    const definition = Object.hasOwn(projects, projectId) ? projects[projectId] : undefined;

    if (!definition) throw new Error(`Unsupported project: ${override.project}`);

    const languages =
      override.languages ??
      (override.project && override.project !== parent.project ? definition.languages : parent.languages);

    const inheritedStandards = Object.fromEntries(
      Object.entries(parent.standards)
        .filter(([language]) => languages.includes(language))
        .map(([language, standard]) => [language, standard.id]),
    );

    const inheritedTools = parent.toolOverrides?.filter(
      (id) => !tools[id].languages.length || tools[id].languages.some((language) => languages.includes(language)),
    );

    packages.push(
      resolvePackage(
        {
          project: parent.project,
          languages,
          capabilities: languages.includes("javascript") ? parent.capabilities : [],
          tools: inheritedTools,
          ...override,
          formatting: { ...parent.formattingOverrides, ...override.formatting },
          standards: { ...inheritedStandards, ...override.standards },
        },
        node,
      ),
    );
  }

  return { request, graph, packages };
}
