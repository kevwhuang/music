---
description: Enforce JS and TS conventions
name: audit-js
user-invocable: true
---

- Audit `.js`, `.ts`, `.tsx` files, frontmatter, and `<script>` blocks in `.astro` files
- Skip paths in `.gitignore`

## Protocol

- Report issues in a table with columns: ID, File, Lines, Issue
- No editorializing
- Fix only with user approval

## Ordering

Sort all identifiers lexicographically at all levels: declarations, object properties, interface properties, type properties, destructured bindings, and nested properties.

Reorder top-level declarations in this sequence:

1. Imports
2. Types and interfaces
3. Constants
4. Variables
5. Helpers
6. Main logic
7. Exports

- Imports in three groups separated by blank lines: external, internal, types. Within each group, side-effect imports first, then default, then named. Each group sorted lexicographically.
- Types before interfaces
- Constants are static values known at definition time
- Inline named exports at declaration
- Single-use types and functions stay local. Multi-use types in `env.d.ts`, multi-use functions in `lib/`.

## Tests

- Order test cases by rendering order, not alphabetically

## Style

- Delete `console.log` and `debugger`
- Delete comments
- `async`/`await` over `.then()` chains
- Descriptive names, flag ambiguous or abbreviated identifiers
- `const` over `let` when never reassigned
- `function` declarations over arrows unless inline callbacks
- Functional components only, class components only for error boundaries
- Braces and multiple lines for `for` and `while` loops
- Ternaries only if they fit on one line
- 4-space indentation
- Indent `<script>` content in `.astro` files
- Blank lines around block elements: functions, if/else, for/while, try/catch, classes
- Blank lines between logical groups, not between consecutive declarations
- Single-line guards may stay grouped, multi-line if blocks need surrounding blank lines

## Safety

- Type narrowing must carry into closures
- Empty `catch` blocks must log or re-throw
- Never mutate parameters
- Strict equality only: `===` and `!==`
- Extract magic numbers to named constants
- Numeric separators for 4+ digits

## Astro

- One `<script>` block per `.astro` file

## Scope

- Reorder, rename, and reformat only
