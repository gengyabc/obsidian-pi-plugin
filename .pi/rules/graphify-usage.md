# Graphify Usage

Prefer scoped Graphify queries instead of reading the full report.

Good cases:
- exploring an unfamiliar repo
- architecture review
- cross-file refactor
- dependency/call-chain tracing
- command, workflow, skill, plugin wiring analysis
- preparing a plan for a large implementation

Avoid Graphify for:
- small single-file fixes
- typo or formatting changes
- known stack traces where the file and line are already clear
- simple tests or localized edits

Recommended flow:
1. Check whether `graphify-out/graph.json` exists.
2. If it exists, use scoped queries such as:
   - `graphify query "<specific question>"`
   - `graphify path "<source>" "<target>"`
   - `graphify explain "<concept>"`
3. Read only the source files identified as relevant.
4. Do not read the entire `GRAPH_REPORT.md` unless the task is broad or architectural.
5. If the graph is stale after major structural changes, regenerate it with `/graphify .`.