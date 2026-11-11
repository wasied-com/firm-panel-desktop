#!/usr/bin/env bash
# System libraries of the Linux webview, for the CI.
# 2026-11-11: `apt-get update` hung 4 min per attempt on the hosted runners (three attempts in a row). Only the Ubuntu
# archive is needed: the third-party lists of the runner image are dropped, the Azure mirror is replaced by the main
# archive, and every attempt is bounded and talks (no -qq: the log shows which source holds).
set -euo pipefail
packages=(build-essential file libwebkit2gtk-4.1-dev libxdo-dev libssl-dev librsvg2-dev patchelf)
options=(-o Acquire::Retries=3 -o Acquire::http::Timeout=20 -o Acquire::https::Timeout=20 -o DPkg::Lock::Timeout=120)
sudo find /etc/apt/sources.list.d -type f ! -name 'ubuntu.sources' -print -delete
# The image points apt at a mirror list (mirror+file:/etc/apt/apt-mirrors.txt) that names only the Azure mirror:
# that list now names the main archive first, and the Azure mirror last.
if [ -f /etc/apt/apt-mirrors.txt ]; then
  printf 'http://archive.ubuntu.com/ubuntu/\tpriority:1\nhttp://azure.archive.ubuntu.com/ubuntu/\tpriority:2\n' | sudo tee /etc/apt/apt-mirrors.txt >/dev/null
fi
for file in /etc/apt/sources.list /etc/apt/sources.list.d/ubuntu.sources; do
  [ -f "$file" ] && sudo sed -i 's#https\?://azure\.archive\.ubuntu\.com#http://archive.ubuntu.com#g' "$file"
done
for attempt in 1 2 3; do
  if timeout 180 sudo apt-get "${options[@]}" update && \
     timeout 300 sudo DEBIAN_FRONTEND=noninteractive apt-get "${options[@]}" install -y --no-install-recommends "${packages[@]}"; then
    exit 0
  fi
  echo "apt attempt ${attempt} failed, trying again" >&2
  sleep $((attempt * 10))
done
exit 1
