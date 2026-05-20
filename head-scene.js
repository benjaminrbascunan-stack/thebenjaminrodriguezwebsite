// TheBenjaminRodriguezWebsite — low-poly head scene
// Icosahedron textured with a face atlas; drag-rotate with momentum,
// auto-rotation when idle, hover face → category label brightens, click → zoom.

(() => {
  const CATEGORIES = [
    { id: "ABOUT ME",       dir: [ 0.00, -0.45,  1.00] },  // mouth — front lower-center
    { id: "SOUND",          dir: [-1.00,  0.00,  0.15] },  // left ear (viewer's left)
    { id: "VIDEO",          dir: [-0.40,  0.42,  1.00] },  // left eye (viewer's left)
    { id: "OBJECTS",        dir: [ 0.40,  0.42,  1.00] },  // right eye (viewer's right)
    { id: "DUMMIES",        dir: [ 0.00,  1.00,  0.30] },  // top — forehead/crown
    { id: "AUTOMATIZATION", dir: [ 1.00,  0.00,  0.15] },  // right ear (viewer's right)
    { id: "WEB",            dir: [ 0.00, -1.00,  0.30] },  // bottom — chin
    { id: "???",            dir: [ 0.55, -0.70, -0.80] },  // back-lower — hidden admin
  ];
  const FILL_LABEL = "ADD LATER";
  const FILL_COUNT = 2;     // two placeholder labels only

  const canvas        = document.getElementById("scene");
  const labelsRoot    = document.getElementById("labels");
  const loader        = document.getElementById("loader");
  const focusOverlay  = document.getElementById("focus-overlay");
  const focusPanel    = document.getElementById("focus-panel");

  // ---------- renderer / scene / camera ----------
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,        // we WANT the chunky look
    powerPreference: "high-performance",
    preserveDrawingBuffer: true,
  });
  renderer.setClearColor(0x000000, 0);
  // Render at full resolution; the chunky look comes from detail=0 geometry + NearestFilter texture.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    34,
    window.innerWidth / window.innerHeight,
    0.1, 100
  );
  camera.position.set(0, 0, 4.6);

  // ---------- lights ----------
  scene.add(new THREE.AmbientLight(0xffffff, 0.78));
  const key = new THREE.DirectionalLight(0xffffff, 0.55);
  key.position.set(2.2, 3.0, 2.4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xfff0e8, 0.22);
  fill.position.set(-2.0, -1.4, 1.0);
  scene.add(fill);
  const rim  = new THREE.DirectionalLight(0xd8dae0, 0.35);
  rim.position.set(0, 0, -3);
  scene.add(rim);

  // ---------- head ----------
  // Truncated-icosahedron-style polyhedron: IcosahedronGeometry detail=1 gives
  // 80 facets — visually close to a truncated icosahedron. We replace its UVs
  // with a proper spherical projection so the face atlas wraps cleanly
  // (PolyhedronGeometry's default seam handling drops black-atlas-edge regions
  // onto front-facing faces, leaving the head looking flat-black).
  const RADIUS = 0.86;
  const geometry = new THREE.IcosahedronGeometry(RADIUS, 1);
  {
    const pos = geometry.attributes.position;
    const uvs = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const r = Math.sqrt(x*x + y*y + z*z);
      const phi = Math.atan2(x, z);             // -π..π
      const theta = Math.acos(y / r);           // 0..π
      uvs[i*2]   = phi / (2 * Math.PI) + 0.5;   // 0..1, seam at z<0 / x≈0
      uvs[i*2+1] = 1 - theta / Math.PI;         // 0=south pole, 1=north pole
    }
    // Fix triangles that cross the seam — shift small-u verts by +1 so the
    // interpolated u stays continuous within the face.
    for (let f = 0; f < pos.count / 3; f++) {
      const i0 = f*3+0, i1 = f*3+1, i2 = f*3+2;
      const u0 = uvs[i0*2], u1 = uvs[i1*2], u2 = uvs[i2*2];
      const max = Math.max(u0, u1, u2);
      const min = Math.min(u0, u1, u2);
      if (max - min > 0.5) {
        if (u0 < 0.25) uvs[i0*2] += 1;
        if (u1 < 0.25) uvs[i1*2] += 1;
        if (u2 < 0.25) uvs[i2*2] += 1;
      }
    }
    geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  }
  geometry.computeVertexNormals();

  // Per-vertex colors for hover-darken effect
  const positions = geometry.attributes.position;
  const vertCount = positions.count;
  const colorArr = new Float32Array(vertCount * 3).fill(1.0);
  geometry.setAttribute("color", new THREE.BufferAttribute(colorArr, 3));

  // Multi-texture system — reacts to spin speed
  const texLoader = new THREE.TextureLoader();
  const FACE_TEXTURES = [
    "assets/head-texture.png",   // 0: normal
    "assets/head-dizzy-1.png",   // 1: dizzy light
    "assets/head-dizzy-2.png",   // 2: dizzy heavy
    "assets/head-dizzy-3.png",   // 3: about to vomit
    "assets/head-vomit-1.png",   // 4: vomit frame 1
    "assets/head-vomit-2.png",   // 5: vomit frame 2
  ];
  function makeTexture(url, onLoad) {
    const t = texLoader.load(url, onLoad, undefined, onLoad);
    t.minFilter = THREE.NearestFilter;
    t.magFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  }
  let loadedCount = 0;
  const onFirstLoad = () => {
    loadedCount++;
    if (loadedCount === 1) {
      loader.classList.add("gone");
      setTimeout(() => loader.remove(), 700);
    }
  };
  const textures = FACE_TEXTURES.map((url, i) => makeTexture(url, i === 0 ? onFirstLoad : undefined));
  const texture = textures[0]; // active texture reference (used by material)

  // Spin tracking
  let spinAccum = 0;          // accumulated spin energy
  let currentTexIdx = 0;
  let vomitTimer = 0;         // counts up during vomit sequence
  let vomitFrame = 0;
  let isVomiting = false;
  let recoveryTimer = 0;

  const material = new THREE.MeshLambertMaterial({
    map: texture,
    vertexColors: true,
    flatShading: true,
    color: 0xffffff,
    emissive: 0x000000,
    emissiveIntensity: 0.0,
  });

  const head = new THREE.Mesh(geometry, material);
  scene.add(head);

  // Subtle floating bob — head suspended in vacuum
  const headBobOrigin = new THREE.Vector3(0, 0, 0);

  // ---------- face data ----------
  const faceCount = vertCount / 3;
  const faceCenters = [];
  const faceNormals = [];
  for (let i = 0; i < faceCount; i++) {
    const a = new THREE.Vector3().fromBufferAttribute(positions, i * 3 + 0);
    const b = new THREE.Vector3().fromBufferAttribute(positions, i * 3 + 1);
    const c = new THREE.Vector3().fromBufferAttribute(positions, i * 3 + 2);
    const center = a.clone().add(b).add(c).multiplyScalar(1/3);
    const normal = new THREE.Vector3()
      .subVectors(b, a)
      .cross(new THREE.Vector3().subVectors(c, a))
      .normalize();
    faceCenters.push(center);
    faceNormals.push(normal);
  }

  // ---------- label assignment ----------
  // For each named CATEGORY, find the face whose centroid direction (from origin)
  // is closest to the target direction. Then pick a handful of additional
  // farthest-point faces to receive the "ADD LATER" placeholder.
  const namedFaces = [];     // {faceIdx, id}
  const usedFaceIdx = new Set();
  for (const cat of CATEGORIES) {
    const target = new THREE.Vector3(...cat.dir).normalize();
    let bestI = -1, bestDot = -Infinity;
    for (let i = 0; i < faceCount; i++) {
      if (usedFaceIdx.has(i)) continue;
      const d = faceCenters[i].clone().normalize().dot(target);
      if (d > bestDot) { bestDot = d; bestI = i; }
    }
    namedFaces.push({ faceIdx: bestI, id: cat.id, isPlaceholder: false });
    usedFaceIdx.add(bestI);
  }
  // Add fill labels via farthest-point on the remaining faces (front-facing-ish only)
  function pickFillFaces(k) {
    const dirs = faceCenters.map((c) => c.clone().normalize());
    const candidates = [];
    for (let i = 0; i < faceCount; i++) {
      if (usedFaceIdx.has(i)) continue;
      // Only pick faces roughly on the front/upper half so they actually appear.
      if (dirs[i].z < -0.3) continue;
      candidates.push(i);
    }
    if (!candidates.length) return [];
    const picked = [candidates[0]];
    while (picked.length < k && picked.length < candidates.length) {
      let bestC = -1, bestMin = -Infinity;
      for (const c of candidates) {
        if (picked.includes(c)) continue;
        let minD = Infinity;
        // also include named faces in distance check so they spread out
        for (const p of [...picked, ...namedFaces.map(f => f.faceIdx)]) {
          const d = 1 - dirs[c].dot(dirs[p]);
          if (d < minD) minD = d;
        }
        if (minD > bestMin) { bestMin = minD; bestC = c; }
      }
      if (bestC < 0) break;
      picked.push(bestC);
    }
    return picked;
  }
  const fillFaceIdxs = pickFillFaces(FILL_COUNT);
  for (const f of fillFaceIdxs) {
    namedFaces.push({ faceIdx: f, id: FILL_LABEL, isPlaceholder: true });
    usedFaceIdx.add(f);
  }

  // Build label DOM
  const faceLabels = namedFaces.map((entry) => {
    const el = document.createElement("div");
    el.className = "face-label" + (entry.isPlaceholder ? " placeholder" : "");
    el.textContent = entry.id;
    labelsRoot.appendChild(el);
    return { el, faceIdx: entry.faceIdx, category: entry.id, isPlaceholder: entry.isPlaceholder };
  });
  // Reverse map: face index → label element (if labeled)
  const faceToLabel = {};
  for (const l of faceLabels) faceToLabel[l.faceIdx] = l;

  // ---------- drag mechanics ----------
  let isDragging = false;
  let last = { x: 0, y: 0 };
  let dragVel = { x: 0, y: 0 };
  let lastMoveTs = 0;

  const DAMPING = 0.93;
  // 30% slower than the previous slow speed (0.0020 → 0.0014).
  const AUTO_YAW = 0.0014;
  const AUTO_PITCH = 0.00022;
  let autoFade = 1;            // 1 = pure auto, 0 = pure post-drag
  let pointerHasMoved = false;

  canvas.addEventListener("pointerdown", (e) => {
    isDragging = true;
    pointerHasMoved = false;
    canvas.classList.add("dragging");
    try { canvas.setPointerCapture(e.pointerId); } catch {}
    last = { x: e.clientX, y: e.clientY };
    dragVel = { x: 0, y: 0 };
    autoFade = 0;
  });

  function endDrag() {
    if (!isDragging) return;
    isDragging = false;
    canvas.classList.remove("dragging");
  }
  window.addEventListener("pointerup",     endDrag);
  window.addEventListener("pointercancel", endDrag);

  function applyRot(yaw, pitch) {
    // rotate around world Y for yaw, world X for pitch (intuitive trackball-ish feel)
    const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitch);
    head.quaternion.premultiply(qx).premultiply(qy);
  }

  // Combined pointermove: drag + raycast hover
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hoveredFace = -1;
  let hoverEnabled = true;

  window.addEventListener("pointermove", (e) => {
    if (isDragging) {
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      if (Math.abs(dx) + Math.abs(dy) > 1) pointerHasMoved = true;
      const SENS = 0.0065;
      applyRot(dx * SENS, dy * SENS);
      dragVel = { x: dx * SENS, y: dy * SENS };
      last = { x: e.clientX, y: e.clientY };
      lastMoveTs = performance.now();
    }
    // raycast hover (cheap, every move)
    const rect = canvas.getBoundingClientRect();
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObject(head, false);
    if (hits.length && hoverEnabled) {
      const fi = hits[0].faceIndex;
      const lbl = faceToLabel[fi];
      // Only consider a face "hovered" if it carries a real category label.
      // Placeholder (ADD LATER) and unlabeled faces are inert.
      if (lbl && !lbl.isPlaceholder) {
        hoveredFace = fi;
        canvas.style.cursor = isDragging ? "grabbing" : "pointer";
      } else {
        hoveredFace = -1;
        canvas.style.cursor = isDragging ? "grabbing" : "grab";
      }
    } else {
      hoveredFace = -1;
      canvas.style.cursor = isDragging ? "grabbing" : "grab";
    }
  });

  canvas.addEventListener("pointerleave", () => {
    hoveredFace = -1;
  });

  // Click → if on a labeled face, enter category
  canvas.addEventListener("click", (e) => {
    if (pointerHasMoved) return;     // suppress click after drag
    if (hoveredFace < 0 || !(hoveredFace in faceToLabel)) return;
    const lbl = faceToLabel[hoveredFace];
    if (lbl.isPlaceholder) return;   // ADD LATER faces are non-interactive
    enterCategory(lbl.category);
  });

  function enterCategory(name) {
    if (window.FloatingPages && typeof window.FloatingPages.open === "function") {
      window.FloatingPages.open(name);
      return;
    }
    // Fallback to the legacy overlay if the floating-pages system isn't loaded.
    focusPanel.textContent = name;
    focusOverlay.classList.add("on");
    hoverEnabled = false;
  }
  function exitCategory() {
    focusOverlay.classList.remove("on");
    hoverEnabled = true;
  }
  // Floating-pages dispatches custom events when it closes — re-enable hover.
  document.addEventListener("fp:close", () => { hoverEnabled = true; });
  document.addEventListener("fp:open",  () => { hoverEnabled = false; });
  window.addEventListener("keydown", exitCategory);
  focusOverlay.addEventListener("click", exitCategory);

  // ---------- per-frame color update (hover darken) ----------
  function updateColors() {
    const HOVER_V = 0.42;
    for (let i = 0; i < faceCount; i++) {
      const v = (i === hoveredFace) ? HOVER_V : 1.0;
      for (let j = 0; j < 3; j++) {
        const o = (i * 3 + j) * 3;
        colorArr[o]   = v;
        colorArr[o+1] = v;
        colorArr[o+2] = v;
      }
    }
    geometry.attributes.color.needsUpdate = true;
  }

  // ---------- per-frame label positioning ----------
  const tmpVec = new THREE.Vector3();
  const tmpNormal = new THREE.Vector3();
  const camWorldPos = new THREE.Vector3();
  function updateLabels() {
    camera.getWorldPosition(camWorldPos);
    const W = window.innerWidth;
    const H = window.innerHeight;
    for (const l of faceLabels) {
      const i = l.faceIdx;
      // world position of face center
      tmpVec.copy(faceCenters[i]).applyMatrix4(head.matrixWorld);
      // world normal
      tmpNormal.copy(faceNormals[i]).applyQuaternion(head.quaternion);
      // outward direction from camera to face
      const toFace = tmpVec.clone().sub(camWorldPos).normalize();
      // dot of inward (-toFace) with face normal: positive when face is facing camera
      const facing = -toFace.dot(tmpNormal);
      const visible = facing > 0.05;

      // project to screen
      const proj = tmpVec.clone().project(camera);
      const x = (proj.x + 1) * 0.5 * W;
      const y = (1 - proj.y) * 0.5 * H;
      l.el.style.left = `${x}px`;
      l.el.style.top  = `${y}px`;

      // visibility / opacity by facing
      if (visible) {
        const active = (i === hoveredFace);
        l.el.classList.toggle("visible", !active);
        l.el.classList.toggle("active", active);
      } else {
        l.el.classList.remove("visible");
        l.el.classList.remove("active");
      }
    }
  }

  // ---------- resize ----------
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  // ---------- texture switcher ----------
  function setTexture(idx) {
    if (currentTexIdx === idx) return;
    currentTexIdx = idx;
    material.map = textures[idx];
    material.needsUpdate = true;
  }

  // Thresholds for spin energy accumulator
  const SPIN_DIZZY1  = 0.8;   // → cara 2
  const SPIN_DIZZY2  = 2.2;   // → cara 3
  const SPIN_VOMIT   = 4.0;   // → trigger vomit sequence
  const SPIN_DECAY   = 1.4;   // how fast energy drains when not spinning
  const SPIN_GAIN    = 18.0;  // how fast energy builds from drag speed

  // ---------- main loop ----------
  const clock = new THREE.Clock();
  let t = 0;
  function animate() {
    const dt = clock.getDelta();
    t += dt;

    // Subtle floating bob (head suspended)
    head.position.y = Math.sin(t * 0.6) * 0.045;
    head.position.x = Math.cos(t * 0.4) * 0.025;

    // Current drag speed
    const dragSpeed = isDragging ? Math.hypot(dragVel.x, dragVel.y) : 0;

    if (isDragging) {
      // rotation handled in pointermove
      spinAccum += dragSpeed * SPIN_GAIN * dt;
    } else {
      // momentum
      applyRot(dragVel.x, dragVel.y);
      dragVel.x *= DAMPING;
      dragVel.y *= DAMPING;

      // blend back to auto rotation as drag velocity decays
      const speed = Math.hypot(dragVel.x, dragVel.y);
      spinAccum += speed * SPIN_GAIN * dt * 0.5; // momentum also builds spin

      autoFade = Math.min(1, autoFade + dt * 0.25);
      const blend = Math.max(autoFade, 1 - speed * 30);
      applyRot(AUTO_YAW * blend, AUTO_PITCH * blend);
    }

    // Vomit sequence state machine
    if (isVomiting) {
      vomitTimer += dt;
      // Sequence: cara4 (about to) → cara5 → cara6 → cara5 → cara6 → back to normal
      if (vomitTimer < 0.6) {
        setTexture(3); // cara 4: about to vomit (hold longer for anticipation)
      } else if (vomitTimer < 1.2) {
        setTexture(4); // cara 5: vomit frame 1
      } else if (vomitTimer < 1.8) {
        setTexture(5); // cara 6: vomit frame 2
      } else if (vomitTimer < 2.3) {
        setTexture(4); // cara 5 again
      } else if (vomitTimer < 2.8) {
        setTexture(5); // cara 6 again
      } else {
        // vomit done — reset everything
        isVomiting = false;
        vomitTimer = 0;
        spinAccum = 0;
        setTexture(0);
      }
    } else {
      // Recovery: drain spin energy over time
      spinAccum = Math.max(0, spinAccum - SPIN_DECAY * dt);

      // Trigger vomit ONLY when user releases (not dragging) and hit max energy
      if (!isDragging && spinAccum >= SPIN_VOMIT) {
        isVomiting = true;
        vomitTimer = 0;
        setTexture(3);
      } else if (spinAccum >= SPIN_DIZZY2) {
        setTexture(2); // cara 3: heavy dizzy
      } else if (spinAccum >= SPIN_DIZZY1) {
        setTexture(1); // cara 2: light dizzy
      } else {
        setTexture(0); // cara 1: normal
      }
    }

    updateColors();
    renderer.render(scene, camera);
    updateLabels();

    requestAnimationFrame(animate);
  }
  animate();
})();
