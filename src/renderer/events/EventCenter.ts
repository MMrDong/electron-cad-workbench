type EventCallback<TPayload = unknown> = (payload: TPayload) => void;

/**
 * 渲染进程内部事件中心。
 *
 * 它只负责 React 模块之间的轻量通信，不跨进程。
 * 跨进程通信继续走 preload 暴露的 desktopApi 或本地 WebSocket。
 */
class EventCenter {
  private events = new Map<string, Set<EventCallback>>();

  // 订阅事件，返回取消订阅函数，方便 useEffect 里直接清理。
  on<TPayload = unknown>(eventName: string, callback: EventCallback<TPayload>) {
    const listeners = this.events.get(eventName) ?? new Set<EventCallback>();
    listeners.add(callback as EventCallback);
    this.events.set(eventName, listeners);
    return () => this.off(eventName, callback);
  }

  // 不传 callback 时清空该事件的所有监听。
  off<TPayload = unknown>(eventName: string, callback?: EventCallback<TPayload>) {
    if (!callback) {
      this.events.delete(eventName);
      return;
    }

    this.events.get(eventName)?.delete(callback as EventCallback);
  }

  // 发布事件给当前渲染进程内的所有订阅者。
  emit<TPayload = unknown>(eventName: string, payload: TPayload) {
    this.events.get(eventName)?.forEach((callback) => callback(payload));
  }
}

export const eventCenter = new EventCenter();

// 暴露到 window 便于开发期调试，例如 window.eventCenter.emit(...)
if (typeof window !== "undefined") {
  Object.assign(window, { eventCenter });
}
