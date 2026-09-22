// Guards the Android build path against depending on metered GitHub-hosted
// runners, and against the local escape hatch going missing. Assertions on the
// workflow source match the style of androidSdkWorkflows.test.ts.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const androidWorkflows = [
  '.github/workflows/android-apk.yml',
  '.github/workflows/android-aab-release.yml',
];

describe.each(androidWorkflows)('%s runner selection', (workflowPath) => {
  const workflow = read(workflowPath);

  it('defaults to a self-hosted runner that billing cannot meter', () => {
    expect(workflow).toContain(
      "runs-on: ${{ fromJSON(vars.ANDROID_RUNNER_JSON || (inputs.runner == 'github-hosted'",
    );
    expect(workflow).toContain('\'["self-hosted","linux","x64"]\'');
    // A GitHub-hosted runner must never be the unconditional default.
    expect(workflow).not.toMatch(/runs-on:\s*ubuntu-latest/);
  });

  it('offers an explicit runner choice on manual runs', () => {
    expect(workflow).toContain('type: choice');
    expect(workflow).toContain('- self-hosted');
    expect(workflow).toContain('- github-hosted');
    expect(workflow).toContain('default: self-hosted');
  });

  it('documents the repository-variable override', () => {
    expect(workflow).toContain('gh variable set ANDROID_RUNNER_JSON');
  });

  it('points contributors at the no-CI local build', () => {
    expect(workflow).toContain('scripts/build-android-apk.sh');
  });
});

describe('local Android build escape hatch', () => {
  it('exists, is documented and is wired into npm scripts', () => {
    const script = read('scripts/build-android-apk.sh');
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };

    expect(script).toContain('gradlew assembleDebug');
    expect(script).toContain('gradlew clean bundleRelease assembleRelease');
    expect(script).toContain('--check');
    expect(pkg.scripts['android:apk']).toBe('bash scripts/build-android-apk.sh');
    expect(pkg.scripts['android:apk:release']).toBe('bash scripts/build-android-apk.sh --release');
    expect(read('docs/ANDROID_BUILD.md')).toContain('scripts/build-android-apk.sh');
  });

  it('ships a self-hosted runner registration helper', () => {
    const runnerScript = read('scripts/setup-self-hosted-runner.sh');

    expect(runnerScript).toContain('registration-token');
    expect(runnerScript).toContain('--labels');
    expect(runnerScript).toContain('self-hosted,linux,x64,android');
  });
});