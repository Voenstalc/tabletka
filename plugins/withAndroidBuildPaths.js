/*
 * Android's CMake/ninja build fails when object paths exceed MAX_PATH (260),
 * and AGP refuses non-ASCII project paths. The project lives under a Cyrillic
 * folder, so release builds are made from a short ASCII copy (see AGENTS.md).
 *
 * This plugin keeps the two required Gradle settings in the generated
 * android/app/build.gradle after every `expo prebuild`:
 *   - buildStagingDirectory: put CMake artifacts in a very short path;
 *   - CMAKE_OBJECT_PATH_MAX: let CMake shorten object file names.
 *
 * The staging directory must be a short ASCII path, ideally at a drive root.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const DEFAULT_STAGING = 'D:/t';
const MARKER = 'TABLETKA_BUILD_PATHS';

function patch(contents, staging) {
  if (contents.includes(MARKER)) return contents;

  let result = contents.replace(
    /(namespace\s+['"][^'"]+['"]\s*)/,
    `$1\n\n    // ${MARKER}: short paths for AGP/CMake on Windows\n    externalNativeBuild {\n        cmake {\n            buildStagingDirectory "${staging}"\n        }\n    }\n`
  );

  result = result.replace(
    /(defaultConfig\s*\{)/,
    `$1\n        // ${MARKER}: CMake shortens object names instead of exceeding MAX_PATH\n        externalNativeBuild {\n            cmake {\n                arguments "-DCMAKE_OBJECT_PATH_MAX=200"\n            }\n        }\n`
  );

  return result;
}

module.exports = function withAndroidBuildPaths(config, props = {}) {
  const staging = typeof props.buildStagingDirectory === 'string'
    ? props.buildStagingDirectory.trim()
    : DEFAULT_STAGING;
  if (!/^[A-Za-z]:[\\/]/.test(staging)) {
    throw new Error(
      `withAndroidBuildPaths: buildStagingDirectory должен быть абсолютным путём на диске (${staging})`
    );
  }

  return withAppBuildGradle(config, (config) => {
    config.modResults.contents = patch(config.modResults.contents, staging);
    return config;
  });
};
