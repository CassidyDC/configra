/**
 * @file Webpack configuration generation with selected Babel presets and source extensions.
 */

import { readFileSync } from "node:fs";

/**
 * @typedef {import("../../../contracts.js").PackageContext} PackageContext
 * @typedef {import("../../../contracts.js").ToolContribution} ToolContribution
 */

/**
 * Render the packaged build template with selected Babel presets and entry extension.
 *
 * @param {PackageContext} project Resolved settings and package ownership.
 * @returns {ToolContribution} Proposed configuration and tool requirements.
 */
export default function render(project) {
  const npm = {
    webpack: "^5.0.0",
    "webpack-cli": "^6.0.0",
    "babel-loader": "^10.0.0",
    "@babel/core": "^7.0.0",
    "@babel/preset-env": "^7.0.0",
  };

  const presets = ["@babel/preset-env"];

  if (project.capabilities.includes("react")) {
    presets.push(["@babel/preset-react", { runtime: "automatic" }]);
    npm["@babel/preset-react"] = "^7.0.0";
  }

  if (project.capabilities.includes("typescript")) {
    presets.push("@babel/preset-typescript");
    npm["@babel/preset-typescript"] = "^7.0.0";
  }

  const extension = project.capabilities.includes("typescript")
    ? project.capabilities.includes("react")
      ? "tsx"
      : "ts"
    : project.capabilities.includes("react")
      ? "jsx"
      : "js";

  const template = readFileSync(new URL("./templates/webpack.config.mjs", import.meta.url), "utf8");

  return {
    files: {
      "webpack.config.mjs": template
        .replaceAll("__ENTRY__", `src/index.${extension}`)
        .replace("__PRESETS__", JSON.stringify(presets)),
    },
    npm,
    scripts: { build: "webpack --mode production" },
  };
}
