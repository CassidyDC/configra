/**
 * Vitest Configuration
 * @file Test projects for offline unit and integration tests and the packed smoke test.
 *
 * @see https://vitest.dev/config/
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "offline",
          include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
          testTimeout: 30_000,
        },
      },
      {
        test: {
          name: "smoke",
          include: ["tests/smoke/**/*.test.ts"],
          testTimeout: 300_000,
          hookTimeout: 300_000,
        },
      },
    ],
  },
});
