// upload-update.js - Script to upload update files to server via SCP/SSH
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const config = {
  // SSH server configuration
  // Set UPDATE_SSH_HOST / UPDATE_SSH_USER in the environment; not kept in the repo.
  sshHost: process.env.UPDATE_SSH_HOST || 'your-server',
  sshUser: process.env.UPDATE_SSH_USER || 'deploy',
  sshPort: '22',
  // Remote directory for updates
  remoteDir: '/var/www/updates', // Remote directory for updates
  buildDir: 'build-output'
};

// Read package.json to get version
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = packageJson.version;
const productName = packageJson.build.productName || 'Visibility Browser';

console.log(`Uploading ${productName} v${version} to ${config.sshHost}...`);

// Find the installer file
const buildDir = path.resolve(__dirname, config.buildDir);
const files = fs.readdirSync(buildDir);
const installerFile = files.find(f => f.endsWith('.exe') && f.includes('_Installer'));

if (!installerFile) {
  console.error('ERROR: Installer file not found in build-output directory');
  process.exit(1);
}

const installerPath = path.join(buildDir, installerFile);
const yamlFile = path.join(buildDir, 'latest.yml');

console.log(`Installer: ${installerFile}`);
console.log(`YAML: ${yamlFile}`);

// Upload function using SCP
function uploadFileViaSCP(filePath, remotePath) {
  return new Promise((resolve, reject) => {
    const scpCommand = `scp -P ${config.sshPort} "${filePath}" ${config.sshUser}@${config.sshHost}:${remotePath}`;
    
    try {
      console.log(`Uploading ${path.basename(filePath)}...`);
      execSync(scpCommand, { stdio: 'inherit' });
      console.log(`✓ Uploaded: ${path.basename(filePath)}`);
      resolve();
    } catch (error) {
      console.error(`✗ ERROR uploading ${path.basename(filePath)}:`, error.message);
      reject(error);
    }
  });
}

// Create remote directory if it doesn't exist
function createRemoteDirectory() {
  return new Promise((resolve, reject) => {
    const sshCommand = `ssh -p ${config.sshPort} ${config.sshUser}@${config.sshHost} "mkdir -p ${config.remoteDir}"`;
    
    try {
      execSync(sshCommand, { stdio: 'inherit' });
      console.log(`✓ Remote directory ready: ${config.remoteDir}`);
      resolve();
    } catch (error) {
      console.error(`✗ ERROR creating remote directory:`, error.message);
      reject(error);
    }
  });
}

async function main() {
  try {
    // Create remote directory
    await createRemoteDirectory();
    
    // Upload installer
    await uploadFileViaSCP(installerPath, `${config.remoteDir}/`);
    
    // Upload YAML
    if (fs.existsSync(yamlFile)) {
      await uploadFileViaSCP(yamlFile, `${config.remoteDir}/`);
    }
    
    console.log('\n✓ Upload completed successfully!');
    console.log(`Server: ${config.sshHost}`);
    console.log(`Remote directory: ${config.remoteDir}`);
    console.log(`Version: ${version}`);
    
  } catch (error) {
    console.error('\n✗ Upload failed:', error.message);
    console.error('\nPlease check:');
    console.error('1. SSH access to server');
    console.error('2. SCP is available on your system');
    console.error('3. SSH keys are configured (or use password)');
    process.exit(1);
  }
}

main();
