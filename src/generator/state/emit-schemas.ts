/**
 * Renders the published JSON Schemas from the runtime schemas Configra validates against.
 */

import { configSchema, outputSchema } from "./schemas.js";

/**
 * Returns each published schema file name and its JSON text.
 */
export function publishedSchemas(version: string): Array<{ file: string; text: string }> {
  const config = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `https://unpkg.com/@cassidydc/configra@${version}/dist/schemas/config.v1.json`,
    ...configSchema,
  };

  const output = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `https://unpkg.com/@cassidydc/configra@${version}/dist/schemas/output.v1.json`,
    ...outputSchema,
  };

  return [
    { file: "config.v1.json", text: `${JSON.stringify(config, null, 2)}\n` },
    { file: "output.v1.json", text: `${JSON.stringify(output, null, 2)}\n` },
  ];
}
