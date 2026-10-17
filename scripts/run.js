const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const [, , targetDir, ...cmdArgs] = process.argv;

if (!targetDir || cmdArgs.length === 0) {
  console.error('Usage: node scripts/run.js <directory> <command> [...args]');
  process.exit(1);
}

const env = { ...process.env };
const major = parseInt(process.versions.node.split('.')[0], 10);

// On Windows, if current node is < 22, use modern Node 26 if available in nodejs_old
if (major < 22 && fs.existsSync('C:\\Program Files\\nodejs_old')) {
  env.PATH = `C:\\Program Files\\nodejs_old;${env.PATH}`;
}

const cwd = path.resolve(__dirname, '..', targetDir);
const bin = cmdArgs[0];

const child = spawn(bin, cmdArgs.slice(1), {
  cwd,
  env,
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
