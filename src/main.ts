import "./styles.css";

import type { TelemetryPayload, WorkbenchTask } from "./types";

type Point3D = {
  x: number;
  y: number;
  z: number;
};

type Point2D = {
  x: number;
  y: number;
};

type ModelPart = Point3D & {
  w: number;
  h: number;
  d: number;
  color: string;
};

const tasks: WorkbenchTask[] = [
  {
    id: "render",
    label: "渲染 SDK 升级",
    detail: "切换 LOD 策略并刷新模型缓存"
  },
  {
    id: "wasm",
    label: "WASM 高频计算",
    detail: "模拟几何求交与包围盒计算"
  },
  {
    id: "ipc",
    label: "C++ SDK 同步",
    detail: "通过 Electron IPC 触发本机任务"
  }
];

const state = {
  zoom: 1,
  rotation: 0.28,
  pitch: 0.74,
  dragging: false,
  lastX: 0,
  lastY: 0,
  telemetry: {} as Partial<TelemetryPayload>
};

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div class="grid min-h-screen grid-cols-[280px_minmax(0,1fr)] bg-[#101418] text-slate-100 max-[1120px]:grid-cols-[230px_minmax(0,1fr)]">
    <aside class="flex flex-col gap-7 border-r border-slate-700 bg-[#12171c] px-6 py-7">
      <div class="flex items-center gap-4">
        <div class="grid h-12 w-12 place-items-center border border-emerald-400/60 bg-emerald-950/40 text-2xl font-black text-emerald-300">D</div>
        <div>
          <h1 class="m-0 text-lg font-bold tracking-normal">CAD Workbench</h1>
          <p class="m-0 mt-1 text-sm text-slate-400">Electron 工业桌面端 Demo</p>
        </div>
      </div>

      <nav class="grid gap-2" aria-label="Workbench sections">
        <button class="nav-item nav-item-active" type="button">三维模型</button>
        <button class="nav-item" type="button">渲染任务</button>
        <button class="nav-item" type="button">SDK 联调</button>
        <button class="nav-item" type="button">WebOffice</button>
      </nav>

      <section class="mt-auto border border-slate-700 bg-slate-900/80 p-4">
        <span class="block text-xs font-bold uppercase text-emerald-300">Engineering Focus</span>
        <strong class="mt-2 block">Web3D / CAD / Electron</strong>
        <p class="m-0 mt-2 text-sm leading-6 text-slate-400">面向复杂工业软件的前端工程化、桌面化与实时交互能力展示。</p>
      </section>
    </aside>

    <main class="min-w-0 p-7">
      <header class="mb-6 flex items-center justify-between gap-5">
        <div>
          <span class="block text-xs font-bold uppercase text-emerald-300">国产 CAD 云桌面一体化</span>
          <h2 class="m-0 mt-2 text-[26px] font-bold tracking-normal">三维模型调度与实时渲染监控</h2>
        </div>
        <div class="flex items-center gap-2.5">
          <button class="h-11 w-11 border border-slate-700 bg-slate-800 text-2xl text-slate-100" id="zoomOut" type="button" title="缩小">−</button>
          <button class="h-11 w-11 border border-slate-700 bg-slate-800 text-2xl text-slate-100" id="zoomIn" type="button" title="放大">+</button>
          <button class="h-11 border border-emerald-400/60 bg-emerald-400 px-4 font-bold text-emerald-950" id="exportModel" type="button">导出报告</button>
        </div>
      </header>

      <section class="grid grid-cols-[minmax(0,1fr)_360px] gap-5 max-[1120px]:grid-cols-1">
        <section class="panel" aria-label="CAD viewport">
          <div class="flex items-center justify-between gap-4 border-b border-slate-700 px-5 py-4">
            <div>
              <span class="block text-xs font-bold uppercase text-emerald-300">Viewport</span>
              <strong>Assembly-A12 / LOD 自动分层</strong>
            </div>
            <div class="border border-blue-400/50 px-3 py-1.5 text-sm text-blue-300">WebSocket Live</div>
          </div>
          <canvas class="block h-[min(62vh,560px)] min-h-[430px] w-full cursor-grab bg-[#0d1115] active:cursor-grabbing" id="cadCanvas"></canvas>
          <div class="flex items-center justify-between gap-4 border-t border-slate-700 px-5 py-3 text-sm text-slate-400">
            <span>拖动画布旋转视角，滚轮缩放模型</span>
            <span id="zoomValue">100%</span>
          </div>
        </section>

        <aside class="grid content-start gap-4 max-[1120px]:grid-cols-2">
          <section class="grid grid-cols-2 gap-3 max-[1120px]:col-span-2">
            <div class="metric-card"><span class="block text-xs text-slate-400">FPS</span><strong class="mt-2 block text-2xl" id="fpsMetric">--</strong></div>
            <div class="metric-card"><span class="block text-xs text-slate-400">Triangles</span><strong class="mt-2 block text-2xl" id="triMetric">--</strong></div>
            <div class="metric-card"><span class="block text-xs text-slate-400">Latency</span><strong class="mt-2 block text-2xl" id="latencyMetric">--</strong></div>
            <div class="metric-card"><span class="block text-xs text-slate-400">WASM Load</span><strong class="mt-2 block text-2xl" id="wasmMetric">--</strong></div>
          </section>

          <section class="panel p-4">
            <div class="flex items-center justify-between gap-3">
              <span class="block text-xs font-bold uppercase text-emerald-300">Desktop Tasks</span>
              <strong>本机能力调度</strong>
            </div>
            <div class="mt-4 grid gap-2.5" id="taskList"></div>
          </section>

          <section class="panel p-4">
            <div class="flex items-center justify-between gap-3">
              <span class="block text-xs font-bold uppercase text-emerald-300">Pipeline</span>
              <strong>工程链路</strong>
            </div>
            <ol class="mt-4 grid gap-2.5 pl-5 text-sm text-slate-400">
              <li class="text-emerald-300">模型二进制分片加载</li>
              <li class="text-emerald-300">WASM 高频计算卸载</li>
              <li class="text-amber-300">Electron IPC 任务桥接</li>
              <li>桌面端批处理导出</li>
            </ol>
          </section>
        </aside>
      </section>
    </main>
  </div>

  <div class="pointer-events-none fixed bottom-6 right-6 max-w-[420px] translate-y-3 border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 opacity-0 transition" id="toast" role="status" aria-live="polite"></div>
`;

const canvas = document.querySelector<HTMLCanvasElement>("#cadCanvas")!;
const ctx = canvas.getContext("2d")!;
const zoomValue = document.querySelector<HTMLSpanElement>("#zoomValue")!;
const toast = document.querySelector<HTMLDivElement>("#toast")!;

const metrics = {
  fps: document.querySelector<HTMLElement>("#fpsMetric")!,
  triangles: document.querySelector<HTMLElement>("#triMetric")!,
  latency: document.querySelector<HTMLElement>("#latencyMetric")!,
  wasm: document.querySelector<HTMLElement>("#wasmMetric")!
};

let toastTimer = 0;

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(rect.width * ratio);
  canvas.height = Math.floor(rect.height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  drawScene();
}

function project(point: Point3D): Point2D {
  const cos = Math.cos(state.rotation);
  const sin = Math.sin(state.rotation);
  const x = point.x * cos - point.z * sin;
  const z = point.x * sin + point.z * cos;
  const scale = 46 * state.zoom;

  return {
    x: canvas.clientWidth / 2 + x * scale,
    y: canvas.clientHeight / 2 + (z * 0.42 - point.y * state.pitch) * scale
  };
}

function drawScene() {
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  drawGrid();
  drawAssembly();
  drawOverlay();
}

function drawGrid() {
  ctx.save();
  ctx.strokeStyle = "rgba(89, 111, 127, 0.22)";
  ctx.lineWidth = 1;

  for (let i = -8; i <= 8; i += 1) {
    drawLine({ x: -8, y: 0, z: i }, { x: 8, y: 0, z: i });
    drawLine({ x: i, y: 0, z: -8 }, { x: i, y: 0, z: 8 });
  }

  ctx.restore();
}

function drawAssembly() {
  const parts: ModelPart[] = [
    { x: -2.5, y: 0.4, z: -1.2, w: 4.8, h: 0.8, d: 2.4, color: "#46c2a6" },
    { x: 1.2, y: 1.2, z: -0.9, w: 2.2, h: 1.6, d: 1.7, color: "#6da8ff" },
    { x: -2.1, y: 1.25, z: 1.1, w: 1.6, h: 1.7, d: 1.5, color: "#f3b35a" },
    { x: 0.5, y: 2.1, z: 1.2, w: 3.4, h: 0.6, d: 1.2, color: "#ef6f6c" }
  ];

  parts
    .map((part) => ({ part, depth: part.x + part.z }))
    .sort((a, b) => a.depth - b.depth)
    .forEach(({ part }) => drawBox(part));
}

function drawBox(part: ModelPart) {
  const x0 = part.x;
  const x1 = part.x + part.w;
  const y0 = part.y;
  const y1 = part.y + part.h;
  const z0 = part.z;
  const z1 = part.z + part.d;

  const vertices = {
    a: project({ x: x0, y: y0, z: z0 }),
    b: project({ x: x1, y: y0, z: z0 }),
    c: project({ x: x1, y: y0, z: z1 }),
    d: project({ x: x0, y: y0, z: z1 }),
    e: project({ x: x0, y: y1, z: z0 }),
    f: project({ x: x1, y: y1, z: z0 }),
    g: project({ x: x1, y: y1, z: z1 }),
    h: project({ x: x0, y: y1, z: z1 })
  };

  drawFace([vertices.e, vertices.f, vertices.g, vertices.h], shade(part.color, 24));
  drawFace([vertices.b, vertices.c, vertices.g, vertices.f], shade(part.color, -8));
  drawFace([vertices.d, vertices.c, vertices.g, vertices.h], shade(part.color, -22));
  drawWire([vertices.a, vertices.b, vertices.c, vertices.d, vertices.a]);
  drawWire([vertices.e, vertices.f, vertices.g, vertices.h, vertices.e]);
  drawWire([vertices.a, vertices.e]);
  drawWire([vertices.b, vertices.f]);
  drawWire([vertices.c, vertices.g]);
  drawWire([vertices.d, vertices.h]);
}

function drawFace(points: Point2D[], color: string) {
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  });
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawWire(points: Point2D[]) {
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  });
  ctx.strokeStyle = "rgba(235, 246, 255, 0.62)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawLine(start: Point3D, end: Point3D) {
  const a = project(start);
  const b = project(end);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function drawOverlay() {
  ctx.save();
  ctx.fillStyle = "rgba(237, 243, 248, 0.72)";
  ctx.font = "13px Segoe UI, Microsoft YaHei, sans-serif";
  ctx.fillText("Assembly-A12 | LOD-2 | WebGL Preview Mock", 18, 28);
  ctx.fillStyle = "rgba(70, 194, 166, 0.78)";
  ctx.fillText(`Zoom ${Math.round(state.zoom * 100)}%`, 18, 50);
  ctx.restore();
}

function shade(hex: string, amount: number) {
  const raw = hex.replace("#", "");
  const num = Number.parseInt(raw, 16);
  const r = clamp((num >> 16) + amount);
  const g = clamp(((num >> 8) & 0xff) + amount);
  const b = clamp((num & 0xff) + amount);
  return `rgb(${r}, ${g}, ${b})`;
}

function clamp(value: number) {
  return Math.max(0, Math.min(255, value));
}

function setZoom(nextZoom: number) {
  state.zoom = Math.max(0.62, Math.min(1.8, nextZoom));
  zoomValue.textContent = `${Math.round(state.zoom * 100)}%`;
  drawScene();
}

function renderTasks() {
  const taskList = document.querySelector<HTMLDivElement>("#taskList")!;
  taskList.innerHTML = "";

  tasks.forEach((task) => {
    const row = document.createElement("div");
    row.className = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 border border-slate-700 bg-[#141a1f] p-3";
    row.innerHTML = `
      <div>
        <strong class="block">${task.label}</strong>
        <span class="mt-1 block text-xs text-slate-400">${task.detail}</span>
      </div>
      <button class="task-button" type="button" data-task="${task.id}">运行</button>
    `;
    taskList.appendChild(row);
  });
}

async function runTask(taskId: string, button: HTMLButtonElement) {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) {
    return;
  }

  button.disabled = true;
  button.textContent = "处理中";

  try {
    const result = await window.desktopApi.runTask(task);
    button.textContent = "完成";
    showToast(result.message);
  } catch (error) {
    button.textContent = "失败";
    showToast(error instanceof Error ? error.message : "Task failed");
  } finally {
    window.setTimeout(() => {
      button.disabled = false;
      button.textContent = "运行";
    }, 1000);
  }
}

function showToast(message: string) {
  toast.textContent = message;
  toast.classList.remove("opacity-0", "translate-y-3");
  toast.classList.add("opacity-100", "translate-y-0");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("opacity-100", "translate-y-0");
    toast.classList.add("opacity-0", "translate-y-3");
  }, 2600);
}

function bindEvents() {
  document.querySelector<HTMLButtonElement>("#zoomIn")!.addEventListener("click", () => setZoom(state.zoom + 0.12));
  document.querySelector<HTMLButtonElement>("#zoomOut")!.addEventListener("click", () => setZoom(state.zoom - 0.12));

  canvas.addEventListener("pointerdown", (event) => {
    state.dragging = true;
    state.lastX = event.clientX;
    state.lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!state.dragging) {
      return;
    }

    const dx = event.clientX - state.lastX;
    const dy = event.clientY - state.lastY;
    state.rotation += dx * 0.008;
    state.pitch = Math.max(0.45, Math.min(1.05, state.pitch + dy * 0.004));
    state.lastX = event.clientX;
    state.lastY = event.clientY;
    drawScene();
  });

  canvas.addEventListener("pointerup", (event) => {
    state.dragging = false;
    canvas.releasePointerCapture(event.pointerId);
  });

  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      setZoom(state.zoom + (event.deltaY > 0 ? -0.08 : 0.08));
    },
    { passive: false }
  );

  document.querySelector<HTMLDivElement>("#taskList")!.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-task]");
    if (button) {
      runTask(button.dataset.task ?? "", button);
    }
  });

  document.querySelector<HTMLButtonElement>("#exportModel")!.addEventListener("click", exportModel);
  window.addEventListener("resize", resizeCanvas);
}

async function exportModel() {
  const result = await window.desktopApi.exportModel({
    zoom: state.zoom,
    rotation: state.rotation,
    pitch: state.pitch,
    telemetry: state.telemetry,
    model: "Assembly-A12",
    features: ["LOD", "WASM", "WebSocket", "Electron IPC"]
  });

  if (result.canceled) {
    showToast("导出已取消");
    return;
  }

  showToast(`报告已导出：${result.filePath}`);
}

function bindTelemetry() {
  window.desktopApi.onTelemetry((payload) => {
    state.telemetry = payload;
    metrics.fps.textContent = `${payload.fps}`;
    metrics.triangles.textContent = `${(payload.triangles / 1000000).toFixed(2)}M`;
    metrics.latency.textContent = `${payload.latency}ms`;
    metrics.wasm.textContent = `${payload.wasmLoad}%`;
  });
}

async function boot() {
  renderTasks();
  bindEvents();
  bindTelemetry();
  resizeCanvas();

  const version = await window.desktopApi.getVersion();
  showToast(`Electron demo ready · v${version}`);
}

boot();
