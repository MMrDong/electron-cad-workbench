import { contextBridge, ipcRenderer } from "electron";

import type {
  DesktopApi,
  ExportResult,
  ModelSnapshot,
  WsServerState,
  TaskResult,
  TelemetryPayload,
  WorkbenchTask
} from "../src/types";

/**
 * preload 是主进程和渲染进程之间的安全桥。
 *
 * 渲染进程不能直接访问 Node/Electron API，这里只暴露经过白名单包装的方法：
 * - invoke 类方法用于一次性请求主进程能力
 * - onTelemetry 用于订阅主进程推送的实时指标
 */
const desktopApi: DesktopApi = {
  // 获取 Electron 应用版本，用于启动提示和关于信息。
  getVersion: () => ipcRenderer.invoke("app:get-version"),

  // 刷新当前渲染页面，开发调试时等同于浏览器刷新。
  reloadWindow: () => ipcRenderer.invoke("window:reload") as Promise<void>,

  // 获取本地 WebSocket 服务地址，渲染进程再用浏览器原生 WebSocket 连接。
  getWsServer: () => ipcRenderer.invoke("ws:get-server") as Promise<WsServerState>,

  // 触发主进程侧模拟任务，代表桌面端/原生能力调度。
  runTask: (task: WorkbenchTask) => ipcRenderer.invoke("task:run", task) as Promise<TaskResult>,

  // 打开系统保存对话框，将当前模型快照导出为 JSON 报告。
  exportModel: (snapshot: ModelSnapshot) => ipcRenderer.invoke("model:export", snapshot) as Promise<ExportResult>,

  // 订阅主进程定时推送的遥测数据，并返回取消订阅函数，避免组件卸载后泄漏监听器。
  onTelemetry: (callback: (payload: TelemetryPayload) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: TelemetryPayload) => callback(payload);
    ipcRenderer.on("telemetry:update", listener);
    return () => ipcRenderer.removeListener("telemetry:update", listener);
  }
};

// 只把 desktopApi 暴露到 window，保持 contextIsolation 下的最小权限面。
contextBridge.exposeInMainWorld("desktopApi", desktopApi);
