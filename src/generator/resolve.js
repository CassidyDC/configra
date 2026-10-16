import { projects, capabilities, standards, tools } from "../components/registry.js";
import { relativePath } from "../platform/filesystem.js";

function list(value, label, allowed) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !allowed.includes(item))) {
    throw new Error(`Unsupported ${label}; choose from ${allowed.join(", ")}`);
  }
  return [...new Set(value)].sort();
}

export function normalizeRequest(input = {}) {
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
      if (!item || typeof item !== "object") throw new Error("Each package needs a relative path");
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

function resolvePackage(selection, node) {
  const project = projects[selection.project];
  if (!project) throw new Error(`Unsupported project: ${selection.project}`);
  const languages = list(selection.languages ?? project.languages, "languages", Object.keys(standards));
  const selectedCapabilities = list(selection.capabilities ?? [], "capabilities", Object.keys(capabilities));
  for (const id of selectedCapabilities) {
    if (!languages.includes(capabilities[id].language)) throw new Error(`${id} requires JavaScript`);
  }
  const chosenStandards = {};
  for (const [language, id] of Object.entries(selection.standards ?? {})) {
    if (!languages.includes(language) || !standards[language]?.[id])
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
  return {
    ...node,
    formattingOverrides: selection.formatting,
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

export function resolve(request, graph) {
  request = normalizeRequest(request);
  const root = resolvePackage(request, graph.packages[0]);
  const packages = [root];
  for (const node of graph.packages.slice(1)) {
    const override = request.packages.find((item) => item.path === node.path);
    const parent = packages.find((item) => item.path === node.parent);
    const definition = projects[override.project ?? parent.project];
    if (!definition) throw new Error(`Unsupported project: ${override.project}`);
    const languages =
      override.languages ??
      (override.project && override.project !== parent.project ? definition.languages : parent.languages);
    const inheritedStandards = Object.fromEntries(
      Object.entries(parent.standards)
        .filter(([language]) => languages.includes(language))
        .map(([language, standard]) => [language, standard.id]),
    );
    const inheritedTools = parent.tools.filter(
      (id) => !tools[id].languages.length || tools[id].languages.some((language) => languages.includes(language)),
    );
    packages.push(
      resolvePackage(
        {
          project: parent.project,
          languages,
          capabilities: languages.includes("javascript") ? parent.capabilities : [],
          tools: inheritedTools,
          formatting: parent.formattingOverrides,
          ...override,
          standards: { ...inheritedStandards, ...override.standards },
        },
        node,
      ),
    );
  }
  return { request, graph, packages };
}
