import React from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import "./styles.css";

createRoot(document.querySelector<HTMLDivElement>("#app")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
