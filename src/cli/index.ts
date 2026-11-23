#!/usr/bin/env node

/**
 * Configra executable entry point.
 */

import { run } from "./main.js";

process.exitCode = await run(process.argv.slice(2));
