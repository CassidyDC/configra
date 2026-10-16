#!/usr/bin/env node
import { run } from "../src/cli/index.js";

/**
 * Start the CLI and expose its completion status to the invoking shell.
 *
 * @module cdctool
 */
process.exitCode = await run();
