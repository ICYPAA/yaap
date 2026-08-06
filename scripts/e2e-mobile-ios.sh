#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mobile_dir="$repo_root/apps/mobile"
maestro_workspace="$mobile_dir/e2e/maestro"
maestro_java_home="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
app_bundle_id="com.themindfulpug.icypaa"
metro_log="${TMPDIR:-/tmp}/yaap-e2e-metro.log"
metro_pid=""

simctl_check="$(xcrun --find simctl 2>&1)" || {
  if grep -qi "license" <<<"$simctl_check"; then
    echo "Apple's Xcode license has not been accepted." >&2
    echo "Review and accept it in a Terminal first:" >&2
    echo "  sudo xcodebuild -license" >&2
  else
    echo "iOS Simulator tools are unavailable." >&2
    echo "Install Apple's Xcode bundle and an iOS Simulator runtime first." >&2
  fi
  exit 1
}

if ! xcrun simctl list runtimes available | grep -q "iOS"; then
  echo "No available iOS Simulator runtime was found." >&2
  echo "Install one from Xcode Settings > Components." >&2
  exit 1
fi

if ! command -v maestro >/dev/null 2>&1; then
  echo "Maestro is required. Install it with:" >&2
  echo "  brew install mobile-dev-inc/tap/maestro" >&2
  exit 1
fi

if [[ ! -x "$maestro_java_home/bin/java" ]]; then
  echo "Java 17 is required. Install it with:" >&2
  echo "  brew install openjdk@17" >&2
  exit 1
fi

if ! command -v pod >/dev/null 2>&1; then
  echo "CocoaPods is required for the native iOS build. Install it with:" >&2
  echo "  brew install cocoapods" >&2
  exit 1
fi

cleanup() {
  if [[ -n "$metro_pid" ]]; then
    kill "$metro_pid" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

pnpm --dir "$repo_root" supabase:start
if ! pnpm --dir "$repo_root" supabase:db:reset; then
  echo "Local Supabase reset failed while its containers were restarting; retrying once." >&2
  sleep 5
  pnpm --dir "$repo_root" supabase:db:reset
fi
"$repo_root/scripts/configure-local-env.sh"
"$repo_root/scripts/verify-local-db.sh"

simulator_id="$(
  xcrun simctl list devices booted |
    sed -n 's/.*(\([0-9A-F-]\{36\}\)) (Booted).*/\1/p' |
    head -n 1
)"

if [[ -z "$simulator_id" ]]; then
  simulator_id="$(
    xcrun simctl list devices available |
      sed -n '/-- iOS /,/^$/s/.*iPhone.*(\([0-9A-F-]\{36\}\)) (Shutdown).*/\1/p' |
      head -n 1
  )"

  if [[ -z "$simulator_id" ]]; then
    echo "No available iPhone Simulator was found." >&2
    exit 1
  fi

  xcrun simctl boot "$simulator_id"
  open -a Simulator --args -CurrentDeviceUDID "$simulator_id"
  xcrun simctl bootstatus "$simulator_id" -b
fi

if [[ -z "$simulator_id" ]]; then
  echo "No booted iOS Simulator was found." >&2
  exit 1
fi

if ! curl --silent --fail http://127.0.0.1:8081/status >/dev/null 2>&1; then
  CI=1 pnpm --dir "$mobile_dir" exec expo start \
    --dev-client \
    --lan >"$metro_log" 2>&1 &
  metro_pid="$!"

  for _ in {1..60}; do
    if curl --silent --fail http://127.0.0.1:8081/status >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  if ! curl --silent --fail http://127.0.0.1:8081/status >/dev/null 2>&1; then
    echo "Metro did not become ready on port 8081." >&2
    tail -n 80 "$metro_log" >&2 || true
    exit 1
  fi
fi

# Regenerate the ignored native project so the local-only Simulator config
# cannot inherit production signing entitlements from an earlier prebuild.
YAAP_LOCAL_IOS=1 pnpm --dir "$mobile_dir" exec expo prebuild \
  --platform ios \
  --clean

# With exactly one booted Simulator, omitting --device selects it through
# simctl and avoids physical-device code-signing requirements.
YAAP_LOCAL_IOS=1 pnpm --dir "$mobile_dir" exec expo run:ios --no-bundler

if ! xcrun simctl get_app_container \
  "$simulator_id" \
  "$app_bundle_id" \
  app >/dev/null 2>&1; then
  echo "The iOS build finished without installing $app_bundle_id." >&2
  echo "Review the Expo/Xcode build output above before running Maestro." >&2
  exit 1
fi

JAVA_HOME="$maestro_java_home" \
  MAESTRO_CLI_NO_ANALYTICS=1 \
  MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true \
  maestro test "$maestro_workspace"
