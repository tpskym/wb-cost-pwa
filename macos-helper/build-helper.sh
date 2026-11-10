#!/bin/sh
set -eu
resources=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
app=$1
/usr/bin/osacompile -o "$app" "$resources/Helper.applescript"
/bin/cp "$resources/open-file.sh" "$app/Contents/Resources/open-file.sh"
/bin/cp "$resources/webdav-check.sh" "$app/Contents/Resources/webdav-check.sh"
plist="$app/Contents/Info.plist"
/usr/libexec/PlistBuddy -c 'Add :CFBundleIdentifier string io.github.tpskym.workshop.files' "$plist"
/usr/libexec/PlistBuddy -c 'Add :CFBundleURLTypes array' "$plist"
/usr/libexec/PlistBuddy -c 'Add :CFBundleURLTypes:0 dict' "$plist"
/usr/libexec/PlistBuddy -c 'Add :CFBundleURLTypes:0:CFBundleURLName string Workshop files' "$plist"
/usr/libexec/PlistBuddy -c 'Add :CFBundleURLTypes:0:CFBundleURLSchemes array' "$plist"
/usr/libexec/PlistBuddy -c 'Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string workshop-files' "$plist"
/usr/bin/plutil -lint "$plist"
/usr/bin/codesign --force --sign - "$app"
