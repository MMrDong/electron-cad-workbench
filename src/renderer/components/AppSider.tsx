import type { CadDocumentKind } from "../../types";
import type { WorkspaceView } from "../types";

type AppSiderProps = {
  activeView: WorkspaceView;
  onCreateTab: (kind: CadDocumentKind) => void;
  onOpenRecent: () => void;
  onOpenWelcome: () => void;
};

export function AppSider({ activeView, onCreateTab, onOpenRecent, onOpenWelcome }: AppSiderProps) {
  return (
    <aside className="flex flex-col gap-7 border-r border-slate-700 bg-[#12171c] px-6 py-7">
      <div className="flex items-center gap-4">
        <div className="grid h-12 w-12 place-items-center border border-emerald-400/60 bg-emerald-950/40 text-2xl font-black text-emerald-300">
          D
        </div>
        <div>
          <h1 className="m-0 text-lg font-bold tracking-normal">CAD Workbench</h1>
          <p className="m-0 mt-1 text-sm text-slate-400">Electron 工业桌面端 Demo</p>
        </div>
      </div>

      <nav className="grid gap-2" aria-label="Workbench actions">
        <button className="nav-item" onClick={() => onCreateTab("part")} type="button">
          新建 零件设计
        </button>
        <button className="nav-item" onClick={() => onCreateTab("assembly")} type="button">
          新建 装配设计
        </button>
        <div className="my-1 h-px bg-slate-800" />
        <button className={`nav-item ${activeView === "welcome" ? "nav-item-active" : ""}`} onClick={onOpenWelcome} type="button">
          欢迎主页
        </button>
        <button className={`nav-item ${activeView === "recent" ? "nav-item-active" : ""}`} onClick={onOpenRecent} type="button">
          最近文档
        </button>
      </nav>

      <section className="mt-auto border border-slate-700 bg-slate-900/80 p-4">
        <span className="block text-xs font-bold uppercase text-emerald-300">Renderer Design</span>
        <strong className="mt-2 block">Pages / Hooks / Events</strong>
        <p className="m-0 mt-2 text-sm leading-6 text-slate-400">
          渲染进程按编排层、标签 Hook、事件中心和视图组件拆分。
        </p>
      </section>
    </aside>
  );
}
