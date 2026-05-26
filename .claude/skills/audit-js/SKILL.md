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

Sort in three groups separated by blank lines, each sorted by imported identifier:

1. External
2. Internal
3. Types

- Within each group: side-effect first, then default, then named

## Ordering

Sort identifiers lexicographically at all levels, except ordered sequences (signal chains, pipelines) which stay in logical order. `async` does not affect sort order. Apply the same ordering rules inside nested constructions (handlers, closures, callbacks). Reorder top-level declarations in this sequence:

1. Imports
2. Types and interfaces
3. Constants (static values known at definition time)
4. Variables
5. Functions
6. Components
7. Main logic (execution and side effects)
8. Exports (inline named at declaration)

## Style

- `const` for all non-reassigned variables
- `function` declarations over arrows unless inline callbacks
- Minimize closures, prefer module-level functions
- Extract multi-statement inline handlers to named functions in the component
- `async`/`await` over `.then()` chains
- Functional components only, class components only for error boundaries
- Concise but unabbreviated names that describe exactly what the identifier holds or does
- Braces and multiple lines for `for` and `while` loops
- Ternaries only if they fit on one line
- 4-space indentation
- Blank lines around block elements, return statements, and between logical groups
- Blank lines around multiline blocks including constants and nested objects
- Group independent declarations together (alphabetizable), separate with a blank line when one depends on another
- Declarations and guards are always separate groups, even when the guard checks the preceding declaration
- Single-line guards may stay grouped with other guards
- Multiple single-line return statements stay grouped with no blank lines between them
- Alphabetize values inside `||` guard conditions
- Inline `if`/`else` when both branches are single statements that fit on one line
- Split function signatures to multiple lines when they exceed ~80 characters
- Inline styles only for runtime-computed values; static values use Tailwind or CSS
- Multi-line blocks need surrounding blank lines
- Extract magic numbers to named constants
- Numeric separators for 4+ digits
- Delete `console.log`
- Delete comments
- Encode non-standard characters: HTML entities in JSX text, Unicode escapes in JS strings
- Deduplicate repeated logic into utility functions

## Safety

- Strict equality only
- Never mutate React state or props directly
- Cleanup listeners, timers, and subscriptions in `useEffect`

## Types

- Avoid explicit `any` and `!` non-null assertions
- Return type annotations only on exported functions, hooks, and tuples where inference would widen
- Delete unreachable branches, unused constants, and dead code
- Type narrowing must carry into closures
- Types before interfaces
- Derive types from existing types, don't duplicate shapes
- Alphabetize union type members
- Colocate single-use types, shared types in `env.d.ts`
- Consistent typing throughout, respect tsconfig

## React

- Event handlers must stay within the responsible component
- Component ordering: variables (hooks), derived values, functions, effects, return
- Name event handlers `handle{EventName}` to match the DOM event they respond to
- Cleanup side effects on unmount

## Astro

- One `<script>` block per `.astro` file
