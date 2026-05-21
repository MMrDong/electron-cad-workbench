import { useMemo, useState } from "react";

import type { CadDocumentKind } from "../../types";
import { eventCenter } from "../events/EventCenter";
import type { CadTab, ViewState } from "../types";
import { initialView } from "../types";

function createId(kind: CadDocumentKind) {
  return `${kind}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useCadTabs() {
  const [tabs, setTabs] = useState<CadTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const activeTab = useMemo(() => tabs.find((tab) => tab.id === activeTabId) ?? null, [activeTabId, tabs]);
  const hasActiveTab = Boolean(activeTab);

  function createTab(kind: CadDocumentKind) {
    const sameKindCount = tabs.filter((tab) => tab.kind === kind).length + 1;
    const tab: CadTab = {
      id: createId(kind),
      kind,
      lastActivated: Date.now(),
      partCount: kind === "assembly" ? 4 : 1,
      title: kind === "assembly" ? `装配 ${sameKindCount}` : `零件 ${sameKindCount}`,
      view: initialView
    };

    setTabs((current) => [...current, tab]);
    setActiveTabId(tab.id);
    eventCenter.emit("tabs:created", tab);
    return tab;
  }

  function activateTab(tabId: string) {
    setActiveTabId(tabId);
    setTabs((current) =>
      current.map((tab) => (tab.id === tabId ? { ...tab, lastActivated: Date.now() } : tab))
    );
    eventCenter.emit("tabs:activated", tabId);
  }

  function closeTab(tabId: string) {
    setTabs((current) => {
      const index = current.findIndex((tab) => tab.id === tabId);
      const next = current.filter((tab) => tab.id !== tabId);

      if (tabId === activeTabId) {
        const fallback = next[index - 1] ?? next[index] ?? null;
        setActiveTabId(fallback?.id ?? null);
      }

      eventCenter.emit("tabs:closed", tabId);
      return next;
    });
  }

  function clearActiveTab() {
    setActiveTabId(null);
    eventCenter.emit("tabs:cleared-active", null);
  }

  function updateActiveTab(updater: (tab: CadTab) => CadTab) {
    if (!activeTabId) {
      return;
    }

    setTabs((current) => current.map((tab) => (tab.id === activeTabId ? updater(tab) : tab)));
  }

  function updateActiveView(view: ViewState | ((current: ViewState) => ViewState)) {
    updateActiveTab((tab) => ({
      ...tab,
      view: typeof view === "function" ? view(tab.view) : view
    }));
  }

  function updateActiveZoom(delta: number) {
    updateActiveView((current) => ({
      ...current,
      zoom: Math.max(0.62, Math.min(1.8, current.zoom + delta))
    }));
  }

  function addAssemblyPart() {
    updateActiveTab((tab) => ({
      ...tab,
      partCount: Math.min(tab.partCount + 1, 9)
    }));
  }

  function getVisibleTabs() {
    return [...tabs].sort((a, b) => b.lastActivated - a.lastActivated).slice(0, 7);
  }

  function getHiddenTabs() {
    if (tabs.length <= 7) {
      return [];
    }

    const visibleIds = new Set(getVisibleTabs().map((tab) => tab.id));
    return tabs.filter((tab) => !visibleIds.has(tab.id));
  }

  return {
    activeTab,
    activateTab,
    addAssemblyPart,
    clearActiveTab,
    closeTab,
    createTab,
    getHiddenTabs,
    getVisibleTabs,
    hasActiveTab,
    tabs,
    updateActiveView,
    updateActiveZoom
  };
}
