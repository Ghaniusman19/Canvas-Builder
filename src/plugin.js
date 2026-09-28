import { LAYER_TYPES, getLayerType, splitOptions } from "./layerTypes.js";
import { escapeHtml, absUrl, EDITOR_STAGE_SIZE } from "./utils.js";

function bool(value) {
  return value === true || value === "true";
}

export function renderLayerMarkup(type, model) {
  const get = (key) => (model.get ? model.get(key) : model[key]);
  const guide = bool(get("clickGuide"))
    ? `<span class="sim-click-guide-dot" title="${escapeHtml(get("clickGuideText") || "Click guide")}"></span>`
    : "";
  const border = bool(get("showBorder")) ? "1px solid #cbd5e1" : "1px solid transparent";
  const color = get("fontColor") || "#111827";
  const bg = get("backgroundColor") || "#ffffff";
  const fontSize = get("fontSize") || 14;
  const fontWeight = get("fontWeight") || "400";
  const name = escapeHtml(get("layerName") || type);

  if (type === "sim-jump") {
    return `${guide}<div class="sim-jump-box">${name}</div>`;
  }
  if (type === "sim-input" || type === "sim-typeahead") {
    return `${guide}<input class="sim-editor-field" style="border:${border};color:${color};background:${bg};font-size:${fontSize}px;font-weight:${fontWeight}" placeholder="${escapeHtml(get("placeholder") || "")}" value="" readonly />`;
  }
  if (type === "sim-paragraph") {
    return `${guide}<textarea class="sim-editor-textarea" style="border:${border};color:${color};background:${bg};font-size:${fontSize}px" placeholder="${escapeHtml(get("placeholder") || "")}" readonly></textarea>`;
  }
  if (type === "sim-select") {
    const options = splitOptions(get("optionsText"));
    const opts = ['<option value="">Select</option>']
      .concat(options.map((opt) => `<option>${escapeHtml(opt)}</option>`))
      .join("");
    return `${guide}<select class="sim-editor-select" style="border:${border};color:${color};background:${bg}">${opts}</select>`;
  }
  if (type === "sim-html") {
    const opacity = get("opacity") ?? 0.45;
    return `<div class="sim-html-layer" style="background:${get("backgroundColor") || "#111827"};opacity:${opacity};border:${bool(get("showBorder")) ? "1px solid #94a3b8" : "none"};color:#fff;padding:12px;font-size:13px">${escapeHtml(get("content") || name)}</div>`;
  }
  if (type === "sim-image") {
      const src = absUrl(get("src"));
    const opacity = get("opacity") ?? 1;
    return src
      ? `<img class="sim-image-layer" src="${escapeHtml(src)}" style="opacity:${opacity}" alt="${name}" />`
      : `<div class="sim-html-layer" style="align-items:center;justify-content:center;color:#94a3b8;border:1px dashed #94a3b8">Image</div>`;
  }
  if (type === "sim-date") {
    return `${guide}<div class="sim-date-layer">📅 ${escapeHtml(get("correctValue") || "Date picker")}</div>`;
  }
  if (type === "sim-toggle") {
    const src = absUrl(get("srcOff") || "/screens/ampm-off.svg");
    return `${guide}<img class="sim-toggle-layer" src="${escapeHtml(src)}" alt="${name}" />`;
  }
  if (type === "sim-text") {
    return `<div class="sim-text-layer" style="color:${get("fontColor") || "#fff"};font-size:${get("fontSize") || 18}px;font-weight:${get("fontWeight") || 600}">${escapeHtml(get("content") || "")}</div>`;
  }
  return name;
}

function propKeys(def) {
  return Object.keys(def.defaults || {});
}

function paintBackgroundDom(el, src) {
  if (!el) return;
  el.setAttribute("data-sim-type", "sim-background");
  el.classList.add("sim-background");
  el.style.position = "absolute";
  el.style.left = "0";
  el.style.top = "0";
  el.style.width = "100%";
  el.style.height = "100%";
  el.style.objectFit = "fill";
  el.style.pointerEvents = "none";
  el.style.zIndex = "0";
  if (el.tagName === "IMG") {
    if (src) el.setAttribute("src", src);
    else el.removeAttribute("src");
    return;
  }
  el.style.backgroundImage = src ? `url("${src}")` : "none";
  el.style.backgroundRepeat = "no-repeat";
  el.style.backgroundSize = "100% 100%";
}

export default function simulationPlugin(editor) {
  editor.DomComponents.addType("sim-background", {
    isComponent: (el) => el.getAttribute?.("data-sim-type") === "sim-background",
    model: {
      defaults: {
        tagName: "img",
        void: true,
        src: "",
        selectable: false,
        hoverable: false,
        draggable: false,
        droppable: false,
        highlightable: false,
        locked: true,
        attributes: { "data-sim-type": "sim-background", class: "sim-background", alt: "" },
        style: {
          position: "absolute",
          left: "0",
          top: "0",
          width: "100%",
          height: "100%",
          objectFit: "fill",
          pointerEvents: "none",
          zIndex: 0,
        },
      },
      init() {
        this.on("change:src", () => {
          const src = this.get("src") || "";
          this.addAttributes({ src });
          paintBackgroundDom(this.getEl?.(), src);
        });
      },
    },
    view: {
      onRender({ el, model }) {
        paintBackgroundDom(el, model.get("src") || model.getAttributes()?.src || "");
      },
    },
  });

  LAYER_TYPES.forEach((def) => {
    editor.DomComponents.addType(def.id, {
      isComponent: (el) => el.getAttribute?.("data-sim-type") === def.id,
      model: {
        defaults: {
          tagName: "div",
          droppable: false,
          draggable: true,
          copyable: true,
          removable: true,
          resizable: { tl: 1, tr: 1, bl: 1, br: 1, cl: 1, cr: 1, bc: 1, tc: 1 },
          attributes: { "data-sim-type": def.id, class: `sim-layer ${def.id}` },
          ...def.defaults,
        },
      },
      view: {
        init() {
          this.listenTo(this.model, propKeys(def).map((key) => `change:${key}`).join(" "), this.render);
        },
        onRender({ el, model }) {
          el.setAttribute("data-sim-type", def.id);
          el.innerHTML = renderLayerMarkup(def.id, model);
        },
      },
    });
  });
}

export function addLayerToCanvas(editor, typeId, extra = {}) {
  const def = getLayerType(typeId);
  if (!def || !editor) return null;
  const wrapper = editor.getWrapper();
  const style = wrapper.getStyle() || {};
  const canvasW = parseFloat(style.width) || EDITOR_STAGE_SIZE;
  const canvasH = parseFloat(style.height) || EDITOR_STAGE_SIZE;
  const width = extra.width || def.size.width;
  const height = extra.height || def.size.height;
  const left = extra.x ?? Math.round(canvasW / 2 - width / 2);
  const top = extra.y ?? Math.round(canvasH / 2 - height / 2);
  const addedList = wrapper.append({
    type: typeId,
    ...def.defaults,
    ...(extra.props || {}),
    style: {
      position: "absolute",
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
      zIndex: 2,
    },
  });
  const added = Array.isArray(addedList) ? addedList[0] : addedList;
  if (added && extra.select !== false) editor.select(added);
  return added;
}

export function setScreenBackground(editor, src, width = EDITOR_STAGE_SIZE, height = EDITOR_STAGE_SIZE) {
  const wrapper = editor.getWrapper();
  if (!wrapper) return;
  const resolved = src ? absUrl(src) : "";
  const stageW = EDITOR_STAGE_SIZE;
  const stageH = EDITOR_STAGE_SIZE;
  wrapper.setStyle({
    width: `${stageW}px`,
    height: `${stageH}px`,
    minHeight: `${stageH}px`,
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#ffffff",
  });
  let bg = wrapper.findType("sim-background")[0];
  if (!bg) {
    const added = wrapper.components().add(
      {
        type: "sim-background",
        src: resolved,
        attributes: {
          "data-sim-type": "sim-background",
          class: "sim-background",
          src: resolved,
          alt: "",
        },
      },
      { at: 0 }
    );
    bg = Array.isArray(added) ? added[0] : added;
  } else {
    bg.set("src", resolved);
    bg.addAttributes({ src: resolved });
  }
  paintBackgroundDom(bg?.getEl?.(), resolved);
  const frame = editor.Canvas.getFrameEl?.();
  if (frame) {
    frame.style.width = `${stageW}px`;
    frame.style.height = `${stageH}px`;
  }
  if (typeof editor.setDevice === "function") {
    editor.setDevice("desktop");
  }
}
