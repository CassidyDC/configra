export default function render(project) {
  const entries = ["node_modules/", ".DS_Store"];
  if (project.languages.includes("php")) entries.push("vendor/", ".phpstan-cache/");
  if (project.languages.includes("python")) entries.push("__pycache__/", "*.py[cod]", ".venv/", ".pytest_cache/");
  if (project.tools.includes("webpack")) entries.push("dist/");
  return { lines: { ".gitignore": entries } };
}
