/* floating-pages-content.js — driven by content.json
   Matches the v2 two-column layout aesthetic.
   Edit via admin.html — do not touch this file directly. */

(() => {
  if (!window.FloatingPages) { console.warn("FloatingPages not loaded yet"); return; }

  // ── helpers ──────────────────────────────────────────────────────────────
  const slot  = (label, cls = "", img = "") => img
    ? `<div class="fp-slot ${cls}" style="background-image:url('${img}');background-size:cover;background-position:center;"><span class="label">${label}</span></div>`
    : `<div class="fp-slot ${cls}"><span class="label">${label}</span></div>`;

  const audio = (title, dur, url) => url
    ? `<a href="${url}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit;"><div class="fp-audio"><span class="play">▶</span><span>${title}</span><span class="meta">${dur}</span></div></a>`
    : `<div class="fp-audio"><span class="play">▶</span><span>${title}</span><span class="meta">${dur}</span></div>`;

  const embed = (film) => {
    if (film.embed_url) {
      return `<div class="fp-embed"><iframe src="${film.embed_url}" title="${film.title}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`;
    }
    const bg = film.thumbnail ? `background-image:url('${film.thumbnail}');background-size:cover;background-position:center;` : "";
    return `<div class="fp-embed" style="${bg}">${film.id} — pending</div>`;
  };

  const foot  = (txt) => `<div class="fp-pagefoot">${txt}</div>`;

  function modelViewer(url, label) {
    if (!url) return slot(label + " — 3d model pending", "square");
    const id = "mv-" + Math.random().toString(36).slice(2, 7);
    setTimeout(() => {
      const c = document.getElementById(id);
      if (!c || !window.THREE) return;
      const r = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true });
      r.setPixelRatio(window.devicePixelRatio);
      r.setSize(c.clientWidth, c.clientHeight);
      const sc = new THREE.Scene();
      const cam = new THREE.PerspectiveCamera(45, c.clientWidth / c.clientHeight, 0.01, 100);
      sc.add(new THREE.AmbientLight(0xffffff, 0.9));
      const dl = new THREE.DirectionalLight(0xffffff, 0.5);
      dl.position.set(2, 3, 2); sc.add(dl);
      if (!window.THREE.GLTFLoader) return;
      new THREE.GLTFLoader().load(url, (gltf) => {
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        model.position.sub(box.getCenter(new THREE.Vector3()));
        cam.position.set(0, 0, box.getSize(new THREE.Vector3()).length() * 1.2);
        sc.add(model);
        let drag = false, lx = 0, ly = 0;
        c.addEventListener("pointerdown", e => { drag = true; lx = e.clientX; ly = e.clientY; });
        window.addEventListener("pointerup", () => drag = false);
        window.addEventListener("pointermove", e => {
          if (!drag) return;
          model.rotation.y += (e.clientX - lx) * 0.01;
          model.rotation.x += (e.clientY - ly) * 0.01;
          lx = e.clientX; ly = e.clientY;
        });
        (function loop() { requestAnimationFrame(loop); model.rotation.y += 0.003; r.render(sc, cam); })();
      });
    }, 80);
    return `<div style="position:relative;aspect-ratio:1/1;background:#0c0c0c;">
      <canvas id="${id}" style="width:100%;height:100%;display:block;cursor:grab;"></canvas>
      <span style="position:absolute;bottom:8px;left:10px;font-size:10px;color:rgba(255,255,255,0.35);text-transform:lowercase;letter-spacing:0.06em;">${label} — drag to rotate</span>
    </div>`;
  }

  // ── page builders ─────────────────────────────────────────────────────────

  function buildAbout(d) {
    const socials = (d.social_links || []).map(l =>
      l.url ? `<a href="${l.url}" target="_blank" rel="noopener">${l.label}</a>` : `<span style="color:#aaa">${l.label}</span>`
    ).join(", ");
    const studioLines = (d.studio_lines || []).map(l => `<div>${l}</div>`).join("");
    const contactLines = (d.contact_lines || []).map(l => `<div>${l}</div>`).join("");
    const tags = (d.tags || []).map(t => `<div>${t}</div>`).join("");
    return `
      <div class="fp-layout">
        <div class="fp-col">
          <h2>ABOUT ME</h2>
          <p class="preserve-case">${d.name || "BENJAMIN RODRIGUEZ"}</p>
          <p>${d.bio || ""}</p>
          <h2>STUDIO</h2>
          <div class="fp-block">${studioLines}</div>
          <div class="fp-block">${contactLines}</div>
          <div class="fp-inline-links">${socials}</div>
          <div class="fp-tags">${tags}</div>
        </div>
        <div class="fp-col">
          <h2>PORTRAIT</h2>
          ${slot("portrait — drop image", "tall", d.portrait_image)}
          <h2 style="margin-top:48px;">NOTES</h2>
          <p>${d.note_a || ""}</p>
          <p>${d.note_b || ""}</p>
          <p>${d.note_c || ""}</p>
        </div>
      </div>
      ${foot("® 2026 thebenjaminrodriguezwebsite.com all rights reserved.")}
    `;
  }

  function buildSound(d) {
    const byType = {};
    for (const t of (d.tracks || [])) {
      if (!byType[t.type]) byType[t.type] = [];
      byType[t.type].push(t);
    }
    let leftCol = `<h2>SOUND</h2><p>${d.intro || ""}</p>`;
    for (const [type, tracks] of Object.entries(byType)) {
      leftCol += `<h2>${type}</h2>`;
      leftCol += tracks.map(t => audio(t.title, t.duration, t.url)).join("");
    }
    return `
      <div class="fp-layout">
        <div class="fp-col">${leftCol}</div>
        <div class="fp-col">
          <h2>COVER</h2>
          ${slot("cover art — drop image", "square", d.cover_image)}
          <h2 style="margin-top:48px;">NOTES</h2>
          <p>${d.notes || ""}</p>
        </div>
      </div>
      ${foot("sound — 2024–2026 — audio quality 24-bit")}
    `;
  }

  function buildVideo(d) {
    const films = d.films || [];
    const left  = films.filter((_, i) => i % 2 === 0);
    const right = films.filter((_, i) => i % 2 !== 0);
    const col = (arr) => arr.map(f => `
      ${embed(f)}
      <div class="fp-embed-caption">${f.title} / ${f.duration} / ${f.year}</div>
    `).join("");
    return `
      <div class="fp-layout">
        <div class="fp-col">
          <h2>VIDEO</h2>
          <p>${d.intro || ""}</p>
          ${col(left)}
        </div>
        <div class="fp-col">
          <h2>REEL</h2>
          ${col(right)}
        </div>
      </div>
      ${foot("video — 2024–2026 — playback quality hd")}
    `;
  }

  function buildObjects(d) {
    const grid = (d.items || []).map(item =>
      item.model_3d ? `<div>${modelViewer(item.model_3d, item.id)}</div>`
                    : slot(item.id + (item.title !== item.id ? " — " + item.title : ""), "square", item.image)
    ).join("");
    return `
      <div class="fp-layout">
        <div class="fp-col">
          <h2>OBJECTS</h2>
          <p>${d.intro || ""}</p>
          <h2>NOTES</h2>
          <p>${d.notes || ""}</p>
          <h2>BY TYPE</h2>
          <p>garment, footwear, optical media, print, packaging, accessory, hardware, scan, document.</p>
        </div>
        <div class="fp-col">
          <h2>INDEX</h2>
          <div class="fp-slot-grid cols-3">${grid}</div>
        </div>
      </div>
      ${foot("objects — n=" + (d.count || (d.items || []).length) + " — last catalogued 2026")}
    `;
  }

  function buildDummies(d) {
    const grid = (d.items || []).map(item =>
      item.model_3d ? `<div>${modelViewer(item.model_3d, item.id)}</div>`
                    : slot(item.title, "tall", item.image)
    ).join("");
    return `
      <div class="fp-layout">
        <div class="fp-col">
          <h2>DUMMIES</h2>
          <p>${d.intro || ""}</p>
          <h2>NOTES</h2>
          <p>${d.notes || ""}</p>
          <h2>BY FORM</h2>
          <p>full body, torso, half-body, leg form, head, hand, abstract block, articulated.</p>
          <h2>USE</h2>
          <p>display, fitting, scan reference, set design, sculpture, photo subject.</p>
        </div>
        <div class="fp-col">
          <h2>CATALOGUE</h2>
          <div class="fp-slot-grid cols-2">${grid}</div>
        </div>
      </div>
      ${foot("dummies — n=" + (d.count || (d.items || []).length) + " — last entry 2026")}
    `;
  }

  function buildAutomatization(d) {
    const systems = d.systems || [];
    const diagrams = systems.map(s =>
      slot("diagram — " + s.name.toLowerCase(), "square", s.diagram)
    ).join("");
    const systemsHtml = systems.map(s => `
      <h2>${s.name}</h2>
      <p>${s.desc}</p>
    `).join("");
    return `
      <div class="fp-layout">
        <div class="fp-col">
          <h2>AUTOMATIZATION</h2>
          <p>${d.intro || ""}</p>
          ${systemsHtml}
        </div>
        <div class="fp-col">
          <h2>DIAGRAMS</h2>
          <div class="fp-slot-grid cols-2">${diagrams}</div>
          <h2 style="margin-top:48px;">STATUS</h2>
          <p>${d.active_count || systems.length} active workflows. uptime ${d.uptime || "99.94%"} (2026 ytd).</p>
        </div>
      </div>
      ${foot("automatization — " + (d.active_count || systems.length) + " workflows — uptime " + (d.uptime || "99.94%") + " (2026)")}
    `;
  }

  function buildWeb(d) {
    const grid = (d.projects || []).map(p =>
      slot(p.id + " — " + p.title, "wide", p.screenshot)
    ).join("");
    return `
      <div class="fp-layout">
        <div class="fp-col">
          <h2>WEB</h2>
          <p>${d.intro || ""}</p>
          <h2>PROJECTS</h2>
          <p>${(d.projects || []).map(p => `${p.title} (${p.year})`).join(", ")}.</p>
          <h2>STACK</h2>
          <p>${d.stack || ""}</p>
          <h2>NOTES</h2>
          <p>${d.notes || ""}</p>
        </div>
        <div class="fp-col">
          <h2>CAPTURES</h2>
          <div class="fp-slot-grid cols-2">${grid}</div>
        </div>
      </div>
      ${foot("web — 2024–2026 — selected experiments")}
    `;
  }

  // ── bootstrap ─────────────────────────────────────────────────────────────
  fetch("content.json?" + Date.now())
    .then(r => r.json())
    .then(data => {
      const reg = window.FloatingPages.register;
      reg("ABOUT",          { title: "ABOUT ME",       html: buildAbout(data.about) });
      reg("SOUND",          { title: "SOUND",           html: buildSound(data.sound) });
      reg("VIDEO",          { title: "VIDEO",           html: buildVideo(data.video) });
      reg("OBJECTS",        { title: "OBJECTS",         html: buildObjects(data.objects) });
      reg("DUMMIES",        { title: "DUMMIES",         html: buildDummies(data.dummies) });
      reg("AUTOMATIZATION", { title: "AUTOMATIZATION",  html: buildAutomatization(data.automatization) });
      reg("WEB",            { title: "WEB",             html: buildWeb(data.web) });

      // Admin entry — registered with static HTML, no content.json needed
      reg("???", {
        title: "???",
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;min-height:60vh;gap:32px;">
            <h2 style="font-family:Arial,sans-serif;font-weight:700;font-size:clamp(32px,6vw,80px);letter-spacing:-0.02em;text-transform:uppercase;line-height:1;text-align:center;">What you<br>looking for?</h2>
            <div style="display:flex;flex-direction:column;width:320px;gap:0;">
              <input type="password" id="inline-pwd" placeholder="contraseña" autocomplete="current-password"
                style="background:#fff;border:2px solid #000;border-bottom:none;color:#000;font-family:Arial,sans-serif;font-size:14px;font-weight:700;padding:14px 16px;outline:none;width:100%;">
              <button onclick="inlineAdminLogin()"
                style="background:#000;color:#fff;border:2px solid #000;font-family:Arial,sans-serif;font-weight:700;font-size:13px;letter-spacing:0.06em;text-transform:uppercase;padding:14px 24px;cursor:pointer;text-align:left;width:100%;">
                Entrar →
              </button>
              <div id="inline-pwd-error" style="display:none;font-weight:700;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#000;margin-top:10px;">Contraseña incorrecta</div>
            </div>
          </div>
        `,
      });
    })
    .catch(err => console.error("FloatingPages: failed to load content.json", err));
})();

// Admin inline login
window.inlineAdminLogin = function() {
  const val = document.getElementById("inline-pwd").value;
  const ADMIN_PASSWORD = "$14Febero";
  if (val === ADMIN_PASSWORD) {
    window.location.href = "admin.html";
  } else {
    document.getElementById("inline-pwd-error").style.display = "block";
    document.getElementById("inline-pwd").value = "";
    document.getElementById("inline-pwd").focus();
  }
};
document.addEventListener("keydown", function(e) {
  const pwd = document.getElementById("inline-pwd");
  if (pwd && document.activeElement === pwd && e.key === "Enter") {
    window.inlineAdminLogin();
  }
});
