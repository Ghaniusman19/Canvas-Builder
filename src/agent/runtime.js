/**
 * Agent runtime — plays a saved canvas without GrapesJS.
 * Same workflow FiveLumens agent side will use after backend returns canvas JSON.
 *
 * Flow:
 * 1. Load canvas (screens + layers)
 * 2. Show current screen background
 * 3. Render interactive layers on top
 * 4. Validate required inputs before jump
 * 5. Jump layer → next screen id (props.jumpTo) or finish if empty
 */

import { el, escapeHtml, EDITOR_STAGE_SIZE } from "../utils.js";
import { resolveVariables } from "../store.js";
import { splitOptions } from "../layerTypes.js";
import { getScreenById, getLayers, getJumpLayers } from "../agentApi.js";

function isFilledCorrect(layer, value) {
  const expected = String(layer.props?.correctValue ?? "").trim();
  if (!expected) return true;
  return String(value ?? "").trim().toLowerCase() === expected.toLowerCase();
}

function requiredLayers(screen) {
  return getLayers(screen).filter((layer) => {
    if (!["sim-input", "sim-select", "sim-typeahead", "sim-date", "sim-toggle", "sim-paragraph"].includes(layer.type)) {
      return false;
    }
    return String(layer.props?.correctValue ?? "").trim() !== "";
  });
}

function screenIndex(canvas, screenId) {
  return Math.max(0, (canvas.screens || []).findIndex((screen) => screen.id === screenId));
}

function buildInspector(canvas, screen, answers, visited) {
  const jumps = getJumpLayers(screen).map((layer) => ({
    id: layer.id,
    name: layer.props?.layerName || "Jump",
    jumpTo: layer.props?.jumpTo || "(finish)",
  }));

  return {
    howDataIsAccessed: {
      canvas: "payload from fetchCanvasForAgent(id)",
      screens: "canvas.screens",
      currentScreen: "canvas.screens.find(s => s.id === screenId)",
      layers: "currentScreen.layers",
      jumpTarget: "layer.props.jumpTo → next screen id",
    },
    canvas: {
      id: canvas.id,
      title: canvas.title,
      screenCount: canvas.screens?.length || 0,
    },
    currentScreen: {
      id: screen?.id,
      name: screen?.name,
      index: screenIndex(canvas, screen?.id) + 1,
      layerCount: getLayers(screen).length,
      background: screen?.background ? "(image present)" : "(none)",
    },
    layers: getLayers(screen).map((layer) => ({
      id: layer.id,
      type: layer.type,
      x: layer.x,
      y: layer.y,
      w: layer.width,
      h: layer.height,
      name: layer.props?.layerName || "",
      jumpTo: layer.props?.jumpTo || undefined,
      answered: answers[layer.id] ?? null,
    })),
    jumpLayers: jumps,
    pathSoFar: visited,
  };
}

/**
 * Mount full agent simulation experience into `root`.
 * @returns {{ destroy: Function }}
 */
export function mountAgentRuntime(root, { canvas, onExit }) {
  const answers = {};
  const visited = [];
  let screenId = canvas.startScreenId || canvas.screens[0]?.id;
  let phase = "intro"; // intro | play | complete
  let startedAt = null;
  let hoveredGuide = null;

  const shell = el("div", { class: "agent-shell" });
  root.innerHTML = "";
  root.append(shell);

  const showToastError = (message) => {
    shell.querySelector(".agent-toast-error")?.remove();
    const box = el("div", { class: "agent-toast-error" }, message || "That's not correct. Try again.");
    shell.append(box);
    setTimeout(() => box.remove(), 2400);
  };

  const helpFor = (screen) => {
    const withHelp = getLayers(screen).find((layer) => layer.props?.helpText);
    return withHelp?.props?.helpText || "";
  };

  const goToScreen = (nextId) => {
    screenId = nextId;
    hoveredGuide = null;
    render();
  };

  const finish = () => {
    phase = "complete";
    render();
  };

  const renderIntro = () => {
    const screens = canvas.screens || [];
    const totalLayers = screens.reduce((sum, screen) => sum + (screen.layers?.length || 0), 0);
    shell.innerHTML = "";
    shell.append(
      el("header", { class: "agent-top" }, [
        el("button", { class: "btn ghost", type: "button", onclick: () => onExit?.() }, "← Back to assignments"),
        el("strong", {}, "Agent training"),
        el("span", { class: "agent-badge" }, "POC · same JSON as admin save"),
      ]),
      el("div", { class: "agent-intro" }, [
        el("div", { class: "agent-intro-card" }, [
          el("div", { class: "agent-kicker" }, canvas.teamTag || "Screen simulation"),
          el("h1", {}, escapeHtml(canvas.title || "Untitled canvas")),
          el("p", {}, escapeHtml(canvas.description || "Complete each screen. Jump layers move you forward when required fields are correct.")),
          el("ul", { class: "agent-meta-list" }, [
            el("li", {}, `${screens.length} screen${screens.length === 1 ? "" : "s"}`),
            el("li", {}, `${totalLayers} layer${totalLayers === 1 ? "" : "s"}`),
            el("li", {}, "Start at first screen · navigate via Jump layers"),
          ]),
          el("div", { class: "agent-intro-actions" }, [
            el("button", {
              class: "btn primary",
              type: "button",
              onclick: () => {
                phase = "play";
                startedAt = Date.now();
                visited.length = 0;
                visited.push(screenId);
                render();
              },
            }, "Start simulation"),
            el("button", { class: "btn ghost", type: "button", onclick: () => onExit?.() }, "Cancel"),
          ]),
          el("div", { class: "agent-flow-hint" }, [
            el("h3", {}, "Agent-side data path"),
            el("ol", {}, [
              el("li", {}, "Backend returns canvas JSON (screens + layers)"),
              el("li", {}, "Agent loads canvas.screens[0] (or startScreenId)"),
              el("li", {}, "Each layer is drawn at x/y/width/height on the screenshot"),
              el("li", {}, "Jump layer reads props.jumpTo → opens that screen id"),
              el("li", {}, "Empty jumpTo finishes the simulation"),
            ]),
          ]),
        ]),
      ])
    );
  };

  const renderComplete = () => {
    const seconds = startedAt ? Math.max(1, Math.round((Date.now() - startedAt) / 1000)) : 0;
    shell.innerHTML = "";
    shell.append(
      el("header", { class: "agent-top" }, [
        el("button", { class: "btn ghost", type: "button", onclick: () => onExit?.() }, "← Back to assignments"),
        el("strong", {}, escapeHtml(canvas.title || "Canvas")),
        el("span", { class: "agent-badge ok" }, "Completed"),
      ]),
      el("div", { class: "agent-complete" }, [
        el("div", { class: "preview-check" }, "✓"),
        el("h2", {}, "Simulation complete"),
        el("p", {}, `You finished “${escapeHtml(canvas.title || "this canvas")}” in about ${seconds}s.`),
        el("p", { class: "agent-complete-path" }, `Path: ${visited.map((id, i) => getScreenById(canvas, id)?.name || id).join(" → ")}`),
        el("div", { class: "agent-intro-actions" }, [
          el("button", {
            class: "btn primary",
            type: "button",
            onclick: () => {
              phase = "intro";
              screenId = canvas.startScreenId || canvas.screens[0]?.id;
              Object.keys(answers).forEach((key) => delete answers[key]);
              visited.length = 0;
              render();
            },
          }, "Replay"),
          el("button", { class: "btn ghost", type: "button", onclick: () => onExit?.() }, "Back to assignments"),
        ]),
      ])
    );
  };

  const renderPlay = () => {
    const screen = getScreenById(canvas, screenId);
    shell.innerHTML = "";
    if (!screen) {
      shell.append(
        el("div", { class: "agent-complete" }, [
          el("h2", {}, "Screen missing"),
          el("p", {}, "jumpTo pointed at an id that is not in canvas.screens."),
          el("button", { class: "btn primary", type: "button", onclick: () => onExit?.() }, "Exit"),
        ])
      );
      return;
    }

    const index = screenIndex(canvas, screen.id);
    const total = canvas.screens.length;
    const help = helpFor(screen);
    const inspector = buildInspector(canvas, screen, answers, visited);

    const stage = el("div", { class: "agent-stage" });
    stage.style.width = `${screen.width || EDITOR_STAGE_SIZE}px`;
    stage.style.height = `${screen.height || EDITOR_STAGE_SIZE}px`;

    if (screen.background) {
      stage.append(el("img", { class: "preview-bg", src: screen.background, alt: screen.name }));
    }

    getLayers(screen).forEach((layer) => {
      const node = el("div", { class: "preview-layer" });
      node.style.left = `${layer.x}px`;
      node.style.top = `${layer.y}px`;
      node.style.width = `${layer.width}px`;
      node.style.height = `${layer.height}px`;
      const props = layer.props || {};
      const resolvedText = resolveVariables(props.content || "", canvas);

      if (props.clickGuide) {
        const label = el("span", { class: "preview-guide-label" }, props.clickGuideText || "Guide");
        label.style.display = hoveredGuide === layer.id ? "block" : "none";
        const guide = el("div", {
          class: "preview-guide",
          title: props.clickGuideText || "Click guide",
          onmouseenter: () => {
            hoveredGuide = layer.id;
            label.style.display = "block";
          },
          onmouseleave: () => {
            hoveredGuide = null;
            label.style.display = "none";
          },
        });
        guide.append(label);
        node.append(guide);
      }

      const markDone = () => {
        node.querySelector(".preview-guide")?.remove();
        node.classList.add("is-complete");
      };

      if (layer.type === "sim-input" || layer.type === "sim-typeahead") {
        const input = el("input", { class: "preview-input", placeholder: props.placeholder || "" });
        input.style.color = props.fontColor || "#111827";
        input.style.background = props.backgroundColor || "#fff";
        input.style.border = props.showBorder ? "1px solid #cbd5e1" : "1px solid transparent";
        input.style.fontSize = `${props.fontSize || 14}px`;
        if (answers[layer.id] != null) input.value = answers[layer.id];
        if (layer.type === "sim-typeahead") {
          const listId = `agent_list_${layer.id}`;
          input.setAttribute("list", listId);
          const list = el("datalist", { id: listId });
          splitOptions(props.optionsText).forEach((opt) => list.append(el("option", { value: opt })));
          node.append(list);
        }
        const check = () => {
          answers[layer.id] = input.value;
          paintInspector();
          if (!isFilledCorrect(layer, input.value)) {
            input.classList.add("is-invalid");
            showToastError(props.errorMessage || "Incorrect value. Please try again.");
            return false;
          }
          input.classList.remove("is-invalid");
          markDone();
          return true;
        };
        input.addEventListener("blur", check);
        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            check();
          }
        });
        node.append(input);
      } else if (layer.type === "sim-paragraph") {
        const input = el("textarea", { class: "preview-input", placeholder: props.placeholder || "" });
        input.style.color = props.fontColor || "#111827";
        input.style.background = props.backgroundColor || "#fff";
        if (answers[layer.id] != null) input.value = answers[layer.id];
        input.addEventListener("blur", () => {
          answers[layer.id] = input.value;
          paintInspector();
          if (!isFilledCorrect(layer, input.value)) showToastError(props.errorMessage);
          else markDone();
        });
        node.append(input);
      } else if (layer.type === "sim-select") {
        const select = el("select", { class: "preview-input" });
        select.append(el("option", { value: "" }, "Select"));
        splitOptions(props.optionsText).forEach((opt) => select.append(el("option", { value: opt }, opt)));
        if (answers[layer.id]) select.value = answers[layer.id];
        select.addEventListener("change", () => {
          answers[layer.id] = select.value;
          paintInspector();
          if (!isFilledCorrect(layer, select.value)) {
            showToastError(props.errorMessage || "Incorrect selection.");
            return;
          }
          markDone();
          if (props.jumpTo) {
            visited.push(props.jumpTo);
            goToScreen(props.jumpTo);
          }
        });
        node.append(select);
      } else if (layer.type === "sim-date") {
        const input = el("input", { class: "preview-input", type: "date" });
        if (answers[layer.id]) input.value = answers[layer.id];
        input.addEventListener("change", () => {
          answers[layer.id] = input.value;
          paintInspector();
          if (!isFilledCorrect(layer, input.value)) showToastError(props.errorMessage);
          else markDone();
        });
        node.append(input);
      } else if (layer.type === "sim-toggle") {
        let on = answers[layer.id] === "on";
        const img = el("img", {
          class: "preview-toggle",
          src: on ? props.srcOn || "/screens/ampm-on.svg" : props.srcOff || "/screens/ampm-off.svg",
          alt: props.layerName || "Toggle",
        });
        img.addEventListener("click", () => {
          on = !on;
          img.src = on ? props.srcOn || "/screens/ampm-on.svg" : props.srcOff || "/screens/ampm-off.svg";
          answers[layer.id] = on ? "on" : "off";
          paintInspector();
          if (isFilledCorrect(layer, answers[layer.id])) markDone();
        });
        node.append(img);
      } else if (layer.type === "sim-text") {
        node.append(
          el("div", {
            class: "preview-text",
            style: `color:${props.fontColor || "#fff"};font-size:${props.fontSize || 18}px;font-weight:${props.fontWeight || 600}`,
          }, resolvedText)
        );
      } else if (layer.type === "sim-html") {
        node.append(
          el("div", {
            class: "preview-html",
            style: `background:${props.backgroundColor || "#111827"};opacity:${props.opacity ?? 0.45}`,
          }, props.content || "")
        );
      } else if (layer.type === "sim-image") {
        if (props.src) node.append(el("img", { class: "preview-toggle", src: props.src, alt: props.layerName || "Image" }));
      } else if (layer.type === "sim-jump") {
        const hit = el("button", {
          class: "preview-jump agent-jump-hit",
          type: "button",
          title: props.layerName || "Jump",
        });
        hit.addEventListener("click", () => {
          const pending = requiredLayers(screen).filter((item) => !isFilledCorrect(item, answers[item.id]));
          if (pending.length) {
            showToastError(pending[0].props?.errorMessage || help || "Complete the required fields first.");
            return;
          }
          markDone();
          if (!props.jumpTo) {
            finish();
            return;
          }
          const next = getScreenById(canvas, props.jumpTo);
          if (!next) {
            showToastError(`Jump target “${props.jumpTo}” was not found in canvas.screens.`);
            return;
          }
          visited.push(props.jumpTo);
          goToScreen(props.jumpTo);
        });
        node.append(hit);
      }

      stage.append(node);
    });

    const inspectorPre = el("pre", { class: "agent-inspector-json" }, JSON.stringify(inspector, null, 2));

    const paintInspector = () => {
      const next = buildInspector(canvas, getScreenById(canvas, screenId), answers, visited);
      inspectorPre.textContent = JSON.stringify(next, null, 2);
    };

    shell.append(
      el("header", { class: "agent-top" }, [
        el("button", { class: "btn ghost", type: "button", onclick: () => onExit?.() }, "← Exit"),
        el("div", { class: "agent-top-title" }, [
          el("strong", {}, escapeHtml(canvas.title || "Canvas")),
          el("span", {}, `${escapeHtml(screen.name)} · step ${index + 1} of ${total}`),
        ]),
        el("div", { class: "agent-progress" }, [
          el("div", {
            class: "agent-progress-bar",
            style: `width:${Math.round(((index + 1) / total) * 100)}%`,
          }),
        ]),
      ]),
      el("div", { class: "agent-play-layout" }, [
        el("div", { class: "agent-play-main" }, [
          el("div", { class: "agent-frame" }, [stage]),
          help
            ? el("div", { class: "agent-help" }, [
                el("strong", {}, "Help"),
                el("span", {}, help),
              ])
            : null,
        ]),
        el("aside", { class: "agent-inspector" }, [
          el("h3", {}, "How agent reads this payload"),
          el("p", {}, "This panel mirrors what FiveLumens agent code will access after the API returns the saved canvas."),
          el("div", { class: "agent-inspector-keys" }, [
            el("code", {}, "canvas.screens"),
            el("code", {}, "screen.layers"),
            el("code", {}, "layer.props.jumpTo"),
          ]),
          inspectorPre,
        ]),
      ])
    );
  };

  const render = () => {
    if (phase === "intro") renderIntro();
    else if (phase === "complete") renderComplete();
    else renderPlay();
  };

  render();
  return {
    destroy() {
      shell.remove();
    },
  };
}
