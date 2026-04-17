#!/bin/bash
# PreCompact hook — runs before /compact
# Reminds the agent to snapshot current state to MEMORY.md first

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚡ Context compaction triggered."
echo ""
echo "Before compacting, write to MEMORY.md:"
echo "  - Current task in progress"
echo "  - Last file(s) edited"
echo "  - Any decisions made mid-task"
echo ""
echo "After compacting, re-read:"
echo "  1. MEMORY.md"
echo "  2. TODO.md"
echo "  3. BUGS.md"
echo "  ...then resume the in-progress task."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
