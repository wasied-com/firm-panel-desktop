"""Checks the window of a mounted disk image against layout.json, by reading its .DS_Store (no Finder needed).

A disk image without this layout opens on a raw Finder window: icons anywhere, no arrow, no instruction. The release
fails rather than ship one.

Usage: python verify.py <mount point> <app name>   (needs the ds_store package that comes with dmgbuild)
"""
import json
import os
import sys
from pathlib import Path

from ds_store import DSStore

volume, app = Path(sys.argv[1]), sys.argv[2]
layout = json.loads((Path(__file__).resolve().parent / "layout.json").read_text())
problems = []


def expect(what, actual, wanted):
    if actual != wanted:
        problems.append(f"{what}: {actual!r}, expected {wanted!r}")


# What the volume holds: two visible items, the rest hidden (dot files are never shown by the Finder).
visible = sorted(name for name in os.listdir(volume) if not name.startswith("."))
expect("visible items", visible, sorted(["Applications", app]))
expect("Applications link", os.readlink(volume / "Applications"), "/Applications")
for hidden in (".DS_Store", ".background.tiff", ".VolumeIcon.icns"):
    if not (volume / hidden).is_file() or (volume / hidden).stat().st_size == 0:
        problems.append(f"{hidden} is missing or empty")

if not (volume / ".DS_Store").is_file():
    for problem in problems:
        print(f"FAIL {problem}")
    sys.exit(1)

with DSStore.open(str(volume / ".DS_Store"), "r") as store:
    window = store["."]["bwsp"]
    for key in ("ShowToolbar", "ShowSidebar", "ShowStatusBar", "ShowPathbar", "ShowTabView"):
        expect(f"window {key}", window.get(key), False)
    size = window["WindowBounds"].replace("{", "").replace("}", "").split(",")[2:]
    expect("window size", [int(float(v)) for v in size], layout["window"])
    view = store["."]["icvp"]
    expect("icon size", int(view["iconSize"]), layout["icon_size"])
    expect("text size", int(view["textSize"]), layout["text_size"])
    expect("background type (picture)", view["backgroundType"], 2)
    expect("arrangement", view["arrangeBy"], "none")
    expect(f"{app} position", list(store[app]["Iloc"]), layout["app"])
    expect("Applications position", list(store["Applications"]["Iloc"]), layout["applications"])

for problem in problems:
    print(f"FAIL {problem}")
print("ok   disk image layout" if not problems else f"{len(problems)} problem(s) in the disk image layout")
sys.exit(1 if problems else 0)
