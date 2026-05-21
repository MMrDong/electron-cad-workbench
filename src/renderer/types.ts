import type { CadDocumentKind } from "../types";

export type ViewState = {
  zoom: number;
  rotation: number;
  pitch: number;
};

export type CadTab = {
  id: string;
  kind: CadDocumentKind;
  lastActivated: number;
  partCount: number;
  title: string;
  view: ViewState;
};

export type WorkspaceView = "welcome" | "recent";

export const initialView: ViewState = {
  zoom: 1,
  rotation: 0.28,
  pitch: 0.74
};
