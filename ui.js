import { gsap } from 'gsap';
import { loadVideo } from './main.js';
import raymarcherFrag from './cards/raymarcher.frag.glsl?raw';

// ─────────────────────────────────────────────────────────────────────────────
// Inline fluid shader (no external fetch needed)
// ─────────────────────────────────────────────────────────────────────────────

const FLUID_FRAG = `
precision mediump float;
uniform vec2 uResolution;
uniform float uTime;

float h(vec2 p){ p=fract(p*vec2(127.1,311.7)); p+=dot(p,p+19.19); return fract(p.x*p.y); }
float n(vec2 p){
  vec2 i=floor(p), f=fract(p), u=f*f*(3.0-2.0*f);
  return mix(mix(h(i),h(i+vec2(1,0)),u.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x),u.y);
}
float fbm(vec2 p){ float v=0.,a=.5; for(int i=0;i<5;i++){v+=a*n(p);a*=.5;p*=2.1;} return v; }

void main(){
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 t  = uv + vec2(uTime*0.036, uTime*0.020);
  float c = fbm(t*3.0 + vec2(fbm(t*2.2+0.3), fbm(t*2.2+1.7)));
  c = smoothstep(0.26, 0.74, c);
  vec3 col = mix(vec3(0.012,0.048,0.130), vec3(0.035,0.160,0.360), c);
  col += vec3(0.0, 0.03, 0.12) * pow(c, 3.0);
  vec2 cen = uv - 0.5;
  col *= 1.0 - dot(cen,cen) * 1.9;
  gl_FragColor = vec4(col, 1.0);
}`;

const VERT_PASS = `attribute vec2 aPosition; void main(){ gl_Position=vec4(aPosition,0.,1.); }`;

// ─────────────────────────────────────────────────────────────────────────────
// WebGL helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeGL(canvas) {
  return canvas.getContext('webgl', { antialias: false, powerPreference: 'low-power' })
      || canvas.getContext('experimental-webgl');
}

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(s));
  return s;
}

function makeProgram(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(p));
  return p;
}

function setupQuad(gl, prog) {
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
  const a = gl.getAttribLocation(prog, 'aPosition');
  gl.enableVertexAttribArray(a);
  gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// GLSL card factory — shared logic for raymarcher + fluid cards
//
// Returns { start, stop } — call start() when section becomes active,
// stop() when leaving. RAF only runs while the card is active.
// ─────────────────────────────────────────────────────────────────────────────

function setupGLSLCard({ canvasId, loadingId, fragSrc, onReady, onDraw }) {
  const noop = { start: () => {}, stop: () => {} };

  const canvas  = document.getElementById(canvasId);
  const loading = loadingId ? document.getElementById(loadingId) : null;
  if (!canvas) return noop;

  let gl;
  try { gl = makeGL(canvas); } catch { return noop; }
  if (!gl) return noop;

  let prog;
  try {
    prog = makeProgram(gl, VERT_PASS, fragSrc);
  } catch (e) {
    console.error(`Shader error (${canvasId}):`, e);
    if (loading) loading.textContent = 'Shader error';
    return noop;
  }

  gl.useProgram(prog);
  setupQuad(gl, prog);

  const uRes  = gl.getUniformLocation(prog, 'uResolution');
  const uTime = gl.getUniformLocation(prog, 'uTime');
  if (loading) loading.classList.add('gone');

  // ResizeObserver: update canvas size reactively — no per-frame layout reads
  let canvasW = 0, canvasH = 0;
  const ro = new ResizeObserver(entries => {
    const dpr = Math.min(devicePixelRatio, 1.5);
    const { width, height } = entries[0].contentRect;
    canvasW = Math.floor(width  * dpr);
    canvasH = Math.floor(height * dpr);
    canvas.width  = canvasW;
    canvas.height = canvasH;
    gl.viewport(0, 0, canvasW, canvasH);
  });
  ro.observe(canvas);

  onReady?.(gl, prog, canvas);

  const startTime = Date.now();
  let rafId = null;

  function render() {
    const t = (Date.now() - startTime) * 0.001;
    gl.useProgram(prog);
    gl.uniform2f(uRes, canvasW, canvasH);
    gl.uniform1f(uTime, t);
    onDraw?.(gl, t);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    rafId = requestAnimationFrame(render);
  }

  return {
    start() { if (!rafId) rafId = requestAnimationFrame(render); },
    stop()  { cancelAnimationFrame(rafId); rafId = null; },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cursor dot
// ─────────────────────────────────────────────────────────────────────────────

function initCursorDot() {
  if (window.matchMedia('(pointer: coarse)').matches) return;
  const dot = document.createElement('div');
  dot.id = 'cursor-dot';
  document.body.appendChild(dot);
  let cx = -100, cy = -100, tx = -100, ty = -100;
  document.addEventListener('mousemove', e => { tx = e.clientX; ty = e.clientY; dot.style.opacity = '1'; });
  document.addEventListener('mouseleave', () => { dot.style.opacity = '0'; });
  (function tick() {
    cx += (tx - cx) * 0.12;
    cy += (ty - cy) * 0.12;
    dot.style.left = cx + 'px';
    dot.style.top  = cy + 'px';
    requestAnimationFrame(tick);
  })();
}

// ─────────────────────────────────────────────────────────────────────────────
// Navigation state machine
// ─────────────────────────────────────────────────────────────────────────────

export function initUI(scene, sections) {
  const NUM_STOPS = sections.length;

  let currentStop  = 0;
  let transitioning = false;

  const btnPrev     = document.getElementById('btn-prev');
  const btnNext     = document.getElementById('btn-next');
  const dots        = document.querySelectorAll('.dot');
  const snavBtns    = document.querySelectorAll('.snav-btn');
  const topNav      = document.getElementById('top-nav');
  const labelEl     = document.getElementById('section-label');
  const heroOverlay = document.getElementById('hero-overlay');
  heroOverlay.style.pointerEvents = 'all'; // clickable on hero, JS sets 'none' when leaving

  initCursorDot();

  // ── GLSL cards ──────────────────────────────────────────────────────────────
  // CSS3DObject elements are appended to the DOM only on the first render()
  // call, so getElementById returns null if called synchronously here.
  // Defer setup until after the first animation frame gives the renderer
  // a chance to inject them into the document.
  const mouse = { x: 0.5, y: 0.5 };
  let rayUMouse;
  let raymarcher = { start: () => {}, stop: () => {} };
  let fluid      = { start: () => {}, stop: () => {} };

  requestAnimationFrame(() => {
    raymarcher = setupGLSLCard({
      canvasId:  'raymarcher-canvas',
      loadingId: 'loading-raymarcher',
      fragSrc:   raymarcherFrag,
      onReady(gl, prog, canvas) {
        rayUMouse = gl.getUniformLocation(prog, 'uMouse');
        canvas.addEventListener('mousemove', e => {
          const r = canvas.getBoundingClientRect();
          mouse.x = (e.clientX - r.left) / r.width;
          mouse.y = 1 - (e.clientY - r.top)  / r.height;
        });
      },
      onDraw(gl) { if (rayUMouse) gl.uniform2f(rayUMouse, mouse.x, mouse.y); },
    });

    fluid = setupGLSLCard({
      canvasId: 'fluid-canvas',
      fragSrc:  FLUID_FRAG,
    });
  });

  // ── Video focus mode ─────────────────────────────────────────────────────
  // Click play → card flies toward camera, video plays fullscreen-ish.
  // Click close → card returns, video pauses.
  let focusedVid = null;
  let focusOverlay = null; // holds close btn + link btn

  function enterFocus(cardId, vid) {
    if (vid) {
      loadVideo(vid);
      vid.play().catch(() => {});
      focusedVid = vid;
    }
    scene.focusCard(cardId);

    // Create overlay with close button (and link if card has one)
    focusOverlay = document.createElement('div');
    focusOverlay.className = 'focus-overlay';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'focus-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', exitFocus);
    focusOverlay.appendChild(closeBtn);

    // Find card data to check for a link
    const section = sections.find(s => s.cards.some(c => c.id === cardId));
    const cardData = section?.cards.find(c => c.id === cardId);
    if (cardData?.link) {
      const linkBtn = document.createElement('a');
      linkBtn.className = 'focus-link';
      linkBtn.href = cardData.link;
      linkBtn.target = '_blank';
      linkBtn.rel = 'noopener';
      linkBtn.textContent = cardData.linkText || 'Open link →';
      focusOverlay.appendChild(linkBtn);
    }

    document.body.appendChild(focusOverlay);
  }

  function exitFocus() {
    if (focusedVid) {
      focusedVid.pause();
      focusedVid = null;
    }
    scene.unfocusCard();
    if (focusOverlay) {
      focusOverlay.remove();
      focusOverlay = null;
    }
  }

  // ── Library viewer ─────────────────────────────────────────────────────────
  // Clicking a library card focuses it (3D fly-toward-camera), plays video,
  // and shows a clip strip + arrows as a DOM overlay.  Switching clips swaps
  // the video src on the card's own <video> element and re-focuses that card.
  const librarySection = sections.find(s => s.stopName === 'stop-library');
  const libraryClips = librarySection ? librarySection.cards : [];
  let libraryOverlay = null;
  let libraryIdx = 0;
  let libraryVidEl = null;  // the <video> on the currently focused card

  function openLibrary(startCardId) {
    libraryIdx = Math.max(0, libraryClips.findIndex(c => c.id === startCardId));
    selectLibraryClip(libraryIdx);
    buildLibraryOverlay();
  }

  function selectLibraryClip(idx) {
    // Stop previous video
    if (libraryVidEl) {
      libraryVidEl.pause();
      libraryVidEl.onended = null;
    }

    // Rotate carousel to bring this card to front
    scene.rotateLibrary(idx);
    libraryIdx = idx;

    // Play video on the front card
    const clip = libraryClips[idx];
    const cardEl = document.getElementById('card-' + clip.id);
    libraryVidEl = cardEl?.querySelector('video');
    if (libraryVidEl) {
      loadVideo(libraryVidEl);
      libraryVidEl.play().catch(() => {});
      libraryVidEl.onended = () => {
        libraryIdx = (libraryIdx + 1) % libraryClips.length;
        selectLibraryClip(libraryIdx);
        updateLibraryStrip();
      };
    }
  }

  function buildLibraryOverlay() {
    if (libraryOverlay) libraryOverlay.remove();

    libraryOverlay = document.createElement('div');
    libraryOverlay.className = 'library-controls';

    // Prev / Next arrows
    const prevBtn = document.createElement('button');
    prevBtn.className = 'library-arrow library-arrow--prev';
    prevBtn.innerHTML = '&#8249;';
    prevBtn.addEventListener('click', () => {
      libraryIdx = (libraryIdx - 1 + libraryClips.length) % libraryClips.length;
      selectLibraryClip(libraryIdx);
      updateLibraryStrip();
    });
    libraryOverlay.appendChild(prevBtn);

    const nextBtn = document.createElement('button');
    nextBtn.className = 'library-arrow library-arrow--next';
    nextBtn.innerHTML = '&#8250;';
    nextBtn.addEventListener('click', () => {
      libraryIdx = (libraryIdx + 1) % libraryClips.length;
      selectLibraryClip(libraryIdx);
      updateLibraryStrip();
    });
    libraryOverlay.appendChild(nextBtn);

    // Clip strip
    const strip = document.createElement('div');
    strip.className = 'library-strip';
    libraryClips.forEach((clip, i) => {
      const thumb = document.createElement('button');
      thumb.className = 'library-thumb' + (i === libraryIdx ? ' active' : '');
      const label = document.createElement('span');
      label.textContent = clip.mediaLabel || clip.id;
      thumb.appendChild(label);
      thumb.addEventListener('click', () => {
        libraryIdx = i;
        selectLibraryClip(i);
        updateLibraryStrip();
      });
      strip.appendChild(thumb);
    });
    libraryOverlay.appendChild(strip);

    document.body.appendChild(libraryOverlay);
  }

  function updateLibraryStrip() {
    const thumbs = libraryOverlay?.querySelectorAll('.library-thumb');
    thumbs?.forEach((t, i) => t.classList.toggle('active', i === libraryIdx));
  }

  function closeLibrary() {
    if (libraryVidEl) {
      libraryVidEl.pause();
      libraryVidEl.onended = null;
      libraryVidEl = null;
    }
    if (libraryOverlay) {
      libraryOverlay.remove();
      libraryOverlay = null;
    }
  }

  // Card clicks detected via Three.js raycasting (DOM events don't work
  // through CSS3DRenderer's nested 3D transforms).
  scene.onCardClicked = (cardId) => {
    // Library cards — open carousel or rotate to clicked card
    if (libraryClips.some(c => c.id === cardId)) {
      if (libraryOverlay) {
        // Already open — rotate to the clicked card
        const idx = libraryClips.findIndex(c => c.id === cardId);
        if (idx >= 0) {
          selectLibraryClip(idx);
          updateLibraryStrip();
        }
      } else {
        openLibrary(cardId);
      }
      return;
    }
    if (scene.isFocused()) return;
    const card = document.getElementById('card-' + cardId);
    const vid = card ? card.querySelector('video') : null;
    enterFocus(cardId, vid);
  };

  function updateControls(stop) {
    dots.forEach(d => d.classList.toggle('active', +d.dataset.stop === stop));
    snavBtns.forEach(b => b.classList.toggle('active', +b.dataset.stop === stop));
    btnPrev.disabled = stop === 0;
    btnNext.disabled = stop === NUM_STOPS - 1;
  }

  // Load non-media videos eagerly when their section activates;
  // media-library videos are loaded on hover inside buildCard.
  function activateSection(stop) {
    raymarcher.stop();
    fluid.stop();
    if (stop === 2) raymarcher.start();
    if (stop === 3) fluid.start();

    const section = sections.find(s => s.index === stop);
    if (!section) return;
    section.cards
      .filter(c => c.type === 'video' && !c.isMedia)
      .forEach(c => {
        const vid = document.getElementById('vid-' + c.id);
        if (vid) loadVideo(vid);
      });
  }

  function goTo(target) {
    if (transitioning || target === currentStop) return;
    // Exit focus/library mode before navigating
    if (libraryOverlay) closeLibrary();
    if (scene.isFocused()) exitFocus();
    if (target < 0 || target >= NUM_STOPS) return;
    transitioning = true;
    const from = currentStop;

    updateControls(target);

    // Fade out hero overlay when leaving stop 0
    if (from === 0) {
      gsap.to(heroOverlay, { opacity: 0, y: -50, duration: 0.8, ease: 'sine.in',
        onComplete: () => { heroOverlay.style.pointerEvents = 'none'; } });
      topNav.classList.add('visible');
    }

    // Fade out previous cards immediately
    if (from > 0) scene.setCardsVisible(from, false);

    // Start loading resources for the target section now (not after arrival)
    activateSection(target);

    // Show incoming cards partway through the transition
    if (target > 0) {
      labelEl.textContent = sections[target].label;
      labelEl.classList.add('visible');
      scene.setCardsVisible(target, true, 0.6);
    }

    scene.goToStop(target, () => {
      if (target === 0) {
        labelEl.classList.remove('visible');
      }
      currentStop = target;
      transitioning = false;
    });
  }

  function toHero() {
    if (transitioning || currentStop === 0) return;
    if (scene.isFocused()) exitFocus();
    transitioning = true;
    const from = currentStop;

    updateControls(0);
    scene.setCardsVisible(from, false);
    labelEl.classList.remove('visible');
    raymarcher.stop();
    fluid.stop();

    scene.goToStop(0, () => {
      gsap.to(heroOverlay, { opacity: 1, y: 0, duration: 0.9, ease: 'sine.out',
        onStart: () => { heroOverlay.style.pointerEvents = 'all'; } });
      topNav.classList.remove('visible');
      currentStop = 0;
      transitioning = false;
    });
  }

  // Single helper used by all backward-navigation triggers
  function goBack() {
    currentStop === 1 ? toHero() : goTo(currentStop - 1);
  }

  // ── Bind controls ───────────────────────────────────────────────────────────
  updateControls(0);

  document.getElementById('hero-cta').addEventListener('click', () => goTo(1));
  document.getElementById('nav-home').addEventListener('click', toHero);
  btnNext.addEventListener('click', () => goTo(currentStop + 1));
  btnPrev.addEventListener('click', goBack);

  dots.forEach(d => d.addEventListener('click', () => {
    const s = +d.dataset.stop;
    s === 0 ? toHero() : goTo(s);
  }));

  snavBtns.forEach(b => b.addEventListener('click', () => goTo(+b.dataset.stop)));

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (libraryOverlay) { closeLibrary(); return; }
      if (scene.isFocused()) { exitFocus(); return; }
    }
    if (['ArrowRight','ArrowDown','PageDown'].includes(e.key)) goTo(currentStop + 1);
    if (['ArrowLeft', 'ArrowUp',  'PageUp'  ].includes(e.key)) goBack();
  });

  let wheelLock = false;
  window.addEventListener('wheel', e => {
    if (wheelLock || transitioning) return;
    wheelLock = true;
    setTimeout(() => { wheelLock = false; }, 800);
    if (e.deltaY > 0) goTo(currentStop + 1); else goBack();
  }, { passive: true });

  let touchY = null;
  window.addEventListener('touchstart', e => { touchY = e.touches[0].clientY; }, { passive: true });
  window.addEventListener('touchend', e => {
    if (touchY === null) return;
    const dy = touchY - e.changedTouches[0].clientY;
    touchY = null;
    if (Math.abs(dy) < 44) return;
    if (dy > 0) goTo(currentStop + 1); else goBack();
  });
}
