#!/bin/sh
# Run this to rebuild the website into the "public" folder.
cd "$(dirname "$0")" && node build.mjs
