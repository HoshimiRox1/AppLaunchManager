import { execSync } from 'node:child_process';

const POWERSHELL_EXEC_OPTIONS = {
  shell: 'powershell.exe',
  encoding: 'utf8' as const,
  timeout: 8000,
  windowsHide: true,
};

// 为了统一执行普通权限的 PowerShell 脚本。
export function runPowerShellScript(script: string): string {
  return execSync(script, POWERSHELL_EXEC_OPTIONS);
}

// 为了把 PowerShell 脚本包装为可提升权限的编码命令。
function encodePowerShellCommand(script: string): string {
  return Buffer.from(script, 'utf16le').toString('base64');
}

// 为了统一执行带管理员权限弹窗的 PowerShell 脚本。
export function runElevatedPowerShellScript(script: string): string {
  const encodedCommand = encodePowerShellCommand(script);
  return execSync(`Start-Process powershell -Verb RunAs -ArgumentList '-EncodedCommand ${encodedCommand}' -Wait`, POWERSHELL_EXEC_OPTIONS);
}
