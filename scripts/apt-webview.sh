#!/usr/bin/env bash
# System libraries of the Linux webview, for the CI. A slow mirror once held this step 30 minutes:
# each attempt is bounded, and a failed attempt is tried again (3 attempts).
set -euo pipefail
packages=(build-essential file libwebkit2gtk-4.1-dev libxdo-dev libssl-dev librsvg2-dev patchelf)
options=(-o Acquire::Retries=3 -o Acquire::http::Timeout=30 -o Acquire::https::Timeout=30 -o DPkg::Lock::Timeout=120)
for attempt in 1 2 3; do
  if timeout 240 sudo apt-get "${options[@]}" update -qq && \
     timeout 300 sudo DEBIAN_FRONTEND=noninteractive apt-get "${options[@]}" install -y -qq --no-install-recommends "${packages[@]}"; then
    exit 0
  fi
  echo "apt attempt ${attempt} failed, trying again" >&2
  sleep $((attempt * 10))
done
exit 1
