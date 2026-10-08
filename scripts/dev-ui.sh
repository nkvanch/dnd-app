#!/usr/bin/env bash
# Tiny uiautomator driver for the device smoke test.  usage: dev-ui.sh dump|has TEXT|tap TEXT|text TEXT VALUE|key N|shot FILE
ADB=D:/Dev/Android/sdk/platform-tools/adb.exe
OUT="${DEVUI_OUT:-/d/Documents/dnd-app/builds/maestro-artifacts/campaign-fix}"
mkdir -p "$OUT"
dump() { MSYS_NO_PATHCONV=1 $ADB shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; MSYS_NO_PATHCONV=1 $ADB pull /sdcard/ui.xml "$(cygpath -w "$OUT")\ui.xml" >/dev/null 2>&1; }
find_center() { # prints "x y" of the first node whose text or content-desc contains $1
  node -e '
const fs=require("fs");const x=fs.readFileSync(process.argv[1],"utf8");const q=process.argv[2];
const re=/<node [^>]*>/g;let m;
while((m=re.exec(x))){const n=m[0];const t=(/ text="([^"]*)"/.exec(n)||[])[1]||"";const d=(/ content-desc="([^"]*)"/.exec(n)||[])[1]||"";const r=/ id="/.exec(n);
 if((t.includes(q)||d.includes(q))){const b=/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(n);if(b){console.log(Math.round((+b[1]+ +b[3])/2),Math.round((+b[2]+ +b[4])/2));process.exit(0)}}}
process.exit(1)' "$OUT/ui.xml" "$1"; }
case "$1" in
  dump) dump; node -e 'const x=require("fs").readFileSync(process.argv[1],"utf8");const o=[];for(const m of x.matchAll(/ (?:text|content-desc)="([^"]+)"/g))o.push(m[1]);console.log([...new Set(o)].join(" | "))' "$OUT/ui.xml" ;;
  has) dump; if find_center "$2" >/dev/null; then echo "PRESENT: $2"; else echo "ABSENT: $2"; fi ;;
  tap) dump; c=$(find_center "$2") || { echo "NOT FOUND: $2"; exit 1; }; $ADB shell input tap $c; echo "tapped $2 at $c" ;;
  text) $ADB shell input text "$2" ;;
  key) $ADB shell input keyevent "$2" ;;
  shot) MSYS_NO_PATHCONV=1 $ADB shell screencap -p /sdcard/s.png; MSYS_NO_PATHCONV=1 $ADB pull /sdcard/s.png "$(cygpath -w "$2")" >/dev/null 2>&1; echo "saved $2" ;;
esac
