# Graphify Usage

Use Graphify as a repo-orientation tool only when the task requires project-level understanding.

Do not use Graphify as a default step.

## Use Graphify for

- unfamiliar repo exploration
- architecture review
- cross-file refactors
- dependency or call-chain tracing
- command/workflow/skill/plugin/package wiring
- large implementation planning
- locating relevant files for complex features

## Avoid Graphify for

- small single-file fixes
- known stack traces with clear file and line
- typo, formatting, or style-only changes
- simple tests
- small documentation edits
- localized bug fixes with an obvious target file

## Flow

1. Decide whether repo-level orientation is needed.
2. Check for `graphify-out/graph.json`.
3. If present, use scoped queries:
   - `graphify query "<specific question>"`
   - `graphify path "<source>" "<target>"`
   - `graphify explain "<concept>"`
4. Use results to identify relevant files.
5. Read the actual source files before planning or editing.
6. Do not read the full `GRAPH_REPORT.md` unless the task is broad or architectural.

## Regenerate

Run `/graphify .` only after meaningful structural changes, such as:

- moved or renamed modules
- added or removed many files
- changed entry points
- changed command/workflow/skill/plugin wiring
- large refactors
- stale or incorrect Graphify results

Do not regenerate for small edits, tests, typos, formatting, or minor docs changes.

## Ground truth

Graphify is a map. Source code is the authority.
