import grapesjs from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";
import simulationPlugin, { addLayerToCanvas, setScreenBackground } from "./plugin.js";
import { readCurrentScreen, loadScreenIntoEditor, paintScreenVisual } from "./serialize.js";
import { renderProperties, renderLayerList } from "./properties.js";
import { LAYER_TYPES, getLayerType } from "./layerTypes.js";
import { createScreen, saveState } from "./store.js";
import { el, fileToDataUrl, toast, EDITOR_STAGE_SIZE } from "./utils.js";
import { iconHtml } from "./icons.js";
import { openPreview } from "./preview.js";
import { openCanvasModal } from "./canvasModal.js";

function flushScreen(ctx) {
  if (!ctx.editor || !ctx.currentScreenId) return;
  const index = ctx.canvas.screens.findIndex((screen) => screen.id === ctx.currentScreenId);
  if (index < 0) return;
  const prev = ctx.canvas.screens[index];
  const next = readCurrentScreen(ctx.editor, prev);
  if (!next.background) next.background = prev.background || "";
  if (!next.width) next.width = prev.width || EDITOR_STAGE_SIZE;
  if (!next.height) next.height = prev.height || EDITOR_STAGE_SIZE;
  ctx.canvas.screens[index] = next;
}

function persist(ctx) {
  flushScreen(ctx);
  ctx.canvas.updatedAt = Date.now();
  const index = ctx.state.canvases.findIndex((item) => item.id === ctx.canvas.id);
  if (index >= 0) ctx.state.canvases[index] = ctx.canvas;
  try {
    saveState(ctx.state);
  } catch (error) {
    console.error(error);
    toast("Could not save this canvas in the browser. The screenshot may be too large.");
    return false;
  }
  return true;
}

function paintRulers(xHost, yHost, zoom, grid) {
  xHost.innerHTML = "";
  yHost.innerHTML = "";
  const step = grid;
  for (let i = 0; i <= 1600; i += step) {
    const markX = el("span", { class: "ruler-mark" }, String(i));
    markX.style.left = `${(i * zoom) / 100}px`;
    xHost.append(markX);
    const markY = el("span", { class: "ruler-mark vertical" }, String(i));
    markY.style.top = `${(i * zoom) / 100}px`;
    yHost.append(markY);
  }
}

function refreshSide(ctx) {
  ctx.els.screens.innerHTML = "";
  ctx.canvas.screens.forEach((screen, index) => {
    const card = el("button", {
      type: "button",
      class: `screen-card${screen.id === ctx.currentScreenId ? " is-active" : ""}`,
    });
    if (screen.background) {
      card.append(el("img", { src: screen.background, alt: screen.name }));
    } else {
      card.append(el("div", { class: "screen-placeholder" }, "Empty"));
    }
    card.append(el("b", {}, String(index + 1)));
    card.append(el("em", {}, screen.name));
    card.addEventListener("click", () => ctx.selectScreen(screen.id));
    ctx.els.screens.append(card);
  });

  const upload = el("label", { class: "screen-upload" });
  upload.innerHTML = `${iconHtml("cloud")}<span>Drop or click to add a screen</span>`;
  const file = el("input", { type: "file", accept: "image/*" });
  file.addEventListener("change", async () => {
    const picked = file.files?.[0];
    if (picked) await ctx.addScreenFromFile(picked);
  });
  upload.append(file);
  upload.addEventListener("dragover", (event) => {
    event.preventDefault();
    upload.classList.add("is-over");
  });
  upload.addEventListener("dragleave", () => upload.classList.remove("is-over"));
  upload.addEventListener("drop", async (event) => {
    event.preventDefault();
    upload.classList.remove("is-over");
    const picked = event.dataTransfer?.files?.[0];
    if (picked) await ctx.addScreenFromFile(picked);
  });
  ctx.els.screens.append(upload);

  ctx.els.name.value = ctx.canvas.screens.find((s) => s.id === ctx.currentScreenId)?.name || "";
  renderProperties(ctx.els.details, {
    editor: ctx.editor,
    canvas: ctx.canvas,
    onChange: () => {
      renderLayerList(ctx.els.layers, ctx.editor, () => refreshSide(ctx));
    },
  });
  renderLayerList(ctx.els.layers, ctx.editor, () => refreshSide(ctx));
}

export async function mountEditor(root, { state, canvas, onBack }) {
  root.innerHTML = "";
  const ctx = {
    state,
    canvas,
    editor: null,
    currentScreenId: canvas.screens[0]?.id || null,
    zoom: 100,
    grid: 50,
    showGrid: false,
    els: {},
  };

  const shell = el("div", { class: "editor-shell" });
  shell.innerHTML = `
    <header class="editor-top">
      <button class="back-btn" type="button" data-back>${iconHtml("back")} Back to Canvas</button>
      <span class="editor-title">${(canvas.title || "Untitled canvas").replace(/</g, "&lt;")}</span>
      <button class="btn ghost" type="button" data-settings>Canvas settings</button>
    </header>
    <div class="editor-body">
      <aside class="screens-rail" data-screens></aside>
      <section class="editor-main">
        <div class="editor-toolbar">
          <div class="toolbar-left">
            <input class="screen-name" data-name maxlength="48" />
            <div class="tool-group">
              <button type="button" data-zoom-out>−</button>
              <strong data-zoom>100%</strong>
              <button type="button" data-zoom-in>+</button>
            </div>
            <label class="grid-ctl">Grid <input data-grid type="number" min="8" max="200" value="50" />px</label>
            <label class="check-ctl"><input data-show-grid type="checkbox" /> Show Grid</label>
            <div class="layer-tools" data-tools></div>
          </div>
          <div class="toolbar-right">
            <select class="library-select" data-library>
              <option value="">Select Layer From Library</option>
            </select>
            <button class="preview-btn" type="button" data-preview>${iconHtml("preview")} PREVIEW</button>
          </div>
        </div>
        <div class="workspace">
          <div class="ruler-corner"></div>
          <div class="ruler-x" data-ruler-x></div>
          <div class="workspace-mid">
            <div class="ruler-y" data-ruler-y></div>
            <div class="gjs-host" id="gjs"></div>
          </div>
        </div>
        <div class="editor-bottom">
          <button class="btn danger-outline" data-delete type="button">DELETE</button>
          <button class="btn ghost" data-cancel type="button">CANCEL</button>
          <button class="btn ghost" data-replace type="button">Replace Background Image</button>
          <span class="bottom-spacer"></span>
          <button class="btn ghost" data-undo type="button">${iconHtml("undo")} UNDO</button>
          <button class="btn ghost" data-redo type="button">${iconHtml("redo")} REDO</button>
          <button class="btn ghost" data-clone type="button">${iconHtml("clone")} CLONE</button>
          <button class="btn primary" data-save type="button">${iconHtml("save")} SAVE</button>
        </div>
      </section>
      <aside class="props-rail">
        <div class="details-scroll" data-details></div>
        <div class="layers-panel" data-layers></div>
      </aside>
    </div>
    <input type="file" accept="image/*" hidden data-bg-file />
  `;
  root.append(shell);

  ctx.els = {
    screens: shell.querySelector("[data-screens]"),
    details: shell.querySelector("[data-details]"),
    layers: shell.querySelector("[data-layers]"),
    name: shell.querySelector("[data-name]"),
    tools: shell.querySelector("[data-tools]"),
    library: shell.querySelector("[data-library]"),
    zoom: shell.querySelector("[data-zoom]"),
    rulerX: shell.querySelector("[data-ruler-x]"),
    rulerY: shell.querySelector("[data-ruler-y]"),
    bgFile: shell.querySelector("[data-bg-file]"),
  };

  LAYER_TYPES.forEach((type) => {
    const btn = el("button", {
      type: "button",
      class: "layer-tool",
      title: type.detailsLabel,
      html: iconHtml(type.icon),
    });
    btn.addEventListener("click", () => {
      if (!ctx.editor) return;
      addLayerToCanvas(ctx.editor, type.id);
      refreshSide(ctx);
    });
    ctx.els.tools.append(btn);
  });

  const rebuildLibrary = () => {
    ctx.els.library.innerHTML = `<option value="">Select Layer From Library</option>`;
    ctx.canvas.screens.forEach((screen) => {
      (screen.layers || []).forEach((layer) => {
        const type = getLayerType(layer.type);
        const option = el("option", { value: `${screen.id}::${layer.id}` }, `${layer.props?.layerName || type?.label} · ${screen.name}`);
        ctx.els.library.append(option);
      });
    });
  };

  ctx.selectScreen = (screenId) => {
    if (!ctx.editor) return;
    const screen = ctx.canvas.screens.find((item) => item.id === screenId);
    if (!screen) return;
    if (ctx.currentScreenId && ctx.currentScreenId !== screenId) {
      flushScreen(ctx);
    }
    ctx.currentScreenId = screenId;
    const latest = ctx.canvas.screens.find((item) => item.id === screenId) || screen;
    loadScreenIntoEditor(ctx.editor, latest);
    applyCanvasChrome();
    refreshSide(ctx);
    rebuildLibrary();
  };

  ctx.addScreenFromFile = async (file) => {
    const src = await fileToDataUrl(file);
    flushScreen(ctx);
    const screen = createScreen({
      name: file.name.replace(/\.[^.]+$/, "") || `Screen ${ctx.canvas.screens.length + 1}`,
      background: src,
      width: EDITOR_STAGE_SIZE,
      height: EDITOR_STAGE_SIZE,
    });
    ctx.canvas.screens.push(screen);
    ctx.currentScreenId = screen.id;
    loadScreenIntoEditor(ctx.editor, screen);
    applyCanvasChrome();
    persist(ctx);
    refreshSide(ctx);
    rebuildLibrary();
    toast("Screen added. A default jump layer was placed on it.", "success");
  };

  const applyCanvasChrome = () => {
    if (!ctx.editor) return;
    ctx.editor.Canvas.setZoom(ctx.zoom);
    ctx.els.zoom.textContent = `${ctx.zoom}%`;
    const doc = ctx.editor.Canvas.getDocument();
    if (doc) {
      doc.body.classList.toggle("sim-show-grid", ctx.showGrid);
      doc.body.style.setProperty("--sim-grid", `${ctx.grid}px`);
      doc.documentElement.style.background = "#ffffff";
      doc.body.style.background = "#ffffff";
    }
    paintRulers(ctx.els.rulerX, ctx.els.rulerY, ctx.zoom, ctx.grid);
    const screen = ctx.canvas.screens.find((item) => item.id === ctx.currentScreenId);
    if (screen) {
      paintScreenVisual(ctx.editor, screen);
    } else {
      const frame = ctx.editor.Canvas.getFrameEl();
      if (frame) {
        frame.style.width = `${EDITOR_STAGE_SIZE}px`;
        frame.style.height = `${EDITOR_STAGE_SIZE}px`;
      }
    }
  };

  const editor = grapesjs.init({
    container: "#gjs",
    height: "100%",
    width: "100%",
    fromElement: false,
    storageManager: false,
    noticeOnUnload: false,
    undoManager: { maximumStackLength: 80 },
    panels: { defaults: [] },
    blockManager: { custom: true },
    layerManager: { custom: true },
    traitManager: { custom: true },
    selectorManager: { componentFirst: true },
    canvas: {
      styles: ["/canvas-frame.css"],
    },
    deviceManager: {
      devices: [{ id: "desktop", name: "Desktop", width: `${EDITOR_STAGE_SIZE}px`, height: `${EDITOR_STAGE_SIZE}px` }],
    },
    plugins: [simulationPlugin],
  });
  ctx.editor = editor;
  refreshSide(ctx);
  rebuildLibrary();

  const paintCurrentScreen = () => {
    const screen = ctx.canvas.screens.find((item) => item.id === ctx.currentScreenId);
    if (screen) loadScreenIntoEditor(editor, screen);
    else setScreenBackground(editor, "", EDITOR_STAGE_SIZE, EDITOR_STAGE_SIZE);
    applyCanvasChrome();
  };

  const restoreIfScreenshotMissing = () => {
    const screen = ctx.canvas.screens.find((item) => item.id === ctx.currentScreenId);
    if (!screen) {
      applyCanvasChrome();
      return;
    }
    const bg = editor.getWrapper()?.findType("sim-background")[0];
    const src = bg?.get("src") || bg?.getEl?.()?.getAttribute("src") || "";
    if (screen.background && !src) {
      paintCurrentScreen();
      return;
    }
    paintScreenVisual(editor, screen);
    applyCanvasChrome();
  };

  const boot = () => {
    if (!editor.getWrapper?.() || !editor.Canvas.getBody?.()) return false;
    const doc = editor.Canvas.getDocument();
    if (doc && !doc.querySelector("base")) {
      const base = doc.createElement("base");
      base.href = `${window.location.origin}/`;
      doc.head.prepend(base);
    }
    window.__simEditor = editor;
    try {
      editor.setDragMode("absolute");
      if (!ctx.currentScreenId && ctx.canvas.screens[0]) {
        ctx.currentScreenId = ctx.canvas.screens[0].id;
      }
      ctx.booted = true;
      paintCurrentScreen();
      refreshSide(ctx);
      rebuildLibrary();
      return true;
    } catch (error) {
      ctx.booted = false;
      console.error(error);
      toast(error.message || "Editor failed to load screens.");
      refreshSide(ctx);
      return false;
    }
  };

  editor.on("load", boot);
  editor.on("canvas:frame:load:body", () => {
    if (!ctx.booted) {
      boot();
      return;
    }
    restoreIfScreenshotMissing();
    refreshSide(ctx);
  });
  setTimeout(boot, 800);

  editor.on("component:selected", () => refreshSide(ctx));
  editor.on("component:deselected", () => refreshSide(ctx));
  editor.on("component:update", () => renderLayerList(ctx.els.layers, editor, () => refreshSide(ctx)));

  shell.querySelector("[data-back]").addEventListener("click", () => {
    persist(ctx);
    ctx.editor.destroy();
    onBack();
  });
  shell.querySelector("[data-settings]").addEventListener("click", () => {
    openCanvasModal({
      canvas: ctx.canvas,
      onSave: (values) => {
        Object.assign(ctx.canvas, values);
        persist(ctx);
        const titleEl = shell.querySelector(".editor-title");
        if (titleEl) titleEl.textContent = ctx.canvas.title || "Untitled canvas";
        toast("Canvas settings saved.", "success");
        refreshSide(ctx);
      },
    });
  });
  shell.querySelector("[data-zoom-in]").addEventListener("click", () => {
    ctx.zoom = Math.min(200, ctx.zoom + 10);
    applyCanvasChrome();
  });
  shell.querySelector("[data-zoom-out]").addEventListener("click", () => {
    ctx.zoom = Math.max(40, ctx.zoom - 10);
    applyCanvasChrome();
  });
  shell.querySelector("[data-grid]").addEventListener("change", (event) => {
    ctx.grid = Number(event.target.value) || 50;
    applyCanvasChrome();
  });
  shell.querySelector("[data-show-grid]").addEventListener("change", (event) => {
    ctx.showGrid = event.target.checked;
    applyCanvasChrome();
  });
  ctx.els.name.addEventListener("change", () => {
    const screen = ctx.canvas.screens.find((item) => item.id === ctx.currentScreenId);
    if (screen) screen.name = ctx.els.name.value.trim() || screen.name;
    refreshSide(ctx);
  });
  ctx.els.library.addEventListener("change", () => {
    const value = ctx.els.library.value;
    ctx.els.library.value = "";
    if (!value) return;
    flushScreen(ctx);
    const [screenId, layerId] = value.split("::");
    const layer = ctx.canvas.screens.find((screen) => screen.id === screenId)?.layers?.find((item) => item.id === layerId);
    if (!layer) {
      toast("That library layer is no longer available.");
      rebuildLibrary();
      return;
    }
    addLayerToCanvas(ctx.editor, layer.type, {
      x: (layer.x || 40) + 24,
      y: (layer.y || 40) + 24,
      width: layer.width,
      height: layer.height,
      props: { ...layer.props, layerName: `${layer.props?.layerName || "Layer"} copy` },
    });
    refreshSide(ctx);
  });
  shell.querySelector("[data-preview]").addEventListener("click", () => {
    persist(ctx);
    if (!ctx.canvas.screens.length) {
      toast("Add a screen before previewing.");
      return;
    }
    openPreview({
      canvas: ctx.canvas,
      startScreenId: ctx.currentScreenId || ctx.canvas.screens[0].id,
      onClose: () => {},
    });
  });
  shell.querySelector("[data-delete]").addEventListener("click", () => {
    const selected = ctx.editor.getSelected();
    if (selected && String(selected.get("type") || "").startsWith("sim-")) {
      selected.remove();
      refreshSide(ctx);
      return;
    }
    if (!ctx.currentScreenId) return;
    if (!confirm("Delete this screen from the canvas?")) return;
    ctx.canvas.screens = ctx.canvas.screens.filter((screen) => screen.id !== ctx.currentScreenId);
    ctx.currentScreenId = ctx.canvas.screens[0]?.id || null;
    if (ctx.currentScreenId) loadScreenIntoEditor(ctx.editor, ctx.canvas.screens[0]);
    else {
      const wrapper = ctx.editor.getWrapper();
      if (typeof wrapper.empty === "function") wrapper.empty();
      setScreenBackground(ctx.editor, "", EDITOR_STAGE_SIZE, EDITOR_STAGE_SIZE);
    }
    persist(ctx);
    refreshSide(ctx);
  });
  shell.querySelector("[data-cancel]").addEventListener("click", () => {
    persist(ctx);
    ctx.editor.destroy();
    onBack();
  });
  shell.querySelector("[data-replace]").addEventListener("click", () => ctx.els.bgFile.click());
  ctx.els.bgFile.addEventListener("change", async () => {
    const file = ctx.els.bgFile.files?.[0];
    ctx.els.bgFile.value = "";
    if (!file) return;
    const src = await fileToDataUrl(file);
    const screen = ctx.canvas.screens.find((item) => item.id === ctx.currentScreenId);
    if (!screen) return;
    screen.background = src;
    screen.width = EDITOR_STAGE_SIZE;
    screen.height = EDITOR_STAGE_SIZE;
    setScreenBackground(ctx.editor, src, EDITOR_STAGE_SIZE, EDITOR_STAGE_SIZE);
    paintScreenVisual(ctx.editor, screen);
    applyCanvasChrome();
    persist(ctx);
    refreshSide(ctx);
  });
  shell.querySelector("[data-undo]").addEventListener("click", () => ctx.editor.UndoManager.undo());
  shell.querySelector("[data-redo]").addEventListener("click", () => ctx.editor.UndoManager.redo());
  shell.querySelector("[data-clone]").addEventListener("click", () => {
    const selected = ctx.editor.getSelected();
    const type = selected?.get("type");
    if (!selected || !String(type || "").startsWith("sim-")) {
      toast("Select a layer to clone.");
      return;
    }
    const style = selected.getStyle();
    const def = getLayerType(type);
    const props = {};
    Object.keys(def?.defaults || {}).forEach((key) => {
      props[key] = selected.get(key);
    });
    props.layerName = `${props.layerName || def.label} copy`;
    addLayerToCanvas(ctx.editor, type, {
      x: (parseFloat(style.left) || 0) + 24,
      y: (parseFloat(style.top) || 0) + 24,
      width: parseFloat(style.width) || def.size.width,
      height: parseFloat(style.height) || def.size.height,
      props,
    });
    refreshSide(ctx);
  });
  shell.querySelector("[data-save]").addEventListener("click", () => {
    if (persist(ctx)) toast("Canvas saved on this browser.", "success");
  });

  return () => ctx.editor?.destroy();
}
