import type { LanguageId, ToolId } from "../../contracts.js";
import { emptyContribution } from "./shared.js";
import type { ToolDefinition } from "./types.js";

/**
 * Defines a tool whose renderer ships in a later milestone, so selections can name it and get a clear error.
 */
function pendingTool(id: ToolId, label: string, description: string, languages: LanguageId[]): ToolDefinition {
  return {
    id,
    label,
    description,
    languages,
    available: false,
    checks: () => [],
    render: () => emptyContribution(),
  };
}

export const stylelintTool = pendingTool("stylelint", "Stylelint", "Lints CSS.", ["css"]);

export const phpLintTool = pendingTool("php-lint", "php -l", "Checks PHP syntax with the native linter.", ["php"]);

export const phpcsTool = pendingTool("phpcs", "PHP_CodeSniffer", "Checks and fixes PHP coding standards.", ["php"]);

export const phpstanTool = pendingTool("phpstan", "PHPStan", "Analyses PHP code statically.", ["php"]);
