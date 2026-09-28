export const EDITOR_STAGE_SIZE = 500;

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function $(selector, root = document) {
  return root.querySelector(selector);
}

export function on(el, event, handler) {
  el.addEventListener(event, handler);
  return () => el.removeEventListener(event, handler);
}

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([key, value]) => {
    if (value == null || value === false) return;
    if (key === "class") node.className = value;
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === "html") node.innerHTML = value;
    else node.setAttribute(key, value === true ? "" : String(value));
  });
  (Array.isArray(children) ? children : [children]).forEach((child) => {
    if (child == null || child === false) return;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  });
  return node;
}

export function toast(message, kind = "info") {
  let host = document.querySelector(".sim-toasts");
  if (!host) {
    host = el("div", { class: "sim-toasts" });
    document.body.append(host);
  }
  const item = el("div", { class: `sim-toast sim-toast-${kind}` }, message);
  host.append(item);
  setTimeout(() => item.classList.add("show"), 20);
  setTimeout(() => {
    item.classList.remove("show");
    setTimeout(() => item.remove(), 280);
  }, 2600);
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function imageSize(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 1440, height: 820 });
    img.src = src;
  });
}

export function todayIso() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function formatDisplayDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function extractCssUrl(value) {
  const raw = String(value || "").trim();
  if (!raw || raw === "none") return "";
  const quoted = raw.match(/url\(\s*(['"])([\s\S]*?)\1\s*\)/i);
  if (quoted?.[2]) return quoted[2].trim();
  const bare = raw.match(/url\(\s*([\s\S]*?)\s*\)/i);
  if (bare?.[1]) return bare[1].trim().replace(/^['"]|['"]$/g, "");
  if (/^(data:|blob:|https?:|\/)/i.test(raw)) return raw;
  return "";
}

export function absUrl(src) {
  if (!src) return "";
  if (/^(data:|blob:|https?:)/i.test(src)) return src;
  try {
    return new URL(src, window.location.origin).href;
  } catch {
    return src;
  }
}

export function parsePx(value, fallback = 0) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}
