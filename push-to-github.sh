#!/bin/bash
echo "Enter your GitHub Personal Access Token:"
read -s TOKEN
echo ""
GIT_TERMINAL_PROMPT=0 GIT_ASKPASS=/bin/true git -c credential.helper= push https://$TOKEN@github.com/almaghboub/ALFANI.git main 2>&1
if [ $? -eq 0 ]; then
  echo ""
  echo "SUCCESS! Code pushed to GitHub."
  echo "Render will auto-deploy in ~2 minutes: https://dashboard.render.com"
else
  echo ""
  echo "FAILED. Make sure your token has 'repo' permission."
fi
