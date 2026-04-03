# LaunchManager · Codex 完整提示词

---

## 提示词正文（直接复制以下全部内容）

```
Build a Windows desktop application called "LaunchManager" (自动化软件启动管理器) from scratch using Electron + React + TypeScript + Tailwind CSS, bundled with electron-vite.

This prompt defines the complete architecture. Implement every module fully and wire them all together. The app must run with `npm run dev` when complete.

===============================================================
## PROJECT FILE STRUCTURE
===============================================================

launch-manager/
├── electron/
│   ├── main.ts                  # Electron entry, window creation, IPC registration
│   ├── preload.ts               # contextBridge, exposes all IPC methods to renderer
│   ├── modules/
│   │   ├── preset-store.ts      # Preset CRUD + persistence via electron-store
│   │   ├── settings-store.ts    # Settings CRUD + system integrations
│   │   ├── launcher.ts          # App launch logic (spawn + bat fallback)
│   │   ├── process-monitor.ts   # 4-tier process detection, polling, IPC push
│   │   ├── killer.ts            # 3-path process kill logic
│   │   └── logger.ts            # electron-log wrapper
│   └── utils/
│       └── app-scanner.ts       # Scan registry + start menu + desktop for installed apps
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── TopBar.tsx
│   │   ├── PresetList.tsx
│   │   ├── PresetCard/
│   │   │   ├── PresetCard.tsx
│   │   │   ├── PresetCardCollapsed.tsx
│   │   │   ├── PresetCardExpanded.tsx
│   │   │   └── AppIconRow.tsx
│   │   ├── AppPicker/
│   │   │   ├── AppPicker.tsx
│   │   │   ├── AppPickerItem.tsx
│   │   │   └── CustomAppForm.tsx
│   │   ├── SortableAppGrid.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── ActionButtons.tsx
│   │   ├── SettingsButton.tsx
│   │   ├── SettingsModal.tsx
│   │   ├── ConfirmDialog.tsx
│   │   └── Toggle.tsx
│   ├── hooks/
│   │   ├── usePresets.ts
│   │   ├── useProcessStatus.ts
│   │   ├── useAppList.ts
│   │   └── useSettings.ts
│   ├── types/
│   │   └── index.ts
│   └── styles/
│       └── globals.css
├── assets/
│   ├── icon.png
│   └── default-app-icon.png
├── index.html
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
└── package.json

===============================================================
## TYPESCRIPT TYPES  (src/types/index.ts)
===============================================================

export interface AppEntry {
  id: string                    // uuid
  name: string
  exePath: string               // full path to .exe (used for launching)
  installDir: string            // install directory (used for monitoring). Auto-inferred as dirname(exePath), user-editable
  iconPath: string              // extracted system icon or user-uploaded image path
  customProcessNames: string[]  // fallback process names for Layer 4 detection
}

export interface Preset {
  id: string
  name: string
  order: number                 // controls display order, drag-reorderable
  apps: AppEntry[]
}

export interface Settings {
  adminMode: boolean            // elevate only kill operations, not the whole app
  runInBackground: boolean      // hide to tray instead of quit on window close
  launchOnStartup: boolean      // register with Windows startup
}

export type RunStatus = 'stopped' | 'partial' | 'running'

export interface PresetStatus {
  presetId: string
  runningCount: number
  totalCount: number
  status: RunStatus
}

===============================================================
## IPC CHANNELS
===============================================================

Implement all of the following in main.ts (ipcMain handlers) and expose them in preload.ts (contextBridge):

// Presets
ipcMain.handle('preset:getAll')               → returns Preset[]
ipcMain.handle('preset:save', presets)        → saves Preset[], returns void

// Launcher
ipcMain.handle('launcher:startPreset', id)    → launches all apps in preset, returns void

// Killer
ipcMain.handle('killer:stopPreset', id)       → checks for risky apps first; if found, returns { needsConfirm: true, riskyApps: string[] }; if not, kills and returns { needsConfirm: false }
ipcMain.handle('killer:confirmStop', id)      → force kills without risky-app check, returns void

// Monitor
ipcMain.on('monitor:statusUpdate')            → main pushes PresetStatus[] to renderer on any status change

// Settings
ipcMain.handle('settings:get')                → returns Settings
ipcMain.handle('settings:save', settings)     → saves Settings, applies system side effects

// App Scanner
ipcMain.handle('app:scanInstalled')           → returns { name, exePath, iconPath }[]

===============================================================
## BACKEND MODULES
===============================================================

--- logger.ts ---
Use `electron-log`. Export a logger with methods: info(module, msg), warn(module, msg), error(module, msg).
Format: [TIMESTAMP] [LEVEL] [MODULE] message
Log file: %APPDATA%/LaunchManager/logs/main.log

--- preset-store.ts ---
Use `electron-store` to persist presets to presets.json.
Implement: getAll(), save(presets), getById(id).

--- settings-store.ts ---
Use `electron-store` to persist settings.
On save:
  - launchOnStartup: call app.setLoginItemSettings({ openAtLogin: value })
  - runInBackground: store value; it is read in main.ts on window 'close' event
Default: { adminMode: false, runInBackground: false, launchOnStartup: false }

--- app-scanner.ts ---
Scan three sources and merge+deduplicate by exePath:
1. Registry: HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall
   Use the `winreg` package. Read DisplayName, InstallLocation, DisplayIcon.
2. Start Menu: glob all .lnk files under %APPDATA%\Microsoft\Windows\Start Menu and C:\ProgramData\Microsoft\Windows\Start Menu. Resolve lnk targets using a shell command.
3. Desktop: glob .lnk files on the user's desktop. Resolve targets.
Return: { name: string, exePath: string, installDir: string, iconPath: string }[]
Wrap the entire function in try/catch, log errors, return [] on failure.

--- launcher.ts ---
export async function launchApp(app: AppEntry): Promise<{ success: boolean, pid?: number }>

Strategy:
1. Try child_process.spawn(app.exePath, [], { detached: true, stdio: 'ignore' })
   On success: record PID, log info, return { success: true, pid }
2. On spawn failure: log warn, fall back to writing a temp .bat file with content:
   @echo off\nstart "" "EXEPATH"\n
   Execute bat with child_process.exec. Log warn about fallback.
   Return { success: true } (no PID available in bat mode)
3. On total failure: log error, return { success: false }

export async function launchPreset(preset: Preset): Promise<void>
- Sort apps by their order in the preset
- For each app: skip if already running (check process-monitor), else launchApp(), wait 800ms
- After all launches, register all launched apps with process-monitor

--- process-monitor.ts ---
This is the most critical module. Implement a polling service with 4-tier detection.

Data structure per monitored app:
interface MonitorEntry {
  appId: string
  installDir: string
  customProcessNames: string[]
  trackedPids: Set<number>
  isRunning: boolean
  detectedProcessNames: Set<string>   // process names seen running, used by killer
}

export function registerApp(appId: string, installDir: string, customProcessNames: string[], initialPid?: number): void
- Creates a MonitorEntry for appId
- If initialPid provided: immediately snapshot process tree via PowerShell (see below), add all found child PIDs to trackedPids

export function unregisterApp(appId: string): void

export function getStatus(appId: string): boolean

export function getKillData(appId: string): { trackedPids: number[], processNames: string[], installDir: string }

export function startPolling(onStatusChange: (statuses: PresetStatus[]) => void): void
- setInterval every 3000ms
- Each tick: run all 4 detection layers for all registered apps
- If any app's isRunning changed: call onStatusChange with updated PresetStatus[]
- Entire tick wrapped in try/catch; log warn on failure, never crash

4-TIER DETECTION (run in parallel with Promise.all, OR the results):

Layer 1 - Path Polling (primary):
Run PowerShell:
  Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -ne $null } | Select-Object ProcessId, Name, ExecutablePath | ConvertTo-Json -Depth 1
Parse JSON result. For each process, check if ExecutablePath.startsWith(installDir).
If match: mark running, add to detectedProcessNames.
Wrap in try/catch, log warn on parse failure, return false.

Layer 2 - Process Tree Tracking:
Run PowerShell:
  Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, Name | ConvertTo-Json -Depth 1
Build a parent→children map. Walk from each pid in trackedPids, collect all descendants.
Add newly discovered child PIDs to trackedPids.
Check if any pid in trackedPids is still alive in the snapshot.
Wrap in try/catch, return false on failure.

Layer 3 - Window Association:
Use `node-window-manager` to enumerate visible windows.
For each window, get pid, then resolve executable path using PowerShell:
  (Get-Process -Id PID).MainModule.FileName
Check if path starts with installDir.
Wrap entire layer in try/catch (node-window-manager can fail), return false on failure.

Layer 4 - Custom Process Names:
Run PowerShell:
  Get-Process | Select-Object Name | ConvertTo-Json
Check if any customProcessName appears in the running process list.
Wrap in try/catch, return false on failure.

IMPORTANT: Escape all paths in PowerShell strings using single quotes. Handle paths with spaces.

--- killer.ts ---
export async function killApp(killData: { trackedPids: number[], processNames: string[], installDir: string }, adminMode: boolean): Promise<void>

Run all 3 kill paths in parallel (Promise.allSettled — do not let one failure stop others):

Path 1 - Kill by PID (most precise):
  Use `tree-kill` package on each pid in trackedPids.
  Wrap each call in try/catch, log warn on failure.

Path 2 - Kill by process name:
  For each name in processNames:
  if adminMode: wrap in Start-Process powershell -Verb RunAs
  else: run directly: taskkill /F /IM <name>
  Wrap in try/catch, log warn on failure.

Path 3 - Kill by install directory (fallback):
  PowerShell:
  Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -like 'INSTALLDIR\*' } | Stop-Process -Force
  if adminMode: wrap with Start-Process -Verb RunAs
  Wrap in try/catch, log warn on failure.

Log info on initiation, log info on completion, log warn on any individual path failure.

const HIGH_RISK_PROCESSES = ['winword.exe','excel.exe','powerpnt.exe','notepad++.exe','sublime_text.exe','code.exe']

export function checkRiskyApps(processNames: string[]): string[]
  Returns intersection of processNames and HIGH_RISK_PROCESSES.

--- main.ts ---
- Create BrowserWindow, load index.html
- On window 'close': if settings.runInBackground → hide(); else quit()
- Register all IPC handlers listed in IPC CHANNELS section
- Start process-monitor polling; on status change, push to renderer via webContents.send('monitor:statusUpdate', statuses)
- Handle launcher:startPreset: call launchPreset, then register launched apps with monitor
- Handle killer:stopPreset: call getKillData, checkRiskyApps; if risky return needsConfirm; else call killApp

--- preload.ts ---
Use contextBridge.exposeInMainWorld('electronAPI', { ... }) to expose all IPC handles as async functions callable from React.
Also expose: onStatusUpdate(callback) using ipcRenderer.on('monitor:statusUpdate', callback)

===============================================================
## FRONTEND IMPLEMENTATION
===============================================================

--- Visual Design ---
Tailwind config cream palette:
  bg: '#FDFBF7', surface: '#F5F0E8', hover: '#EDE4D3', border: '#E2D9CC'
  accent: '#C9A96E', danger: '#D97B6C'
  textPrimary: '#3D3530', textSecondary: '#9C8F85', textDisabled: '#C4BAB3'

All cards, modals, buttons: rounded-2xl (16px) or rounded-xl (12px)
Shadows: subtle, warm-tinted. Font: Inter or system-ui.
Global background: cream.bg. Card surface: cream.surface.
Buttons: accent color fill for primary actions, danger outlined for close actions.

--- App.tsx ---
Layout: full-height flex column.
Top: <TopBar />
Middle: scrollable <PresetList />
Fixed bottom-right: <SettingsButton />
Floating: <ConfirmDialog /> (conditional) and <SettingsModal /> (conditional)

--- TopBar.tsx ---
Left: "LaunchManager" title (textPrimary, font-semibold)
Right: "+ 新建预设" button (accent background, white text, rounded-xl)
On click: call createPreset() from usePresets, new card appears at bottom in edit mode

--- PresetList.tsx ---
Vertically scrollable list of <PresetCard> components.
Support drag-to-reorder presets using @dnd-kit/sortable.
On reorder: update order field and call savePresets.

--- PresetCard.tsx ---
Manages collapsed/expanded state (useState).
Click on card blank area → toggle expanded.
Click outside (useEffect + mousedown listener) → collapse.
Renders either <PresetCardCollapsed> or <PresetCardExpanded>.

--- PresetCardCollapsed.tsx ---
Top row: preset name (editable inline on double-click) + <StatusBadge presetId={id} />
Middle row: <AppIconRow apps={apps} /> — 48px icons, gap-2, overflow hidden after 5 icons shows ellipsis button
Bottom row: right-aligned <ActionButtons presetId={id} />

ActionButtons:
  ▶ 启动: accent fill, calls launcher:startPreset
  ■ 关闭: danger outline, calls killer:stopPreset; handles needsConfirm response by showing ConfirmDialog

--- PresetCardExpanded.tsx ---
Top row: preset name (inline editable) 
Middle: <SortableAppGrid> with 64px icons + delete popover on click + "+" button at end
Bottom (conditional): <AppPicker> when "+" is clicked

--- SortableAppGrid.tsx ---
Use @dnd-kit/core and @dnd-kit/sortable.
Each icon is a DraggableSortable item. Drag to reorder → update apps array order.
On icon click: show a small popover with "移除" button.
Drag-over visual: slight scale + shadow lift.

--- AppPicker.tsx ---
Shown inline below the app grid, slides down with opacity+translateY transition.
Top: search input (filters the list).
List: <AppPickerItem> for each scanned app not already in preset.
On item click: add to preset, close picker.
Supports dropping .exe or .lnk files onto the panel.
Bottom divider + <CustomAppForm>.

--- CustomAppForm.tsx ---
Two fields: exePath text input + "浏览" file picker button, icon image uploader (shows preview).
On submit: add custom AppEntry to preset with provided path and icon.
Auto-infer installDir as dirname(exePath).

--- StatusBadge.tsx ---
Reads from useProcessStatus hook.
Stopped → render nothing.
Partial → amber pill badge: "● X / Y 运行中"
All running → green pill badge: "● Y / Y 运行中"

--- SettingsModal.tsx ---
Centered modal overlay (backdrop blur + dark overlay).
Three Toggle rows: adminMode, runInBackground, launchOnStartup.
On change: call settings:save immediately.
Close on overlay click or ✕ button.

--- ConfirmDialog.tsx ---
Lists risky app names. "取消" (outline) + "确认关闭" (danger fill).
On confirm: call killer:confirmStop.

--- Toggle.tsx ---
Custom styled toggle switch. Checked state: accent color track. Unchecked: cream.border track.
Animated thumb transition.

--- HOOKS ---

usePresets.ts:
  - Load presets via preset:getAll on mount
  - Expose: presets, createPreset, updatePreset, deletePreset, reorderPresets
  - Each mutation calls preset:save with full updated array

useProcessStatus.ts:
  - Listen to monitor:statusUpdate via window.electronAPI.onStatusUpdate
  - Maintain statusMap: Map<presetId, PresetStatus>
  - Expose getPresetStatus(presetId): PresetStatus

useAppList.ts:
  - Lazy-load on first call via app:scanInstalled
  - Cache result, expose: appList, isLoading

useSettings.ts:
  - Load via settings:get on mount
  - Expose: settings, updateSetting(key, value)

===============================================================
## KEY PACKAGES (package.json dependencies)
===============================================================

"electron", "react", "react-dom", "typescript",
"tailwindcss", "postcss", "autoprefixer",
"electron-vite", "vite",
"@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities",
"winreg", "electron-store", "electron-log",
"tree-kill", "node-window-manager",
"uuid"

devDependencies: "@types/react", "@types/react-dom", "@types/node", "@types/uuid", "@types/winreg"

===============================================================
## IMPLEMENTATION INSTRUCTIONS
===============================================================

1. Scaffold the complete project with all files and directory structure above.
2. Implement all backend modules in the order: logger → preset-store → settings-store → app-scanner → launcher → process-monitor → killer → main
3. Implement preload.ts to bridge all IPC channels.
4. Implement all React components and hooks.
5. Wire everything together: app must fully run with `npm run dev`.
6. All backend files: well-commented in English, strict TypeScript.
7. All frontend files: use Tailwind utility classes only, no inline style objects except for dynamic values.
8. Never use <form> tags in React. Use onClick/onChange handlers directly.
9. The process-monitor polling loop must NEVER crash the app — every tick is fully wrapped in try/catch.
10. The killer module must use Promise.allSettled for all 3 kill paths — never let one path block another.
```

---

## 使用提示

- 将代码块内的全部内容**一次性**完整粘贴，不要分段
- 如果 Codex 问你「先做哪个部分」，回答：**「Start with the backend modules in order, then preload.ts, then React components」**
- 遇到 `node-window-manager` 编译报错（需要原生模块），可告知：**「Skip Layer 3 window association for now, implement layers 1, 2, 4 only」**
- 如果生成的代码缺少某个文件，追加说：**「You are missing [filename], implement it now following the same architecture」**

---
