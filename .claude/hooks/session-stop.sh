#!/bin/bash
# session-stop.sh — runs before session closes
# Writes a timestamp + git status snapshot to MEMORY.md automatically

MEMORY_FILE="MEMORY.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M %Z')

# Get last few commits as context
RECENT_COMMITS=$(git log --oneline -5 2>/dev/null || echo "no git history")

# Get any uncommitted changes
DIRTY=$(git status --short 2>/dev/null | head -20)

# Append checkpoint to MEMORY.md
cat >> "$MEMORY_FILE" << EOF

---
## Session Checkpoint — $TIMESTAMP

### Recent Commits
\`\`\`
$RECENT_COMMITS
\`\`\`

### Uncommitted Changes at Close
\`\`\`
${DIRTY:-"none"}
\`\`\`
EOF

echo "✅ Session checkpoint written to MEMORY.md"