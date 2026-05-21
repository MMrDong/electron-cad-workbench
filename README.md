# Electron CAD Workbench

这是一个面向 CAD / Web3D 工业软件场景的 Electron 桌面端 Demo，使用 Electron、React、TypeScript、Vite、Tailwind CSS、Three.js 和本地 Node WebSocket 服务构建。

项目重点模拟一套 CAD 工作流：新建零件、新建装配、多文档标签页、沉浸式 3D 渲染、本地实时服务推送，以及 Electron 主进程和渲染进程之间的安全通信。

## 功能特性

- 类 Chrome 的多标签文档工作区
- 欢迎页支持新建零件和新建装配
- 基于 Three.js 的沉浸式 CAD 3D 视口
- 装配体预览，支持添加零件
- 零件预览，支持基础特征可视化
- 控件和状态信息以 overlay 形式显示在 3D 画布上
- Electron 主进程 / preload / renderer 分层
- 本地 WebSocket 服务：`ws://127.0.0.1:49321`
- IPC 支持导出、刷新、遥测数据、本地 WS 地址发现
- 开发环境支持 DevTools 调试
- 支持页面刷新快捷键和顶部刷新按钮

## 运行项目

```bash
npm install
npm run dev
```

`dev` 脚本会先启动 Vite，再启动 Electron。

```text
Vite: http://127.0.0.1:5173
WS:   ws://127.0.0.1:49321
```

## 常用命令

```bash
npm run dev        # 启动 Vite + Electron
npm run build      # 构建 Electron 主进程/preload 和 Vite 渲染进程
npm run typecheck  # 检查渲染进程和 Electron 代码类型
npm run preview    # 预览 Vite 生产构建
```

## 目录结构

```text
electron/
  main.ts              Electron 主进程和应用生命周期
  preload.ts           暴露给渲染进程的安全 IPC 桥
  wsServer.ts          本地 Node WebSocket 服务

src/
  main.tsx             React 渲染进程入口
  App.tsx              渲染进程编排层
  components/
    CadViewport.tsx    Three.js 场景、渲染循环和相机控制
    WelcomePage.tsx    启动欢迎页
  renderer/
    components/        应用外壳组件，例如 Header / Sider
    events/            渲染进程内部事件中心
    hooks/             tabs、telemetry、toast、WebSocket 等逻辑
    pages/             工作台和最近文档视图
  styles.css           Tailwind CSS 入口
  types.ts             preload 和 renderer 共享类型
```

## 渲染进程设计

渲染进程参考桌面 CAD 壳应用的组织方式：

- `App.tsx` 作为编排层，负责组合页面、tabs、toast、telemetry 和 WebSocket 状态。
- `useCadTabs` 负责多文档标签页的创建、激活、关闭和文档状态维护。
- `AppHeader` 负责顶部标签栏和窗口级操作。
- `AppSider` 负责无活动文档时的欢迎页、最近文档和新建入口。
- `WorkbenchView` 负责当前活动 CAD 文档的工作台视图。
- `CadViewport` 负责 Three.js 初始化、渲染循环、资源释放和相机控制。

当存在活动 CAD 文档时，页面会隐藏左侧侧栏，把主要工作区交给 3D 渲染画布。标题、操作按钮、WS 状态、性能指标和结构摘要都会以 overlay 形式显示在画布上。

## 本地 WebSocket

Electron 主进程启动后会创建本地 WebSocket 服务：

```text
ws://127.0.0.1:49321
```

渲染进程通过 preload 暴露的 `desktopApi.getWsServer()` 获取地址，再使用浏览器原生 `WebSocket` 连接。

当前 WS 消息包括：

- `cad:hello`：客户端连接成功后的握手消息
- `cad:scene-tick`：服务端定时推送的 CAD 场景状态
- `cad:client-command`：渲染进程发送命令后的广播消息

控制台中可以通过 `[CAD WS]` 前缀查看连接日志。

## 调试方式

开发环境下，DevTools 会在页面加载完成后自动打开。

快捷键：

- `F12`：打开或关闭 DevTools
- `Ctrl + Shift + I`：打开或关闭 DevTools
- `F5`：刷新渲染页面
- `Ctrl + R`：刷新渲染页面

也可以点击顶部的 `刷新` 按钮刷新当前渲染页面。

## 注意事项

- `dist/` 和 `dist-electron/` 是构建产物，已被 git 忽略。
- Three.js 已通过 Vite 拆成独立 chunk。生产构建时仍可能提示 chunk 较大，这是 3D 引擎依赖的正常体积表现。
- 如果控制台出现 WebGL context 相关警告，优先检查是否有重复创建 `WebGLRenderer` 或未释放 renderer 的情况。
