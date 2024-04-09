#!/bin/bash
#
# Smoke test for verifying the published package. It runs `npm pack` and
# verifies the output can be installed and imported.
#

TEST_SCRIPT=$(cat <<'EOF'

import assert from 'assert';
import fs from 'fs-extra';
import {createSyncServer} from 'palm-sync';

(async function() {
  for (const connectionString of [
    'net',
    'usb',
    'serial:net',
  ]) {
    const server = await createSyncServer(connectionString, async () => {});
    await server.start();
    await new Promise(resolve => setTimeout(resolve, 1000));
    await server.stop();
  }
})();

EOF
)

test_shell_script() {
  node_modules/.bin/palm-sync --help
  node_modules/.bin/palm-sync help pull
}


SOURCE_DIR="$PWD"
TEMP_DIR="$PWD/tmp-smoke-test"


cd "$SOURCE_DIR"
echo "> Building package"
npm pack || exit 1
echo

package_files=(*.tgz)
if [ ${#package_files[@]} -eq 1 ]; then
  package_file="$SOURCE_DIR/${package_files[0]}"
  echo "> Found package $package_file"
	echo
else
	echo "Could not identify package file"
	exit 1
fi

echo "> Installing package in temp directory $TEMP_DIR"
if [ -d "$TEMP_DIR" ]; then
  rm -rf "$TEMP_DIR"
fi
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"
npm init -y
npm install --save ts-node typescript '@types/node' "$package_file"
echo

echo "> Running test script"
echo "$TEST_SCRIPT"
if ./node_modules/.bin/ts-node -e "$TEST_SCRIPT"; then
  echo
	echo "> Success!"
	exit_code=0
else
  exit_code=$?
  echo
	echo "> Error - script returned status ${exit_code}"
fi
echo

if [ $exit_code -eq 0 ]; then
  echo "> Running test shell script"
  if test_shell_script; then
    echo
    echo "> Success!"
    exit_code=0
  else
    exit_code=$?
    echo
    echo "> Error - script returned status ${exit_code}"
  fi
  echo
fi

echo "> Cleaning up"
cd "$SOURCE_DIR"
rm -rf "$TEMP_DIR" "$package_file"

exit $exit_code
