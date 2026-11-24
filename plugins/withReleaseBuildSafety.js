/*
 * Expo's generated gradle.properties enables R8 for release builds. R8 full
 * mode strips WorkManager's Room implementation, and the app crashes before
 * the first frame:
 *
 *   NoSuchMethodException: androidx.work.impl.WorkDatabase_Impl.<init> []
 *
 * expo-background-task uses WorkManager, so for this small offline app the
 * safe release configuration is R8 off. The APK gets slightly larger, but it
 * starts. Keep this plugin in sync with the build workspace.
 */
const { withGradleProperties } = require('expo/config-plugins');

function setProperty(properties, key, value) {
  const existing = properties.find(
    (item) => item && item.type === 'property' && item.key === key
  );
  if (existing) {
    existing.value = value;
    return;
  }
  properties.push({ type: 'property', key, value });
}

module.exports = function withReleaseBuildSafety(config) {
  return withGradleProperties(config, (config) => {
    setProperty(config.modResults, 'android.enableMinifyInReleaseBuilds', 'false');
    setProperty(
      config.modResults,
      'android.enableShrinkResourcesInReleaseBuilds',
      'false'
    );
    return config;
  });
};
