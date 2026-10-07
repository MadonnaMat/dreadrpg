// Helpers injected into the page. React's controlled inputs ignore a plain
// `el.value = x`, and its onBlur listens for focusout rather than blur, so
// both need the awkward versions below.
export const DOM = `
window.__h = {
  vis(el) {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  },
  byText(text, sel = "button, a, label, .tab-button") {
    return [...document.querySelectorAll(sel)].filter(
      (e) => this.vis(e) && e.textContent.trim().toLowerCase().includes(text.toLowerCase())
    );
  },
  click(text, sel) {
    const el = this.byText(text, sel)[0];
    if (!el) throw new Error("no element matching: " + text);
    el.click();
    return el.textContent.trim();
  },
  setV(el, v) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
    Object.getOwnPropertyDescriptor(proto.prototype, "value").set.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  },
  blurAll(selector) {
    document.querySelectorAll(selector).forEach((el) =>
      el.dispatchEvent(new FocusEvent("focusout", { bubbles: true }))
    );
  },
  fill(placeholder, value) {
    const el = [...document.querySelectorAll("input, textarea")].find(
      (e) => this.vis(e) && (e.placeholder || "").toLowerCase().includes(placeholder.toLowerCase())
    );
    if (!el) throw new Error("no field with placeholder: " + placeholder);
    this.setV(el, value);
    return el.value;
  },
};
"ready"`;
