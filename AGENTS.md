# Repository guidance

- Finish each task or feature by committing its completed changes.
- Match the existing commit message style and formatting; use a plain, sentence-case imperative subject without adding prefixes or changing the format.
- When relevant, document completed tasks or features in `CHANGELOG.md` and `README.md`.
- For all future updates, leave a blank line before every JSDoc block unless it starts on the first line of the file.
- For all future updates, leave a blank line after each completed code block or control-flow statement (such as an if statement, loop, or function) when another block, statement, or expression follows at the same level. Omit the blank line when only closing syntax follows, and keep `else`, `catch`, `finally`, and `do...while` continuations attached.
- For all future updates, leave a blank line after each standalone `let`, `const`, or `var` declaration when the next statement is not another variable declaration. Consecutive variable declarations may remain together. Do not add padding before closing syntax or within loop headers.
- For all future updates, add a blank line before and after any `const` declaration that spans more than three source lines, even when it is adjacent to another variable declaration.
