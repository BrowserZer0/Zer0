const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

exports.default = async function(context) {
  // Only run on macOS builds
  if (context.electronPlatformName !== 'darwin') {
    return;
  }

  const appPath = context.appOutDir;
  const torDir = path.join(appPath, 'Zero Browser.app', 'Contents', 'Resources', 'mac', 'tor', 'tor');
  
  console.log('Setting execute permissions on Tor binaries...');
  
  // Set permissions on tor binary
  const torBinary = path.join(torDir, 'tor');
  if (fs.existsSync(torBinary)) {
    fs.chmodSync(torBinary, 0o755);
    console.log(`  ✓ Set permissions on ${torBinary}`);
  }

  // Set permissions on libevent
  const libevent = path.join(torDir, 'libevent-2.1.7.dylib');
  if (fs.existsSync(libevent)) {
    fs.chmodSync(libevent, 0o755);
    console.log(`  ✓ Set permissions on ${libevent}`);
  }

  // Set permissions on pluggable transports
  const ptDir = path.join(torDir, 'pluggable_transports');
  if (fs.existsSync(ptDir)) {
    const files = fs.readdirSync(ptDir);
    for (const file of files) {
      const filePath = path.join(ptDir, file);
      const stat = fs.statSync(filePath);
      if (stat.isFile()) {
        fs.chmodSync(filePath, 0o755);
        console.log(`  ✓ Set permissions on ${filePath}`);
      }
    }
  }

  console.log('Tor binary permissions set successfully!');
};
