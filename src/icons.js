const svg = (path, { viewBox = "0 0 24 24", stroke = true } = {}) =>
  `<svg viewBox="${viewBox}" fill="${stroke ? "none" : "currentColor"}" stroke="${stroke ? "currentColor" : "none"}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;

export const icons = {
  jump: svg('<rect x="4" y="4" width="9" height="9" rx="1.5"/><rect x="11" y="11" width="9" height="9" rx="1.5"/>'),
  input: svg('<rect x="3" y="7" width="18" height="10" rx="2"/><path d="M7 12h6"/>'),
  paragraph: svg('<path d="M5 6h14M5 12h10M5 18h14"/>'),
  select: svg('<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M8 12h5M16 10l2 2-2 2"/>'),
  html: svg('<path d="M8 8l-4 4 4 4M16 8l4 4-4 4"/>'),
  image: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M21 16l-5-5-8 8"/>'),
  date: svg('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>'),
  toggle: svg('<rect x="3" y="8" width="18" height="8" rx="4"/><circle cx="9" cy="12" r="2.5"/>'),
  typeahead: svg('<circle cx="11" cy="11" r="6"/><path d="M20 20l-3.5-3.5"/>'),
  text: svg('<path d="M5 6h14M12 6v12M8 18h8"/>'),
  preview: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9l6 3-6 3z"/>'),
  undo: svg('<path d="M9 7L5 11l4 4"/><path d="M5 11h9a5 5 0 010 10H9"/>'),
  redo: svg('<path d="M15 7l4 4-4 4"/><path d="M19 11H10a5 5 0 000 10h5"/>'),
  clone: svg('<rect x="8" y="8" width="12" height="12" rx="2"/><rect x="4" y="4" width="12" height="12" rx="2"/>'),
  trash: svg('<path d="M5 7h14M10 7V5h4v2M8 7l1 12h6l1-12"/>'),
  cloud: svg('<path d="M8 17h9a4 4 0 00.4-8 6 6 0 00-11.2-1.6A4 4 0 008 17z"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  check: svg('<path d="M5 12l5 5 9-9"/>'),
  back: svg('<path d="M14 6l-6 6 6 6"/>'),
  grid: svg('<rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><rect x="14" y="14" width="6" height="6"/>'),
  save: svg('<path d="M5 5h11l3 3v11H5z"/><path d="M8 5v5h8V5M8 19v-6h8v6"/>'),
  layers: svg('<path d="M12 4l9 5-9 5-9-5 9-5zM3 14l9 5 9-5"/>'),
};

export function iconHtml(name) {
  return icons[name] || "";
}
