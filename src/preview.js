import { el, escapeHtml, EDITOR_STAGE_SIZE } from "./utils.js";
import { resolveVariables } from "./store.js";
import { splitOptions } from "./layerTypes.js";

function isFilledCorrect(layer, value) {
  const expected = String(layer.props?.correctValue ?? "").trim();
  if (!expected) return true;
  return String(value ?? "").trim().toLowerCase() === expected.toLowerCase();
}

function requiredLayers(screen) {
  return (screen.layers || []).filter((layer) => {
    if (!["sim-input", "sim-select", "sim-typeahead", "sim-date", "sim-toggle", "sim-paragraph"].includes(layer.type)) {
      return false;
    }
    return String(layer.props?.correctValue ?? "").trim() !== "";
  });
}

export function openPreview({ canvas, startScreenId, onClose }) {
  const answers = {};
  let screenId = startScreenId || canvas.screens[0]?.id;
  const overlay = el("div", { class: "preview-overlay" });

  const close = () => {
    overlay.remove();
    onClose?.();
  };

  const showError = (message) => {
    overlay.querySelector(".preview-error")?.remove();
    const box = el("div", { class: "preview-error" }, message || "That's not correct. Try again.");
    overlay.append(box);
    setTimeout(() => box.remove(), 2200);
  };

  const helpFor = (screen) => {
    const withHelp = (screen.layers || []).find((layer) => layer.props?.helpText);
    return withHelp?.props?.helpText || "";
  };

  const render = () => {
    const screen =
      canvas.screens.find((item) => item.id === screenId) ||
      canvas.screens[0];
    overlay.innerHTML = "";
    if (!screen) {
      overlay.append(el("div", { class: "preview-complete" }, [
        el("h2", {}, "No screens to preview"),
        el("button", { class: "btn primary", onclick: close }, "Close"),
      ]));
      return;
    }

    const stage = el("div", { class: "preview-stage" });
    stage.style.width = `${EDITOR_STAGE_SIZE}px`;
    stage.style.height = `${EDITOR_STAGE_SIZE}px`;
    if (screen.background) {
      stage.append(el("img", { class: "preview-bg", src: screen.background, alt: screen.name }));
    }

    const help = el("div", { class: "preview-help" }, helpFor(screen));
    if (!helpFor(screen)) help.style.display = "none";

    (screen.layers || []).forEach((layer) => {
      const node = el("div", { class: "preview-layer" });
      node.style.left = `${layer.x}px`;
      node.style.top = `${layer.y}px`;
      node.style.width = `${layer.width}px`;
      node.style.height = `${layer.height}px`;
      const props = layer.props || {};
      const resolvedText = resolveVariables(props.content || "", canvas);

      if (props.clickGuide) {
        const guide = el("div", { class: "preview-guide", title: props.clickGuideText || "Click guide" });
        if (props.clickGuideText) {
          guide.append(el("span", { class: "preview-guide-label" }, props.clickGuideText));
        }
        node.append(guide);
      }

      const markDone = () => {
        node.querySelector(".preview-guide")?.remove();
        node.classList.add("is-complete");
      };

      if (layer.type === "sim-input" || layer.type === "sim-typeahead") {
        const input = el("input", {
          class: "preview-input",
          placeholder: props.placeholder || "",
        });
        input.style.color = props.fontColor || "#111827";
        input.style.background = props.backgroundColor || "#fff";
        input.style.border = props.showBorder ? "1px solid #cbd5e1" : "1px solid transparent";
        input.style.fontSize = `${props.fontSize || 14}px`;
        if (layer.type === "sim-typeahead") {
          const listId = `list_${layer.id}`;
          input.setAttribute("list", listId);
          const list = el("datalist", { id: listId });
          splitOptions(props.optionsText).forEach((opt) => list.append(el("option", { value: opt })));
          node.append(list);
        }
        const check = () => {
          answers[layer.id] = input.value;
          if (!isFilledCorrect(layer, input.value)) {
            input.classList.add("is-invalid");
            showError(props.errorMessage);
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
        input.addEventListener("blur", () => {
          answers[layer.id] = input.value;
          if (!isFilledCorrect(layer, input.value)) showError(props.errorMessage);
          else markDone();
        });
        node.append(input);
      } else if (layer.type === "sim-select") {
        const select = el("select", { class: "preview-input" });
        select.append(el("option", { value: "" }, "Select"));
        splitOptions(props.optionsText).forEach((opt) => select.append(el("option", { value: opt }, opt)));
        select.addEventListener("change", () => {
          answers[layer.id] = select.value;
          if (!isFilledCorrect(layer, select.value)) {
            showError(props.errorMessage);
            return;
          }
          markDone();
          if (props.jumpTo) {
            screenId = props.jumpTo;
            render();
          }
        });
        node.append(select);
      } else if (layer.type === "sim-date") {
        const input = el("input", { class: "preview-input", type: "date" });
        input.addEventListener("change", () => {
          answers[layer.id] = input.value;
          if (!isFilledCorrect(layer, input.value)) showError(props.errorMessage);
          else markDone();
        });
        node.append(input);
      } else if (layer.type === "sim-toggle") {
        let on = false;
        const img = el("img", { class: "preview-toggle", src: props.srcOff || "/screens/ampm-off.svg", alt: props.layerName || "Toggle" });
        img.addEventListener("click", () => {
          on = !on;
          img.src = on ? props.srcOn || "/screens/ampm-on.svg" : props.srcOff || "/screens/ampm-off.svg";
          answers[layer.id] = on ? "on" : "off";
          if (isFilledCorrect(layer, answers[layer.id])) markDone();
        });
        node.append(img);
      } else if (layer.type === "sim-text") {
        node.append(el("div", {
          class: "preview-text",
          style: `color:${props.fontColor || "#fff"};font-size:${props.fontSize || 18}px;font-weight:${props.fontWeight || 600}`,
        }, resolvedText));
      } else if (layer.type === "sim-html") {
        node.append(el("div", {
          class: "preview-html",
          style: `background:${props.backgroundColor || "#111827"};opacity:${props.opacity ?? 0.45}`,
        }, props.content || ""));
      } else if (layer.type === "sim-image") {
        if (props.src) node.append(el("img", { class: "preview-toggle", src: props.src, alt: props.layerName || "Image" }));
      } else if (layer.type === "sim-jump") {
        const hit = el("button", { class: "preview-jump", type: "button", title: props.layerName || "Jump" });
        hit.addEventListener("click", () => {
          const pending = requiredLayers(screen).filter((item) => !isFilledCorrect(item, answers[item.id]));
          if (pending.length) {
            showError(pending[0].props?.errorMessage || helpFor(screen) || "Complete the required fields first.");
            return;
          }
          if (!props.jumpTo) {
            overlay.innerHTML = "";
            overlay.append(el("div", { class: "preview-complete" }, [
              el("div", { class: "preview-check" }, "✓"),
              el("h2", {}, "Simulation complete"),
              el("p", {}, "You finished every screen in this canvas."),
              el("button", { class: "btn primary", onclick: close }, "Back to editor"),
            ]));
            return;
          }
          screenId = props.jumpTo;
          render();
        });
        node.append(hit);
      }

      stage.append(node);
    });

    overlay.append(
      el("div", { class: "preview-bar" }, [
        el("strong", {}, escapeHtml(canvas.title)),
        el("span", {}, screen.name),
        el("button", { class: "btn ghost", onclick: close }, "Close preview"),
      ]),
      el("div", { class: "preview-frame" }, [stage]),
      help
    );
  };

  render();
  document.body.append(overlay);
  return close;
}
