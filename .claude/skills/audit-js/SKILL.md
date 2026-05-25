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

## Imports

Sort in three groups separated by blank lines, each sorted lexicographically:

1. External
2. Internal
3. Types

- Within each group: side-effect first, then default, then named

## Ordering

Sort identifiers lexicographically at all levels and reorder top-level declarations in this sequence:

1. Imports
2. Types and interfaces
3. Constants (static values known at definition time)
4. Variables
5. Helpers (pure utilities)
6. Functions (components and hooks)
7. Main logic (execution and side effects)
8. Exports (inline named at declaration)

## Style

- `const` for all non-reassigned variables
- `function` declarations over arrows unless inline callbacks
- `async`/`await` over `.then()` chains
- Functional components only, class components only for error boundaries
- Descriptive names, flag ambiguous or abbreviated identifiers
- Braces and multiple lines for `for` and `while` loops
- Ternaries only if they fit on one line
- 4-space indentation
- Blank lines around block elements and between logical groups
- Single-line guards may stay grouped, multi-line blocks need surrounding blank lines
- Extract magic numbers to named constants
- Numeric separators for 4+ digits
- Delete `console.log`
- Delete comments

## Safety

- Strict equality only
- Never mutate React state or props directly
- Cleanup listeners, timers, and subscriptions in `useEffect`

## Types

- Avoid explicit `any` and `!` non-null assertions
- Type narrowing must carry into closures
- Types before interfaces
- Colocate single-use types, shared types in `env.d.ts`

## Astro

- One `<script>` block per `.astro` file
