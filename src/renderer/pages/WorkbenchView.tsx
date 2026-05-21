import { CadViewport } from "../../components/CadViewport";
import type { CadBinaryPart } from "../../types";
import type { CadWsState } from "../hooks/useCadWebSocket";
import type { LodLevel } from "../hooks/useWasmLod";
import type { CadTab, ViewState } from "../types";

type WorkbenchViewProps = {
  activeTab: CadTab;
  binaryParts: CadBinaryPart[];
  lodLevel: LodLevel;
  lodReady: boolean;
  metrics: Array<{ label: string; value: string | number }>;
  onAddAssemblyPart: () => void;
  onRequestBinaryModel: () => void;
  onUpdateView: (view: ViewState | ((current: ViewState) => ViewState)) => void;
  onZoom: (delta: number) => void;
  wsState: CadWsState;
};

export function WorkbenchView({
  activeTab,
  binaryParts,
  lodLevel,
  lodReady,
  metrics,
  onAddAssemblyPart,
  onRequestBinaryModel,
  onUpdateView,
  onZoom,
  wsState
}: WorkbenchViewProps) {
  const sceneMetrics = metrics.filter((metric) => metric.label === "FPS" || metric.label === "Latency");

  return (
    <CadViewport
      binaryParts={binaryParts}
      documentKind={activeTab.kind}
      lodLevel={lodLevel}
      onViewChange={onUpdateView}
      partCount={activeTab.partCount}
      view={activeTab.view}
    >
      <div className="absolute left-5 top-5 max-w-[360px] border border-slate-700/80 bg-[#101418]/80 px-4 py-3 shadow-2xl backdrop-blur">
        <span className="block text-xs font-bold uppercase text-emerald-300">
          {activeTab.kind === "assembly" ? "Assembly Design" : "Part Modeling"}
        </span>
        <h2 className="m-0 mt-1 text-xl font-bold tracking-normal">
          {activeTab.kind === "assembly" ? "装配体设计" : "零件建模"}
        </h2>
        <p className="m-0 mt-1 text-xs text-slate-400">
          {activeTab.kind === "assembly" ? `${activeTab.partCount} parts / constrained preview` : "single part / feature preview"}
        </p>
      </div>

      <div className="pointer-events-auto absolute right-5 top-5 flex items-center gap-2">
        {activeTab.kind === "assembly" ? (
          <button
            className="h-10 border border-blue-400/60 bg-blue-400/95 px-4 text-sm font-bold text-blue-950 shadow-xl backdrop-blur"
            onClick={onAddAssemblyPart}
            type="button"
          >
            添加零件
          </button>
        ) : null}
        <button
          className="h-10 border border-emerald-400/60 bg-emerald-400/95 px-4 text-sm font-bold text-emerald-950 shadow-xl backdrop-blur"
          onClick={onRequestBinaryModel}
          type="button"
        >
          加载二进制模型
        </button>
        <button
          className="h-10 w-10 border border-slate-700 bg-[#101418]/85 text-xl text-slate-100 shadow-xl backdrop-blur"
          onClick={() => onZoom(-0.12)}
          title="缩小"
          type="button"
        >
          -
        </button>
        <button
          className="h-10 w-10 border border-slate-700 bg-[#101418]/85 text-xl text-slate-100 shadow-xl backdrop-blur"
          onClick={() => onZoom(0.12)}
          title="放大"
          type="button"
        >
          +
        </button>
      </div>

      <div className="absolute bottom-5 left-5 grid grid-cols-2 gap-2">
        {sceneMetrics.map((metric) => (
          <div className="border border-slate-700/80 bg-[#101418]/80 px-3 py-2 shadow-xl backdrop-blur" key={metric.label}>
            <span className="block text-xs text-slate-400">{metric.label}</span>
            <strong className="mt-1 block text-lg">{metric.value}</strong>
          </div>
        ))}
      </div>

      <div className="absolute left-5 top-32 w-[220px] border border-slate-700/80 bg-[#101418]/80 px-3 py-2 text-xs shadow-xl backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold uppercase text-emerald-300">Local WS</span>
          <span className={wsState.status === "open" ? "text-emerald-300" : "text-amber-300"}>{wsState.status}</span>
        </div>
        <div className="mt-2 grid gap-1 text-slate-400">
          <span>clients: {wsState.clients}</span>
          <span>batches: {wsState.binaryRecords.length}</span>
          <span>parts: {wsState.binaryParts.length}</span>
          <span>last: {wsState.lastBinaryAt}</span>
          <span>lod: {getLodLabel(lodLevel)} {lodReady ? "wasm" : "js"}</span>
          <span>render: wasm layout + three mesh</span>
        </div>
      </div>

      <StructureOverlay activeTab={activeTab} />

      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 border border-slate-700/70 bg-[#101418]/70 px-3 py-2 text-xs text-slate-400 shadow-xl backdrop-blur">
        拖拽旋转视角 / 滚轮缩放 / 右键平移 / Zoom {Math.round(activeTab.view.zoom * 100)}%
      </div>
    </CadViewport>
  );
}

function getLodLabel(level: LodLevel) {
  if (level === 0) {
    return "high";
  }

  if (level === 1) {
    return "mid";
  }

  return "low";
}

function StructureOverlay({ activeTab }: { activeTab: CadTab }) {
  return (
    <section className="absolute bottom-5 right-5 w-56 border border-slate-700/80 bg-[#101418]/80 p-3 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <span className="block text-xs font-bold uppercase text-emerald-300">
          {activeTab.kind === "assembly" ? "Assembly" : "Features"}
        </span>
        <strong>{activeTab.kind === "assembly" ? `${activeTab.partCount} 个零件` : "单零件"}</strong>
      </div>
      <div className="mt-3 grid gap-2">
        {activeTab.kind === "assembly"
          ? Array.from({ length: Math.min(activeTab.partCount, 5) }, (_, index) => (
              <div className="border border-slate-700 bg-[#141a1f] px-2.5 py-2" key={index}>
                <strong className="block text-sm">Part-{String(index + 1).padStart(2, "0")}</strong>
              </div>
            ))
          : ["Base Extrude", "Chamfer Edge", "Axis"].map((feature) => (
              <div className="border border-slate-700 bg-[#141a1f] px-2.5 py-2" key={feature}>
                <strong className="block text-sm">{feature}</strong>
              </div>
            ))}
        {activeTab.kind === "assembly" && activeTab.partCount > 5 ? (
          <span className="text-xs text-slate-500">+ {activeTab.partCount - 5} more</span>
        ) : null}
      </div>
    </section>
  );
}
