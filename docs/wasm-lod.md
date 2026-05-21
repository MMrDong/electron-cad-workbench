# WASM LOD 开发与使用说明

本文档说明本项目中 WebAssembly 的开发流程、构建方式、JS 调用方式，以及它如何和 Three.js 渲染场景联动。

## 目标

当前 WASM 模块用于处理 CAD 场景中的 LOD 数据。

LOD 是 Level of Detail 的缩写，表示模型细节等级。本项目约定：

```ts
0 // high，高细节
1 // mid，中细节
2 // low，低细节
```

当模型数量变多，或者相机离模型更远时，系统会降低细节等级，减少边线、阴影等渲染开销。

## 文件结构

```text
src/wasm/lod.wat
  WASM 源码，使用 WAT 文本格式编写。

scripts/build-lod-wasm.mjs
  构建脚本，使用 wabt 把 .wat 编译成 .wasm。

public/wasm/lod.wasm
  构建产物，Vite 会作为静态资源提供给渲染进程。

src/renderer/hooks/useWasmLod.ts
  React Hook，负责加载 WASM、缓存导出函数、写入内存、调用计算、读回结果。

src/App.tsx
  根据相机距离和零件数量调用 WASM，得到当前 LOD 和渲染用零件数据。

src/components/CadViewport.tsx
  Three.js 场景，接收 WASM 处理后的数据并创建 mesh。
```

## 开发流程

### 1. 编写 WAT

WASM 源码位于：

```text
src/wasm/lod.wat
```

当前模块导出了三个核心能力：

```wat
(memory (export "memory") 1)
(func (export "selectLod") ...)
(func (export "layoutParts") ...)
```

含义分别是：

```text
memory
  WASM 线性内存。JS 会把 Float32Array 写进去，WASM 从这里读取和修改数据。

selectLod(distance, partCount)
  根据相机距离和零件数量返回 LOD 等级。

layoutParts(ptr, count, lod)
  从 memory 的 ptr 位置开始，批量处理 count 个零件的 position / scale。
```

### 2. 构建 WASM

运行：

```bash
npm run wasm:lod
```

脚本会执行：

```bash
node scripts/build-lod-wasm.mjs
```

构建结果输出到：

```text
public/wasm/lod.wasm
```

生产构建时也会自动执行：

```bash
npm run build
```

因为 `package.json` 里已经配置：

```json
{
  "build": "npm run wasm:lod && tsc -p tsconfig.electron.json && vite build"
}
```

## JS 如何加载 WASM

渲染进程在 `useWasmLod.ts` 中加载 WASM：

```ts
WebAssembly.instantiateStreaming(fetch("/wasm/lod.wasm"))
```

加载完成后会拿到：

```ts
instance.exports
```

然后把 WASM 导出的函数缓存到 React state 里：

```ts
setState({
  layoutParts: (parts, lod) => layoutPartsWithWasm(exports, parts, lod),
  ready: true,
  selectLod: exports.selectLod
});
```

因为 `useEffect` 的依赖数组是空数组：

```ts
useEffect(() => {
  // load wasm
}, []);
```

所以 `.wasm` 文件只会在 Hook 挂载时请求一次。后续每次计算 LOD 都复用同一个 WASM instance 和同一块 memory。

## JS 如何和 WASM 通信

WASM 不能直接读取 JS 对象，也不能直接操作 Three.js 的 mesh。两边主要通过数字和线性内存通信。

本项目的数据流是：

```text
CadBinaryPart[]
-> Float32Array
-> WebAssembly.Memory
-> WASM layoutParts
-> WebAssembly.Memory
-> CadBinaryPart[]
-> Three.js Mesh
```

每个零件被编码成 9 个 `f32`：

```text
position.x
position.y
position.z
scale.x
scale.y
scale.z
color.r
color.g
color.b
```

也就是：

```text
每个零件 9 个 f32
每个 f32 4 字节
每个零件 36 字节
```

JS 会先把零件数组压平：

```ts
const values = new Float32Array(parts.length * 9);
```

然后写入 WASM 内存：

```ts
new Float32Array(exports.memory.buffer, ptr, values.length).set(values);
```

再调用 WASM：

```ts
exports.layoutParts(ptr, parts.length, lod);
```

WASM 会在同一块 memory 里原地修改数据。JS 再读回：

```ts
const output = new Float32Array(exports.memory.buffer, ptr, values.length);
```

最后重新组装成 Three.js 能消费的对象：

```ts
{
  position: [x, y, z],
  scale: [x, y, z],
  color: [r, g, b]
}
```

## 和 Three.js 的联动方式

Three.js 不直接调用 WASM。调用关系由 React 编排：

```text
App.tsx
  调用 wasmLod.selectLod(...)
  调用 wasmLod.layoutParts(...)
  把处理后的 binaryParts 传给 WorkbenchView

WorkbenchView.tsx
  把 binaryParts 和 lodLevel 传给 CadViewport

CadViewport.tsx
  根据 binaryParts 创建 THREE.Mesh
  根据 lodLevel 控制边线、阴影等细节
```

例如：

```ts
const lodLevel = activeTab
  ? wasmLod.selectLod(10 / activeTab.view.zoom, wsState.binaryParts.length)
  : 0;

const renderBinaryParts = useMemo(
  () => wasmLod.layoutParts(wsState.binaryParts, lodLevel),
  [lodLevel, wasmLod, wsState.binaryParts]
);
```

其中：

```text
10 / activeTab.view.zoom
  近似表示相机距离。

wsState.binaryParts.length
  表示当前累计加载的二进制零件数量。
```

当不断点击“加载二进制模型”时，`binaryParts.length` 会增加，LOD 会重新计算，WASM 也会重新处理累计的零件数据。

## fallback 机制

`useWasmLod.ts` 里有 JS fallback：

```ts
fallbackSelectLod
fallbackLayoutParts
```

作用是：

```text
WASM 还没加载完成时，页面可以先运行。
WASM 加载失败时，功能不会直接崩溃。
```

fallback 的规则需要和 `src/wasm/lod.wat` 保持一致，否则 WASM 成功与失败时表现会不一样。

## 修改 WASM 后要做什么

如果修改了：

```text
src/wasm/lod.wat
```

需要重新生成：

```bash
npm run wasm:lod
```

然后验证：

```bash
npm run typecheck
npm run build
```

如果正在运行开发环境，建议刷新页面或重启：

```bash
npm run dev
```

## 实际项目中的建议

当前 demo 用 WAT 手写 WASM，适合学习内存布局和调用流程。实际工程里如果逻辑更复杂，可以考虑：

- 使用 Rust / C++ 编写核心算法，再编译成 WASM。
- 把 WASM 放到 Web Worker 中，避免大量计算阻塞 UI。
- 使用更稳定的数据协议，例如固定 stride 的 TypedArray 或共享内存池。
- 让 WASM 输出更直接的渲染数据，例如 instance transform matrix、可见性标记、LOD bucket。
- 对大型模型做分块计算，不要每次都处理全量模型。

在 CAD / Web3D 场景中，WASM 更适合处理大量数字计算，例如：

- LOD 选择
- 包围盒计算
- 空间索引
- 碰撞检测
- 几何简化
- 曲面采样
- 大批量 transform

而材质、灯光、相机、mesh 生命周期这些仍然交给 Three.js 管理。
