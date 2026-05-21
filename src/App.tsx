import { useEffect, useMemo, useState } from "react";

import { WelcomePage } from "./components/WelcomePage";
import { AppHeader } from "./renderer/components/AppHeader";
import { AppSider } from "./renderer/components/AppSider";
import { eventCenter } from "./renderer/events/EventCenter";
import { useCadWebSocket } from "./renderer/hooks/useCadWebSocket";
import { useCadTabs } from "./renderer/hooks/useCadTabs";
import { useTelemetry } from "./renderer/hooks/useTelemetry";
import { useToast } from "./renderer/hooks/useToast";
import { RecentView } from "./renderer/pages/RecentView";
import { WorkbenchView } from "./renderer/pages/WorkbenchView";
import type { WorkspaceView } from "./renderer/types";
import type { CadDocumentKind } from "./types";

export function App() {
  const [activeView, setActiveView] = useState<WorkspaceView>("welcome");
  const telemetry = useTelemetry();
  const { requestBinaryModel, state: wsState } = useCadWebSocket();
  const { toast, setToast } = useToast();
  const {
    activeTab,
    activateTab,
    addAssemblyPart,
    clearActiveTab,
    closeTab,
    createTab,
    hasActiveTab,
    tabs,
    updateActiveView,
    updateActiveZoom
  } = useCadTabs();

  const metrics = useMemo(
    () => [
      { label: "FPS", value: telemetry.fps ?? "--" },
      {
        label: "Triangles",
        value: telemetry.triangles ? `${(telemetry.triangles / 1000000).toFixed(2)}M` : "--"
      },
      { label: "Latency", value: telemetry.latency ? `${telemetry.latency}ms` : "--" },
      { label: "WASM Load", value: telemetry.wasmLoad ? `${telemetry.wasmLoad}%` : "--" }
    ],
    [telemetry]
  );

  useEffect(() => {
    window.desktopApi.getVersion().then((version) => {
      setToast(`Electron demo ready · v${version}`);
    });

    const offCreated = eventCenter.on("tabs:created", () => setActiveView("welcome"));
    return () => offCreated();
  }, [setToast]);

  function createDocument(kind: CadDocumentKind) {
    createTab(kind);
    setActiveView("welcome");
    setToast(kind === "assembly" ? "已新建装配文档" : "已新建零件文档");
  }

  async function exportModel() {
    if (!activeTab) {
      setToast("没有活动文档可以导出");
      return;
    }

    const result = await window.desktopApi.exportModel({
      zoom: activeTab.view.zoom,
      rotation: activeTab.view.rotation,
      pitch: activeTab.view.pitch,
      telemetry,
      model: activeTab.kind === "assembly" ? "Assembly-A12" : "Part-P01",
      features: ["LOD", "WASM", "WebSocket", "Electron IPC"]
    });

    setToast(result.canceled ? "导出已取消" : `报告已导出：${result.filePath}`);
  }

  function renderMainView() {
    if (hasActiveTab && activeTab) {
      return (
        <WorkbenchView
          activeTab={activeTab}
          metrics={metrics}
          onAddAssemblyPart={() => {
            addAssemblyPart();
            setToast("已添加一个装配零件");
          }}
          onUpdateView={updateActiveView}
          onZoom={updateActiveZoom}
          onRequestBinaryModel={requestBinaryModel}
          wsState={wsState}
        />
      );
    }

    if (activeView === "recent") {
      return <RecentView onOpenAssembly={() => createDocument("assembly")} onOpenPart={() => createDocument("part")} />;
    }

    return <WelcomePage onCreate={createDocument} />;
  }

  return (
    <>
      <div
        className={`grid min-h-screen bg-[#101418] text-slate-100 ${
          activeTab ? "grid-cols-1" : "grid-cols-[280px_minmax(0,1fr)] max-[1120px]:grid-cols-[230px_minmax(0,1fr)]"
        }`}
      >
        {activeTab ? null : (
          <AppSider
            activeView={activeView}
            onCreateTab={createDocument}
            onOpenRecent={() => {
              clearActiveTab();
              setActiveView("recent");
            }}
            onOpenWelcome={() => {
              clearActiveTab();
              setActiveView("welcome");
            }}
          />
        )}

        <main className="min-w-0 p-0">
          <AppHeader
            activeTab={activeTab}
            onActivateTab={activateTab}
            onCloseTab={closeTab}
            onCreateTab={createDocument}
            onExportModel={exportModel}
            onGoHome={() => {
              clearActiveTab();
              setActiveView("welcome");
            }}
            onReload={() => {
              window.desktopApi.reloadWindow();
            }}
            tabs={tabs}
          />
          {renderMainView()}
        </main>
      </div>

      <div
        className={`pointer-events-none fixed bottom-6 right-6 max-w-[420px] border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 transition ${
          toast ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
        }`}
        role="status"
        aria-live="polite"
      >
        {toast}
      </div>
    </>
  );
}
