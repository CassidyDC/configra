#!/usr/bin/env node
import { run } from "../src/cli/index.js";

process.exitCode = await run();
