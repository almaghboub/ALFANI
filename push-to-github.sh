#!/bin/bash
echo "Enter your GitHub Personal Access Token:"
read -s TOKEN
echo ""
git push https://$TOKEN@github.com/almaghboub/ALFANI.git main
if [ $? -eq 0 ]; then
  echo ""
  echo "SUCCESS! Code pushed to GitHub."
  echo "Render will now auto-deploy. Check: https://dashboard.render.com"
else
  echo ""
  echo "FAILED. Make sure your token has 'repo' permission."
fi
