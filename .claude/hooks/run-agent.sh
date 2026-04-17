#!/bin/bash
# run-agent.sh

while true; do
  claude --dangerously-skip-permissions
  EXIT_CODE=$?

  if [ $EXIT_CODE -eq 2 ]; then
    echo "⏸  Rate limit hit — waiting 180 min..."
    sleep 10800
    echo "▶  Restarting..."
  else
    break
  fi
done