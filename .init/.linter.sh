#!/bin/bash
cd /home/kavia/workspace/code-generation/auto-subtitle-synchronizer-97028/subtitle_sync_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

