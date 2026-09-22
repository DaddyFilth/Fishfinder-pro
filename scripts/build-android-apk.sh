#!/usr/bin/env bash
#
# Build the SeamCast Android APK directly on this machine.
#
# Why this exists: GitHub-hosted Actions minutes can be billed or blocked
# (private repos, spending limits, exhausted quotas). This script performs the
# exact same build steps as .github/workflows/android-apk.yml and
# .github/workflows/android-aab-release.yml, but needs no CI runner at all, so
# nothing can stop an APK from being produced.
#
# Usage:
#   bash scripts/build-android-apk.sh              # debug APK
#   bash scripts/build-android-apk.sh --check      # verify prerequisites only
#   bash scripts/build-android-apk.sh --release    # signed AAB + APK
#   bash scripts/build-android-apk.sh --skip-install
#
# Release signing reads the same variables the release workflow uses:
#   ANDROID_KEYSTORE_BASE64 or KEYSTORE_PATH
#   ANDROID_KEYSTORE_PASSWORD
#   ANDROID_KEY_ALIAS
#   ANDROID_KEY_PASSWORD
set -euo pipefail

MODE="debug"
CHECK_ONLY="false"
SKIP_INSTALL="false"

usage() {
  sed -n '3,21p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

for arg in "$@"; do
  case "$arg" in
    --release) MODE="release" ;;
    --check) CHECK_ONLY="true" ;;
    --skip-install) SKIP_INSTALL="true" ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      usage
      exit 2
      ;;
  esac
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android"
cd "$ROOT_DIR"

SDK_PACKAGES='platform-tools platforms;android-36 build-tools;36.0.0'

info() { printf '\033[0;36m▸ %s\033[0m\n' "$1"; }
ok() { printf '\033[0;32m✓ %s\033[0m\n' "$1"; }
fail() {
  printf '\033[0;31m✗ %s\033[0m\n' "$1" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command '$1' is not on PATH."
}

# ─── Prerequisite checks ──────────────────────────────────────────────────────
require_cmd java
require_cmd node
require_cmd npx

JAVA_MAJOR="$(java -version 2>&1 | awk -F'"' '/version/ {print $2}' | awk -F. '{print ($1 == 1 ? $2 : $1)}')"
if [ -z "$JAVA_MAJOR" ] || ! [ "$JAVA_MAJOR" -ge 17 ] 2>/dev/null; then
  fail "Java 17 or newer is required (found '${JAVA_MAJOR:-unknown}'). CI uses Temurin 21."
fi
ok "Java $JAVA_MAJOR"

resolve_android_sdk() {
  local candidate
  for candidate in "${ANDROID_HOME:-}" "${ANDROID_SDK_ROOT:-}"; do
    if [ -n "$candidate" ] && [ -d "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  if [ -f "$ANDROID_DIR/local.properties" ]; then
    candidate="$(sed -n 's/^sdk\.dir=//p' "$ANDROID_DIR/local.properties" | tail -1)"
    if [ -n "$candidate" ] && [ -d "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  fi

  for candidate in \
    "$HOME/Android/Sdk" \
    "$HOME/Android/sdk" \
    "$HOME/Library/Android/sdk" \
    "/usr/lib/android-sdk" \
    "/opt/android-sdk"; do
    if [ -d "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  return 1
}

if ! ANDROID_SDK="$(resolve_android_sdk)"; then
  cat >&2 <<EOF

$(printf '\033[0;31m✗ Android SDK not found.\033[0m')

Install the SDK once, then re-run:

  sdkmanager --install $SDK_PACKAGES

Point the project at it either way:

  export ANDROID_HOME="\$HOME/Android/Sdk"
  # or
  echo "sdk.dir=\$HOME/Android/Sdk" > android/local.properties

Alternatively let a self-hosted runner install the SDK for you (the Android
workflow runs android-actions/setup-android before building):

  bash scripts/setup-self-hosted-runner.sh --check
EOF
  exit 1
fi
export ANDROID_HOME="$ANDROID_SDK"
ok "Android SDK: $ANDROID_HOME"

if [ "$CHECK_ONLY" = "true" ]; then
  ok "Prerequisites satisfied for a '$MODE' build (nothing was built)."
  exit 0
fi

# ─── Web assets + Capacitor sync ──────────────────────────────────────────────
if [ "$SKIP_INSTALL" = "false" ] && [ ! -d "$ROOT_DIR/node_modules" ]; then
  info "Installing npm dependencies"
  npm ci
fi

info "Generating Android launcher icons"
if [ "$MODE" = "release" ]; then
  test -s "$ROOT_DIR/assets/icon-only.png" ||
    fail "Missing assets/icon-only.png for the release icon set."
  npx --yes @capacitor/assets@3.0.5 generate \
    --android \
    --assetPath assets \
    --iconBackgroundColor "#090d16" \
    --iconBackgroundColorDark "#090d16"
else
  npx @capacitor/assets generate --android --iconBackgroundColor "#0a192f"
fi

if [ "$MODE" = "release" ]; then
  info "Building the web application"
  npm run build
fi

info "Syncing the Capacitor Android project"
npx cap sync android

chmod +x "$ANDROID_DIR/gradlew"

# ─── Gradle build ─────────────────────────────────────────────────────────────
if [ "$MODE" = "debug" ]; then
  info "Building the debug APK"
  (cd "$ANDROID_DIR" && ./gradlew assembleDebug --stacktrace)

  APK="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
  test -s "$APK" || fail "Gradle finished but $APK is missing."
else
  KEYSTORE_RESOLVED="${KEYSTORE_PATH:-}"
  if [ -z "$KEYSTORE_RESOLVED" ]; then
    if [ -n "${ANDROID_KEYSTORE_BASE64:-}" ]; then
      KEYSTORE_RESOLVED="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/fishfinder-upload.jks"
      printf '%s' "$ANDROID_KEYSTORE_BASE64" | base64 --decode >"$KEYSTORE_RESOLVED"
      trap 'rm -f "$KEYSTORE_RESOLVED"' EXIT
    else
      fail "Set ANDROID_KEYSTORE_BASE64 or KEYSTORE_PATH to sign the release build."
    fi
  fi
  test -s "$KEYSTORE_RESOLVED" || fail "Keystore '$KEYSTORE_RESOLVED' is missing or empty."
  test -n "${ANDROID_KEYSTORE_PASSWORD:-}" || fail "Set ANDROID_KEYSTORE_PASSWORD."
  test -n "${ANDROID_KEY_ALIAS:-}" || fail "Set ANDROID_KEY_ALIAS."
  test -n "${ANDROID_KEY_PASSWORD:-}" || fail "Set ANDROID_KEY_PASSWORD."

  info "Building the signed release AAB and APK"
  (cd "$ANDROID_DIR" &&
    ./gradlew clean bundleRelease assembleRelease \
      -Pandroid.injected.signing.store.file="$KEYSTORE_RESOLVED" \
      -Pandroid.injected.signing.store.password="$ANDROID_KEYSTORE_PASSWORD" \
      -Pandroid.injected.signing.key.alias="$ANDROID_KEY_ALIAS" \
      -Pandroid.injected.signing.key.password="$ANDROID_KEY_PASSWORD" \
      --stacktrace)

  AAB="$ANDROID_DIR/app/build/outputs/bundle/release/app-release.aab"
  APK="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
  test -s "$AAB" || fail "Gradle finished but $AAB is missing."
  test -s "$APK" || fail "Gradle finished but $APK is missing."
  ok "AAB: $AAB"
fi

checksum() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

SIZE="$(du -h "$APK" | awk '{print $1}')"
ok "APK: $APK ($SIZE)"
ok "sha256: $(checksum "$APK")"
info "Install on a connected device with: adb install -r \"$APK\""