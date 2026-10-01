import { uid, todayIso, EDITOR_STAGE_SIZE } from "./utils.js";

const STORAGE_KEY = "screen-simulation-studio-v1";

function seedDemoCanvas() {
  const loginId = uid("screen");
  const dashId = uid("screen");
  return {
    id: uid("canvas"),
    title: "Sample myHR",
    description: "Login to dashboard walkthrough used in the client demo call.",
    teamTag: "Clear Source",
    updatedAt: Date.now(),
    autofillFields: [
      { id: uid("field"), label: "Full Name", value: "Amy Diego Dejos" },
      { id: uid("field"), label: "Username", value: "jamie.dejos" },
    ],
    screens: [
      {
        id: loginId,
        name: "Log in",
        background: "/screens/login.svg",
        width: 1440,
        height: 820,
        layers: [
          {
            id: uid("layer"),
            type: "sim-select",
            x: 214,
            y: 168,
            width: 168,
            height: 36,
            props: {
              layerName: "List of Name",
              optionsText: "Jamie\nAndrew\nAmy Diego Dejos",
              correctValue: "Jamie",
              showBorder: true,
              fontColor: "#111827",
              backgroundColor: "#ffffff",
              helpText: "Select Jamie",
              clickGuide: true,
              clickGuideText: "Select Jamie",
              errorMessage: "Incorrect selection.",
            },
          },
          {
            id: uid("layer"),
            type: "sim-input",
            x: 870,
            y: 270,
            width: 420,
            height: 48,
            props: {
              layerName: "Account Name",
              placeholder: "Account Name",
              correctValue: "Amy Diego Dejos",
              showBorder: false,
              fontColor: "#111827",
              backgroundColor: "#ffffff",
              fontSize: 14,
              fontWeight: "400",
              helpText: "Input your name",
              clickGuide: true,
              clickGuideText: "Input your name",
              errorMessage: "Incorrect name. Please try again.",
            },
          },
          {
            id: uid("layer"),
            type: "sim-text",
            x: 78,
            y: 210,
            width: 320,
            height: 36,
            props: {
              layerName: "Full name",
              content: "{{Full Name}}",
              fontColor: "#ffffff",
              fontSize: 18,
              fontWeight: "600",
            },
          },
          {
            id: uid("layer"),
            type: "sim-text",
            x: 78,
            y: 248,
            width: 280,
            height: 28,
            props: {
              layerName: "Today",
              content: "{{Today}}",
              fontColor: "#ffffff",
              fontSize: 14,
              fontWeight: "400",
            },
          },
          {
            id: uid("layer"),
            type: "sim-jump",
            x: 1148,
            y: 478,
            width: 142,
            height: 42,
            props: {
              layerName: "Login",
              jumpTo: dashId,
              helpText: "Click the login",
              clickGuide: false,
              clickGuideText: "Click the login",
            },
          },
        ],
      },
      {
        id: dashId,
        name: "Dashboard",
        background: "/screens/dashboard.svg",
        width: 1440,
        height: 820,
        layers: [
          {
            id: uid("layer"),
            type: "sim-paragraph",
            x: 284,
            y: 348,
            width: 672,
            height: 180,
            props: {
              layerName: "Leave notes",
              placeholder: "Add a detailed note for this request",
              correctValue: "",
              showBorder: false,
              fontColor: "#111827",
              backgroundColor: "rgba(255,255,255,0.92)",
              fontSize: 14,
              helpText: "Enter a note",
            },
          },
          {
            id: uid("layer"),
            type: "sim-date",
            x: 284,
            y: 588,
            width: 280,
            height: 44,
            props: {
              layerName: "Start date",
              correctValue: `${new Date().getFullYear()}-03-14`,
              helpText: "Pick the correct date",
              clickGuide: true,
              clickGuideText: "Select 14",
              errorMessage: "Please select the correct date.",
            },
          },
          {
            id: uid("layer"),
            type: "sim-toggle",
            x: 1028,
            y: 392,
            width: 220,
            height: 72,
            props: {
              layerName: "AM PM",
              srcOff: "/screens/ampm-off.svg",
              srcOn: "/screens/ampm-on.svg",
              correctValue: "on",
              helpText: "Select PM",
              clickGuide: true,
            },
          },
          {
            id: uid("layer"),
            type: "sim-jump",
            x: 1240,
            y: 720,
            width: 140,
            height: 44,
            props: {
              layerName: "Finish",
              jumpTo: "",
              helpText: "Complete the simulation",
              clickGuide: true,
              clickGuideText: "Finish",
            },
          },
        ],
      },
    ],
  };
}

function blankState() {
  return { canvases: [seedDemoCanvas()] };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = blankState();
      saveState(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.canvases)) {
      const seeded = blankState();
      saveState(seeded);
      return seeded;
    }
    return parsed;
  } catch {
    const seeded = blankState();
    try {
      saveState(seeded);
    } catch {
      /* ignore quota on seed */
    }
    return seeded;
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function createCanvas({ title, description, teamTag, autofillFields }) {
  return {
    id: uid("canvas"),
    title: title || "Untitled canvas",
    description: description || "",
    teamTag: teamTag || "",
    updatedAt: Date.now(),
    autofillFields: autofillFields?.length
      ? autofillFields
      : [{ id: uid("field"), label: "Full Name", value: "" }],
    screens: [],
  };
}

export function duplicateCanvas(canvas) {
  const idMap = {};
  const screens = (canvas.screens || []).map((screen) => {
    const nextId = uid("screen");
    idMap[screen.id] = nextId;
    return {
      ...screen,
      id: nextId,
      layers: (screen.layers || []).map((layer) => ({
        ...layer,
        id: uid("layer"),
        props: { ...(layer.props || {}) },
      })),
    };
  });
  screens.forEach((screen) => {
    screen.layers.forEach((layer) => {
      if (layer.props?.jumpTo && idMap[layer.props.jumpTo]) {
        layer.props.jumpTo = idMap[layer.props.jumpTo];
      }
    });
  });
  return {
    ...canvas,
    id: uid("canvas"),
    title: `${canvas.title || "Untitled canvas"} copy`,
    updatedAt: Date.now(),
    autofillFields: (canvas.autofillFields || []).map((field) => ({
      ...field,
      id: uid("field"),
    })),
    screens,
  };
}

export function createScreen({ name, background, width, height }) {
  return {
    id: uid("screen"),
    name: name || "Untitled screen",
    background: background || "",
    width: width || EDITOR_STAGE_SIZE,
    height: height || EDITOR_STAGE_SIZE,
    layers: [
      {
        id: uid("layer"),
        type: "sim-jump",
        x: 40,
        y: 40,
        width: 148,
        height: 44,
        props: {
          layerName: "Jump Layer",
          jumpTo: "",
          helpText: "",
          clickGuide: true,
          clickGuideText: "Click here",
        },
      },
    ],
  };
}

export function resolveVariables(text, canvas) {
  let output = String(text || "");
  const fields = canvas?.autofillFields || [];
  fields.forEach((field) => {
    const token = `{{${field.label}}}`;
    output = output.replaceAll(token, field.value || "");
  });
  output = output
    .replaceAll("{{Full Name}}", fields.find((f) => /full name/i.test(f.label))?.value || "")
    .replaceAll("{{Username}}", fields.find((f) => /user/i.test(f.label))?.value || "")
    .replaceAll("{{Today}}", new Date().toLocaleDateString())
    .replaceAll("{{Date}}", new Date().toLocaleDateString())
    .replaceAll("{{Time}}", new Date().toLocaleTimeString());
  return output;
}

export { todayIso };
