const fs = require('fs');
const path = require('path');

/**
 * After packing, wraps the Electron binary with a shell script that sets
 * ELECTRON_DISABLE_SANDBOX=1 so the AppImage runs without a SUID chrome-sandbox
 * (AppImages usually run unprivileged and can't set the SUID bit themselves).
 */
exports.default = async function (context) {
  if (context.electronPlatformName !== 'linux') {
    return;
  }

  const appOutDir = context.appOutDir;
  const executableName = context.packager.executableName;
  const binaryPath = path.join(appOutDir, executableName);
  const binaryBackup = path.join(appOutDir, `${executableName}.bin`);

  fs.renameSync(binaryPath, binaryBackup);

  const wrapper = [
    '#!/bin/bash',
    'export ELECTRON_DISABLE_SANDBOX=1',
    `exec "$(dirname "$0")/${executableName}.bin" "$@"`,
  ].join('\n') + '\n';

  fs.writeFileSync(binaryPath, wrapper, { mode: 0o755 });
};
