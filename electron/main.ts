import { app, BrowserWindow, dialog, ipcMain } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { getWsServerState, startWsServer, stopWsServer } from "./wsServer";

type TelemetryPayload = {
  fps: number;
  triangles: number;
  latency: number;
  wasmLoad: number;
  timestamp: string;
};

type WorkbenchTask = {
  id: string;
  label: string;
};

type ModelSnapshot = {
  zoom: number;
  rotation: number;
  pitch: number;
  telemetry: Partial<TelemetryPayload>;
  model: string;
  features: string[];
};

let mainWindow: BrowserWindow | undefined;
let telemetryTimer: NodeJS.Timeout | undefined;

const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1060,
    minHeight: 700,
    title: "CAD Desktop Workbench",
    backgroundColor: "#101418",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    mainWindow.loadURL("http://127.0.0.1:5173");

    // 开发环境默认打开控制台，方便调试渲染进程、Three.js 和 WebSocket 状态。
    mainWindow.webContents.once("did-finish-load", () => {
      mainWindow?.webContents.openDevTools({ mode: "detach" });
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
  }

  registerDebugShortcuts(mainWindow);

  mainWindow.on("closed", () => {
    mainWindow = undefined;
    stopTelemetry();
  });
}

function registerDebugShortcuts(window: BrowserWindow) {
  window.webContents.on("before-input-event", (event, input) => {
    const isToggleDevTools =
      input.key === "F12" || (input.key.toLowerCase() === "i" && input.control && input.shift);
    const isReload = input.key === "F5" || (input.key.toLowerCase() === "r" && input.control);

    if (isToggleDevTools) {
      event.preventDefault();
      window.webContents.toggleDevTools();
    }

    if (isReload) {
      event.preventDefault();
      window.webContents.reload();
    }
  });
}

function startTelemetry() {
  stopTelemetry();

  telemetryTimer = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      stopTelemetry();
      return;
    }

    const payload: TelemetryPayload = {
      fps: randomInt(52, 61),
      triangles: randomInt(845000, 1260000),
      latency: randomInt(16, 42),
      wasmLoad: randomInt(28, 73),
      timestamp: new Date().toLocaleTimeString()
    };

    mainWindow.webContents.send("telemetry:update", payload);
  }, 1200);
}

function stopTelemetry() {
  if (telemetryTimer) {
    clearInterval(telemetryTimer);
    telemetryTimer = undefined;
  }
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

app.whenReady().then(() => {
  startWsServer();
  createWindow();
  startTelemetry();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      startTelemetry();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopWsServer();
});

ipcMain.handle("app:get-version", () => app.getVersion());
ipcMain.handle("ws:get-server", () => getWsServerState());
ipcMain.handle("window:reload", () => {
  mainWindow?.webContents.reload();
});

ipcMain.handle("task:run", async (_event, task: WorkbenchTask) => {
  await new Promise((resolve) => setTimeout(resolve, 450));

  return {
    id: task.id,
    status: "done",
    finishedAt: new Date().toLocaleTimeString(),
    message: `${task.label} completed by the desktop host`
  };
});

ipcMain.handle("model:export", async (_event, snapshot: ModelSnapshot) => {
  if (!mainWindow) {
    return { canceled: true };
  }

  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: "Export model report",
    defaultPath: "cad-workbench-report.json",
    filters: [{ name: "JSON", extensions: ["json"] }]
  });

  if (canceled || !filePath) {
    return { canceled: true };
  }

  const report = {
    exportedAt: new Date().toISOString(),
    source: "Electron CAD Workbench",
    snapshot
  };

  await fs.writeFile(filePath, JSON.stringify(report, null, 2), "utf8");
  return { canceled: false, filePath };
});
