<!--
CLI System Design Reference

Reference description of the original CLI system design.
-->

# Configra System Design

## How Configra works

Configra generates project configuration based on the arguments passed to it. For example, if you choose WordPress Standards, WordPress Site Script, the generated configuration will include all the linting, formatting, and scripting files for a WordPress site, following WordPress standard. You can choose WordPress Modernized Standards to have namespacing, no-yoda expressions, etc. You can also choose community standards and apply that to your WordPress site. It's very customizable.

## Scripts

- WordPress Site (wp-content)
- WordPress Standalone Plugin
- WordPress Standalone Theme

## Standards

- PHP
  - Community
  - WordPress

## Tools

- CSS
  - Prettier
  - Stylelint
- JavaScript
  - ESLint
  - Prettier
- Markdown
  - MarkdownLint
- PHP
  - PHPStan
- React
  - ??
- SCSS
  - Prettier
  - Stylelint
- TypeScript
  - ESLint
