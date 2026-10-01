import "./styles.css";
import { loadState, saveState, createCanvas, duplicateCanvas } from "./store.js";
import { el, toast } from "./utils.js";
import { iconHtml } from "./icons.js";
import { mountEditor } from "./editor.js";
import { openCanvasModal } from "./canvasModal.js";
import { openPreview } from "./preview.js";

const app = document.getElementById("app");
let state = loadState();

function formatWhen(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function createNewCanvas() {
  openCanvasModal({
    onSave: (values) => {
      const canvas = createCanvas(values);
      state.canvases.unshift(canvas);
      saveState(state);
      openEditor(canvas.id);
    },
  });
}

function editCanvas(canvas) {
  openCanvasModal({
    canvas,
    onSave: (values) => {
      Object.assign(canvas, values, { updatedAt: Date.now() });
      saveState(state);
      renderHome();
      toast("Canvas details saved.", "success");
    },
  });
}

function renderHome() {
  app.innerHTML = "";
  const home = el("div", { class: "home" });
  const wrap = el("div", { class: "home-wrap" });
  wrap.append(
    el("div", { class: "home-hero" }, [
      el("div", {}, [
        el("div", { class: "home-kicker" }, "Screen Simulation POC"),
        el("h1", {}, "Canvas Studio"),
        el("p", {}, "Create canvases, overlay simulation layers on screenshots, then preview the learner path. Built with GrapesJS."),
      ]),
      el("div", { class: "home-hero-actions" }, [
        el("a", { class: "btn ghost", href: "/agent.html" }, "Open agent side"),
        el("button", { class: "btn primary", type: "button", onclick: createNewCanvas }, [
          el("span", { html: iconHtml("plus") }),
          "New canvas",
        ]),
      ]),
    ])
  );

  const tableWrap = el("div", { class: "table-wrap" });
  const table = el("table", { class: "canvas-table" });
  table.append(
    el("thead", {}, [
      el("tr", {}, [
        el("th", {}, "Canvas"),
        el("th", {}, "Description"),
        el("th", {}, "Theme"),
        el("th", {}, "Screens"),
        el("th", {}, "Last updated"),
        el("th", { class: "col-actions" }, "Actions"),
      ]),
    ])
  );

  const tbody = el("tbody");
  if (!state.canvases.length) {
    tbody.append(
      el("tr", {}, [
        el("td", { class: "table-empty", colspan: "6" }, [
          el("strong", {}, "No canvases yet"),
          el("span", {}, "Create one to start building a screen simulation."),
          // el("button", { class: "btn primary", type: "button", onclick: createNewCanvas }, "New canvas"),
        ]),
      ])
    );
  } else {
    state.canvases.forEach((canvas) => {
      const open = () => openEditor(canvas.id);
      const row = el("tr", { class: "canvas-row" });
      row.append(
        el("td", { class: "col-title" }, [
          el("button", { class: "link-btn", type: "button", onclick: open }, canvas.title || "Untitled canvas"),
        ]),
        el("td", { class: "col-desc" }, canvas.description || "—"),
        el("td", {}, canvas.teamTag ? el("span", { class: "pill" }, canvas.teamTag) : "—"),
        el("td", {}, String(canvas.screens?.length || 0)),
        el("td", { class: "col-date" }, formatWhen(canvas.updatedAt)),
        el("td", { class: "col-actions" }, [
          el("div", { class: "table-actions" }, [
            el("button", { class: "btn primary", type: "button", onclick: open }, "Open"),
            el("button", {
              class: "btn ghost",
              type: "button",
              onclick: () => {
                if (!canvas.screens?.length) {
                  toast("Add screens in the builder before opening agent view.");
                  return;
                }
                window.location.href = `/agent.html?canvas=${encodeURIComponent(canvas.id)}`;
              },
            }, "Agent"),
            el("button", {
              class: "btn ghost",
              type: "button",
              onclick: () => {
                if (!canvas.screens?.length) {
                  toast("Add screens in the builder before previewing.");
                  return;
                }
                openPreview({ canvas, startScreenId: canvas.screens[0].id });
              },
            }, "Preview"),
            el("button", { class: "btn ghost", type: "button", onclick: () => editCanvas(canvas) }, "Edit"),
            el("button", {
              class: "btn ghost",
              type: "button",
              onclick: () => {
                state.canvases.unshift(duplicateCanvas(canvas));
                saveState(state);
                renderHome();
                toast("Canvas duplicated.", "success");
              },
            }, "Duplicate"),
            el("button", {
              class: "btn danger",
              type: "button",
              onclick: () => {
                if (!confirm(`Delete “${canvas.title}”?`)) return;
                state.canvases = state.canvases.filter((item) => item.id !== canvas.id);
                saveState(state);
                renderHome();
                toast("Canvas deleted");
              },
            }, "Delete"),
          ]),
        ])
      );
      tbody.append(row);
    });
  }

  table.append(tbody);
  tableWrap.append(table);
  wrap.append(tableWrap);
  home.append(wrap);
  app.append(home);
}

async function openEditor(canvasId) {
  const canvas = state.canvases.find((item) => item.id === canvasId);
  if (!canvas) return;
  await mountEditor(app, {
    state,
    canvas,
    onBack: () => {
      state = loadState();
      renderHome();
    },
  });
}

renderHome();
