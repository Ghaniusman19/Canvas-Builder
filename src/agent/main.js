import "../styles.css";
import "./agent.css";
import { el, toast } from "../utils.js";
import { fetchAssignedCanvases, fetchCanvasForAgent } from "../agentApi.js";
import { mountAgentRuntime } from "./runtime.js";

const app = document.getElementById("app");
let runtime = null;

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

function goStudio() {
  window.location.href = "/";
}

async function startCanvas(canvasId) {
  try {
    const result = await fetchCanvasForAgent(canvasId);
    if (!result.success || !result.data) {
      toast(result.message || "Could not load this canvas.");
      return;
    }
    runtime?.destroy();
    runtime = mountAgentRuntime(app, {
      canvas: result.data,
      onExit: () => {
        runtime?.destroy();
        runtime = null;
        const url = new URL(window.location.href);
        url.searchParams.delete("canvas");
        window.history.replaceState({}, "", url.pathname);
        renderAssignments();
      },
    });
  } catch (error) {
    console.error(error);
    toast(error?.message || "Agent runtime failed to start.");
  }
}

async function boot() {
  const params = new URLSearchParams(window.location.search);
  const canvasId = params.get("canvas");
  if (canvasId) {
    await startCanvas(canvasId);
    return;
  }
  await renderAssignments();
}

boot();

async function renderAssignments() {
  app.innerHTML = "";
  const home = el("div", { class: "agent-home" });
  const wrap = el("div", { class: "agent-home-wrap" });

  wrap.append(
    el("div", { class: "agent-home-hero" }, [
      el("div", {}, [
        el("div", { class: "home-kicker" }, "Agent side · Screen Simulation POC"),
        el("h1", {}, "My assigned canvases"),
        el("p", {}, "This mirrors FiveLumens agent training: load the saved canvas JSON (screens + layers), then play the jump flow. Data comes from the same localStorage the admin builder writes on Save."),
      ]),
      el("div", { class: "agent-home-actions" }, [
        el("button", { class: "btn ghost", type: "button", onclick: goStudio }, "← Admin studio"),
        el("button", {
          class: "btn primary",
          type: "button",
          onclick: () => renderAssignments(),
        }, "Refresh"),
      ]),
    ])
  );

  wrap.append(
    el("div", { class: "agent-pipeline" }, [
      el("div", { class: "agent-pipeline-step" }, [
        el("strong", {}, "1. Admin builds"),
        el("span", {}, "Screenshots + layers in GrapesJS builder"),
      ]),
      el("div", { class: "agent-pipeline-step" }, [
        el("strong", {}, "2. Save / API"),
        el("span", {}, "canvas → screens[] → layers[] JSON"),
      ]),
      el("div", { class: "agent-pipeline-step" }, [
        el("strong", {}, "3. Agent loads"),
        el("span", {}, "fetchCanvasForAgent(id) — no GrapesJS"),
      ]),
      el("div", { class: "agent-pipeline-step" }, [
        el("strong", {}, "4. Jump workflow"),
        el("span", {}, "Validate fields → layer.props.jumpTo"),
      ]),
    ])
  );

  const listHost = el("div", { class: "agent-assign-list" }, [
    el("div", { class: "agent-loading" }, "Loading assigned canvases…"),
  ]);
  wrap.append(listHost);
  home.append(wrap);
  app.append(home);

  const result = await fetchAssignedCanvases();
  listHost.innerHTML = "";

  if (!result.success) {
    listHost.append(el("div", { class: "agent-empty" }, "Failed to load assignments."));
    return;
  }

  if (!result.data.length) {
    listHost.append(
      el("div", { class: "agent-empty" }, [
        el("strong", {}, "No canvases with screens yet"),
        el("span", {}, "Open Admin studio, add screens + layers, click Save, then refresh here."),
        el("button", { class: "btn primary", type: "button", onclick: goStudio }, "Open admin studio"),
      ])
    );
    return;
  }

  result.data.forEach((item) => {
    const card = el("article", { class: "agent-assign-card" });
    card.append(
      el("div", { class: "agent-assign-body" }, [
        el("div", { class: "agent-assign-top" }, [
          el("h2", {}, item.title),
          item.teamTag ? el("span", { class: "pill" }, item.teamTag) : null,
        ]),
        el("p", {}, item.description || "No description"),
        el("div", { class: "agent-assign-meta" }, [
          el("span", {}, `${item.screenCount} screens`),
          el("span", {}, `${item.layerCount} layers`),
          el("span", {}, `Updated ${formatWhen(item.updatedAt)}`),
        ]),
      ]),
      el("div", { class: "agent-assign-actions" }, [
        el("button", {
          class: "btn primary",
          type: "button",
          onclick: () => startCanvas(item.id),
        }, "Start"),
        el("button", {
          class: "btn ghost",
          type: "button",
          onclick: async () => {
            const full = await fetchCanvasForAgent(item.id);
            if (!full.success) {
              toast(full.message || "Load failed");
              return;
            }
            console.log("[Agent POC] Full canvas payload:", full.data);
            toast("Full canvas JSON logged to console (F12).", "success");
          },
        }, "Log JSON"),
      ])
    );
    listHost.append(card);
  });
}
