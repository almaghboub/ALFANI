#!/bin/bash
TOKEN="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"
echo "Pushing to GitHub..."
git push https://$TOKEN@github.com/almaghboub/ALFANI.git main 2>&1
if [ $? -eq 0 ]; then
  echo ""
  echo "SUCCESS! Code pushed to GitHub."
  echo "Render will now auto-deploy in ~2 minutes."
else
  echo ""
  echo "FAILED. Token may have expired - paste a new one in push-to-github.sh"
fi
