/**
 * Runtime schemas for external JSON. The published JSON Schemas in dist/schemas/ are emitted from these
 * definitions, so editors validate against exactly what Configra checks.
 */

import { Type, type Static, type TSchema } from "typebox";
import { Value } from "typebox/value";
import type { Diagnostic } from "../../contracts.js";
import { commitMessageModes, languageIds, presetIds, standardIds, toolIds, uiIds } from "../../components/registry.js";

/**
 * An enumeration of string values.
 */
function literals<const T extends string[]>(values: readonly [...T], description?: string) {
  return Type.Enum([...values] as [...T], description ? { description } : {});
}

const standard = literals(standardIds);

export const configSchema = Type.Object(
  {
    $schema: Type.Optional(Type.String({ description: "The JSON Schema for this file. Configra writes it." })),
    version: Type.Literal(1, { description: "The config schema version." }),
    project: literals(presetIds, "The project preset."),
    packages: Type.Optional(
      Type.Array(Type.String(), {
        description: "Plugin and theme directories, or single-file must-use plugins, relative to the project root.",
      }),
    ),
    languages: Type.Optional(
      Type.Array(literals(languageIds), { description: "Selected languages. Replaces the preset's list." }),
    ),
    ui: Type.Optional(
      Type.Array(literals(uiIds), { description: "Selected UI frameworks. Replaces the preset's list." }),
    ),
    standards: Type.Optional(
      Type.Object(
        {
          javascript: Type.Optional(standard),
          typescript: Type.Optional(standard),
          css: Type.Optional(standard),
          php: Type.Optional(standard),
        },
        {
          additionalProperties: false,
          description: "Coding standard per language. Merges with the preset's standard by language.",
        },
      ),
    ),
    tools: Type.Optional(
      Type.Array(literals(toolIds), { description: "Selected tools. Replaces the default tool list." }),
    ),
    commitMessages: Type.Optional(literals(commitMessageModes, "How the commit-msg hook checks subjects.")),
    exclusions: Type.Optional(
      Type.Object(
        {
          add: Type.Optional(
            Type.Array(Type.String(), { description: "Extra exclusions in .gitignore syntax, such as `generated/`." }),
          ),
          remove: Type.Optional(
            Type.Array(Type.String(), { description: "Default exclusions to drop, such as `dist/`." }),
          ),
        },
        { additionalProperties: false, description: "Changes to the directories and files every check skips." },
      ),
    ),
    formatting: Type.Optional(
      Type.Object(
        {
          indentStyle: Type.Optional(literals(["space", "tab"])),
          indentSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 16 })),
          lineWidth: Type.Optional(Type.Integer({ minimum: 20, maximum: 400 })),
          endOfLine: Type.Optional(literals(["lf", "crlf"])),
          quoteStyle: Type.Optional(literals(["double", "single"])),
          semicolons: Type.Optional(Type.Boolean()),
          trailingCommas: Type.Optional(literals(["all", "es5", "none"])),
          bracketSpacing: Type.Optional(Type.Boolean()),
        },
        { additionalProperties: false, description: "Formatting settings shared by EditorConfig and Prettier." },
      ),
    ),
    php: Type.Optional(
      Type.Object(
        {
          targetVersion: Type.Optional(
            Type.String({ pattern: "^\\d+\\.\\d+$", description: "The lowest PHP version the code supports." }),
          ),
          phpstanLevel: Type.Optional(Type.Integer({ minimum: 0, maximum: 10 })),
          scanDirectories: Type.Optional(
            Type.Object(
              { remove: Type.Optional(Type.Array(Type.String())) },
              { additionalProperties: false, description: "Unselected directories PHPStan shouldn't scan." },
            ),
          ),
        },
        { additionalProperties: false },
      ),
    ),
    wordpress: Type.Optional(
      Type.Object(
        {
          minimumVersion: Type.Optional(Type.String({ pattern: "^\\d+\\.\\d+(\\.\\d+)?$" })),
          packages: Type.Optional(
            Type.Record(
              Type.String(),
              Type.Object(
                { textDomain: Type.Optional(Type.String()), prefix: Type.Optional(Type.String()) },
                { additionalProperties: false },
              ),
            ),
          ),
        },
        { additionalProperties: false },
      ),
    ),
    decisions: Type.Optional(
      Type.Record(Type.String(), Type.Literal("retain"), {
        description: "Conflicts settled by keeping the existing content, keyed by conflict ID.",
      }),
    ),
  },
  {
    additionalProperties: false,
    title: "Configra selections",
    description: "Saved Configra selections in .configra/config.json.",
  },
);

export type SavedConfig = Static<typeof configSchema>;

const fileEntry = Type.Object(
  { kind: Type.Literal("file"), hash: Type.String(), mode: Type.Optional(Type.Integer()) },
  { additionalProperties: false },
);

const entryFileEntry = Type.Object({ kind: Type.Literal("entry") }, { additionalProperties: false });

const linesEntry = Type.Object(
  { kind: Type.Literal("lines"), lines: Type.Array(Type.String()) },
  { additionalProperties: false },
);

const fieldsEntry = Type.Object(
  { kind: Type.Literal("fields"), fields: Type.Record(Type.String(), Type.Unknown()) },
  { additionalProperties: false },
);

export const stateSchema = Type.Object(
  {
    version: Type.Literal(1),
    configraVersion: Type.String(),
    files: Type.Record(Type.String(), Type.Union([fileEntry, entryFileEntry, linesEntry, fieldsEntry])),
  },
  {
    additionalProperties: false,
    title: "Configra ownership state",
    description: "Configra-owned ownership state in .configra/state.json.",
  },
);

export type OwnershipState = Static<typeof stateSchema>;

export type StateEntry = OwnershipState["files"][string];

/**
 * Validates parsed JSON against a schema and reports each problem as a diagnostic.
 */
export function validate(schema: TSchema, value: unknown, path: string, code: string): Diagnostic[] {
  if (Value.Check(schema, value)) {
    return [];
  }

  const errors = [...Value.Errors(schema, value)];
  const seen = new Set<string>();

  return errors
    .filter((error) => error.keyword !== "boolean" && error.keyword !== "anyOf")
    .map((error) => ({
      code,
      severity: "error" as const,
      path,
      message: `${error.instancePath || "/"}: ${error.message}`,
    }))
    .filter((diagnostic) => !seen.has(diagnostic.message) && seen.add(diagnostic.message) !== undefined);
}

/**
 * Parses and validates a versioned JSON document. Unsupported versions are reported before schema details.
 */
export function parseVersioned<T>(
  text: string,
  schema: TSchema,
  path: string,
  kind: "CONFIG" | "STATE",
): { value?: T; diagnostics: Diagnostic[] } {
  let value: unknown;

  try {
    value = JSON.parse(text);
  } catch (error) {
    return {
      diagnostics: [
        {
          code: `${kind}_PARSE_ERROR`,
          severity: "error",
          path,
          message: `${path} isn't valid JSON: ${(error as Error).message}`,
        },
      ],
    };
  }

  const version = (value as { version?: unknown } | null)?.version;

  if (version !== 1) {
    return {
      diagnostics: [
        {
          code: `${kind}_UNSUPPORTED_VERSION`,
          severity: "error",
          path,
          message: `${path} has schema version ${JSON.stringify(version)}. This Configra release reads version 1.`,
        },
      ],
    };
  }

  const diagnostics = validate(schema, value, path, `${kind}_INVALID`);

  return diagnostics.length > 0 ? { diagnostics } : { value: value as T, diagnostics };
}

const diagnosticSchema = Type.Object(
  {
    code: Type.String({ description: "A stable diagnostic code, such as SELECTION_UNKNOWN_ID." }),
    severity: literals(["error", "warning", "info"]),
    message: Type.String(),
    path: Type.Optional(Type.String({ description: "A project-relative path, when the diagnostic concerns one." })),
  },
  { additionalProperties: false },
);

const changeSchema = Type.Object(
  {
    path: Type.String(),
    action: literals(["create", "update", "delete"]),
    ownership: literals(["file", "entry", "lines", "fields", "selections", "state"]),
    reason: Type.String(),
    details: Type.Array(
      Type.Object(
        {
          kind: literals(["add-line", "remove-line", "set-field", "remove-field"]),
          target: Type.String({ description: "The line, or a JSON Pointer to the field." }),
          value: Type.Optional(Type.Unknown()),
          previous: Type.Optional(Type.Unknown()),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

const conflictSchema = Type.Object(
  {
    id: Type.String({ description: "A stable conflict ID: a path, or a path and JSON Pointer or line after #." }),
    path: Type.String(),
    kind: literals(["unowned-content", "edited-owned", "deleted-owned", "competing-config"]),
    message: Type.String(),
    options: Type.Array(literals(["retain", "replace"])),
    decision: Type.Optional(literals(["retain", "replace"])),
  },
  { additionalProperties: false },
);

const commandSchema = Type.Object(
  {
    phase: literals(["install", "activate-hooks"]),
    executable: Type.String(),
    args: Type.Array(Type.String()),
    cwd: Type.String({ description: "The working directory, relative to the project root." }),
    approved: Type.Boolean(),
  },
  { additionalProperties: false },
);

const prerequisiteSchema = Type.Object(
  {
    name: literals(["node", "npm", "git", "php", "composer", "lefthook"]),
    required: Type.String(),
    found: Type.Union([Type.String(), Type.Null()]),
    status: literals(["ok", "missing", "unsupported"]),
    neededFor: Type.Array(Type.String()),
  },
  { additionalProperties: false },
);

const { $schema: _schemaProperty, ...selectionProperties } = configSchema.properties;

export const outputSchema = Type.Object(
  {
    version: Type.Literal(1, { description: "The output schema version." }),
    configra: Type.String({ description: "The Configra version that produced the document." }),
    command: Type.Union([literals(["init", "update"]), Type.Null()]),
    status: literals(["ok", "changes", "conflicts", "error"]),
    exitCode: Type.Integer(),
    dryRun: Type.Boolean(),
    selections: Type.Optional(Type.Object(selectionProperties, { additionalProperties: false })),
    changes: Type.Array(changeSchema),
    conflicts: Type.Array(conflictSchema),
    dependencies: Type.Object({
      npm: Type.Object({ add: Type.Record(Type.String(), Type.String()), remove: Type.Array(Type.String()) }),
    }),
    scripts: Type.Array(
      Type.Object(
        { name: Type.String(), command: Type.String(), writes: Type.Boolean() },
        { additionalProperties: false },
      ),
    ),
    hooks: Type.Array(
      Type.Object({ hook: Type.String(), name: Type.String(), run: Type.String() }, { additionalProperties: false }),
    ),
    commands: Type.Array(commandSchema),
    phases: Type.Optional(
      Type.Array(
        Type.Object(
          {
            phase: literals(["apply", "install", "activate-hooks"]),
            status: literals(["done", "skipped", "failed"]),
            message: Type.Optional(Type.String()),
          },
          { additionalProperties: false },
        ),
      ),
    ),
    discovery: Type.Optional(
      Type.Object(
        {
          wordpress: Type.Object({
            kind: literals(["site", "wp-content", "ambiguous", "none"]),
            candidates: Type.Array(Type.String()),
          }),
          languages: Type.Array(literals(languageIds)),
          ui: Type.Array(literals(uiIds)),
          packageManagers: Type.Array(Type.String()),
          prerequisites: Type.Array(prerequisiteSchema),
        },
        { additionalProperties: false },
      ),
    ),
    diagnostics: Type.Array(diagnosticSchema),
  },
  {
    additionalProperties: false,
    title: "Configra result",
    description: "The versioned JSON document Configra prints with --json.",
  },
);
