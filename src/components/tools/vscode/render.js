export default function render(project) {
  const recommendations = ["editorconfig.editorconfig"];
  if (project.tools.includes("eslint")) recommendations.push("dbaeumer.vscode-eslint");
  if (project.tools.includes("prettier")) recommendations.push("esbenp.prettier-vscode");
  if (project.tools.includes("stylelint")) recommendations.push("stylelint.vscode-stylelint");
  if (project.languages.includes("php")) recommendations.push("bmewburn.vscode-intelephense-client");
  if (project.languages.includes("python")) recommendations.push("ms-python.python");
  return {
    jsonFiles: {
      ".vscode/extensions.json": { recommendations },
      ".vscode/settings.json": {
        "editor.insertSpaces": project.formatting.indentStyle === "space",
        "editor.tabSize": project.formatting.indentSize,
        ...Object.fromEntries(
          project.languages.map((language) => [
            `[${language}]`,
            {
              "editor.insertSpaces": project.languageFormatting[language].indentStyle === "space",
              "editor.tabSize": project.languageFormatting[language].indentSize,
            },
          ]),
        ),
      },
    },
  };
}
