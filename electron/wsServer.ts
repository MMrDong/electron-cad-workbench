import { WebSocketServer, WebSocket } from "ws";

/**
 * 本地 CAD WebSocket 服务状态。
 * 目前固定监听 127.0.0.1，避免对局域网暴露调试端口。
 */
export type WsServerState = {
  port: number;
  url: string;
};

/**
 * 主进程和渲染进程之间的 WS 消息协议。
 * 后续如果接入真实 CAD 内核，可以在这里继续扩展模型变更、约束求解、装配更新等消息。
 */
type CadWsMessage =
  | {
      type: "cad:hello";
      payload: WsServerState & {
        clients: number;
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

const WS_PORT = 49321;

let server: WebSocketServer | undefined;
let tickTimer: NodeJS.Timeout | undefined;
let revision = 1;

/**
 * 启动本地 WebSocket 服务。
 *
 * 设计成幂等方法：如果服务已经存在，直接返回当前服务地址，避免 Electron activate 时重复监听端口。
 */
export function startWsServer(): WsServerState {
  if (server) {
    return getWsServerState();
  }

  server = new WebSocketServer({
    host: "127.0.0.1",
    port: WS_PORT
  });

  // 新客户端连接后先发送 hello，方便渲染层立刻知道端口和当前连接数。
  server.on("connection", (socket) => {
    send(socket, {
      type: "cad:hello",
      payload: {
        ...getWsServerState(),
        clients: getClientCount()
      }
    });

    // 当前 demo 会把客户端命令广播出去，模拟多端协同/命令回放通道。
    socket.on("message", (raw) => {
      broadcast({
        type: "cad:client-command",
        payload: parseMessage(raw.toString())
      });
    });
  });

  // 模拟 CAD 服务端状态推送：revision 类似模型版本号，constraints 类似约束求解数量。
  tickTimer = setInterval(() => {
    revision += 1;
    broadcast({
      type: "cad:scene-tick",
      payload: {
        clients: getClientCount(),
        constraints: 12 + (revision % 6),
        revision,
        timestamp: new Date().toLocaleTimeString()
      }
    });
  }, 1500);

  return getWsServerState();
}

/**
 * 停止 WS 服务并关闭全部连接。
 * Electron 退出前调用，避免端口占用残留。
 */
export function stopWsServer() {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = undefined;
  }

  server?.clients.forEach((client) => client.close());
  server?.close();
  server = undefined;
}

// 给 preload/主进程其它模块读取，不直接把 server 实例暴露出去。
export function getWsServerState(): WsServerState {
  return {
    port: WS_PORT,
    url: `ws://127.0.0.1:${WS_PORT}`
  };
}

// 向所有在线客户端广播消息。
function broadcast(message: CadWsMessage) {
  server?.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      send(client, message);
    }
  });
}

// 统一 JSON 序列化出口，便于后续加日志或协议校验。
function send(socket: WebSocket, message: CadWsMessage) {
  socket.send(JSON.stringify(message));
}

function getClientCount() {
  return server?.clients.size ?? 0;
}

// 客户端消息可能不是 JSON，解析失败时保留原始字符串，方便调试。
function parseMessage(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
