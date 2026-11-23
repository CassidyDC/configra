import type { LanguageId, StandardId, UiId } from "../../contracts.js";

/**
 * A language's base file scope and the standards it supports.
 */
export interface LanguageDefinition {
  id: LanguageId;
  label: string;
  extensions: string[];

  /** Extra extensions a UI selection adds to this language's scope. */
  uiExtensions: Partial<Record<UiId, string[]>>;
  standards: Record<StandardId, string>;
}

export const languages: Record<LanguageId, LanguageDefinition> = {
  javascript: {
    id: "javascript",
    label: "JavaScript",
    extensions: ["js", "mjs", "cjs"],
    uiExtensions: { react: ["jsx"] },
    standards: {
      community: "@eslint/js recommended rules",
      wordpress: "@wordpress/eslint-plugin recommended rules",
    },
  },
  typescript: {
    id: "typescript",
    label: "TypeScript",
    extensions: ["ts", "mts", "cts"],
    uiExtensions: { react: ["tsx"] },
    standards: {
      community: "@eslint/js and typescript-eslint recommended rules",
      wordpress: "@wordpress/eslint-plugin recommended rules with TypeScript support",
    },
  },
  css: {
    id: "css",
    label: "CSS",
    extensions: ["css"],
    uiExtensions: {},
    standards: {
      community: "stylelint-config-standard",
      wordpress: "@wordpress/stylelint-config",
    },
  },
  php: {
    id: "php",
    label: "PHP",
    extensions: ["php"],
    uiExtensions: {},
    standards: {
      community: "PSR-12 through PHP_CodeSniffer",
      wordpress: "WordPress Coding Standards",
    },
  },
};
