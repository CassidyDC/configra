#!/usr/bin/env node

/**
 * Configra CLI
 * @file Executable entry point for the Configra CLI.
 * @module configra
 */

import { run } from "../src/cli/index.js";

/**
 * Start the CLI and expose its completion status to the invoking shell.
 */
process.exitCode = await run();
