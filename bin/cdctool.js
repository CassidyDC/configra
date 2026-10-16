#!/usr/bin/env node

/**
 * CassidyDC Toolset CLI
 * @file Executable entry point for the CassidyDC Toolset CLI.
 * @module cdctool
 */

import { run } from "../src/cli/index.js";

/**
 * Start the CLI and expose its completion status to the invoking shell.
 */
process.exitCode = await run();
