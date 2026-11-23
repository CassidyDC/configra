/**
 * ESLint configuration.
 *
 * Configra manages .configra/eslint.mjs and loads it first. Add your own settings after it; later
 * entries override earlier ones.
 *
 * @see https://eslint.org/docs/latest/use/configure/configuration-files
 */

import { defineConfig } from "eslint/config";
import configra from "./.configra/eslint.mjs";

export default defineConfig([
  configra,
  // {
  //   rules: { "no-console": "warn" },
  // },
]);
