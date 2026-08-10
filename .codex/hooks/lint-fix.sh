#!/bin/bash
# Post-edit hook: auto-fix lint issues on edited files
FILE_PATH=$(jq -r '.tool_input.file_path // .tool_input.filePath // empty' < /dev/stdin)

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Only lint TypeScript/JavaScript files
case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx)
    npx eslint --fix "$FILE_PATH" 2>/dev/null || true
    ;;
esac

exit 0
