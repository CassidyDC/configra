import * as fs from "node:fs/promises";
import path from "node:path";
import { directories, read, readJson, safePath, hash } from "../platform/filesystem.js";
import { workspacePatterns, matchesWorkspace } from "../platform/npm.js";

async function gitBoundary(root) {
  let cursor = root;
  while (true) {
    try {
      await fs.lstat(path.join(cursor, ".git"));
      return cursor;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const parent = path.dirname(cursor);
    if (parent === cursor) return null;
    cursor = parent;
  }
}

export async function discover(root) {
  const candidates = [];
  async function visit(relative) {
    const manifests = [];
    for (const name of ["package.json", "composer.json", "pyproject.toml"]) {
      if ((await read(root, path.posix.join(relative, name))) !== null) manifests.push(name);
    }
    if (manifests.length || /^(plugins|themes|mu-plugins)\/[^/]+$/.test(relative))
      candidates.push({ path: relative, manifests });
    for (const child of await directories(path.resolve(root, relative))) {
      const next = path.posix.join(relative, child);
      try {
        await fs.lstat(path.join(root, next, ".git"));
        candidates.push({ path: next, manifests: [], gitBoundary: true });
        continue;
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      await visit(next);
    }
  }
  await visit(".");
  return candidates;
}

export async function packageGraph(root, request) {
  root = await fs.realpath(root);
  const patterns = await workspacePatterns(root);
  const candidates = await discover(root);
  const packages = [{ path: ".", parent: null, workspace: false, children: [] }];
  for (const selection of [...request.packages].sort(
    (a, b) => a.path.split("/").length - b.path.split("/").length || a.path.localeCompare(b.path),
  )) {
    const target = await safePath(root, selection.path);
    if (!(await fs.stat(target)).isDirectory()) throw new Error(`Package is not a directory: ${selection.path}`);
    if ((await gitBoundary(target)) !== (await gitBoundary(root)))
      throw new Error(`Selected package crosses a Git boundary: ${selection.path}`);
    const parent = [...packages]
      .reverse()
      .find((node) => node.path === "." || selection.path.startsWith(node.path + "/"));
    const workspace = matchesWorkspace(selection.path, patterns);
    if (
      request.layout === "workspaces" &&
      (!workspace || (await read(root, `${selection.path}/package.json`)) === null)
    )
      throw new Error(`Package is not a registered npm workspace: ${selection.path}`);
    const manifest = await readJson(root, path.posix.join(selection.path, "package.json"), {});
    const workspaceName = manifest.name;
    if (
      request.layout === "workspaces" &&
      (typeof workspaceName !== "string" ||
        !workspaceName ||
        packages.some((node) => node.workspaceName === workspaceName))
    )
      throw new Error(`Workspace needs a unique package name: ${selection.path}`);
    const node = { path: selection.path, parent: parent.path, workspace, workspaceName, children: [] };
    packages.push(node);
    parent.children.push(node.path);
  }
  const snapshots = {};
  for (const node of packages) {
    const name = path.posix.join(node.path, "package.json");
    snapshots[name] = hash(await read(root, name));
  }
  return { root, gitRoot: await gitBoundary(root), candidates, packages, workspacePatterns: patterns, snapshots };
}
