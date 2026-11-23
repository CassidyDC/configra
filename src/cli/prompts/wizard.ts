/**
 * The setup wizard: a step loop that collects selections, previews the plan, and returns an approved run.
 * Its answers become the same fields the selection flags fill, so prompts, flags, and saved selections
 * share one normalization and planning path.
 */

import { resolve } from "node:path";
import type {
  CommandName,
  CommitMessageMode,
  ConflictAction,
  DiscoveryReport,
  LanguageId,
  PresetId,
  StandardId,
  ToolId,
  UiId,
  WordPressPackageSettings,
} from "../../contracts.js";
import {
  commitMessageModes,
  languageIds,
  languages,
  presetIds,
  projects,
  sharedStandardGroups,
  standardIds,
  toolIds,
  tools,
  uiIds,
  uis,
} from "../../components/registry.js";
import { discover, wordpressCandidates } from "../../generator/discover.js";
import { defaultTools } from "../../generator/normalize.js";
import { readPackageHeaders, suggestPrefix, suggestTextDomain } from "../../generator/wordpress.js";
import { Snapshot } from "../../platform/filesystem.js";
import type { ParsedArgs } from "../args.js";
import { planWorkflow, type PlannedWorkflow, type WorkflowEnvironment } from "../commands/workflow.js";
import { renderText, type Style } from "../output.js";
import { approve, settleConflicts, unresolvedConflicts } from "./approval.js";
import { canceled, type Canceled, type Choice, type Prompter } from "./prompter.js";

/**
 * What the wizard writes: just the config, the config and the tooling files, or both plus an install.
 */
export type WizardOutcome = "save" | "generate" | "install";

export type WizardResult =
  | { kind: "canceled" }
  | { kind: "failed"; planned: PlannedWorkflow }
  | { kind: "approved"; planned: PlannedWorkflow; args: ParsedArgs; outcome: WizardOutcome };

export interface WizardContext {
  prompter: Prompter;
  command: CommandName;
  args: ParsedArgs;
  environment: WorkflowEnvironment;

  /** Writes preview text to stdout. */
  print: (text: string) => void;
  style: Style;
}

/**
 * What the wizard knows about the project: the discovery report, plus lookups it makes on demand.
 */
type Discovery = Omit<DiscoveryReport, "prerequisites"> & {
  /** Lists plugin and theme candidates under a content directory, such as `wp-content/`. */
  candidatesUnder: (base: string) => string[];

  /** Suggests a selected directory's text domain and prefix from its headers and name. */
  suggestNames: (path: string) => Required<WordPressPackageSettings>;
};

interface Answers {
  project: PresetId;
  packages: string[];
  languages: LanguageId[];
  ui: UiId[];
  standards: Partial<Record<LanguageId, StandardId>>;
  tools: ToolId[];
  commitMessages: CommitMessageMode;
  wordpress: Record<string, WordPressPackageSettings>;
}

type StepId =
  "project" | "packages" | "customize" | "languages" | "ui" | "standards" | "tools" | "names" | "commitMessages";

const stepLabels: Record<StepId, string> = {
  project: "Project preset",
  packages: "Plugin and theme directories",
  customize: "Defaults or custom selections",
  languages: "Languages",
  ui: "UI frameworks",
  standards: "Coding standards",
  tools: "Tools",
  names: "Text domains and prefixes",
  commitMessages: "Commit-message checks",
};

/**
 * Returns whether the WordPress PHP checks need a text domain and prefix for each selected directory.
 */
function needsNames(answers: Answers): boolean {
  return (
    projects[answers.project].usesPackages &&
    answers.packages.length > 0 &&
    answers.languages.includes("php") &&
    answers.standards.php === "wordpress" &&
    answers.tools.includes("phpcs")
  );
}

const commitMessageLabels: Record<CommitMessageMode, Choice<CommitMessageMode>> = {
  plain: { value: "plain", label: "Plain sentences", hint: "Add the login form" },
  conventional: { value: "conventional", label: "Conventional Commits", hint: "feat(auth): add the login form" },
  off: { value: "off", label: "Don't check commit messages" },
};

/**
 * Keeps the IDs in their registry order.
 */
function ordered<Id extends string>(order: readonly Id[], ids: Iterable<Id>): Id[] {
  const selected = new Set(ids);

  return order.filter((id) => selected.has(id));
}

/**
 * The tools a language selection offers: universal tools and those for a selected language.
 */
function offeredTools(selected: readonly LanguageId[]): ToolId[] {
  return toolIds.filter((id) => {
    const tool = tools[id];

    return tool.languages.length === 0 || tool.languages.some((language) => selected.includes(language));
  });
}

/**
 * The preset's defaults, with detected languages and UI added as suggestions.
 */
function presetDefaults(project: PresetId, discovery: Discovery): Answers {
  const preset = projects[project];
  const selectedLanguages = ordered(languageIds, [...preset.languages, ...discovery.languages]);

  return {
    project,
    packages: [],
    languages: selectedLanguages,
    ui: ordered(uiIds, [...preset.ui, ...discovery.ui]),
    standards: Object.fromEntries(selectedLanguages.map((language) => [language, preset.standard])),
    tools: defaultTools(selectedLanguages).filter((id) => tools[id].available),
    commitMessages: "plain",
    wordpress: {},
  };
}

/**
 * Reads the starting answers from a plan of the saved selections and flags, when one succeeded.
 */
function plannedAnswers(planned: PlannedWorkflow): Answers | undefined {
  const selections = planned.document.selections;

  if (!selections?.project) {
    return undefined;
  }

  return {
    project: selections.project,
    packages: selections.packages ?? [],
    languages: selections.languages ?? [],
    ui: selections.ui ?? [],
    standards: selections.standards ?? {},
    tools: selections.tools ?? [],
    commitMessages: selections.commitMessages ?? "plain",
    wordpress: selections.wordpress?.packages ?? {},
  };
}

/**
 * Returns the parsed arguments that select exactly the wizard's answers.
 */
function answersToArgs(args: ParsedArgs, answers: Answers): ParsedArgs {
  return {
    ...args,
    project: answers.project,
    packages: projects[answers.project].usesPackages ? answers.packages : [],
    languages: answers.languages,
    ui: answers.ui,
    standards: answers.languages.flatMap((language) => {
      const standard = answers.standards[language];

      return standard ? [`${language}=${standard}`] : [];
    }),
    tools: answers.tools,
    commitMessages: answers.commitMessages,
    hasSelectionFlags: true,
    dryRun: false,
    install: false,
    installHooks: false,
  };
}

/**
 * Groups the selected languages that share one standard question, such as JavaScript and TypeScript.
 */
function standardQuestions(selected: readonly LanguageId[]): LanguageId[][] {
  const questions: LanguageId[][] = [];
  const asked = new Set<LanguageId>();

  for (const language of selected) {
    if (asked.has(language)) {
      continue;
    }

    const group = sharedStandardGroups.find((members) => members.includes(language)) ?? [language];
    const members = group.filter((member) => selected.includes(member));

    members.forEach((member) => asked.add(member));
    questions.push(members);
  }

  return questions;
}

/**
 * Asks one wizard step and returns the updated answers.
 */
async function askStep(
  step: StepId,
  answers: Answers,
  discovery: Discovery,
  prompter: Prompter,
): Promise<Answers | Canceled> {
  switch (step) {
    case "project": {
      const suggested: PresetId = discovery.wordpress.kind === "none" ? "node" : "wordpress-site";

      const project = await prompter.select<PresetId>({
        message: "What kind of project is this?",
        choices: presetIds.map((id) => ({
          value: id,
          label: projects[id].label,
          hint: id === suggested && id !== "node" ? `detected, ${projects[id].description}` : projects[id].description,
        })),
        initial: answers.project,
      });

      if (project === canceled) {
        return canceled;
      }

      return project === answers.project
        ? answers
        : { ...presetDefaults(project, discovery), commitMessages: answers.commitMessages };
    }

    case "packages": {
      let found = discovery.wordpress.candidates;

      // Ask where the plugins and themes are when the layout is unclear.
      if (discovery.wordpress.kind === "ambiguous" || discovery.wordpress.kind === "none") {
        const base = await prompter.select<"wp-content/" | "root">({
          message: "Where are the site's plugins and themes?",
          choices: [
            { value: "wp-content/", label: "In wp-content/", hint: "a full WordPress site" },
            { value: "root", label: "At the root", hint: "a wp-content directory" },
          ],
          initial: discovery.wordpress.kind === "none" ? "root" : "wp-content/",
        });

        if (base === canceled) {
          return canceled;
        }

        found = discovery.candidatesUnder(base === "root" ? "" : base);
      }

      const candidates = [...new Set([...found, ...answers.packages])].sort();

      if (candidates.length === 0) {
        prompter.warn(
          "Configra found no plugin or theme directories. Only the root files are checked. Pass --package to select a directory it didn't find.",
        );

        return { ...answers, packages: [] };
      }

      const packages = await prompter.multiselect<string>({
        message: "Which plugin and theme directories should the checks cover?",
        choices: candidates.map((path) => ({ value: path, label: path })),
        initial: answers.packages,
      });

      return packages === canceled ? canceled : { ...answers, packages };
    }

    case "customize": {
      const summary = [
        answers.languages.map((id) => languages[id].label).join(", ") || "no languages",
        answers.ui.length > 0 ? answers.ui.map((id) => uis[id].label).join(", ") : undefined,
        `${answers.tools.length} tools`,
      ]
        .filter(Boolean)
        .join("; ");
      const choice = await prompter.select<"defaults" | "customize">({
        message: `Use the ${projects[answers.project].label} defaults?`,
        choices: [
          { value: "defaults", label: "Use the defaults", hint: summary },
          { value: "customize", label: "Customize", hint: "languages, UI, standards, tools, and commit messages" },
        ],
        initial: "defaults",
      });

      if (choice === canceled) {
        return canceled;
      }

      if (choice === "defaults") {
        return answers;
      }

      let current = answers;

      for (const next of ["languages", "ui", "standards", "tools", "names", "commitMessages"] as const) {
        const result = await askStep(next, current, discovery, prompter);

        if (result === canceled) {
          return canceled;
        }

        current = result;
      }

      return current;
    }

    case "languages": {
      const selected = await prompter.multiselect<LanguageId>({
        message: "Which languages should Configra check? Clear them all to keep only the universal tools.",
        choices: languageIds.map((id) => ({
          value: id,
          label: languages[id].label,
          ...(discovery.languages.includes(id) ? { hint: "detected" } : {}),
        })),
        initial: answers.languages,
      });

      if (selected === canceled) {
        return canceled;
      }

      const preset = projects[answers.project];
      const standards = Object.fromEntries(
        selected.map((language) => [language, answers.standards[language] ?? preset.standard]),
      );
      const sameLanguages = selected.join() === answers.languages.join();

      return {
        ...answers,
        languages: selected,
        standards,
        tools: sameLanguages ? answers.tools : defaultTools(selected).filter((id) => tools[id].available),
      };
    }

    case "ui": {
      const selected = await prompter.multiselect<UiId>({
        message: "Which UI frameworks does the project use?",
        choices: uiIds.map((id) => ({
          value: id,
          label: uis[id].label,
          ...(discovery.ui.includes(id) ? { hint: "detected" } : {}),
        })),
        initial: answers.ui,
      });

      return selected === canceled ? canceled : { ...answers, ui: selected };
    }

    case "standards": {
      const standards = { ...answers.standards };

      for (const group of standardQuestions(answers.languages)) {
        const first = group[0] as LanguageId;

        const standard = await prompter.select<StandardId>({
          message: `Which coding standard should ${group.map((id) => languages[id].label).join(" and ")} use?`,
          choices: standardIds.map((id) => ({
            value: id,
            label: id === "wordpress" ? "WordPress" : "Community",
            hint: languages[first].standards[id],
          })),
          initial: standards[first] ?? projects[answers.project].standard,
        });

        if (standard === canceled) {
          return canceled;
        }

        group.forEach((language) => (standards[language] = standard));
      }

      return { ...answers, standards };
    }

    case "tools": {
      const offered = offeredTools(answers.languages);

      const selected = await prompter.multiselect<ToolId>({
        message: "Which tools should Configra set up?",
        choices: offered.map((id) => ({
          value: id,
          label: tools[id].label,
          hint: tools[id].available ? tools[id].description : "arrives in a later Configra build",
          disabled: !tools[id].available,
        })),
        initial: answers.tools.filter((id) => offered.includes(id) && tools[id].available),
      });

      return selected === canceled ? canceled : { ...answers, tools: ordered(toolIds, selected) };
    }

    case "names": {
      if (!needsNames(answers)) {
        return answers;
      }

      const names = Object.fromEntries(
        answers.packages.map((path) => [path, { ...discovery.suggestNames(path), ...answers.wordpress[path] }]),
      ) as Record<string, Required<WordPressPackageSettings>>;

      prompter.note(
        answers.packages
          .map((path) => `${path}\n  text domain: ${names[path]?.textDomain}\n  prefix: ${names[path]?.prefix}`)
          .join("\n"),
        "WordPress text domains and prefixes",
      );

      const accepted = await prompter.confirm({
        message: "Use these text domains and prefixes for the WordPress checks?",
        initial: true,
      });

      if (accepted === canceled) {
        return canceled;
      }

      if (!accepted) {
        for (const path of answers.packages) {
          const current = names[path] as Required<WordPressPackageSettings>;

          const textDomain = await prompter.text({
            message: `Text domain for ${path}`,
            initial: current.textDomain,
            validate: (value) =>
              /^[a-z0-9_-]+$/.test(value) ? undefined : "Use lowercase letters, digits, hyphens, and underscores.",
          });

          if (textDomain === canceled) {
            return canceled;
          }

          const prefix = await prompter.text({
            message: `Prefix for global functions, classes, and hooks in ${path}`,
            initial: current.prefix,
            validate: (value) =>
              /^[A-Za-z_][A-Za-z0-9_\\]{2,}$/.test(value)
                ? undefined
                : "Use at least three letters, digits, underscores, or namespace separators, starting with a letter.",
          });

          if (prefix === canceled) {
            return canceled;
          }

          names[path] = { textDomain, prefix };
        }
      }

      return { ...answers, wordpress: names };
    }

    case "commitMessages": {
      const mode = await prompter.select<CommitMessageMode>({
        message: "How should the commit-msg hook check commit subjects?",
        choices: commitMessageModes.map((id) => commitMessageLabels[id]),
        initial: answers.commitMessages,
      });

      return mode === canceled ? canceled : { ...answers, commitMessages: mode };
    }
  }
}

/**
 * Asks which answer to change and asks that step again, along with the steps that depend on it.
 * With `canGoBack`, the menu also offers to return to the review with the answers unchanged.
 */
async function reviseAnswer(
  answers: Answers,
  discovery: Discovery,
  prompter: Prompter,
  message: string,
  canGoBack: boolean,
): Promise<Answers | Canceled> {
  const steps: StepId[] = [
    "project",
    ...(projects[answers.project].usesPackages ? (["packages"] as const) : []),
    "languages",
    "ui",
    ...(answers.languages.length > 0 ? (["standards"] as const) : []),
    "tools",
    ...(needsNames(answers) ? (["names"] as const) : []),
    "commitMessages",
  ];

  const step = await prompter.select<StepId | "back" | "cancel">({
    message,
    choices: [
      ...steps.map((id) => ({ value: id, label: stepLabels[id] })),
      ...(canGoBack ? [{ value: "back" as const, label: "Back to the review", hint: "keep these answers" }] : []),
      { value: "cancel" as const, label: "Cancel", hint: "leave the project untouched" },
    ],
  });

  if (step === canceled || step === "cancel") {
    return canceled;
  }

  if (step === "back") {
    return answers;
  }

  // A new preset resets the selections it provides, and new languages change the standards and tools.
  const dependents: Partial<Record<StepId, StepId[]>> = {
    project: ["packages", "customize", "names"],
    packages: ["names"],
    languages: ["standards", "tools", "names"],
    standards: ["names"],
    tools: ["names"],
  };

  let current = answers;

  for (const next of [step, ...(dependents[step] ?? [])]) {
    if (next === "packages" && !projects[current.project].usesPackages) {
      continue;
    }

    const result = await askStep(next, current, discovery, prompter);

    if (result === canceled) {
      return canceled;
    }

    current = result;
  }

  return current;
}

/**
 * Wizard wording for hook problems whose diagnostics point to flags.
 */
const hookProblemMessages: Record<string, string> = {
  HOOKS_NO_REPOSITORY: "The project isn't a Git repository yet. Run `git init`, then `npx lefthook install`.",
  HOOKS_LEFTHOOK_MISSING:
    "Lefthook isn't installed. Choose Generate and install, or run `npm install` and then `npx lefthook install`.",
};

/**
 * Returns why hook activation can't run for these arguments, or undefined when it can.
 */
function hookProblem(context: WizardContext, args: ParsedArgs): string | undefined {
  const probe = planWorkflow(context.command, { ...args, dryRun: true, installHooks: true }, context.environment);
  const problem = probe.document.diagnostics.find(
    (diagnostic) => diagnostic.code.startsWith("HOOKS_") || diagnostic.message.startsWith("Activating Git hooks"),
  );

  return problem ? (hookProblemMessages[problem.code] ?? problem.message) : undefined;
}

/**
 * Runs the setup wizard and returns an approved run, or why it stopped.
 */
export async function runWizard(context: WizardContext): Promise<WizardResult> {
  const { prompter, command, environment, style } = context;
  const root = resolve(environment.cwd, context.args.cwd ?? ".");
  const snapshot = new Snapshot(root);

  const discovery: Discovery = {
    ...discover(snapshot),
    candidatesUnder: (base) => wordpressCandidates(snapshot, base),
    suggestNames: (path) => ({
      textDomain: readPackageHeaders(snapshot, path).textDomain ?? suggestTextDomain(path),
      prefix: suggestPrefix(path),
    }),
  };

  const decisions: Record<string, ConflictAction> = {};
  const plan = (args: ParsedArgs) =>
    planWorkflow(command, args, { ...environment, decisions, wordpressPackages: answers.wordpress });

  // Plan the saved selections and flags first, so the wizard starts from them and reports invalid input.
  const first = planWorkflow(command, { ...context.args, dryRun: true }, environment);

  const fatal = first.document.diagnostics.find(
    (diagnostic) =>
      diagnostic.severity === "error" &&
      !diagnostic.code.startsWith("SELECTION_") &&
      diagnostic.code !== "INIT_WORDPRESS_DETECTED",
  );

  if (fatal) {
    return { kind: "failed", planned: first };
  }

  const fallback: PresetId =
    (context.args.project as PresetId | undefined) ?? (discovery.wordpress.kind === "none" ? "node" : "wordpress-site");
  let answers = plannedAnswers(first) ?? presetDefaults(presetIds.includes(fallback) ? fallback : "node", discovery);

  prompter.intro(command === "init" ? "Set up Configra" : "Change the Configra setup");

  for (const step of ["project", "packages", "customize", "names"] as const) {
    if (step === "packages" && !projects[answers.project].usesPackages) {
      continue;
    }

    const result = await askStep(step, answers, discovery, prompter);

    if (result === canceled) {
      return { kind: "canceled" };
    }

    answers = result;
  }

  for (;;) {
    const args = answersToArgs(context.args, answers);
    let planned = plan(args);

    if (planned.document.status === "error") {
      prompter.warn(
        planned.document.diagnostics
          .filter((diagnostic) => diagnostic.severity === "error")
          .map((diagnostic) => diagnostic.message)
          .join("\n"),
      );

      const revised = await reviseAnswer(
        answers,
        discovery,
        prompter,
        "Configra can't continue with these answers. Which answer do you want to change?",
        false,
      );

      if (revised === canceled) {
        return { kind: "canceled" };
      }

      answers = revised;

      continue;
    }

    prompter.note(`${JSON.stringify(planned.plan?.config, null, 2)}`, "Proposed .configra/config.json");
    context.print(renderText(planned.document, style, args.cwd ?? ".", "wizard"));

    const outcome = await prompter.select<WizardOutcome | "change" | "cancel">({
      message: "What should Configra do?",
      choices: [
        { value: "generate", label: "Generate files", hint: "save the config and write the tooling files" },
        { value: "install", label: "Generate and install", hint: "also install the declared dependencies" },
        { value: "save", label: "Save config only", hint: "write just .configra/config.json" },
        { value: "change", label: "Change an answer" },
        { value: "cancel", label: "Cancel", hint: "leave the project untouched" },
      ],
      initial: context.args.install ? "install" : "generate",
    });

    if (outcome === canceled || outcome === "cancel") {
      return { kind: "canceled" };
    }

    if (outcome === "change") {
      const revised = await reviseAnswer(answers, discovery, prompter, "Which answer do you want to change?", true);

      if (revised === canceled) {
        return { kind: "canceled" };
      }

      answers = revised;

      continue;
    }

    if (outcome === "save") {
      return { kind: "approved", planned, args, outcome };
    }

    const runArgs: ParsedArgs = { ...args, install: outcome === "install" };

    if (answers.tools.includes("lefthook")) {
      const problem = hookProblem(context, runArgs);

      if (problem === undefined) {
        const activate = await prompter.confirm({
          message: "Activate the Git hooks now with `npx lefthook install`?",
          initial: context.args.installHooks,
        });

        if (activate === canceled) {
          return { kind: "canceled" };
        }

        runArgs.installHooks = activate;
      } else {
        prompter.warn(`Configra will write the hook configuration without activating it. ${problem}`);
      }
    }

    planned = plan(runArgs);

    if (planned.document.status !== "error" && unresolvedConflicts(planned).length > 0) {
      const settled = await settleConflicts(prompter, planned, () => plan(runArgs), decisions);

      if (settled === canceled) {
        return { kind: "canceled" };
      }

      planned = settled;

      if (planned.document.status !== "error" && unresolvedConflicts(planned).length === 0) {
        context.print(renderText(planned.document, style, args.cwd ?? ".", "wizard"));

        if (!(await approve(prompter))) {
          return { kind: "canceled" };
        }
      }
    }

    if (planned.document.status === "error") {
      prompter.warn(
        planned.document.diagnostics
          .filter((diagnostic) => diagnostic.severity === "error")
          .map((diagnostic) => diagnostic.message)
          .join("\n"),
      );

      continue;
    }

    return { kind: "approved", planned, args: runArgs, outcome };
  }
}
