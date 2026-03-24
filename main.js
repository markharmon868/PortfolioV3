import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { gsap } from 'gsap';
import cloudVertSrc from './shaders/cloud.vert.glsl?raw';
import cloudFragSrc from './shaders/cloud.frag.glsl?raw';
import { initUI } from './ui.js';

// ─────────────────────────────────────────────────────────────────────────────
// Section / card data
// ─────────────────────────────────────────────────────────────────────────────
// stopName must match the Blender empty names exactly.
// Card placement comes from the .glb empties; `col` offsets cards left/right
// of the stop empty so multiple cards fan out from a single anchor.

const CARD_SPACING  = 185;
const CARD_SPACING3 = 260;

// Fallback positions used until the .glb is loaded (or if it fails to load).
const FALLBACK_STOPS = {
  'stop-0':          new THREE.Vector3(0,    120, 1800),
  'stop-experience': new THREE.Vector3(0,     30,  580),
  'stop-hackathons': new THREE.Vector3(130,  -20,   60),
  'stop-projects':   new THREE.Vector3(-90,  -80, -470),
  'stop-library':    new THREE.Vector3(0,   -140, -1060),
};

export const SECTIONS = [
  { index: 0, label: '', stopName: 'stop-0', cards: [] },

  {
    index: 1, label: 'Research', stopName: 'stop-experience',
    cards: [
      {
        id: 'earsim', type: 'video', videoSrc: 'media/earsim.mp4',
        title: 'EARSIM — VR Sound Localization',
        badge: 'SIGGRAPH 2025', badgeHref: 'https://dl.acm.org/doi/10.1145/3721250.3743041',
        meta: 'UBC Emerging Media Lab · Spring 2025',
        desc: 'VR system training spatial audio localization for patients with unilateral hearing loss. Built game logic, adaptive UI, and multi-sensory cue delivery. SIGGRAPH Posters 2025.',
        tags: ['Unity', 'VR', 'C#', 'Spatial Audio', 'Medical XR'],
        link: 'https://dl.acm.org/doi/10.1145/3721250.3743041', linkText: 'View publication →',
        col: -1,
      },
      {
        id: 'ict', type: 'video', videoSrc: 'media/ict.mp4',
        title: 'LLM Dialogue Game — USC ICT',
        meta: 'USC Institute for Creative Technologies · Summer 2025',
        desc: 'Third-person Unreal Engine game with LLM-driven NPC dialogue applying Construal Level Theory — exploring persuasive AI in interactive game environments.',
        tags: ['Unreal Engine', 'C++', 'LLM', 'NPC AI', 'Game Dev'],
        col: +1,
      },
    ],
  },

  {
    index: 2, label: 'Hackathons', stopName: 'stop-hackathons',
    cards: [
      {
        id: 'raymarcher', type: 'glsl', canvasId: 'raymarcher-canvas',
        title: 'Sphere-tracing Raymarcher',
        badge: 'Stormhack 1st',
        desc: 'K-Lipschitz sphere tracing for procedural FBM terrain — 40% fewer steps than naive raymarching. Built in 24 hours. Move mouse over the preview to shift the light.',
        tags: ['GLSL', 'WebGL', 'Raymarching', 'Optimization'],
        link: 'https://devpost.com/software/optimized-procedural-heightfield-rendering', linkText: 'View on Devpost →',
        col: -1,
      },
      {
        id: 'shotcaller', type: 'video', videoSrc: 'media/shotcaller.mp4',
        title: 'Shot-caller', badge: 'SF Hackathon',
        desc: 'Built at a San Francisco hackathon. Description and demo coming soon.',
        tags: [],
        link: 'https://devpost.com/software/shot-caller', linkText: 'View on Devpost →',
        col: +1,
      },
    ],
  },

  {
    index: 3, label: 'Projects', stopName: 'stop-projects',
    cards: [
      {
        id: 'fluid', type: 'glsl', canvasId: 'fluid-canvas',
        title: 'Fluid Simulation',
        desc: 'GPU-accelerated fluid simulation exploring Navier-Stokes dynamics in real time.',
        tags: ['GLSL', 'WebGL', 'Physics Simulation', 'GPU'],
        col: -1,
      },
      {
        id: 'motion', type: 'placeholder', placeholderClass: 'c3-placeholder--motion',
        title: '3D Animation & Motion', meta: 'CENT.co · 2022–2024',
        desc: 'Blender 3D animations and motion graphics for artist collaborations.',
        tags: ['Blender', '3D Animation', 'Motion Graphics'],
        col: +1,
      },
    ],
  },

  {
    index: 4, label: '/ Library', stopName: 'stop-library',
    cards: [
      { id: 'ski',   type: 'video', videoSrc: 'media/ski.mp4',   mediaLabel: 'Skiing · Whistler', isMedia: true, col: -1 },
      { id: 'skate', type: 'video', videoSrc: 'media/skate.mp4', mediaLabel: 'Skating · SF',      isMedia: true, col:  0 },
      { id: 'surf',  type: 'video', videoSrc: 'media/surf.mp4',  mediaLabel: 'Surfing',            isMedia: true, col: +1 },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Card DOM builder
// ─────────────────────────────────────────────────────────────────────────────

function buildCard(card) {
  const isMedia = card.isMedia;
  const el = document.createElement('div');
  el.className = 'css3d-card' + (isMedia ? ' media-card' : '');
  el.id = 'card-' + card.id;
  el.style.opacity = '0';

  const mediaDiv = document.createElement('div');
  mediaDiv.className = 'c3-media';

  if (card.type === 'video') {
    const vid = document.createElement('video');
    vid.id = 'vid-' + card.id;
    vid.loop = true; vid.muted = true;
    vid.setAttribute('playsinline', '');
    vid.setAttribute('preload', 'none');
    vid.dataset.src = card.videoSrc || '';
    mediaDiv.appendChild(vid);

    const overlay = document.createElement('div');
    overlay.className = 'c3-overlay' + (isMedia ? ' c3-overlay-thumb' : '');

    if (isMedia) {
      const lbl = document.createElement('span');
      lbl.className = 'media-label';
      lbl.textContent = card.mediaLabel || '';
      overlay.appendChild(lbl);
      el.addEventListener('mouseenter', () => { loadVideo(vid); vid.play().catch(() => {}); });
      el.addEventListener('mouseleave', () => vid.pause());
    }
    mediaDiv.appendChild(overlay);

  } else if (card.type === 'glsl') {
    const canvas = document.createElement('canvas');
    canvas.id = card.canvasId;
    mediaDiv.appendChild(canvas);
    const loading = document.createElement('div');
    loading.className = 'c3-loading';
    loading.id = 'loading-' + card.id;
    loading.textContent = 'Loading GLSL…';
    mediaDiv.appendChild(loading);

  } else if (card.type === 'placeholder') {
    const ph = document.createElement('div');
    ph.className = 'c3-placeholder ' + (card.placeholderClass || '');
    ph.textContent = card.title || '';
    mediaDiv.appendChild(ph);
  }

  el.appendChild(mediaDiv);

  if (!isMedia) {
    const body = document.createElement('div');
    body.className = 'c3-body';
    const headerRow = document.createElement('div');
    headerRow.className = 'c3-header';
    const titleEl = document.createElement('h3');
    titleEl.className = 'c3-title';
    titleEl.textContent = card.title || '';
    headerRow.appendChild(titleEl);
    if (card.badge) {
      const badgeEl = document.createElement(card.badgeHref ? 'a' : 'span');
      badgeEl.className = 'badge';
      badgeEl.textContent = card.badge;
      if (card.badgeHref) { badgeEl.href = card.badgeHref; badgeEl.target = '_blank'; badgeEl.rel = 'noopener'; }
      headerRow.appendChild(badgeEl);
    }
    body.appendChild(headerRow);
    if (card.meta) { const m = document.createElement('p'); m.className = 'c3-meta'; m.textContent = card.meta; body.appendChild(m); }
    if (card.desc) { const d = document.createElement('p'); d.className = 'c3-desc'; d.textContent = card.desc; body.appendChild(d); }
    if (card.tags?.length) {
      const tagsDiv = document.createElement('div');
      tagsDiv.className = 'c3-tags';
      card.tags.forEach(t => { const s = document.createElement('span'); s.className = 'tag'; s.textContent = t; tagsDiv.appendChild(s); });
      body.appendChild(tagsDiv);
    }
    // Links are shown in the focus-mode overlay (regular DOM) since
    // CSS3D pointer events don't work.
    el.appendChild(body);
  }

  return el;
}

export function loadVideo(vid) {
  if (!vid.src && vid.dataset.src) {
    vid.src = vid.dataset.src;
    vid.load();
    vid.addEventListener('canplay', () => {
      vid.classList.add('loaded');
      const label = document.getElementById('vid-label-' + vid.id.replace('vid-', ''));
      if (label) label.style.opacity = '0';
    }, { once: true });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Procedural grid texture for the ground plane
// ─────────────────────────────────────────────────────────────────────────────

function createGridTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = '#1c2e50';
  ctx.lineWidth = 1;
  const divisions = 8;
  for (let i = 0; i <= divisions; i++) {
    const pos = (i / divisions) * size;
    ctx.beginPath(); ctx.moveTo(pos, 0); ctx.lineTo(pos, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, pos); ctx.lineTo(size, pos); ctx.stroke();
  }

  ctx.fillStyle = '#253d6a';
  for (let i = 0; i <= divisions; i++) {
    for (let j = 0; j <= divisions; j++) {
      ctx.beginPath();
      ctx.arc((i / divisions) * size, (j / divisions) * size, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return new THREE.CanvasTexture(canvas);
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene init
// ─────────────────────────────────────────────────────────────────────────────

function init() {
  // ── Renderers ────────────────────────────────────────────────────────────────
  const webglRenderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('bg-canvas'),
    antialias: true, alpha: false, powerPreference: 'high-performance',
  });
  webglRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  webglRenderer.setSize(innerWidth, innerHeight);
  webglRenderer.setClearColor(0x0d1526, 1); // fallback if sky dome fails

  const css3dRenderer = new CSS3DRenderer();
  css3dRenderer.setSize(innerWidth, innerHeight);
  document.getElementById('css3d-container').appendChild(css3dRenderer.domElement);

  // ── Camera ───────────────────────────────────────────────────────────────────
  // On portrait screens, widen the vertical FOV so the scene extends vertically
  // rather than cropping horizontally.
  const BASE_FOV = 52;
  function computeFOV() {
    const aspect = innerWidth / innerHeight;
    if (aspect < 1) {
      // Portrait: expand FOV to keep horizontal coverage
      return BASE_FOV / aspect;
    }
    return BASE_FOV;
  }
  const camera = new THREE.PerspectiveCamera(computeFOV(), innerWidth / innerHeight, 1, 20000);

  // ── Scenes ───────────────────────────────────────────────────────────────────
  const glScene    = new THREE.Scene();
  const css3dScene = new THREE.Scene();

  // ── Sky dome ─────────────────────────────────────────────────────────────────
  const skyMesh = new THREE.Mesh(
    new THREE.SphereGeometry(12000, 24, 12),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uHorizon: { value: new THREE.Color(0x1a2d4a) },
        uZenith:  { value: new THREE.Color(0x050c1a) },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vWorldPos;
        uniform vec3 uHorizon;
        uniform vec3 uZenith;
        void main() {
          float t = clamp(normalize(vWorldPos).y * 0.5 + 0.5, 0.0, 1.0);
          gl_FragColor = vec4(mix(uHorizon, uZenith, pow(t, 0.6)), 1.0);
        }
      `,
    }),
  );
  // Camera moves away from origin so the dome must never be frustum-culled
  skyMesh.frustumCulled = false;
  glScene.add(skyMesh);

  // ── Lighting ─────────────────────────────────────────────────────────────────
  glScene.add(new THREE.AmbientLight(0x1a2840, 2.5));

  const dirLight = new THREE.DirectionalLight(0xc8d8ff, 3.0);
  dirLight.position.set(300, 1200, 600);
  glScene.add(dirLight);

  const fillLight = new THREE.DirectionalLight(0x0a1830, 1.0);
  fillLight.position.set(-200, -400, -200);
  glScene.add(fillLight);

  // ── Ground plane ─────────────────────────────────────────────────────────────
  const gridTex = createGridTexture();
  gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping;
  gridTex.repeat.set(60, 60);

  const groundMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(18000, 18000),
    new THREE.MeshStandardMaterial({
      map: gridTex, roughness: 0.95, metalness: 0.05,
      color: new THREE.Color(0x0d1828), envMapIntensity: 0.3,
    }),
  );
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.y = -600;
  glScene.add(groundMesh);

  // ── Cloud planes ─────────────────────────────────────────────────────────────
  const cloudMaterials = [];
  const planeGeo   = new THREE.PlaneGeometry(1, 1);
  const zPositions = [2200, 1600, 1000, 400, -200, -800, -1400, -2000];
  const opacities  = [0.55, 0.50, 0.46, 0.42, 0.38, 0.32, 0.26, 0.20];
  const scaleVals  = [7000, 7500, 8000, 8500, 9000, 9500, 10000, 11000];

  zPositions.forEach((z, i) => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: cloudVertSrc,
      fragmentShader: cloudFragSrc,
      uniforms: {
        uTime:    { value: 0 },
        uDepth:   { value: i / (zPositions.length - 1) },
        uOpacity: { value: opacities[i] },
        uSpeed:   { value: new THREE.Vector2(0.0055 - i * 0.0004, 0.0028 - i * 0.0002) },
        uColorA:  { value: new THREE.Color(0x060a18) },
        uColorB:  { value: new THREE.Color(0x182a50) },
      },
      transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    cloudMaterials.push(mat);
    const mesh = new THREE.Mesh(planeGeo, mat);
    mesh.scale.set(scaleVals[i], scaleVals[i] * 0.6, 1);
    mesh.position.set((Math.random() - 0.5) * 200, (Math.random() - 0.5) * 120, z);
    glScene.add(mesh);
  });

  // ── glTF scene data ──────────────────────────────────────────────────────────
  // Camera path (CatmullRomCurve3) and stop positions are extracted from the
  // .glb exported from Blender.  Until the file is provided, fallbacks are used.
  // Blender scene is ~100x smaller than the Three.js world, so we scale up.
  const GLB_SCALE = 100;

  const stopPositions = SECTIONS.map(s => (FALLBACK_STOPS[s.stopName] || new THREE.Vector3()).clone());
  let cameraPath = null;        // THREE.CatmullRomCurve3 — set when .glb loads
  let stopFractions = null;     // t values [0..1] for each stop along the curve

  // Load the Blender scene — async, non-blocking. Fallbacks work until it loads.
  new GLTFLoader().load(
    'scene.glb',
    (gltf) => {
      const root = gltf.scene;

      // Extract stop empties (scaled)
      SECTIONS.forEach((section, i) => {
        const empty = root.getObjectByName(section.stopName);
        if (empty) {
          stopPositions[i].copy(empty.position).multiplyScalar(GLB_SCALE);
          console.log(`Stop "${section.stopName}" → `, stopPositions[i]);
        } else {
          console.warn(`Empty "${section.stopName}" not found in .glb, using fallback`);
        }
      });

      // Extract camera path from the converted curve mesh named "CameraPath"
      const pathObj = root.getObjectByName('CameraPath');
      if (pathObj) {
        const points = [];
        const extractPoints = (geo) => {
          const pos = geo.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            points.push(new THREE.Vector3(
              pos.getX(i) * GLB_SCALE,
              pos.getY(i) * GLB_SCALE,
              pos.getZ(i) * GLB_SCALE,
            ));
          }
        };
        if (pathObj.geometry) {
          extractPoints(pathObj.geometry);
        } else {
          pathObj.traverse(child => { if (child.geometry) extractPoints(child.geometry); });
        }

        // Deduplicate — glTF line meshes can have repeated verts from segments
        const deduped = [points[0]];
        for (let i = 1; i < points.length; i++) {
          if (points[i].distanceTo(deduped[deduped.length - 1]) > 0.01) {
            deduped.push(points[i]);
          }
        }

        if (deduped.length >= 2) {
          cameraPath = new THREE.CatmullRomCurve3(deduped, false, 'catmullrom', 0.5);
          // Compute t fractions: project each stop onto the curve
          stopFractions = stopPositions.map(pos => {
            let bestT = 0, bestDist = Infinity;
            for (let t = 0; t <= 1; t += 0.001) {
              const d = cameraPath.getPoint(t).distanceTo(pos);
              if (d < bestDist) { bestDist = d; bestT = t; }
            }
            return bestT;
          });
          console.log('Camera path loaded:', deduped.length, 'points, stop fractions:', stopFractions);
        }
      } else {
        console.warn('CameraPath not found in .glb — using fallback positions');
      }

      // Re-place cards at their stop positions now that .glb data is available
      placeCards();

      // Find where the camera currently is on the new curve so transitions
      // start from the right spot (no yank).
      if (cameraPath) {
        let bestT = 0, bestD = Infinity;
        for (let t = 0; t <= 1; t += 0.001) {
          const d = cameraPath.getPoint(t).distanceTo(camTarget.position);
          if (d < bestD) { bestD = d; bestT = t; }
        }
        currentCurveT = bestT;
      }
      // Compute library carousel facing from camera approach direction
      if (cameraPath && stopFractions && libSection) {
        const libT = stopFractions[libSection.index];
        const tangent = cameraPath.getTangent(libT);
        // Cards should face toward the camera (opposite of tangent)
        libFacingAngle = Math.atan2(-tangent.x, -tangent.z) - Math.PI / 2;
      }

      // Re-issue the current stop so it uses the curve path
      goToStop(currentStop);
    },
    undefined,
    (err) => { console.warn('scene.glb not found or failed to load — using fallbacks.', err); },
  );

  // ── CSS3D cards ───────────────────────────────────────────────────────────────
  // Cards are placed relative to their section's stop position.
  // `col` fans cards left/right of the anchor.
  const cardGroups = [];
  const cardObjectMap = new Map(); // card id → CSS3DObject

  SECTIONS.forEach((section, sIdx) => {
    if (!section.cards.length) return;
    const objects = [];
    section.cards.forEach(card => {
      const el  = buildCard(card);
      const obj = new CSS3DObject(el);
      css3dScene.add(obj);
      objects.push(obj);
      cardObjectMap.set(card.id, { obj, card, sectionIndex: sIdx });
    });
    cardGroups.push({ sectionIndex: section.index, objects });
  });

  // ── Card click hitboxes (Three.js raycasting) ───────────────────────────────
  // CSS3DRenderer's nested 3D transforms break DOM pointer events, so we place
  // invisible Three.js planes at each card position and raycast against them.
  const raycaster = new THREE.Raycaster();
  const mouse2 = new THREE.Vector2();
  const hitboxes = [];
  const hitboxGeo = new THREE.PlaneGeometry(320, 440);
  const hitboxMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });

  cardObjectMap.forEach(({ obj }, cardId) => {
    const mesh = new THREE.Mesh(hitboxGeo, hitboxMat);
    mesh.position.copy(obj.position);
    mesh.rotation.y = obj.rotation.y;
    glScene.add(mesh);
    hitboxes.push({ mesh, cardId });
  });

  function syncHitboxes() {
    hitboxes.forEach(({ mesh, cardId }) => {
      const entry = cardObjectMap.get(cardId);
      if (entry) {
        mesh.position.copy(entry.obj.position);
        mesh.rotation.y = entry.obj.rotation.y;
      }
    });
  }

  // Exposed for ui.js to hook into
  let onCardClicked = () => {};

  window.addEventListener('click', e => {
    mouse2.x = (e.clientX / innerWidth) * 2 - 1;
    mouse2.y = -(e.clientY / innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse2, camera);
    const hits = raycaster.intersectObjects(hitboxes.map(h => h.mesh));
    if (hits.length > 0) {
      const hit = hitboxes.find(h => h.mesh === hits[0].object);
      if (hit && !focusedCardId) {
        const entry = cardObjectMap.get(hit.cardId);
        if (entry && parseFloat(entry.obj.element.style.opacity) > 0.5) {
          onCardClicked(hit.cardId);
        }
      }
    }
  });

  // Position cards at their stop anchors (called on init + after .glb loads)
  function placeCards() {
    SECTIONS.forEach((section, sIdx) => {
      if (!section.cards.length) return;
      // Library uses its own carousel layout
      if (section.stopName === 'stop-library') return;

      const anchor = stopPositions[sIdx];
      const spacing = section.cards.length === 3 ? CARD_SPACING3 : CARD_SPACING;
      const needsFlip = section.stopName === 'stop-experience'
                     || section.stopName === 'stop-hackathons';
      const flipY = needsFlip ? Math.PI : 0;
      section.cards.forEach(card => {
        const entry = cardObjectMap.get(card.id);
        if (!entry) return;
        entry.obj.position.set(
          anchor.x + card.col * spacing,
          anchor.y,
          anchor.z,
        );
        const fan = needsFlip ? card.col * 0.10 : -card.col * 0.10;
        entry.obj.rotation.y = flipY + fan;
      });
    });
    // Place library carousel
    placeLibraryCarousel(libraryCarouselIdx, false);
    syncHitboxes();
  }

  // ── Library carousel ──────────────────────────────────────────────────────
  // Cards arranged on a circle around the library stop. The front card faces
  // the camera; side cards are angled away. Rotating the carousel brings a
  // different card to the front.
  const CAROUSEL_RADIUS = 280;
  const libSection = SECTIONS.find(s => s.stopName === 'stop-library');
  const libCards = libSection ? libSection.cards : [];
  let libraryCarouselIdx = 0;
  // Base angle: direction the library faces the camera (computed after .glb loads)
  let libFacingAngle = 0; // default, updated when camera path loads

  function placeLibraryCarousel(activeIdx, animate = true) {
    if (!libSection || !libCards.length) return;
    const anchor = stopPositions[libSection.index];
    const n = libCards.length;
    const angleStep = (Math.PI * 2) / n;

    libCards.forEach((card, i) => {
      const entry = cardObjectMap.get(card.id);
      if (!entry) return;

      // Position on circle: activeIdx card goes to front (facing camera)
      const slotAngle = libFacingAngle + (i - activeIdx) * angleStep;
      const tx = anchor.x + Math.sin(slotAngle) * CAROUSEL_RADIUS;
      const tz = anchor.z + Math.cos(slotAngle) * CAROUSEL_RADIUS;
      const ty = anchor.y;
      // Card faces outward from circle center
      const rotY = slotAngle;

      // Front card full opacity, side cards dimmed
      const isFront = i === activeIdx;
      const targetOpacity = isFront ? 1 : 0.5;

      if (animate) {
        gsap.to(entry.obj.position, { x: tx, y: ty, z: tz, duration: 0.7, ease: 'power2.inOut' });
        gsap.to(entry.obj.rotation, { y: rotY, duration: 0.7, ease: 'power2.inOut' });
        gsap.to(entry.obj.element, { opacity: targetOpacity, duration: 0.5 });
      } else {
        entry.obj.position.set(tx, ty, tz);
        entry.obj.rotation.y = rotY;
      }
    });

    libraryCarouselIdx = activeIdx;
    // Sync hitboxes after animation completes
    if (animate) gsap.delayedCall(0.75, syncHitboxes);
    else syncHitboxes();
  }

  function rotateLibrary(idx) {
    placeLibraryCarousel(idx, true);
  }

  placeCards();

  // ── Camera state ─────────────────────────────────────────────────────────────
  // camTarget holds the current goal position + lookAt.
  // When a .glb curve is available, goToStop tweens along it.
  // Otherwise it lerps directly between stop positions.
  let currentStop = 0;
  const camTarget = {
    position: stopPositions[0].clone(),
    lookAt:   stopPositions[0].clone(),
  };
  camera.position.copy(camTarget.position);

  // ── Render loop ───────────────────────────────────────────────────────────────
  let elapsed = 0;
  let last = performance.now();

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) * 0.001, 0.05);
    last = now;
    elapsed += dt;

    // Gentle idle drift
    const driftAmt = currentStop === 0 ? 1 : 0.25;
    camera.position.set(
      camTarget.position.x + Math.sin(elapsed * 0.23) * 12 * driftAmt,
      camTarget.position.y + Math.cos(elapsed * 0.17) *  6 * driftAmt,
      camTarget.position.z,
    );
    camera.lookAt(camTarget.lookAt.x, camTarget.lookAt.y, camTarget.lookAt.z);

    cloudMaterials.forEach(m => { m.uniforms.uTime.value = elapsed; });
    webglRenderer.render(glScene, camera);
    css3dRenderer.render(css3dScene, camera);
  }
  requestAnimationFrame(frame);

  // ── Resize ────────────────────────────────────────────────────────────────────
  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.fov = computeFOV();
    camera.updateProjectionMatrix();
    webglRenderer.setSize(innerWidth, innerHeight);
    css3dRenderer.setSize(innerWidth, innerHeight);
  });

  // ── Card visibility ───────────────────────────────────────────────────────────
  // cardGroups is small (4 entries); find() cost is negligible.
  function setCardsVisible(sectionIndex, visible, delay = 0) {
    const group = cardGroups.find(g => g.sectionIndex === sectionIndex);
    if (!group) return;
    group.objects.forEach((obj, i) => {
      gsap.to(obj.element, {
        opacity:  visible ? 1 : 0,
        duration: visible ? 0.5 : 0.3,
        delay:    visible ? delay + i * 0.09 : 0,
        ease:     visible ? 'power2.out' : 'power2.in',
      });
    });
  }

  // ── Card focus mode ────────────────────────────────────────────────────────
  // Click a video card → it tweens toward the camera to near-fullscreen,
  // siblings fade out.  Call unfocusCard() to reverse.
  let focusedCardId = null;
  let focusSavedPos = null;
  let focusSavedRot = null;

  function focusCard(cardId) {
    const entry = cardObjectMap.get(cardId);
    if (!entry) return;
    focusedCardId = cardId;

    // Save original transform
    focusSavedPos = entry.obj.position.clone();
    focusSavedRot = entry.obj.rotation.y;

    // Compute a position in front of the camera
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const focusPos = camera.position.clone().add(dir.multiplyScalar(420));

    // Face the camera
    const focusRotY = Math.atan2(
      camera.position.x - focusPos.x,
      camera.position.z - focusPos.z,
    );

    // Tween the card forward
    gsap.to(entry.obj.position, {
      x: focusPos.x, y: focusPos.y, z: focusPos.z,
      duration: 0.7, ease: 'power2.out',
    });
    gsap.to(entry.obj.rotation, {
      y: focusRotY, duration: 0.7, ease: 'power2.out',
    });

    // Fade out siblings in the same section
    const group = cardGroups.find(g => g.sectionIndex === entry.sectionIndex);
    if (group) {
      group.objects.forEach(obj => {
        if (obj !== entry.obj) {
          gsap.to(obj.element, { opacity: 0, duration: 0.4, ease: 'power2.in' });
        }
      });
    }
  }

  function unfocusCard() {
    if (!focusedCardId) return;
    const entry = cardObjectMap.get(focusedCardId);
    if (!entry) { focusedCardId = null; return; }

    // Tween back to original position
    gsap.to(entry.obj.position, {
      x: focusSavedPos.x, y: focusSavedPos.y, z: focusSavedPos.z,
      duration: 0.6, ease: 'power2.inOut',
    });
    gsap.to(entry.obj.rotation, {
      y: focusSavedRot, duration: 0.6, ease: 'power2.inOut',
    });

    // Fade siblings back in
    const group = cardGroups.find(g => g.sectionIndex === entry.sectionIndex);
    if (group) {
      group.objects.forEach(obj => {
        if (obj !== entry.obj) {
          gsap.to(obj.element, { opacity: 1, duration: 0.5, ease: 'power2.out' });
        }
      });
    }

    focusedCardId = null;
    focusSavedPos = null;
    focusSavedRot = null;
  }

  // ── Camera navigation ──────────────────────────────────────────────────────
  // Smooth ramp-up / ramp-down via sine ease. LookAt interpolates smoothly
  // from current target to next stop so the camera doesn't snap.
  let navTween = null;
  // Track the current curve-t so we don't need to search each time
  let currentCurveT = 0;

  function goToStop(index, onArrival) {
    index = Math.max(0, Math.min(index, SECTIONS.length - 1));
    currentStop = index;

    if (navTween) navTween.kill();

    const targetPos = stopPositions[index];
    const fromLookAt = camTarget.lookAt.clone();

    // Compute distance-based duration: longer moves take more time
    const dist = camTarget.position.distanceTo(targetPos);
    const duration = Math.max(1.8, Math.min(3.0, dist / 600));

    if (cameraPath && stopFractions) {
      const fromT = currentCurveT;
      const toT = stopFractions[index];
      const proxy = { t: fromT };

      navTween = gsap.to(proxy, {
        t: toT,
        duration,
        ease: 'sine.inOut',
        onUpdate() {
          const pt = cameraPath.getPoint(proxy.t);
          camTarget.position.copy(pt);
          // Smoothly interpolate lookAt from previous target to new target
          const progress = (proxy.t - fromT) / (toT - fromT || 1);
          camTarget.lookAt.lerpVectors(fromLookAt, targetPos, progress);
          currentCurveT = proxy.t;
        },
        onComplete() { currentCurveT = toT; onArrival?.(); },
      });
    } else {
      // No curve yet — direct lerp between stop positions
      const from = camTarget.position.clone();
      const proxy = { t: 0 };

      navTween = gsap.to(proxy, {
        t: 1,
        duration,
        ease: 'sine.inOut',
        onUpdate() {
          camTarget.position.lerpVectors(from, targetPos, proxy.t);
          camTarget.lookAt.lerpVectors(fromLookAt, targetPos, proxy.t);
        },
        onComplete() { onArrival?.(); },
      });
    }
  }

  return {
    goToStop, setCardsVisible, getCurrentStop: () => currentStop,
    focusCard, unfocusCard, isFocused: () => !!focusedCardId,
    rotateLibrary, getLibraryIdx: () => libraryCarouselIdx,
    set onCardClicked(fn) { onCardClicked = fn; },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero entrance
// ─────────────────────────────────────────────────────────────────────────────

function heroIn() {
  gsap.set(['.hero-hello','.hero-name','.hero-subtitle','.hero-location','.hero-badge'], { opacity: 0, y: 22 });
  gsap.set(['.hero-rule', '.hero-cta'], { opacity: 0 });
  const tl = gsap.timeline({ delay: 0.3 });
  tl.to('.hero-hello',    { opacity: 1, y: 0, duration: 0.55, ease: 'power2.out' }, 0)
    .to('.hero-name',     { opacity: 1, y: 0, duration: 0.80, ease: 'power2.out' }, 0.12)
    .to('.hero-rule',     { opacity: 1,        duration: 0.45, ease: 'power2.out' }, 0.48)
    .to('.hero-subtitle', { opacity: 1, y: 0, duration: 0.55, ease: 'power2.out' }, 0.56)
    .to('.hero-location', { opacity: 1, y: 0, duration: 0.55, ease: 'power2.out' }, 0.68)
    .to('.hero-badge',    { opacity: 1, y: 0, duration: 0.50, ease: 'power2.out' }, 0.80)
    .to('.hero-cta',      { opacity: 1,        duration: 0.70, ease: 'power2.out' }, 1.05);
}

heroIn();
const scene = init();
initUI(scene, SECTIONS);
