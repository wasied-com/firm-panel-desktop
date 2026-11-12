#!/usr/bin/env bash
# Signs a macOS application with the Developer ID certificate that Apple keeps in its cloud ("Cloud Managed Developer ID
# Application"), has it notarised and staples the ticket, in place. No private key of the certificate exists outside
# Apple: the signature is asked through the Xcode export of a hand-made archive, authenticated by the App Store Connect
# key of the team. The hardened runtime, required by the notary, is set first and kept by the export.
#
# Usage: scripts/mac-cloud-sign.sh <path to Some.app>
# Environment: APPLE_API_KEY_PATH (the .p8 file), APPLE_API_KEY (its id), APPLE_API_ISSUER, APPLE_TEAM_ID.
set -euo pipefail

app="${1:?usage: mac-cloud-sign.sh <path to Some.app>}"
: "${APPLE_API_KEY_PATH:?}" "${APPLE_API_KEY:?}" "${APPLE_API_ISSUER:?}" "${APPLE_TEAM_ID:?}"
[ -d "$app" ] || { echo "not an application: $app" >&2; exit 1; }

name="$(basename "$app" .app)"
plist="$app/Contents/Info.plist"
read_key() { /usr/libexec/PlistBuddy -c "Print :$1" "$plist"; }
bundle_id="$(read_key CFBundleIdentifier)"
short_version="$(read_key CFBundleShortVersionString)"
build_version="$(read_key CFBundleVersion)"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
archive="$work/$name.xcarchive"
mkdir -p "$archive/Products/Applications"
ditto "$app" "$archive/Products/Applications/$name.app"

# The export keeps the flags of the signature it replaces (--preserve-metadata=identifier,flags,runtime).
codesign --force --deep --sign - --options runtime --timestamp=none "$archive/Products/Applications/$name.app"

cat > "$archive/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>ApplicationProperties</key><dict>
    <key>ApplicationPath</key><string>Applications/$name.app</string>
    <key>CFBundleIdentifier</key><string>$bundle_id</string>
    <key>CFBundleShortVersionString</key><string>$short_version</string>
    <key>CFBundleVersion</key><string>$build_version</string>
    <key>SigningIdentity</key><string></string>
    <key>Team</key><string>$APPLE_TEAM_ID</string>
  </dict>
  <key>ArchiveVersion</key><integer>2</integer>
  <key>CreationDate</key><date>$(date -u +%Y-%m-%dT%H:%M:%SZ)</date>
  <key>Name</key><string>$name</string>
  <key>SchemeName</key><string>$name</string>
</dict></plist>
PLIST
cat > "$work/options.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>developer-id</string>
  <key>teamID</key><string>$APPLE_TEAM_ID</string>
  <key>signingStyle</key><string>automatic</string>
</dict></plist>
PLIST

if ! xcodebuild -exportArchive -archivePath "$archive" -exportPath "$work/export" \
  -exportOptionsPlist "$work/options.plist" -allowProvisioningUpdates \
  -authenticationKeyPath "$APPLE_API_KEY_PATH" -authenticationKeyID "$APPLE_API_KEY" \
  -authenticationKeyIssuerID "$APPLE_API_ISSUER" > "$work/export.log" 2>&1; then
  tail -40 "$work/export.log" >&2
  echo "the Developer ID export failed" >&2
  exit 1
fi
signed="$work/export/$name.app"

codesign --verify --deep --strict "$signed"
details="$(codesign -dvv "$signed" 2>&1)"
echo "$details" | grep -E "Authority=Developer ID Application|TeamIdentifier|flags|Timestamp"
echo "$details" | grep -q "Authority=Developer ID Application: .*($APPLE_TEAM_ID)" || { echo "not signed by the team's Developer ID" >&2; exit 1; }
echo "$details" | grep -q "flags=.*runtime" || { echo "the hardened runtime was lost" >&2; exit 1; }

ditto -c -k --keepParent "$signed" "$work/$name.zip"
xcrun notarytool submit "$work/$name.zip" --key "$APPLE_API_KEY_PATH" --key-id "$APPLE_API_KEY" \
  --issuer "$APPLE_API_ISSUER" --wait --timeout 30m --output-format json > "$work/notary.json" || true
cat "$work/notary.json"; echo
if ! grep -q '"status" *: *"Accepted"' "$work/notary.json"; then
  submission="$(sed -n 's/.*"id" *: *"\([^"]*\)".*/\1/p' "$work/notary.json" | head -1)"
  [ -n "$submission" ] && xcrun notarytool log "$submission" --key "$APPLE_API_KEY_PATH" --key-id "$APPLE_API_KEY" \
    --issuer "$APPLE_API_ISSUER" >&2 || true
  echo "the notary did not accept the application" >&2
  exit 1
fi
xcrun stapler staple "$signed"
xcrun stapler validate "$signed"
# What a Mac decides when the application arrives from the Internet.
spctl --assess --type execute -vv "$signed" 2>&1 | tee "$work/gatekeeper.txt"
grep -q "source=Notarized Developer ID" "$work/gatekeeper.txt" || { echo "Gatekeeper does not accept it" >&2; exit 1; }

rm -rf "$app"
ditto "$signed" "$app"
echo "signed, notarised and stapled: $app"
