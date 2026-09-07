const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

// Inspect the applied config plugins, since SDK fields directly under
// expo.android do not configure the generated native build.
const config = JSON.parse(execFileSync(process.execPath, [
  require.resolve('expo/bin/cli'), 'config', '--type', 'introspect', '--json',
], {
  cwd: path.resolve(__dirname, '..'),
  env: { ...process.env, EXPO_NO_DOTENV: '1' },
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
}));

const properties = Object.fromEntries(
  config._internal.modResults.android.gradleProperties
    .filter(({ type }) => type === 'property')
    .map(({ key, value }) => [key, value])
);
const target = Number(properties['android.targetSdkVersion']);
const compile = Number(properties['android.compileSdkVersion']);

assert(target >= 36, `Android target SDK must be at least 36; received ${target}`);
assert(compile >= target, `Android compile SDK ${compile} must cover target SDK ${target}`);
console.log(`Android API requirement verified: target ${target}, compile ${compile}.`);
