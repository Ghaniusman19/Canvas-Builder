/**
 * Agent-side data access (POC stand-in for FiveLumens backend).
 *
 * Admin builder saves: { canvases: [ { id, title, screens: [ { id, layers: [...] } ] } ] }
 * Agent runtime loads the SAME shape — in production via GET /api/...; here via localStorage.
 */

import { loadState } from "./store.js";

const delay = (ms = 180) => new Promise((resolve) => setTimeout(resolve, ms));

/** Simulate: GET /agent/training/canvases — list assigned published canvases */
export async function fetchAssignedCanvases() {
  await delay();
  const state = loadState();
  const canvases = (state.canvases || [])
    .filter((canvas) => Array.isArray(canvas.screens) && canvas.screens.length > 0)
    .map((canvas) => ({
      id: canvas.id,
      title: canvas.title || "Untitled canvas",
      description: canvas.description || "",
      teamTag: canvas.teamTag || "",
      screenCount: canvas.screens.length,
      layerCount: canvas.screens.reduce((sum, screen) => sum + (screen.layers?.length || 0), 0),
      updatedAt: canvas.updatedAt || null,
      status: "assigned",
    }));
  return { success: true, data: canvases };
}

/**
 * Simulate: GET /agent/training/canvases/:id
 * Returns the FULL builder payload the agent player needs:
 * canvas → screens[] → layers[] (with x/y/width/height/props)
 */
export async function fetchCanvasForAgent(canvasId) {
  await delay();
  const state = loadState();
  const canvas = (state.canvases || []).find((item) => item.id === canvasId);
  if (!canvas) {
    return { success: false, message: "Canvas not found or not assigned to this agent.", data: null };
  }
  if (!canvas.screens?.length) {
    return { success: false, message: "This canvas has no screens yet.", data: null };
  }

  // Deep clone so agent runtime never mutates admin studio state accidentally
  const payload = JSON.parse(JSON.stringify(canvas));
  return {
    success: true,
    data: {
      id: payload.id,
      title: payload.title,
      description: payload.description,
      teamTag: payload.teamTag,
      autofillFields: payload.autofillFields || [],
      screens: (payload.screens || []).map((screen, index) => ({
        id: screen.id,
        name: screen.name || `Screen ${index + 1}`,
        background: screen.background || "",
        width: screen.width || 500,
        height: screen.height || 500,
        order: index,
        layers: (screen.layers || []).map((layer, layerIndex) => ({
          id: layer.id,
          type: layer.type,
          x: layer.x || 0,
          y: layer.y || 0,
          width: layer.width || 120,
          height: layer.height || 40,
          order: layerIndex,
          props: { ...(layer.props || {}) },
        })),
      })),
      startScreenId: payload.screens[0]?.id || null,
    },
  };
}

/** Helpers the agent (and FiveLumens) will use when reading the payload */
export function getScreenById(canvas, screenId) {
  return (canvas?.screens || []).find((screen) => screen.id === screenId) || canvas?.screens?.[0] || null;
}

export function getLayers(screen) {
  return screen?.layers || [];
}

export function getJumpLayers(screen) {
  return getLayers(screen).filter((layer) => layer.type === "sim-jump");
}

export function getLayerById(screen, layerId) {
  return getLayers(screen).find((layer) => layer.id === layerId) || null;
}
