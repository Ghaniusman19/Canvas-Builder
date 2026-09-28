import { el, uid } from "./utils.js";

export function openCanvasModal({ canvas = null, onSave, onCancel } = {}) {
  const isEdit = Boolean(canvas);
  const fields = (canvas?.autofillFields || []).map((field) => ({ ...field }));
  if (!fields.length) fields.push({ id: uid("field"), label: "Full Name", value: "" });

  const back = el("div", { class: "modal-back" });
  const fieldHost = el("div");
  const paintFields = () => {
    fieldHost.innerHTML = "";
    fields.forEach((field) => {
      const row = el("div", { class: "field-row" });
      const name = el("input", { value: field.label, placeholder: "Field name" });
      const value = el("input", { value: field.value, placeholder: "Value" });
      name.addEventListener("input", () => { field.label = name.value; });
      value.addEventListener("input", () => { field.value = value.value; });
      const remove = el("button", { class: "icon-btn", type: "button", title: "Remove field" }, "×");
      remove.addEventListener("click", () => {
        const index = fields.indexOf(field);
        if (index >= 0) fields.splice(index, 1);
        paintFields();
      });
      row.append(name, value, remove);
      fieldHost.append(row);
    });
  };
  paintFields();

  const title = el("input", { placeholder: "Canvas title", value: canvas?.title || "Sample" });
  const description = el("textarea", { rows: "3", placeholder: "What this canvas is about" });
  description.value = canvas?.description || "";
  const team = el("input", { placeholder: "Theme / team tag", value: canvas?.teamTag || "Clear Source" });

  const close = () => {
    back.remove();
    onCancel?.();
  };

  const modal = el("div", { class: "modal" }, [
    el("h2", {}, isEdit ? "Edit canvas" : "Create a new canvas"),
    el("label", {}, ["Title", title]),
    el("label", {}, ["Description", description]),
    el("label", {}, ["Theme tag", team]),
    el("label", {}, "Autofill fields"),
    fieldHost,
    el("button", {
      class: "btn ghost",
      type: "button",
      onclick: () => {
        fields.push({ id: uid("field"), label: "New field", value: "" });
        paintFields();
      },
    }, "+ Add autofill field"),
    el("div", { class: "modal-actions" }, [
      el("button", { class: "btn ghost", type: "button", onclick: close }, "Cancel"),
      el("button", {
        class: "btn primary",
        type: "button",
        onclick: () => {
          onSave?.({
            title: title.value.trim() || "Untitled canvas",
            description: description.value.trim(),
            teamTag: team.value.trim(),
            autofillFields: fields.filter((field) => field.label.trim()),
          });
          back.remove();
        },
      }, isEdit ? "Save changes" : "Create & open builder"),
    ]),
  ]);
  back.append(modal);
  back.addEventListener("click", (event) => {
    if (event.target === back) close();
  });
  document.body.append(back);
  title.focus();
}
