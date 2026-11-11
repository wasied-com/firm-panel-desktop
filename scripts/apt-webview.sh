#!/usr/bin/env bash
# System libraries of the Linux webview, for the CI.
# 2026-11-11: from the hosted runners, every plain-HTTP Ubuntu mirror timed out (azure.archive.ubuntu.com, then
# archive.ubuntu.com, 3 attempts each). apt now goes through HTTPS mirrors only; a probe prints what answers, so a
# failure says which way out is closed.
set -euo pipefail
packages=(build-essential file libwebkit2gtk-4.1-dev libxdo-dev libssl-dev librsvg2-dev patchelf)
options=(-o Acquire::Retries=3 -o Acquire::http::Timeout=20 -o Acquire::https::Timeout=20 -o DPkg::Lock::Timeout=120)
mirrors=(https://mirrors.edge.kernel.org/ubuntu/ https://mirror.pnl.gov/ubuntu/ https://archive.ubuntu.com/ubuntu/)

for url in http://archive.ubuntu.com/ubuntu/ "${mirrors[@]}"; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$url" || true)
  echo "probe ${url} -> ${code}"
done

sudo find /etc/apt/sources.list.d -type f ! -name 'ubuntu.sources' -print -delete
printf '%s\n' "${mirrors[@]}" | sudo tee /etc/apt/apt-mirrors.txt >/dev/null
if [ -f /etc/apt/sources.list.d/ubuntu.sources ]; then
  sudo sed -i -E 's#^URIs: .*#URIs: mirror+file:/etc/apt/apt-mirrors.txt#' /etc/apt/sources.list.d/ubuntu.sources
  grep '^URIs' /etc/apt/sources.list.d/ubuntu.sources
fi
for attempt in 1 2 3; do
  if timeout 180 sudo apt-get "${options[@]}" update && \
     timeout 300 sudo DEBIAN_FRONTEND=noninteractive apt-get "${options[@]}" install -y --no-install-recommends "${packages[@]}"; then
    exit 0
  fi
  echo "apt attempt ${attempt} failed, trying again" >&2
  sleep $((attempt * 10))
done
exit 1
