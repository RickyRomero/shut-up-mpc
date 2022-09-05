#!/bin/sh

echo "Setting options to prevent cascading errors..."
set -eu

echo "Copying extension files..."
cd /usr/app
cp -R $GITHUB_WORKSPACE/* /mpc/extension/

echo "Preparing build directory..."
mkdir "/mpc/build/Shut Up"
cp -R /mpc/extension/* "/mpc/build/Shut Up/"
ls -la "/mpc/build/Shut Up/"

echo "Removing dotfiles..."
find "/mpc/build/Shut Up/" -name ".*" -exec rm -r {} \; -print

echo "Building extension..."
yarn build

echo "Submitting extension..."
yarn submit
