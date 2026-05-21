export type TelemetryPayload = {
  fps: number;
  triangles: number;
  latency: number;
  wasmLoad: number;
  timestamp: string;
};

export type WorkbenchTask = {
  id: string;
  label: string;
  detail: string;
};

export type CadDocumentKind = "assembly" | "part";

export type CadBinaryPart = {
  color: [number, number, number];
  position: [number, number, number];
  scale: [number, number, number];
};

export type CadBinaryRecord = {
  id: string;
  parts: CadBinaryPart[];
  receivedAt: string;
};

export type TaskResult = {
  id: string;
  status: "done";
  finishedAt: string;
  message: string;
};

export type ModelSnapshot = {
  zoom: number;
  rotation: number;
  pitch: number;
  telemetry: Partial<TelemetryPayload>;
  model: string;
  features: string[];
};

export type ExportResult = {
  canceled: boolean;
  filePath?: string;
};

export type WsServerState = {
  port: number;
  url: string;
};

export type DesktopApi = {
  getVersion: () => Promise<string>;
  reloadWindow: () => Promise<void>;
  getWsServer: () => Promise<WsServerState>;
  runTask: (task: WorkbenchTask) => Promise<TaskResult>;
  exportModel: (snapshot: ModelSnapshot) => Promise<ExportResult>;
  onTelemetry: (callback: (payload: TelemetryPayload) => void) => () => void;
};

declare global {
  interface Window {
    desktopApi: DesktopApi;
  }
}
