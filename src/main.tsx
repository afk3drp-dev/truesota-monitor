import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Suppress default Chromium/WebView2 right-click context menu & browser shortcuts
window.addEventListener(
  "contextmenu",
  (e) => {
    e.preventDefault();
  },
  { capture: true },
);

window.addEventListener(
  "keydown",
  (e) => {
    const ctrl = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (
      e.key === "F5" ||
      (ctrl && (key === "p" || key === "s" || key === "r" || key === "u"))
    ) {
      e.preventDefault();
    }
  },
  { capture: true },
);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
