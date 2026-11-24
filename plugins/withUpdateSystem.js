/*
 * Native prerequisites for in-app APK updates.
 *
 * The app downloads a signed APK and hands it to the Android package
 * installer. That needs:
 *   - android.permission.REQUEST_INSTALL_PACKAGES;
 *   - a FileProvider (already added by expo-file-system);
 *   - our private CA in the trust store, because the update server uses the
 *     project's own CA on an IP address;
 *   - a network security config that keeps system CAs and adds ours.
 *
 * All of this must survive `expo prebuild`, so it lives in a config plugin
 * instead of a handwritten android/ folder.
 */
const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

const INSTALL_PERMISSION = 'android.permission.REQUEST_INSTALL_PACKAGES';
const CA_SOURCE = path.join('certs', 'update-ca.pem');
const CA_RESOURCE = 'update_ca';
const CONFIG_FILE = 'network_security_config.xml';

function withInstallPermission(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest['uses-permission'] = manifest['uses-permission'] || [];
    const exists = manifest['uses-permission'].some(
      (item) => item?.$?.['android:name'] === INSTALL_PERMISSION
    );
    if (!exists) {
      manifest['uses-permission'].push({
        $: { 'android:name': INSTALL_PERMISSION },
      });
    }

    const application = manifest.application?.[0];
    if (application) {
      application.$ = application.$ || {};
      application.$['android:networkSecurityConfig'] =
        '@xml/network_security_config';
    }
    return config;
  });
}

function withTlsResources(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const androidRoot = config.modRequest.platformProjectRoot;
      const mainRes = path.join(androidRoot, 'app', 'src', 'main', 'res');
      const rawDir = path.join(mainRes, 'raw');
      const xmlDir = path.join(mainRes, 'xml');

      fs.mkdirSync(rawDir, { recursive: true });
      fs.mkdirSync(xmlDir, { recursive: true });

      const caPath = path.join(projectRoot, CA_SOURCE);
      if (!fs.existsSync(caPath)) {
        throw new Error(
          `withUpdateSystem: нет CA-файла ${caPath}. Скопируйте ca.pem с сервера обновлений.`
        );
      }
      fs.copyFileSync(caPath, path.join(rawDir, `${CA_RESOURCE}.pem`));

      const strict = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false">
    <trust-anchors>
      <certificates src="system" />
      <certificates src="@raw/${CA_RESOURCE}" />
    </trust-anchors>
  </base-config>
</network-security-config>
`;
      fs.writeFileSync(path.join(xmlDir, CONFIG_FILE), strict, 'utf8');

      // Debug builds may be pointed at a local manifest server via
      // EXPO_PUBLIC_UPDATE_MANIFEST_URL. Release builds keep the strict file:
      // the override is ignored outside __DEV__ anyway.
      const debugXmlDir = path.join(
        androidRoot,
        'app',
        'src',
        'debug',
        'res',
        'xml'
      );
      fs.mkdirSync(debugXmlDir, { recursive: true });
      const debug = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false">
    <trust-anchors>
      <certificates src="system" />
      <certificates src="@raw/${CA_RESOURCE}" />
    </trust-anchors>
  </base-config>
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="false">127.0.0.1</domain>
    <domain includeSubdomains="false">localhost</domain>
  </domain-config>
</network-security-config>
`;
      fs.writeFileSync(path.join(debugXmlDir, CONFIG_FILE), debug, 'utf8');
      return config;
    },
  ]);
}

module.exports = function withUpdateSystem(config) {
  config = withInstallPermission(config);
  config = withTlsResources(config);
  return config;
};
