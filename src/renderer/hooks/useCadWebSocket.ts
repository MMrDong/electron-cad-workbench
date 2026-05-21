import { useEffect, useRef, useState } from "react";
import type { CadBinaryPart, CadBinaryRecord } from "../../types";

/**
 * 渲染进程接收的本地 WS 消息协议。
 * 与 electron/wsServer.ts 中的服务端消息保持一致。
 */
type CadWsMessage =
  | {
      type: "cad:hello";
      payload: {
        clients: number;
        port: number;
        url: string;
      };
    }
  | {
      type: "cad:client-command";
      payload: unknown;
    };

export type CadWsState = {
  binaryParts: CadBinaryPart[];
  binaryRecords: CadBinaryRecord[];
  clients: number;
  lastBinaryAt: string;
  lastMessage: string;
  status: "connecting" | "open" | "closed" | "error";
  url: string;
};

/**
 * 连接 Electron 主进程启动的本地 WebSocket 服务。
 *
 * 流程：
 * 1. 通过 preload 获取 ws://127.0.0.1:49321
 * 2. 使用浏览器原生 WebSocket 连接
 * 3. 将服务端推送归约成 React 状态，供 3D overlay 展示
 */
export function useCadWebSocket() {
  const socketRef = useRef<WebSocket | undefined>(undefined);
  const [state, setState] = useState<CadWsState>({
    binaryParts: [],
    binaryRecords: [],
    clients: 0,
    lastBinaryAt: "--",
    lastMessage: "--",
    status: "connecting",
    url: ""
  });

  useEffect(() => {
    let socket: WebSocket | undefined;
    let disposed = false;

    // preload 只负责告诉渲染层地址，真正的长连接由浏览器 WebSocket 负责。
    window.desktopApi.getWsServer().then(({ url }) => {
      if (disposed) {
        return;
      }

      console.info("[CAD WS] 准备连接本地服务:", url);
      setState((current) => ({ ...current, status: "connecting", url }));
      socket = new WebSocket(url);
      socketRef.current = socket;
      socket.binaryType = "arraybuffer";

      socket.addEventListener("open", () => {
        console.info("[CAD WS] 连接已打开:", url);
        setState((current) => ({ ...current, status: "open" }));

        // 告诉服务端当前 renderer 已就绪，后续可扩展为订阅某个文档/装配体。
        socket?.send(
          JSON.stringify({
            type: "cad:renderer-ready",
            payload: {
              timestamp: new Date().toISOString()
            }
          })
        );
      });

      socket.addEventListener("message", (event) => {
        if (event.data instanceof ArrayBuffer) {
          const parts = parseBinaryParts(event.data);
          const record: CadBinaryRecord = {
            id: `binary-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            parts,
            receivedAt: new Date().toLocaleTimeString()
          };
          console.info("[CAD WS] 收到二进制模型数据:", record);
          setState((current) => ({
            ...current,
            binaryParts: [...current.binaryParts, ...parts],
            binaryRecords: [...current.binaryRecords, record],
            lastBinaryAt: record.receivedAt,
            lastMessage: "binary model"
          }));
          return;
        }

        const message = parseMessage(event.data);
        if (!message) {
          console.warn("[CAD WS] 收到非协议消息:", event.data);
          return;
        }

        console.debug("[CAD WS] 收到服务端消息:", message);
        setState((current) => reduceMessage(current, message));
      });

      socket.addEventListener("close", () => {
        console.info("[CAD WS] 连接已关闭");
        setState((current) => ({ ...current, status: "closed" }));
      });

      socket.addEventListener("error", () => {
        console.error("[CAD WS] 连接发生错误");
        setState((current) => ({ ...current, status: "error" }));
      });
    });

    return () => {
      // 组件卸载时关闭连接，防止热更新或页面切换后留下旧 socket。
      disposed = true;
      socket?.close();
      socketRef.current = undefined;
    };
  }, []);

  function requestBinaryModel() {
    if (state.status !== "open") {
      console.warn("[CAD WS] WS 未连接，无法请求二进制模型");
      return;
    }

    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.warn("[CAD WS] socket 不可用，无法请求二进制模型");
      return;
    }

    socket.send(
      JSON.stringify({
        type: "cad:request-binary-model",
        payload: {
          timestamp: new Date().toISOString()
        }
      })
    );
  }

  return { requestBinaryModel, state };
}

// 把不同消息类型折叠成 UI 需要的最小状态。
function reduceMessage(current: CadWsState, message: CadWsMessage): CadWsState {
  if (message.type === "cad:hello") {
    return {
      ...current,
      clients: message.payload.clients,
      lastMessage: "server hello",
      status: "open",
      url: message.payload.url
    };
  }

  return {
    ...current,
    lastMessage: "client command"
  };
}

// WS 传入的数据类型较宽，这里只接受 JSON 字符串协议。
function parseMessage(raw: unknown): CadWsMessage | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }

  try {
    return JSON.parse(raw) as CadWsMessage;
  } catch {
    return undefined;
  }
}

function parseBinaryParts(buffer: ArrayBuffer): CadBinaryPart[] {
  const values = new Float32Array(buffer);
  const stride = 9;
  const parts: CadBinaryPart[] = [];

  for (let offset = 0; offset + stride <= values.length; offset += stride) {
    parts.push({
      position: [values[offset], values[offset + 1], values[offset + 2]],
      scale: [values[offset + 3], values[offset + 4], values[offset + 5]],
      color: [values[offset + 6], values[offset + 7], values[offset + 8]]
    });
  }

  return parts;
}
