import { parseArgs } from "node:util";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { init } from "./commands/init.js";
import { update } from "./commands/update.js";

/**
 * @typedef {import("../contracts.js").CliIO} CliIO
 */

/**
 * Usage text shared by explicit help and invocations without a command.
 *
 * @constant {string}
 */
const help = `CassidyDC Toolset
Usage: cdctool <init|update|discover> [options]

  --cwd <path>            Existing project directory (default: current directory)
  --project <id>          node, php, python, wordpress-site, wordpress-plugin, wordpress-theme
  --languages <list>      Comma-separated javascript,css,php,python
  --capabilities <list>   Comma-separated react,typescript (does not select webpack)
  --standard <lang=id>    Repeat per language: javascript=community or php=wordpress
  --tools <list>          Explicit comma-separated tool selection; empty disables all tools
  --layout <id>           single, nested, workspaces
  --package <path>        Repeat for selected child packages; use --config for child overrides
  --config <file>         JSON selections (same schema as .cassidydc-toolset.json)
  --interactive          Collect selections in the terminal
  --dry-run              Preview without writing or installing
  --json                 Machine-readable proposal (combine with --dry-run for preview)
  --install              Install declared dependencies after generation
  --force                Replace explicitly reported conflicting generated entries
  --help, --version      Show help or version
`;

/**
 * Parse CLI arguments, dispatch a workflow, and translate failures into readable diagnostics.
 *
 * @param {string[]} [argv=process.argv.slice(2)] Arguments excluding the Node executable and script path.
 * @param {CliIO} [io] Output callbacks; defaults to process stdout and stderr.
 * @returns {Promise<number>} Zero on success, one on failure, or two for dry-run conflicts.
 */
export async function run(
  argv = process.argv.slice(2),
  io = { out: (value) => process.stdout.write(value + "\n"), error: (value) => process.stderr.write(value + "\n") },
) {
  try {
    const { values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        cwd: { type: "string" },
        project: { type: "string" },
        languages: { type: "string" },
        capabilities: { type: "string" },
        tools: { type: "string" },
        standard: { type: "string", multiple: true },
        layout: { type: "string" },
        package: { type: "string", multiple: true },
        config: { type: "string" },
        interactive: { type: "boolean" },
        "dry-run": { type: "boolean" },
        json: { type: "boolean" },
        install: { type: "boolean" },
        force: { type: "boolean" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
      },
    });

    if (values.version) {
      io.out(JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8")).version);

      return 0;
    }

    if (values.help || !positionals.length) {
      io.out(help);

      return 0;
    }

    if (positionals.length !== 1 || !["init", "update", "discover"].includes(positionals[0]))
      throw new Error("Expected init, update, or discover; use --help");

    const root = path.resolve(values.cwd ?? process.cwd());

    if (positionals[0] === "discover") {
      const { packageGraph } = await import("../generator/package-graph.js");

      io.out(JSON.stringify(await packageGraph(root, { packages: [], layout: "single" }), null, 2));

      return 0;
    }

    let selections = {};

    if (values.config) selections = JSON.parse(await readFile(path.resolve(root, values.config), "utf8"));

    if (!selections || typeof selections !== "object" || Array.isArray(selections))
      throw new Error("Selections must be a JSON object");

    for (const name of ["project", "layout"]) if (values[name] !== undefined) selections[name] = values[name];

    for (const name of ["languages", "capabilities", "tools"])
      if (values[name] !== undefined)
        selections[name] = values[name]
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);

    if (values.standard) {
      selections.standards = { ...selections.standards };

      for (const standard of values.standard) {
        const parts = standard.split("=");

        if (parts.length !== 2 || parts.some((part) => !part)) throw new Error("Use --standard language=standard");

        selections.standards[parts[0]] = parts[1];
      }
    }

    if (values.package) selections.packages = values.package.map((path) => ({ path }));

    const interactive = values.interactive || (positionals[0] === "init" && argv.length === 1 && process.stdin.isTTY);

    if (interactive) {
      if (!process.stdin.isTTY || !process.stdout.isTTY)
        throw new Error("Interactive mode requires a terminal; pass selections as arguments or --config");

      const { collect } = await import("./prompts/selections.js");

      if (positionals[0] === "update") {
        const { readJson } = await import("../platform/filesystem.js");
        selections = { ...(await readJson(root, ".cassidydc-toolset.json", {})), ...selections };
      }

      selections = await collect(selections);
    }

    return await (positionals[0] === "init" ? init : update)(
      root,
      selections,
      { dryRun: values["dry-run"], json: values.json, install: values.install, force: values.force, interactive },
      io,
    );
  } catch (error) {
    io.error(error.message);

    return 1;
  }
}
