import { useEffect, useState } from "react";

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
      type: "cad:scene-tick";
      payload: {
        clients: number;
        constraints: number;
        revision: number;
        timestamp: string;
      };
    }
  | {
      type: "cad:client-command";
      payload: unknown;
    };

export type CadWsState = {
  clients: number;
  constraints: number;
  lastMessage: string;
  revision: number;
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
  const [state, setState] = useState<CadWsState>({
    clients: 0,
    constraints: 0,
    lastMessage: "--",
    revision: 0,
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
    };
  }, []);

  return state;
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

  if (message.type === "cad:scene-tick") {
    return {
      ...current,
      clients: message.payload.clients,
      constraints: message.payload.constraints,
      lastMessage: message.payload.timestamp,
      revision: message.payload.revision,
      status: "open"
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
