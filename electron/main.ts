import { app, BrowserWindow, dialog, ipcMain } from "electron";
import fs from "node:fs/promises";
import path from "node:path";

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
  } else {
    mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = undefined;
    stopTelemetry();
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

ipcMain.handle("app:get-version", () => app.getVersion());

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
