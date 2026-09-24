#!/usr/bin/env bash
#
# Register a self-hosted GitHub Actions runner for the Android builds.
#
# Self-hosted runners are not metered: they never draw from the GitHub-hosted
# Actions minute allowance, so a billing limit or exhausted quota cannot block
# an APK build. The Android workflows default to a runner labelled
# `self-hosted,linux,x64` (see .github/workflows/android-apk.yml).
#
# Usage:
#   bash scripts/setup-self-hosted-runner.sh --check          # prerequisites only
#   bash scripts/setup-self-hosted-runner.sh --token <TOKEN>  # download + register
#   bash scripts/setup-self-hosted-runner.sh --token <TOKEN> --service
#
# Mint a registration token (valid ~1 hour) with the GitHub CLI:
#   gh api -X POST repos/DaddyFilth/Fishfinder-pro/actions/runners/registration-token --jq .token
#
# The runner needs Java 17+ and Node 22. The Android SDK is installed inside the
# workflow by android-actions/setup-android, so it does not have to be
# pre-installed on the machine.
set -euo pipefail

REPO_URL_DEFAULT="https://github.com/DaddyFilth/Fishfinder-pro"
RUNNER_DIR_DEFAULT="$HOME/actions-runner"
LABELS_DEFAULT="self-hosted,linux,x64,android"
RUNNER_VERSION="2.328.0"

CHECK_ONLY="false"
INSTALL_SERVICE="false"
TOKEN="${RUNNER_TOKEN:-}"
REPO_URL="${REPO_URL:-$REPO_URL_DEFAULT}"
RUNNER_DIR="${RUNNER_DIR:-$RUNNER_DIR_DEFAULT}"
LABELS="${RUNNER_LABELS:-$LABELS_DEFAULT}"
RUNNER_NAME="$(hostname)-seamcast"

usage() {
  sed -n '3,21p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

while [ $# -gt 0 ]; do
  case "$1" in
    --check) CHECK_ONLY="true" ;;
    --service) INSTALL_SERVICE="true" ;;
    --token)
      TOKEN="${2:-}"
      shift
      ;;
    --url)
      REPO_URL="${2:-}"
      shift
      ;;
    --name)
      RUNNER_NAME="${2:-}"
      shift
      ;;
    --labels)
      LABELS="${2:-}"
      shift
      ;;
    --dir)
      RUNNER_DIR="${2:-}"
      shift
      ;;
    --version)
      RUNNER_VERSION="${2:-}"
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 2
      ;;
  esac
  shift
done

info() { printf '\033[0;36m▸ %s\033[0m\n' "$1"; }
ok() { printf '\033[0;32m✓ %s\033[0m\n' "$1"; }
fail() {
  printf '\033[0;31m✗ %s\033[0m\n' "$1" >&2
  exit 1
}

# ─── Host prerequisites ──────────────────────────────────────────────────────
command -v java >/dev/null 2>&1 || fail "Java 17+ is required on the runner host."
JAVA_MAJOR="$(java -version 2>&1 | awk -F'"' '/version/ {print $2}' | awk -F. '{print ($1 == 1 ? $2 : $1)}')"
! [ "$JAVA_MAJOR" -ge 17 ] 2>/dev/null && fail "Java 17+ is required (found '${JAVA_MAJOR:-unknown}')."
ok "Java $JAVA_MAJOR"

command -v node >/dev/null 2>&1 || fail "Node.js 22 is required on the runner host."
NODE_MAJOR="$(node --version | sed 's/^v//' | cut -d. -f1)"
! [ "$NODE_MAJOR" -ge 20 ] 2>/dev/null && fail "Node 20+ is required (found v$NODE_MAJOR)."
ok "Node v$(node --version | sed 's/^v//')"

case "$(uname -s)" in
  Linux) RUNNER_OS="linux" ;;
  Darwin) RUNNER_OS="osx" ;;
  *) fail "Unsupported host OS '$(uname -s)'. Use scripts/build-android-apk.sh locally instead." ;;
esac

case "$(uname -m)" in
  x86_64 | amd64) RUNNER_ARCH="x64" ;;
  arm64 | aarch64) RUNNER_ARCH="arm64" ;;
  *) fail "Unsupported architecture '$(uname -m)'." ;;
esac
ok "Host: $RUNNER_OS/$RUNNER_ARCH"

info "Workflow labels that will select this runner: $LABELS"

if [ "$CHECK_ONLY" = "true" ]; then
  ok "Prerequisites satisfied (nothing was downloaded or registered)."
  info "Next: mint a token with gh api -X POST ${REPO_URL#https://github.com/}/actions/runners/registration-token --jq .token"
  info "Then: bash scripts/setup-self-hosted-runner.sh --token <TOKEN>"
  exit 0
fi

if [ -z "$TOKEN" ]; then
  if command -v gh >/dev/null 2>&1; then
    info "No token supplied; asking the GitHub CLI to mint one"
    TOKEN="$(gh api -X POST "${REPO_URL#https://github.com/}/actions/runners/registration-token" --jq .token 2>/dev/null || true)"
  fi
  [ -n "$TOKEN" ] || fail "No registration token. Pass --token, or set RUNNER_TOKEN, or export a working GH_TOKEN for 'gh api'."

# ─── Download the runner ─────────────────────────────────────────────────────
TARBALL="actions-runner-${RUNNER_OS}-${RUNNER_ARCH}-${RUNNER_VERSION}.tar.gz"
DOWNLOAD_URL="https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${TARBALL}"

mkdir -p "$RUNNER_DIR"
cd "$RUNNER_DIR"

if [ -x "./config.sh" ]; then
  ok "Runner binaries already present in $RUNNER_DIR (reusing)"
else
  info "Downloading runner v$RUNNER_VERSION ($RUNNER_OS/$RUNNER_ARCH)"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL -o "$TARBALL" "$DOWNLOAD_URL"
  elif command -v wget >/dev/null 2>&1; then
    wget -q -O "$TARBALL" "$DOWNLOAD_URL"
  else
    fail "Need curl or wget to download the runner tarball."
  fi
  tar xzf "$TARBALL"
  rm -f "$TARBALL"
  ok "Extracted to $RUNNER_DIR"
fi

# ─── Register ────────────────────────────────────────────────────────────────
info "Registering '$RUNNER_NAME' against $REPO_URL"
./config.sh \
  --url "$REPO_URL" \
  --token "$TOKEN" \
  --name "$RUNNER_NAME" \
  --labels "$LABELS" \
  --work "_work" \
  --unattended \
  --replace

ok "Runner registered"

if [ "$INSTALL_SERVICE" = "true" ]; then
  if command -v systemctl >/dev/null 2>&1; then
    info "Installing the runner as a systemd service"
    sudo ./svc.sh install "${USER:-$(id -un)}"
    sudo ./svc.sh start
    ok "Service started. Check it with: sudo ./svc.sh status"
  else
    info "systemd not available; run the runner in the foreground with: $RUNNER_DIR/run.sh"
  fi
else
  info "Start it with: $RUNNER_DIR/run.sh"
  info "Re-run with --service to install it as a systemd service."
fi

cat <<EOF

Next steps
  1. Confirm the runner shows up:
       gh api ${REPO_URL#https://github.com/}/actions/runners --jq '.runners[].name'
  2. Trigger a billing-free APK build:
       gh workflow run android-apk.yml
  3. Prefer no CI at all? Build on this machine instead:
       bash scripts/build-android-apk.sh
EOF
fi