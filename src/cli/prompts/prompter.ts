/**
 * The terminal prompts the wizard and approval flow use, behind an interface so tests can script answers.
 */

import * as clack from "@clack/prompts";

/**
 * Returned by a prompt when the user cancels it, such as with Escape or Ctrl+C.
 */
export const canceled: unique symbol = Symbol("canceled");

export type Canceled = typeof canceled;

/**
 * One choice in a select or multiselect prompt.
 */
export interface Choice<Value extends string> {
  value: Value;
  label: string;
  hint?: string;
  disabled?: boolean;
}

/**
 * The prompts Configra asks, each returning `canceled` when the user cancels.
 */
export interface Prompter {
  intro: (title: string) => void;
  outro: (message: string) => void;

  /** Shows a block of text, such as a preview, with an optional title. */
  note: (message: string, title?: string) => void;
  warn: (message: string) => void;
  select: <Value extends string>(options: {
    message: string;
    choices: Choice<Value>[];
    initial?: Value;
  }) => Promise<Value | Canceled>;
  multiselect: <Value extends string>(options: {
    message: string;
    choices: Choice<Value>[];
    initial: Value[];
    required?: boolean;
  }) => Promise<Value[] | Canceled>;
  confirm: (options: { message: string; initial?: boolean }) => Promise<boolean | Canceled>;
}

/**
 * Maps clack's cancel symbol to `canceled`.
 */
function settle<Value>(result: unknown): Value | Canceled {
  return clack.isCancel(result) ? canceled : (result as Value);
}

/**
 * Converts choices to clack options.
 */
function options<Value extends string>(choices: Choice<Value>[]): clack.SelectOptions<Value>["options"] {
  return choices.map((choice) => ({
    value: choice.value,
    label: choice.label,
    ...(choice.hint !== undefined ? { hint: choice.hint } : {}),
    ...(choice.disabled ? { disabled: true } : {}),
  })) as clack.SelectOptions<Value>["options"];
}

/**
 * Prompts in the terminal with `@clack/prompts`.
 */
export const terminalPrompter: Prompter = {
  intro: (title) => clack.intro(title),
  outro: (message) => clack.outro(message),
  note: (message, title) => clack.note(message, title),
  warn: (message) => clack.log.warn(message),
  select: async <Value extends string>({
    message,
    choices,
    initial,
  }: {
    message: string;
    choices: Choice<Value>[];
    initial?: Value;
  }) =>
    settle<Value>(
      await clack.select<Value>({
        message,
        options: options(choices),
        ...(initial !== undefined ? { initialValue: initial } : {}),
      }),
    ),
  multiselect: async <Value extends string>({
    message,
    choices,
    initial,
    required,
  }: {
    message: string;
    choices: Choice<Value>[];
    initial: Value[];
    required?: boolean;
  }) =>
    settle<Value[]>(
      await clack.multiselect<Value>({
        message,
        options: options(choices),
        initialValues: initial,
        required: required ?? false,
      }),
    ),
  confirm: async ({ message, initial }) =>
    settle<boolean>(await clack.confirm({ message, ...(initial !== undefined ? { initialValue: initial } : {}) })),
};
