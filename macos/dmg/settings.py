# Layout of the macOS disk image, read by dmgbuild (https://dmgbuild.readthedocs.io).
#
# dmgbuild writes the .DS_Store of the window itself: no Finder, no AppleScript, so the layout is the same on a CI
# runner as on a Mac (the script bundled with Tauri skips its Finder step whenever CI=true, which left the window raw).
#
# Usage, from the root of the repository:
#   dmgbuild -s macos/dmg/settings.py -D app="<path>/Panel du cabinet.app" "Panel du cabinet" "<out>.dmg"
# Optional: -D dir=<folder of this file> when run from elsewhere, -D volume_icon=<.icns>.
# The window size and the icon centres come from layout.json, shared with draw-background.py and verify.py.
import json
import os.path

# `defines` is given by dmgbuild (the -D options).
application = defines["app"]  # noqa: F821
here = defines.get("dir", "macos/dmg")  # noqa: F821
app_name = os.path.basename(application)
with open(os.path.join(here, "layout.json"), encoding="utf-8") as f:
    layout = json.load(f)

format = "UDZO"
filesystem = "HFS+"
files = [application]
symlinks = {"Applications": "/Applications"}
# No hide_extensions: SetFile would put Finder information on the bundle, which `codesign --strict` rejects as
# detritus. The Finder hides ".app" by default anyway.

# The volume shows the icon of the application, in the Finder sidebar and on the desktop.
icon = defines.get("volume_icon", "src-tauri/icons/icon.icns")  # noqa: F821
# background.png and background@2x.png, combined by dmgbuild into one HiDPI .background.tiff (hidden on the volume).
background = os.path.join(here, "background.png")

# A plain window: no toolbar, no sidebar, no status or path bar, icons where the background expects them.
window_rect = ((200, 160), tuple(layout["window"]))
default_view = "icon-view"
show_status_bar = False
show_tab_view = False
show_toolbar = False
show_pathbar = False
show_sidebar = False
sidebar_width = 0
show_icon_preview = False
include_icon_view_settings = True
include_list_view_settings = False
arrange_by = None
grid_offset = (0, 0)
grid_spacing = 100
scroll_position = (0, 0)
label_pos = "bottom"
text_size = layout["text_size"]
icon_size = layout["icon_size"]
icon_locations = {
    app_name: tuple(layout["app"]),
    "Applications": tuple(layout["applications"]),
}
