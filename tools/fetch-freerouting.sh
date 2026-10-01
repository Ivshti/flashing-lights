#!/usr/bin/env bash
# Download the Freerouting autorouter (needs Java 25+) into tools/bin/.
set -euo pipefail
V=2.4.1
cd "$(dirname "$0")"
mkdir -p bin
URL=https://repo1.maven.org/maven2/app/freerouting/freerouting/$V/freerouting-$V-executable.jar
curl -fsSL -o bin/freerouting.jar "$URL"
echo "$(curl -fsSL "$URL.sha1")  bin/freerouting.jar" | sha1sum -c -
