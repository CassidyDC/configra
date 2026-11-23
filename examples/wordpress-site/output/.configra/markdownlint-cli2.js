// Managed by Configra. Put your changes in .markdownlint-cli2.mjs.

/** @type {import("markdownlint-cli2").Options} */
export default {
  config: {
    default: true,
    // Prettier formats Markdown, so these overlapping style rules are off.
    "blanks-around-fences": false,
    "blanks-around-headings": false,
    "blanks-around-lists": false,
    "code-fence-style": false,
    "emphasis-style": false,
    "heading-start-left": false,
    "heading-style": false,
    "hr-style": false,
    "line-length": false,
    "list-indent": false,
    "list-marker-space": false,
    "no-blanks-blockquote": false,
    "no-hard-tabs": false,
    "no-missing-space-atx": false,
    "no-missing-space-closed-atx": false,
    "no-multiple-blanks": false,
    "no-multiple-space-atx": false,
    "no-multiple-space-blockquote": false,
    "no-multiple-space-closed-atx": false,
    "no-trailing-spaces": false,
    "ol-prefix": false,
    "strong-style": false,
    "ul-indent": false,
  },
  ignores: ["**/node_modules/**", "**/vendor/**", "**/build/**", "**/dist/**", "**/.configra/**", "**/.cache/**", "**/*.min.js", "**/*.min.css"],
  gitignore: true,
};
