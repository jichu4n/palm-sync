#!/bin/bash

WORKSPACES=(pdb)
SOURCE_DIR="$PWD"
OUTPUT_DOCS_DIR="$SOURCE_DIR/docs"

cd "$SOURCE_DIR"
npm run --workspaces build:docs

if [ -d "$OUTPUT_DOCS_DIR" ]; then
  rm -r "$OUTPUT_DOCS_DIR"
fi
mkdir -p "$OUTPUT_DOCS_DIR"

for workspace in "${WORKSPACES[@]}"; do
  if [ -d "./$workspace/docs" ]; then
	  mv "./$workspace/docs" "$OUTPUT_DOCS_DIR/$workspace"
	fi
done
