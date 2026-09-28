import { getLayerType } from "./layerTypes.js";
import { parsePx, absUrl, extractCssUrl, EDITOR_STAGE_SIZE } from "./utils.js";

function collectProps(model, typeId) {
  const def = getLayerType(typeId);
  const props = {};
  Object.keys(def?.defaults || {}).forEach((key) => {
    const value = model.get(key);
    props[key] = value == null ? def.defaults[key] : value;
  });
  return props;
}

function readBackgroundFromComponent(cmp) {
  if (!cmp) return "";
  const fromSrc = cmp.get("src") || cmp.getAttributes?.()?.src || "";
  if (fromSrc && fromSrc !== "none") return fromSrc;
  const el = cmp.getEl?.();
  if (el?.getAttribute) {
    const attrSrc = el.getAttribute("src");
    if (attrSrc) return attrSrc;
    const cssSrc = extractCssUrl(el.style?.backgroundImage);
    if (cssSrc) return cssSrc;
  }
  return extractCssUrl(cmp.getStyle?.()?.backgroundImage);
}

function clearWrapper(wrapper) {
  if (!wrapper) return;
  if (typeof wrapper.empty === "function") {
    wrapper.empty();
    return;
  }
  const comps = wrapper.components();
  while (comps.length) comps.at(0).remove();
}

export function paintScreenVisual(editor, screen) {
  if (!editor) return;
  const width = EDITOR_STAGE_SIZE;
  const height = EDITOR_STAGE_SIZE;
  const src = screen?.background ? absUrl(screen.background) : "";
  const wrapper = editor.getWrapper();
  if (!wrapper) return;

  wrapper.setStyle({
    width: `${width}px`,
    height: `${height}px`,
    minHeight: `${height}px`,
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#ffffff",
  });

  const frame = editor.Canvas.getFrameEl?.();
  if (frame) {
    frame.style.width = `${width}px`;
    frame.style.height = `${height}px`;
  }

  const bg = wrapper.findType("sim-background")[0];
  if (bg) {
    bg.set("src", src);
    bg.addAttributes({ src });
    const el = bg.getEl?.();
    if (el) {
      el.setAttribute("data-sim-type", "sim-background");
      if (src) el.setAttribute("src", src);
      el.style.position = "absolute";
      el.style.left = "0";
      el.style.top = "0";
      el.style.width = "100%";
      el.style.height = "100%";
      el.style.objectFit = "fill";
      el.style.pointerEvents = "none";
      el.style.zIndex = "0";
    }
  }

  const wrapEl = wrapper.getEl?.();
  const domImg = wrapEl?.querySelector?.("[data-sim-type='sim-background']");
  if (domImg && src) {
    domImg.setAttribute("src", src);
    domImg.style.width = "100%";
    domImg.style.height = "100%";
  }
}

export function readCurrentScreen(editor, screenMeta) {
  const wrapper = editor.getWrapper();
  const style = wrapper.getStyle() || {};
  const layers = [];
  let background = screenMeta?.background || "";
  wrapper.components().forEach((cmp) => {
    const type = cmp.get("type");
    if (type === "sim-background") {
      background = readBackgroundFromComponent(cmp) || background;
      return;
    }
    if (!String(type).startsWith("sim-")) return;
    const cmpStyle = cmp.getStyle();
    layers.push({
      id: cmp.getId(),
      type,
      x: parsePx(cmpStyle.left),
      y: parsePx(cmpStyle.top),
      width: parsePx(cmpStyle.width, 120),
      height: parsePx(cmpStyle.height, 40),
      props: collectProps(cmp, type),
    });
  });
  return {
    ...screenMeta,
    name: screenMeta?.name || "Untitled screen",
    background: background || screenMeta?.background || "",
    width: EDITOR_STAGE_SIZE,
    height: EDITOR_STAGE_SIZE,
    layers,
  };
}

export function loadScreenIntoEditor(editor, screen) {
  if (!editor || !screen) return;
  const wrapper = editor.getWrapper();
  if (!wrapper) return;
  const width = EDITOR_STAGE_SIZE;
  const height = EDITOR_STAGE_SIZE;
  const src = screen.background ? absUrl(screen.background) : "";

  wrapper.setStyle({
    width: `${width}px`,
    height: `${height}px`,
    minHeight: `${height}px`,
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#ffffff",
  });
  clearWrapper(wrapper);

  wrapper.append({
    type: "sim-background",
    src,
    attributes: {
      "data-sim-type": "sim-background",
      class: "sim-background",
      src,
      alt: screen.name || "",
    },
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
  });

  (screen.layers || []).forEach((layer) => {
    const def = getLayerType(layer.type) || { defaults: {}, size: { width: 120, height: 40 } };
    wrapper.append({
      type: layer.type,
      ...def.defaults,
      ...(layer.props || {}),
      attributes: {
        ...(layer.id ? { id: layer.id } : {}),
        "data-sim-type": layer.type,
      },
      style: {
        position: "absolute",
        left: `${layer.x || 40}px`,
        top: `${layer.y || 40}px`,
        width: `${layer.width || def.size.width}px`,
        height: `${layer.height || def.size.height}px`,
        zIndex: 2,
      },
    });
  });

  editor.select();
  paintScreenVisual(editor, { ...screen, background: src, width, height });
}
