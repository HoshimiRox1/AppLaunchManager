const { spawn } = require('node:child_process');
const path = require('node:path');

// 清理会让 Electron 退化为 Node 模式的环境变量，再转发给本地 electron-vite CLI。
function run() {
  const mode = process.argv[2];

  if (!mode) {
    console.error('Missing electron-vite mode, expected one of: dev | build | preview');
    process.exit(1);
  }

  const childEnv = { ...process.env };
  delete childEnv.ELECTRON_RUN_AS_NODE;

  const cliPath = path.join(__dirname, '..', 'node_modules', 'electron-vite', 'bin', 'electron-vite.js');
  const child = spawn(process.execPath, [cliPath, mode], {
    stdio: 'inherit',
    shell: false,
    env: childEnv,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

run();
