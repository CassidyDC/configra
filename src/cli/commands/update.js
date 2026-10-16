import { readJson } from "../../platform/filesystem.js";
import { generate } from "./generate.js";
export async function update(root, selections, options, io) {
  const saved = await readJson(root, ".cassidydc-toolset.json");
  if (!saved) throw new Error("No saved selections; run cdctool init first");
  return generate(
    root,
    {
      ...saved,
      ...selections,
      ...(saved.standards || selections.standards
        ? { standards: { ...saved.standards, ...selections.standards } }
        : {}),
    },
    options,
    io,
  );
}
