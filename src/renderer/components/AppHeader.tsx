import type { CadDocumentKind } from "../../types";
import type { CadTab } from "../types";

type AppHeaderProps = {
  activeTab: CadTab | null;
  tabs: CadTab[];
  onActivateTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onCreateTab: (kind: CadDocumentKind) => void;
  onGoHome: () => void;
  onExportModel: () => void;
  onReload: () => void;
};

export function AppHeader({
  activeTab,
  tabs,
  onActivateTab,
  onCloseTab,
  onCreateTab,
  onGoHome,
  onExportModel,
  onReload
}: AppHeaderProps) {
  return (
    <section className="flex h-12 items-end gap-1 border-b border-slate-800 bg-[#0d1115] px-3 pt-2">
      <button
        className={`mb-0 h-10 border px-3 text-sm ${
          activeTab ? "border-slate-800 bg-slate-900 text-slate-400" : "border-slate-700 bg-[#101418] text-slate-100"
        }`}
        onClick={onGoHome}
        type="button"
      >
        主页
      </button>

      {tabs.map((tab) => (
        <button
          className={`flex h-10 min-w-0 max-w-56 items-center gap-2 border px-3 text-left text-sm transition ${
            tab.id === activeTab?.id
              ? "border-slate-700 border-b-[#101418] bg-[#101418] text-slate-100"
              : "border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800"
          }`}
          key={tab.id}
          onClick={() => onActivateTab(tab.id)}
          type="button"
        >
          <span className={`h-2 w-2 shrink-0 ${tab.kind === "assembly" ? "bg-emerald-300" : "bg-blue-300"}`} />
          <span className="truncate">{tab.title}</span>
          <span
            className="ml-auto grid h-5 w-5 shrink-0 place-items-center text-slate-500 hover:bg-slate-700 hover:text-slate-100"
            onClick={(event) => {
              event.stopPropagation();
              onCloseTab(tab.id);
            }}
            role="button"
            tabIndex={0}
            aria-label={`关闭 ${tab.title}`}
          >
            x
          </span>
        </button>
      ))}

      <button
        className="mb-0 grid h-10 w-10 place-items-center border border-slate-800 bg-slate-900 text-xl text-slate-300 hover:bg-slate-800"
        onClick={() => onCreateTab("assembly")}
        title="新建装配"
        type="button"
      >
        +
      </button>

      <div className="ml-auto flex h-10 items-center gap-2">
        <button className="h-9 border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200" onClick={() => onCreateTab("part")} type="button">
          新建零件
        </button>
        <button className="h-9 border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200" onClick={onReload} type="button">
          刷新
        </button>
        <button className="h-9 border border-emerald-400/60 bg-emerald-400 px-3 text-sm font-bold text-emerald-950" onClick={onExportModel} type="button">
          导出
        </button>
      </div>
    </section>
  );
}
