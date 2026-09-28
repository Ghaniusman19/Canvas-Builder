import { getLayerType, splitOptions, LAYER_TYPES } from "./layerTypes.js";
import { el, escapeHtml, fileToDataUrl } from "./utils.js";
import { iconHtml } from "./icons.js";

function fieldValue(model, key, fallback) {
  const value = model.get(key);
  return value == null ? fallback : value;
}

export function renderProperties(host, { editor, canvas, onChange }) {
  host.innerHTML = "";
  const selected = editor?.getSelected?.();
  const header = el("div", { class: "details-head" }, [
    el("h3", {}, "Layer Details"),
  ]);
  host.append(header);

  if (!selected || !String(selected.get("type") || "").startsWith("sim-")) {
    host.append(el("p", { class: "details-empty" }, "Select a layer on the canvas to edit its options."));
    return;
  }

  const typeId = selected.get("type");
  const def = getLayerType(typeId);
  if (!def) return;

  const typeRow = el("label", { class: "prop-field" }, [
    el("span", {}, "Type"),
    el("select", { disabled: true }, [
      el("option", {}, def.detailsLabel),
    ]),
  ]);
  host.append(typeRow);

  def.fields.forEach((field) => {
    const current = fieldValue(selected, field.key, def.defaults[field.key]);
    const wrap = el("label", { class: "prop-field" });
    wrap.append(el("span", {}, field.label));

    const commit = (value) => {
      selected.set(field.key, value);
      onChange?.();
    };

    if (field.type === "checkbox") {
      const input = el("input", { type: "checkbox" });
      input.checked = current === true || current === "true";
      input.addEventListener("change", () => commit(input.checked));
      wrap.classList.add("prop-inline");
      wrap.append(input);
    } else if (field.type === "color") {
      const row = el("div", { class: "prop-color" });
      const input = el("input", { type: "color" });
      input.value = /^#/.test(String(current || "")) ? current : "#ffffff";
      const text = el("input", { type: "text", value: String(current || "") });
      input.addEventListener("input", () => {
        text.value = input.value;
        commit(input.value);
      });
      text.addEventListener("change", () => commit(text.value));
      row.append(input, text);
      wrap.append(row);
    } else if (field.type === "number") {
      const input = el("input", { type: "number", value: String(current || "") });
      input.addEventListener("change", () => commit(Number(input.value)));
      wrap.append(input);
    } else if (field.type === "range") {
      const input = el("input", {
        type: "range",
        min: "0",
        max: "1",
        step: "0.05",
        value: String(current ?? 1),
      });
      const readout = el("em", { class: "prop-readout" }, `${Math.round(Number(current ?? 1) * 100)}%`);
      input.addEventListener("input", () => {
        readout.textContent = `${Math.round(Number(input.value) * 100)}%`;
        commit(Number(input.value));
      });
      wrap.append(el("div", { class: "prop-range" }, [input, readout]));
    } else if (field.type === "select") {
      const select = el("select");
      (field.options || []).forEach((opt) => {
        const option = el("option", { value: opt }, opt);
        if (String(current) === String(opt)) option.selected = true;
        select.append(option);
      });
      select.addEventListener("change", () => commit(select.value));
      wrap.append(select);
    } else if (field.type === "textarea") {
      const input = el("textarea", { rows: "3" }, String(current || ""));
      input.addEventListener("change", () => commit(input.value));
      wrap.append(input);
    } else if (field.type === "options") {
      const list = el("div", { class: "prop-options" });
      const values = splitOptions(current);
      const renderList = (items) => {
        list.innerHTML = "";
        items.forEach((item, index) => {
          const row = el("div", { class: "prop-option-row" });
          const input = el("input", { type: "text", value: item });
          input.addEventListener("change", () => {
            items[index] = input.value;
            commit(items.filter(Boolean).join("\n"));
          });
          const remove = el("button", { type: "button", class: "icon-btn" }, "×");
          remove.addEventListener("click", () => {
            items.splice(index, 1);
            commit(items.join("\n"));
            renderProperties(host, { editor, canvas, onChange });
          });
          row.append(input, remove);
          list.append(row);
        });
        const addRow = el("div", { class: "prop-option-row" });
        const addInput = el("input", { type: "text", placeholder: "Add option" });
        const addBtn = el("button", { type: "button", class: "icon-btn primary" }, "+");
        const add = () => {
          if (!addInput.value.trim()) return;
          items.push(addInput.value.trim());
          commit(items.join("\n"));
          renderProperties(host, { editor, canvas, onChange });
        };
        addBtn.addEventListener("click", add);
        addInput.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            add();
          }
        });
        addRow.append(addInput, addBtn);
        list.append(addRow);
      };
      renderList(values);
      wrap.append(list);
    } else if (field.type === "screen-select") {
      const select = el("select");
      select.append(el("option", { value: "" }, "Select a screen"));
      (canvas.screens || []).forEach((screen) => {
        const option = el("option", { value: screen.id }, screen.name);
        if (screen.id === current) option.selected = true;
        select.append(option);
      });
      select.addEventListener("change", () => commit(select.value));
      wrap.append(select);
    } else if (field.type === "image") {
      const box = el("div", { class: "prop-image" });
      if (current) {
        box.append(el("img", { src: String(current), alt: "" }));
      }
      const input = el("input", { type: "file", accept: "image/*" });
      input.addEventListener("change", async () => {
        const file = input.files?.[0];
        if (!file) return;
        commit(await fileToDataUrl(file));
        renderProperties(host, { editor, canvas, onChange });
      });
      box.append(input);
      wrap.append(box);
    } else if (field.type === "date") {
      const input = el("input", { type: "date", value: String(current || "") });
      input.addEventListener("change", () => commit(input.value));
      wrap.append(input);
    } else if (field.type === "variable") {
      const select = el("select");
      select.append(el("option", { value: "" }, "None"));
      (canvas.autofillFields || []).forEach((fieldItem) => {
        select.append(el("option", { value: `{{${fieldItem.label}}}` }, fieldItem.label));
      });
      select.append(el("option", { value: "{{Today}}" }, "Today's date"));
      select.append(el("option", { value: "{{Time}}" }, "Current time"));
      select.append(el("option", { value: "{{Username}}" }, "Username"));
      if (current) select.value = current;
      select.addEventListener("change", () => {
        commit(select.value);
        if (select.value) selected.set("content", select.value);
        renderProperties(host, { editor, canvas, onChange });
      });
      wrap.append(select);
    } else {
      const input = el("input", { type: "text", value: String(current || "") });
      input.addEventListener("change", () => commit(input.value));
      wrap.append(input);
    }

    host.append(wrap);
  });
}

export function renderLayerList(host, editor, onSelect) {
  host.innerHTML = "";
  host.append(el("div", { class: "layers-head" }, [
    el("span", { html: iconHtml("layers") }),
    el("strong", {}, "Layers"),
  ]));
  const selected = editor?.getSelected?.();
  const wrapper = editor?.getWrapper?.();
  if (!wrapper) return;
  const items = wrapper.components().filter((cmp) => String(cmp.get("type") || "").startsWith("sim-") && cmp.get("type") !== "sim-background");
  if (!items.length) {
    host.append(el("p", { class: "details-empty" }, "No layers yet. Use the toolbar to add one."));
    return;
  }
  items.slice().reverse().forEach((cmp) => {
    const type = getLayerType(cmp.get("type"));
    const row = el("button", {
      type: "button",
      class: `layer-row${selected === cmp ? " is-active" : ""}`,
    }, [
      el("span", { class: "layer-ico", html: iconHtml(type?.icon || "layers") }),
      el("span", {}, cmp.get("layerName") || type?.label || "Layer"),
    ]);
    row.addEventListener("click", () => {
      editor.select(cmp);
      onSelect?.();
    });
    host.append(row);
  });
}

export function renderLibraryMenu(canvas) {
  return LAYER_TYPES.map((type) => ({
    id: type.id,
    label: type.label,
  })).concat(
    (canvas.screens || []).flatMap((screen) =>
      (screen.layers || []).map((layer) => ({
        id: `lib:${screen.id}:${layer.id}`,
        label: `${layer.props?.layerName || layer.type} · ${screen.name}`,
        layer,
      }))
    )
  );
}
