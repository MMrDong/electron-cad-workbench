import { contextBridge, ipcRenderer } from "electron";

import type {
  DesktopApi,
  ExportResult,
  ModelSnapshot,
  TaskResult,
  TelemetryPayload,
  WorkbenchTask
} from "../src/types";

const desktopApi: DesktopApi = {
  getVersion: () => ipcRenderer.invoke("app:get-version"),
  runTask: (task: WorkbenchTask) => ipcRenderer.invoke("task:run", task) as Promise<TaskResult>,
  exportModel: (snapshot: ModelSnapshot) => ipcRenderer.invoke("model:export", snapshot) as Promise<ExportResult>,
  onTelemetry: (callback: (payload: TelemetryPayload) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: TelemetryPayload) => callback(payload);
    ipcRenderer.on("telemetry:update", listener);
    return () => ipcRenderer.removeListener("telemetry:update", listener);
  }
};

contextBridge.exposeInMainWorld("desktopApi", desktopApi);
