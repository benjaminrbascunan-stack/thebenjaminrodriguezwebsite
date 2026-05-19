/* floating-pages.js — vanilla, framework-free editorial floating windows.
   Public API on window.FloatingPages:
     .register(id, { title, slug, meta, html })       // register a page
     .open(id)                                         // open it
     .close()                                          // close any open
     .isOpen()                                         // bool
   Resolution is case-insensitive and tolerates aliases ("ABOUT ME" ≈ "ABOUT"). */

(() => {
  const root = document.getElementById("fp-root");
  if (!root) { console.warn("FloatingPages: #fp-root not found"); return; }

  // ---------- DOM scaffold ----------
  const backdrop = document.createElement("div");
  backdrop.className = "fp-backdrop";
  root.appendChild(backdrop);

  // Reusable panel; we re-fill its content per open() call.
  const panel = document.createElement("div");
  panel.className = "fp-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.innerHTML = `
    <div class="fp-header">
      <span class="fp-slug" data-fp-slug>—</span>
      <h2 class="fp-title" data-fp-title>—</h2>
      <span class="fp-meta" data-fp-meta></span>
      <button class="fp-close" aria-label="Close" data-fp-close></button>
    </div>
    <div class="fp-body" data-fp-body></div>
  `;
  root.appendChild(panel);

  const slugEl  = panel.querySelector("[data-fp-slug]");
  const titleEl = panel.querySelector("[data-fp-title]");
  const metaEl  = panel.querySelector("[data-fp-meta]");
  const bodyEl  = panel.querySelector("[data-fp-body]");
  const closeBtn = panel.querySelector("[data-fp-close]");

  // ---------- registry ----------
  const pages = new Map();
  function normKey(s) { return String(s || "").toUpperCase().replace(/[^A-Z]/g, ""); }

  function register(id, def) {
    pages.set(normKey(id), { id, ...def });
  }

  function resolve(id) {
    const k = normKey(id);
    if (pages.has(k)) return pages.get(k);
    // Tolerate aliases — e.g. "ABOUT ME" → "ABOUT" if no exact entry.
    for (const [key, val] of pages) {
      if (k.startsWith(key) || key.startsWith(k)) return val;
    }
    return null;
  }

  // ---------- open/close ----------
  let isOpen = false;
  let lastScrollY = 0;

  function lockScroll() {
    lastScrollY = window.scrollY || 0;
    document.body.style.overflow = "hidden";
  }
  function unlockScroll() {
    document.body.style.overflow = "";
  }

  function open(id) {
    const page = resolve(id);
    if (!page) { console.warn("FloatingPages: page not found:", id); return; }

    // Fill content
    slugEl.textContent  = page.slug  || `// ${page.id.toUpperCase()}`;
    titleEl.textContent = page.title || page.id;
    metaEl.textContent  = page.meta  || "";
    bodyEl.innerHTML    = page.html  || "";
    bodyEl.scrollTop = 0;

    // Animate in.
    // We force a reflow on the panel before adding the `open` class so the
    // browser commits the initial opacity:0/scale(0.96) baseline; otherwise
    // some browsers (and iframed/throttled contexts) skip the transition.
    backdrop.offsetHeight;
    panel.offsetHeight;
    requestAnimationFrame(() => {
      backdrop.classList.add("open");
      panel.classList.add("open");
    });
    lockScroll();
    isOpen = true;
    document.dispatchEvent(new CustomEvent("fp:open", { detail: { id: page.id } }));
  }

  function close() {
    if (!isOpen) return;
    backdrop.classList.remove("open");
    panel.classList.remove("open");
    unlockScroll();
    isOpen = false;
    document.dispatchEvent(new CustomEvent("fp:close"));
  }

  // Close interactions
  closeBtn.addEventListener("click", close);
  backdrop.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (!isOpen) return;
    if (e.key === "Escape") close();
  });

  // Public API
  window.FloatingPages = { register, open, close, isOpen: () => isOpen };
})();
