<!--
Generated Configuration Samples

Registry-driven examples produced by scripts/generate-samples.js.
-->

# Configuration samples

Regenerate this directory from the repository root:

```sh
npm run samples:generate
```

This catalog contains 34 setups generated through the same resolution,
planning, and application code as the CLI. Each setup includes the generated
configuration, dependency declarations, selections, and ownership state.

Coverage includes every registered project's default setup, each alternative
standard for its default languages, each compatible capability individually,
combined capabilities, and each compatible tool absent from its defaults.
The nested and workspace examples each contain a child for every project.
This is a compact catalog; arbitrary language overrides, formatting values,
tool subsets, and every combination of choices are not enumerated.

Generation does not install dependencies or hooks. Minimal package manifests
are seeded to give samples stable names and register the workspace example.
A temporary Git boundary enables Lefthook output; no `.git` markers are kept.
Each setup represents its own repository. To try updates, copy it outside
this repository and initialize Git there so its hooks have the same boundary.
The samples are excluded from the repository's own lint and formatting checks
so their generated formatting and ownership hashes remain intact.

The entire directory is replaced on regeneration, including obsolete setups.
Make changes to components or the generation script instead of editing samples.
New components must be registered in `src/components/registry.js`; their
language must be present in a project's default languages to appear here.

## Setups

| Directory | Setup |
| --- | --- |
| [node/default](node/default/) | Project defaults |
| [node/standards/javascript-wordpress](node/standards/javascript-wordpress/) | javascript uses wordpress; other languages keep their defaults |
| [node/capabilities/react](node/capabilities/react/) | react capability with default tools |
| [node/capabilities/typescript](node/capabilities/typescript/) | typescript capability with default tools |
| [node/capabilities/all](node/capabilities/all/) | Combined capabilities: react, typescript |
| [node/tools/webpack](node/tools/webpack/) | webpack added to default tools with all compatible capabilities |
| [php/default](php/default/) | Project defaults |
| [php/standards/php-wordpress](php/standards/php-wordpress/) | php uses wordpress; other languages keep their defaults |
| [wordpress-plugin/default](wordpress-plugin/default/) | Project defaults |
| [wordpress-plugin/standards/javascript-community](wordpress-plugin/standards/javascript-community/) | javascript uses community; other languages keep their defaults |
| [wordpress-plugin/standards/css-community](wordpress-plugin/standards/css-community/) | css uses community; other languages keep their defaults |
| [wordpress-plugin/standards/php-community](wordpress-plugin/standards/php-community/) | php uses community; other languages keep their defaults |
| [wordpress-plugin/capabilities/react](wordpress-plugin/capabilities/react/) | react capability with default tools |
| [wordpress-plugin/capabilities/typescript](wordpress-plugin/capabilities/typescript/) | typescript capability with default tools |
| [wordpress-plugin/capabilities/all](wordpress-plugin/capabilities/all/) | Combined capabilities: react, typescript |
| [wordpress-plugin/tools/webpack](wordpress-plugin/tools/webpack/) | webpack added to default tools with all compatible capabilities |
| [wordpress-site/default](wordpress-site/default/) | Project defaults |
| [wordpress-site/standards/javascript-community](wordpress-site/standards/javascript-community/) | javascript uses community; other languages keep their defaults |
| [wordpress-site/standards/css-community](wordpress-site/standards/css-community/) | css uses community; other languages keep their defaults |
| [wordpress-site/standards/php-community](wordpress-site/standards/php-community/) | php uses community; other languages keep their defaults |
| [wordpress-site/capabilities/react](wordpress-site/capabilities/react/) | react capability with default tools |
| [wordpress-site/capabilities/typescript](wordpress-site/capabilities/typescript/) | typescript capability with default tools |
| [wordpress-site/capabilities/all](wordpress-site/capabilities/all/) | Combined capabilities: react, typescript |
| [wordpress-site/tools/webpack](wordpress-site/tools/webpack/) | webpack added to default tools with all compatible capabilities |
| [wordpress-theme/default](wordpress-theme/default/) | Project defaults |
| [wordpress-theme/standards/javascript-community](wordpress-theme/standards/javascript-community/) | javascript uses community; other languages keep their defaults |
| [wordpress-theme/standards/css-community](wordpress-theme/standards/css-community/) | css uses community; other languages keep their defaults |
| [wordpress-theme/standards/php-community](wordpress-theme/standards/php-community/) | php uses community; other languages keep their defaults |
| [wordpress-theme/capabilities/react](wordpress-theme/capabilities/react/) | react capability with default tools |
| [wordpress-theme/capabilities/typescript](wordpress-theme/capabilities/typescript/) | typescript capability with default tools |
| [wordpress-theme/capabilities/all](wordpress-theme/capabilities/all/) | Combined capabilities: react, typescript |
| [wordpress-theme/tools/webpack](wordpress-theme/tools/webpack/) | webpack added to default tools with all compatible capabilities |
| [layouts/nested](layouts/nested/) | nested layout with one child for every registered project |
| [layouts/workspaces](layouts/workspaces/) | workspaces layout with one child for every registered project |
