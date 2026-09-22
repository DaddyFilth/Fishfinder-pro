# Android APK builds without a billed runner

The Android workflows used to run only on GitHub-hosted runners (`ubuntu-latest`).
Those are metered: on a private repository they draw down the included Actions
minutes, and once the allowance or a spending limit is hit, runs stop. APK builds
now have two paths that billing cannot block.

## 1. Build locally (no CI at all)

```bash
npm run android:apk                 # debug APK
npm run android:apk:check           # verify the toolchain, build nothing
npm run android:apk:release         # signed AAB + APK
```

Equivalent to the workflows: it generates the launcher icons, runs
`npx cap sync android`, then `./gradlew assembleDebug` (or
`clean bundleRelease assembleRelease` for a release), and prints the artifact
path, size and sha256.

Requirements: Java 17+ (CI uses Temurin 21), Node 20+, and the Android SDK:

```bash
sdkmanager --install platform-tools platforms\;android-36 build-tools\;36.0.0
export ANDROID_HOME="$HOME/Android/Sdk"
# or: echo "sdk.dir=$HOME/Android/Sdk" > android/local.properties
```

Release signing reads the same variables as the release workflow:
`ANDROID_KEYSTORE_BASE64` (or `KEYSTORE_PATH`), `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.

## 2. Build on a self-hosted runner

Self-hosted runners are never metered, so a billing limit cannot stop them. Both
Android workflows default to the labels `self-hosted,linux,x64`:

```bash
npm run android:runner:setup -- --check        # prerequisites only
gh api -X POST repos/DaddyFilth/Fishfinder-pro/actions/runners/registration-token --jq .token
npm run android:runner:setup -- --token <TOKEN> --service
```

The runner host needs Java 17+ and Node 20+. The Android SDK is installed inside
the workflow by `android-actions/setup-android`, so it does not have to be
pre-installed on the machine.

Manual runs (`workflow_dispatch`) expose a **runner** dropdown defaulting to
`self-hosted`; choose `github-hosted` for a one-off hosted run. Pull requests
build on a hosted runner because those minutes are free for public repositories.

To move every run, pull requests included, off hosted runners:

```bash
gh variable set ANDROID_RUNNER_JSON --body '["self-hosted","linux","x64"]'
```

To revert to hosted runners everywhere:

```bash
gh variable set ANDROID_RUNNER_JSON --body '["ubuntu-latest"]'
```

> With a self-hosted default and no runner registered, runs sit in the queue
> until a runner is available. Use either `gh variable set` command above, or the
> local script, in that case.

## Which limit actually blocked CI before?

The failing check on recent pull requests was `github-advanced-security` with
`errorType: 'quota'` / `statusCode: 402` — that is the **Copilot** allowance, not
Actions minutes. It fails on `main` too and is unrelated to Android builds. The
APK, release, CodeQL, ESLint and build jobs all completed successfully on
GitHub-hosted runners, because Actions minutes are free for public repositories.
The self-hosted default matters once the repository is private or a spending
limit is set.

A different provider (Codemagic, Bitrise, CircleCI) would also work, but it needs
an external account and secret storage; the two paths above need nothing beyond
this repository.

## Third-party alternative, if you want one

If you would rather not run the build yourself and do not want GitHub-hosted
minutes, a hosted Android CI with a free tier (for example Codemagic or Bitrise)
can run `scripts/build-android-apk.sh` unchanged — the script is the single
source of truth for the build steps.