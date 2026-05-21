import { useEffect, useState } from "react";
import type { CadBinaryPart } from "../../types";

// LOD 细节等级：
// 0 = high，高细节；1 = mid，中细节；2 = low，低细节。
export type LodLevel = 0 | 1 | 2;

// lod.wasm 暴露给 JS 的方法和内存。
type LodExports = {
  layoutParts: (ptr: number, count: number, lod: LodLevel) => void;
  memory: WebAssembly.Memory;
  selectLod: (distance: number, partCount: number) => LodLevel;
};

// React 层对外暴露的 WASM LOD 能力。
export type WasmLodState = {
  layoutParts: (parts: CadBinaryPart[], lod: LodLevel) => CadBinaryPart[];
  ready: boolean;
  selectLod: (distance: number, partCount: number) => LodLevel;
};

// WASM 未加载完成或加载失败时使用的 JS 备用算法。
// 规则需要和 src/wasm/lod.wat 里的 selectLod 保持一致。
const fallbackSelectLod: LodExports["selectLod"] = (distance, partCount) => {
  // 零件很多且相机较远时，直接切低细节，减少边线、阴影等渲染成本。
  if (partCount > 18 && distance > 8) {
    return 2;
  }

  // 相机很近时使用高细节，保证近距离查看模型时细节完整。
  if (distance < 7) {
    return 0;
  }

  // 中远距离按阈值切到 mid / low。
  return distance < 11 ? 1 : 2;
};

// JS fallback 版本的布局处理，保证 WASM 不可用时 Three.js 仍能拿到同形状的数据。
const fallbackLayoutParts: WasmLodState["layoutParts"] = (parts, lod) =>
  parts.map((part) => transformPartByLod(part, lod));

export function useWasmLod(): WasmLodState {
  // 初始先使用 JS fallback；等 lod.wasm 加载完成后再替换成 WASM 导出的函数。
  const [state, setState] = useState<WasmLodState>({
    layoutParts: fallbackLayoutParts,
    ready: false,
    selectLod: fallbackSelectLod
  });

  useEffect(() => {
    let disposed = false;

    // Electron/Vite 会从 public/wasm/lod.wasm 提供这个文件。
    // instantiateStreaming 会边下载边编译，比先 arrayBuffer 再 instantiate 更直接。
    WebAssembly.instantiateStreaming(fetch("/wasm/lod.wasm"))
      .then(({ instance }) => {
        if (disposed) {
          return;
        }

        const exports = instance.exports as unknown as LodExports;
        setState({
          // layoutParts 需要在 JS 里负责数据打包和读回，WASM 只处理连续内存中的数字。
          layoutParts: (parts, lod) => layoutPartsWithWasm(exports, parts, lod),
          ready: true,
          selectLod: exports.selectLod
        });
        console.info("[WASM LOD] lod.wasm 已加载");
      })
      .catch((error) => {
        console.warn("[WASM LOD] lod.wasm 加载失败，使用 JS fallback", error);
      });

    return () => {
      // 组件卸载后忽略异步加载结果，避免 setState 打到已卸载组件。
      disposed = true;
    };
  }, []);

  return state;
}

function layoutPartsWithWasm(exports: LodExports, parts: CadBinaryPart[], lod: LodLevel): CadBinaryPart[] {
  if (parts.length === 0) {
    return [];
  }

  const stride = 9;
  const ptr = 0;
  const values = new Float32Array(parts.length * stride);

  // 每个零件占 9 个 f32：
  // position(x,y,z), scale(x,y,z), color(r,g,b)。
  // Three.js 的对象数据先压平成连续 f32 数组，再交给 WASM 做批量计算。
  parts.forEach((part, index) => {
    const offset = index * stride;
    values.set(part.position, offset);
    values.set(part.scale, offset + 3);
    values.set(part.color, offset + 6);
  });

  // 确保 WASM 线性内存足够容纳本次批量数据。
  ensureMemory(exports.memory, values.byteLength);

  // 把 JS 的 Float32Array 写入 WASM memory，从 ptr=0 开始复用同一块内存。
  new Float32Array(exports.memory.buffer, ptr, values.length).set(values);

  // WASM 在自己的线性内存里原地改写 position / scale，避免逐字段跨边界调用。
  exports.layoutParts(ptr, parts.length, lod);

  // 读回 WASM 计算后的渲染数据，返回给 Three.js 创建 mesh。
  const output = new Float32Array(exports.memory.buffer, ptr, values.length);
  return parts.map((_, index) => {
    const offset = index * stride;
    return {
      position: [output[offset], output[offset + 1], output[offset + 2]],
      scale: [output[offset + 3], output[offset + 4], output[offset + 5]],
      color: [output[offset + 6], output[offset + 7], output[offset + 8]]
    };
  });
}

function ensureMemory(memory: WebAssembly.Memory, requiredBytes: number) {
  // WebAssembly.Memory 按 64KB page 增长；够用就不 grow，避免无意义扩容。
  if (memory.buffer.byteLength >= requiredBytes) {
    return;
  }

  const pageSize = 64 * 1024;
  const missingPages = Math.ceil((requiredBytes - memory.buffer.byteLength) / pageSize);
  memory.grow(missingPages);
}

function transformPartByLod(part: CadBinaryPart, lod: LodLevel): CadBinaryPart {
  // 和 WASM layoutParts 保持一致：低细节时拉开间距并缩小零件，减少视觉拥挤。
  const spread = lod === 0 ? 1 : lod === 1 ? 1.15 : 1.35;
  const scaleFactor = lod === 0 ? 1 : lod === 1 ? 0.9 : 0.72;

  return {
    position: [part.position[0] * spread, part.position[1], part.position[2] * spread],
    scale: [part.scale[0] * scaleFactor, part.scale[1] * scaleFactor, part.scale[2] * scaleFactor],
    color: [...part.color]
  };
}
