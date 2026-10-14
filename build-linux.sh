#!/bin/sh
# Run this to rebuild the website into the "public" folder.
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
	echo "Node.js is not installed. On CachyOS/Arch: sudo pacman -S nodejs"
	exit 1
fi
node build.mjs
