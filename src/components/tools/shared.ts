import type {
  CommandSpec,
  Contribution,
  FormatSettings,
  ManifestFieldContribution,
  ResolvedSettings,
  ToolId,
} from "../../contracts.js";

/**
 * Returns an empty contribution to fill in.
 */
export function emptyContribution(): Contribution {
  return { files: [], lines: [], fields: [], competing: [], diagnostics: [] };
}

/**
 * The first line of every Configra-owned file.
 */
export function managedHeader(entryFile: string): string {
  return `Managed by Configra. Put your changes in ${entryFile}.`;
}

/**
 * Builds a glob such as `**\/*.{js,mjs}` for each scope prefix.
 */
export function scopeGlobs(settings: ResolvedSettings, extensions: readonly string[]): string[] {
  if (extensions.length === 0) {
    return [];
  }

  const suffix = extensions.length === 1 ? `*.${extensions[0]}` : `*.{${extensions.join(",")}}`;

  return settings.scopePrefixes.map((prefix) => `${prefix}${suffix}`);
}

/**
 * Converts `.gitignore`-style exclusions to globs that match at any depth, such as `**\/build/**`.
 */
export function exclusionGlobs(settings: ResolvedSettings): string[] {
  return settings.exclusions.map((entry) => (entry.endsWith("/") ? `**/${entry}**` : `**/${entry}`));
}

/**
 * Quotes one command argument for a package script or Git hook, which run in a shell on every platform.
 */
export function quoteArg(arg: string): string {
  return /^[\w@%+=:,./-]+$/.test(arg) ? arg : `"${arg.replaceAll('"', '\\"')}"`;
}

/**
 * Renders a command for a package script.
 */
export function renderCommand(command: CommandSpec): string {
  return [command.executable, ...command.args].map(quoteArg).join(" ");
}

/**
 * Declares a development dependency in the root `package.json`.
 */
export function npmDependency(tool: ToolId, name: string, range: string): ManifestFieldContribution {
  return {
    tool,
    manifest: "package.json",
    path: ["devDependencies", name],
    value: range,
    reason: `Development dependency for ${tool}`,
    kind: "dependency",
  };
}

/**
 * Renders a JavaScript string array literal on one line.
 */
export function jsArray(values: readonly string[]): string {
  return `[${values.map((value) => JSON.stringify(value)).join(", ")}]`;
}

/**
 * Restyles a simple generated JavaScript file, written with 2-space indents, double quotes, semicolons,
 * and trailing commas, so it already passes Prettier with the project's formatting settings. Comments
 * are left alone, as Prettier leaves them.
 */
export function styleJs(source: string, formatting: FormatSettings): string {
  const unit = formatting.indentStyle === "tab" ? "\t" : " ".repeat(formatting.indentSize);
  const lines = source.split("\n");
  const isComment = (line: string) => /^\s*(\/\/|\/\*\*|\*)/.test(line);

  const styled = lines.map((line) => {
    if (isComment(line) || line.trim() === "") {
      const indent = /^( *)\/\//.exec(line)?.[1] ?? "";

      return indent.length > 0 && indent.length % 2 === 0
        ? `${unit.repeat(indent.length / 2)}${line.trimStart()}`
        : line;
    }

    const indent = /^( *)/.exec(line)?.[1] ?? "";
    let code = line.slice(indent.length);

    if (formatting.quoteStyle === "single") {
      code = code.replaceAll(/"([^"'\\]*)"/g, "'$1'");
    }

    if (!formatting.bracketSpacing) {
      code = code.replaceAll(/\{ ([^{}]*?) \}/g, "{$1}");
    }

    if (!formatting.semicolons) {
      code = code.replace(/;$/, "");
    }

    return `${unit.repeat(indent.length / 2)}${code}`;
  });

  if (formatting.trailingCommas === "none") {
    for (let index = 0; index < styled.length; index += 1) {
      const next = styled.slice(index + 1).find((line) => !isComment(line) && line.trim() !== "");

      if (!isComment(styled[index] as string) && next !== undefined && /^\s*[\]})]/.test(next)) {
        styled[index] = (styled[index] as string).replace(/,$/, "");
      }
    }
  }

  return styled.join("\n");
}
