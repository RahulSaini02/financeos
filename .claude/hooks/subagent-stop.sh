#!/bin/bash
# SubagentStop hook — runs after every subagent completes
# Prints a suggested next action to the Claude transcript

TODO_FILE="TODO.md"
BUGS_FILE="BUGS.md"

# Count open bugs
CRITICAL=$(grep -c "🔴 Critical" "$BUGS_FILE" 2>/dev/null || echo 0)
OPEN_BUGS=$(grep -c "⬜ Open" "$BUGS_FILE" 2>/dev/null || echo 0)

# Count pending tasks
PENDING=$(grep -c "^| ⬜" "$TODO_FILE" 2>/dev/null || echo 0)

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Subagent completed."
echo "  Pending tasks: $PENDING"
echo "  Open bugs: $OPEN_BUGS (Critical: $CRITICAL)"
echo ""

if [ "$CRITICAL" -gt 0 ]; then
  echo "⚠️  There are $CRITICAL critical bugs. Fix these before continuing."
  echo "   Next: Use the backend-agent or frontend-agent to fix critical bugs in BUGS.md"
elif [ "$PENDING" -gt 0 ]; then
  echo "Next: Pick up the next ⬜ Pending task from TODO.md"
else
  echo "✅ All tasks complete! Run the qa-agent for a final validation pass."
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
