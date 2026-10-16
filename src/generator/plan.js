import { format } from "prettier";
import { options as prettierOptions } from "../components/tools/prettier/options.js";
import path from "node:path";
import { tools } from "../components/registry.js";
import { read, hash, json, relativePath } from "../platform/filesystem.js";
import { installation as npmInstallation } from "../platform/npm.js";
import { installation as composerInstallation } from "../platform/composer.js";
import * as single from "./layouts/single.js";
import * as nested from "./layouts/nested.js";
import * as workspaces from "./layouts/workspaces.js";

const STATE = ".cassidydc-toolset-state.json";
const SELECTIONS = ".cassidydc-toolset.json";
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const join = (root, name) => path.posix.join(root, name);

function leaves(value, prefix = [], result = {}) {
  for (const [key, child] of Object.entries(value)) {
    if (["__proto__", "prototype", "constructor"].includes(key)) throw new Error(`Unsupported manifest key: ${key}`);
    if (object(child)) leaves(child, [...prefix, key], result);
    else result[JSON.stringify([...prefix, key])] = child;
  }
  return result;
}
function get(value, keys) {
  return keys.reduce((current, key) => current?.[key], value);
}
function set(value, keys, next) {
  let current = value;
  for (const key of keys.slice(0, -1)) {
    if (["__proto__", "prototype", "constructor"].includes(key)) throw new Error("Unsafe manifest key");
    if (!object(current[key])) current[key] = {};
    current = current[key];
  }
  if (next === undefined) delete current[keys.at(-1)];
  else current[keys.at(-1)] = next;
}

function mergeContribution(target, contribution) {
  for (const key of ["files", "scripts", "npm", "composer", "jsonFiles", "lines", "composerSettings"]) {
    for (const [name, value] of Object.entries(contribution[key] ?? {})) {
      if (target[key][name] !== undefined && !equal(target[key][name], value))
        throw new Error(`Conflicting tool contributions: ${key}/${name}`);
      target[key][name] = value;
    }
  }
  target.hooks.push(...(contribution.hooks ?? []));
}
const empty = () => ({
  files: {},
  scripts: {},
  npm: {},
  composer: {},
  jsonFiles: {},
  lines: {},
  composerSettings: {},
  hooks: [],
});

/** Reads project state and renders a complete proposal without writing. */
export async function plan(resolved) {
  const { graph, request } = resolved;
  const root = graph.root;
  const stateBefore = await read(root, STATE);
  let previous;
  try {
    previous = stateBefore === null ? { version: 1, files: {} } : JSON.parse(stateBefore);
  } catch {
    throw new Error("Invalid JSON in generation state");
  }
  if (!object(previous) || previous.version !== 1 || !object(previous.files))
    throw new Error("Unsupported or invalid generation state");
  const layout = { single, nested, workspaces }[request.layout];
  const desired = new Map();
  const installations = [];
  const hooks = [];
  const diagnostics = [];
  const contributions = new Map();
  const alternatives = new Map();
  const contexts = resolved.packages.map((project) =>
    layout.context(
      {
        ...project,
        descendants: resolved.packages
          .filter(
            (child) =>
              child.path !== project.path && (project.path === "." || child.path.startsWith(project.path + "/")),
          )
          .map((child) => child.path),
      },
      resolved,
    ),
  );
  for (const project of contexts) {
    const contribution = empty();
    for (const id of project.tools.filter((id) => id !== "lefthook"))
      mergeContribution(contribution, tools[id].render(project));
    contributions.set(project.path, contribution);
    for (const id of project.tools)
      for (const name of tools[id].alternatives ?? []) alternatives.set(join(project.path, name), id);
    for (const requirement of contribution.hooks) {
      const prefix = project.path === "." ? "" : project.path + "/";
      hooks.push({
        ...requirement,
        id: `${project.path}:${requirement.id}`,
        root: project.path,
        glob: requirement.glob.map((pattern) => prefix + pattern),
        excludes: project.excludes.map((pattern) => prefix + pattern),
      });
    }
  }
  const rootProject = contexts[0];
  if (contexts.some((project) => project.tools.includes("lefthook"))) {
    if (graph.gitRoot && graph.gitRoot !== root)
      diagnostics.push(
        "Lefthook generation skipped: the Git root is outside the selected project boundary. Run from the repository root to manage root hooks.",
      );
    else mergeContribution(contributions.get("."), tools.lefthook.render(rootProject, { hooks }));
  }
  for (const project of contexts) {
    const contribution = contributions.get(project.path);
    for (const [name, content] of Object.entries(contribution.files))
      desired.set(join(project.path, name), { kind: "file", content });
    for (const [name, content] of Object.entries(contribution.jsonFiles))
      desired.set(join(project.path, name), { kind: "json", content });
    for (const [name, content] of Object.entries(contribution.lines))
      desired.set(join(project.path, name), { kind: "lines", content });
    const scripts = layout.scripts(project, contribution);
    if (Object.keys(scripts).length || Object.keys(contribution.npm).length) {
      desired.set(join(project.path, "package.json"), {
        kind: "json",
        content: { scripts, devDependencies: contribution.npm },
        defaults: {
          name:
            path
              .basename(path.resolve(root, project.path))
              .toLowerCase()
              .replace(/[^a-z0-9-]/g, "-")
              .replace(/^-+/, "") || "project",
          private: true,
        },
      });
    }
    if (Object.keys(contribution.npm).length)
      installations.push(
        npmInstallation(root, layout.dependencyOwner(project), request.layout === "workspaces", project.workspaceName),
      );
    if (Object.keys(contribution.composer).length) {
      desired.set(join(project.path, "composer.json"), {
        kind: "json",
        content: { "require-dev": contribution.composer, ...contribution.composerSettings },
      });
      installations.push(composerInstallation(root, project.path));
    }
  }
  async function formatted(name, content) {
    if (content === null || !/\.(?:[cm]?js|jsonc?|ya?ml|md)$/.test(name)) return content;
    const owner = [...contexts]
      .reverse()
      .find((project) => project.path === "." || name.startsWith(project.path + "/"));
    if (!owner.tools.includes("prettier")) return content;
    return format(content, { ...prettierOptions(owner), filepath: name, plugins: [] });
  }
  const changes = [];
  const conflicts = [];
  const state = { version: 1, files: {} };
  const snapshots = { ...graph.snapshots };
  for (const name of [...new Set([...desired.keys(), ...Object.keys(previous.files)])].sort()) {
    relativePath(name);
    if ([STATE, SELECTIONS].includes(name)) throw new Error(`Invalid managed state entry: ${name}`);
    const before = await read(root, name);
    if (Object.hasOwn(snapshots, name) && snapshots[name] !== hash(before))
      throw new Error(`Project changed during planning: ${name}`);
    snapshots[name] = hash(before);
    const old = previous.files[name];
    if (old && !["file", "json", "lines"].includes(old.kind)) throw new Error(`Invalid generation state for ${name}`);
    const entry = desired.get(name);
    let after;
    const conflict = (reason) => conflicts.push({ path: name, reason });
    if ((entry?.kind ?? old?.kind) === "json") {
      let existing;
      try {
        existing = before === null ? { ...entry?.defaults } : JSON.parse(before);
      } catch {
        throw new Error(`Invalid JSON in ${name}; resolve it before generating`);
      }
      if (!object(existing)) throw new Error(`Expected a JSON object in ${name}`);
      const next = JSON.parse(JSON.stringify(existing));
      const entries = leaves(entry?.content ?? {});
      const prior = old?.entries ?? {};
      for (const key of new Set([...Object.keys(prior), ...Object.keys(entries)])) {
        const keys = JSON.parse(key);
        if (
          !Array.isArray(keys) ||
          !keys.length ||
          keys.some((part) => typeof part !== "string" || ["__proto__", "prototype", "constructor"].includes(part))
        )
          throw new Error(`Invalid state entry in ${name}`);
        const current = get(existing, keys);
        let wanted = entries[key];
        let additive = false;
        // Recommendations are additive, preserving user extensions on updates and removal.
        if (name.endsWith("/.vscode/extensions.json") || name === ".vscode/extensions.json") {
          if (keys.length === 1 && keys[0] === "recommendations" && (current === undefined || Array.isArray(current))) {
            additive = true;
            wanted = [
              ...new Set([...(current ?? []).filter((item) => !(prior[key] ?? []).includes(item)), ...(wanted ?? [])]),
            ];
            if (entries[key])
              entries[key] = entries[key].filter(
                (item) => (prior[key] ?? []).includes(item) || !(current ?? []).includes(item),
              );
          }
        }
        if (!equal(current, wanted)) {
          const known = Object.hasOwn(prior, key);
          if (
            !additive &&
            ((known && !equal(current, prior[key])) || (!known && current !== undefined && !equal(current, wanted)))
          )
            conflict(`Modified or existing manifest entry: ${keys.join(".")}`);
          // Never replace a scalar ancestor (e.g. allow-plugins: false) silently.
          for (let i = 1; i < keys.length; i++) {
            const parent = get(existing, keys.slice(0, i));
            if (parent !== undefined && !object(parent))
              conflict(`Conflicting manifest structure: ${keys.slice(0, i).join(".")}`);
          }
          set(next, keys, wanted);
        }
      }
      after = equal(next, existing) ? before : await formatted(name, json(next));
      if (entry) state.files[name] = { kind: "json", entries };
    } else if ((entry?.kind ?? old?.kind) === "lines") {
      const existing = before?.split(/\r?\n/) ?? [];
      const previousLines = old?.entries ?? [];
      const lines = entry?.content ?? [];
      const kept = existing.filter((line) => !previousLines.includes(line));
      while (kept.at(-1) === "") kept.pop();
      after = [...kept, ...lines.filter((line) => !kept.includes(line))].join("\n") + "\n";
      if (entry)
        state.files[name] = {
          kind: "lines",
          entries: lines.filter((line) => previousLines.includes(line) || !existing.includes(line)),
        };
      if (before === after) after = before;
    } else {
      after = await formatted(name, entry?.content ?? null);
      if (before !== after && before !== null && (!old || hash(before) !== old.hash))
        conflict("File contains existing or edited content");
      if (before === null && old && entry) conflict("Previously generated file was deleted");
      if (entry) state.files[name] = { kind: "file", hash: hash(after) };
    }
    if (before !== after) changes.push({ path: name, before: hash(before), content: after });
  }
  for (const [name, tool] of alternatives) {
    if (previous.files[name]) continue; // Previously generated alternatives follow normal ownership rules.
    if (desired.has(name)) throw new Error(`Competing generated configuration: ${name}`);
    const before = await read(root, name);
    snapshots[name] = hash(before);
    if (before !== null) {
      conflicts.push({
        path: name,
        reason: `Competing ${tool} configuration; replacement requires removing this file`,
      });
      changes.push({ path: name, before: hash(before), content: null });
    }
  }
  const selectionsBefore = await read(root, SELECTIONS);
  snapshots[SELECTIONS] = hash(selectionsBefore);
  let selectionsContent = await formatted(SELECTIONS, json(request));
  if (selectionsBefore !== null) {
    try {
      if (equal(JSON.parse(selectionsBefore), request)) selectionsContent = selectionsBefore;
    } catch {
      conflicts.push({ path: SELECTIONS, reason: "Existing selections are not valid JSON" });
    }
  }
  if (selectionsContent !== selectionsBefore)
    changes.push({ path: SELECTIONS, before: hash(selectionsBefore), content: selectionsContent });
  snapshots[STATE] = hash(stateBefore);
  const stateContent = json(state);
  if (stateBefore !== stateContent) changes.push({ path: STATE, before: hash(stateBefore), content: stateContent });
  return { root, changes, conflicts, diagnostics, installations, snapshots, request };
}
