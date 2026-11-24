/*
 * Release signing without committing a keystore.
 *
 * The build script sets:
 *   RELEASE_STORE_FILE, RELEASE_STORE_PASSWORD,
 *   RELEASE_KEY_ALIAS, RELEASE_KEY_PASSWORD
 *
 * If they are absent (normal dev build), the release variant keeps the debug
 * key so `expo run:android` still works. A shipped build must set them and
 * must use the same keystore forever: Android refuses an update signed by a
 * different key.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = 'TABLETKA_RELEASE_SIGNING';

function patch(contents) {
  if (contents.includes(MARKER)) return contents;

  let result = contents.replace(
    /(signingConfigs\s*\{)/,
    `$1\n        // ${MARKER}: keystore comes from the environment, never from git\n        release {\n            if (System.getenv("RELEASE_STORE_FILE")) {\n                storeFile file(System.getenv("RELEASE_STORE_FILE"))\n                storePassword System.getenv("RELEASE_STORE_PASSWORD")\n                keyAlias System.getenv("RELEASE_KEY_ALIAS")\n                keyPassword System.getenv("RELEASE_KEY_PASSWORD")\n            }\n        }\n`
  );

  result = result.replace(
    /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/,
    `$1signingConfig System.getenv("RELEASE_STORE_FILE") ? signingConfigs.release : signingConfigs.debug`
  );

  return result;
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    config.modResults.contents = patch(config.modResults.contents);
    return config;
  });
};
