// Vanilla JS placeholder for future steps.
// For step 1 we just ensure the asset exists and log a tiny status.
(function () {
  // Keep references to lights so a visible handle can control them
  let floorLightsRef = null;
  let characterLightsRef = null;
  let buddhaLightsRef = null;
  let dragonLightsRef = null;
  const assets = [
    // Ambient textures
    { key: 'character-ambient', src: './normalmap_images/angel-ambient.png' },
    { key: 'buddha-ambient', src: './normalmap_images/budda-ambient.png' },
    { key: 'dragon-ambient', src: './normalmap_images/dragon/ambient.png' },
    // Normal maps
    { key: 'floor-normal', src: './normalmap_images/texture-normalmap.png' },
    { key: 'character-normal', src: './normalmap_images/angel-normalmap.png' },
    { key: 'buddha-normal', src: './normalmap_images/budda-normalmap.png' },
    { key: 'dragon-normal', src: './normalmap_images/dragon/normal.png' },
    // Material map (PBR: metalness/roughness/occlusion)
    { key: 'floor-material', src: './normalmap_images/texture-material.png' },
    { key: 'dragon-material', src: './normalmap_images/dragon/material.png' },
  ];
  let loaded = 0;
  assets.forEach(({ key, src }) => {
    const img = new Image();
    img.onload = function () {
      loaded += 1;
      console.log(`${key} loaded: ${img.width}x${img.height}`);
      if (loaded === assets.length) console.log('Step 3a ready: assets preloaded');
    };
    img.onerror = function () {
      console.warn(`Could not load ${key} at ${src}`);
    };
    img.src = src;
  });

  // Initialize normalmap.js on any `.nm-material` images when available.
  window.addEventListener('DOMContentLoaded', () => {
    const hasLib = typeof window.normalmap === 'function';
    if (!hasLib) {
      console.log('normalmap.js not loaded yet; displaying ambient textures.');
      return;
    }

    // Initialize floor from a <canvas> with data-* URLs so we don't preload via <img>.
    const floorCanvas = document.getElementById('floor');
    if (floorCanvas && floorCanvas.tagName === 'CANVAS') initFloorCanvas(floorCanvas);

    const characterCanvas = document.getElementById('character');
    if (characterCanvas && characterCanvas.tagName === 'CANVAS') initCharacterCanvas(characterCanvas);
    const buddhaCanvas = document.getElementById('buddha');
    if (buddhaCanvas && buddhaCanvas.tagName === 'CANVAS') initCharacterCanvas(buddhaCanvas);
    const dragonCanvas = document.getElementById('dragon');
    if (dragonCanvas && dragonCanvas.tagName === 'CANVAS') initCharacterCanvas(dragonCanvas);

    // If a visible light handle is present, wire it up once lights are ready
    const lightEl = document.getElementById('light');
    if (lightEl) maybeInitVisibleLight(lightEl);

    const materials = Array.from(document.querySelectorAll('img.nm-material'));
    if (materials.length === 0) return;

    materials.forEach((img) => {
      const normalSrc = img.getAttribute('data-normal');
      if (!normalSrc) return;

      // Create a canvas that will replace the image visually (same CSS classes).
      const canvas = document.createElement('canvas');
      canvas.className = img.className + ' nm-canvas';

      // Size the canvas to the image's intrinsic pixels; keep CSS size the same as the image.
      const naturalW = img.naturalWidth || img.width || 256;
      const naturalH = img.naturalHeight || img.height || 256;
      canvas.width = naturalW;
      canvas.height = naturalH;
      const cs = window.getComputedStyle(img);
      canvas.style.width = cs.width;
      canvas.style.height = cs.height;

      // Insert right after the image; hide the original as our ambient source.
      img.insertAdjacentElement('afterend', canvas);
      // Keep the image in the DOM (used as ambient texture), but hide it visually.
      const prevDisplay = img.style.display;
      img.style.display = 'none';

      // Ensure required images are loaded before initializing
      const isFloor = img.id === 'floor';
      const loaders = [loadImage(img), loadImage(normalSrc)];
      if (isFloor) loaders.push(loadImage('./normalmap_images/texture-material.png'));
      Promise.all(loaders)
        .then((loadedImgs) => {
          try {
            const ambientImg = loadedImgs[0];
            const normalImg = loadedImgs[1];
            const materialImg = isFloor ? loadedImgs[2] : undefined;

            // Set CSS size to match the image element
            const cs = window.getComputedStyle(img);
            canvas.style.width = cs.width;
            canvas.style.height = cs.height;

            // Drawing buffer size: for repeat use client size * DPR, otherwise natural pixels
            const dpr = Math.max(window.devicePixelRatio || 1, 1);
            if (isFloor) {
              const cw = img.clientWidth || ambientImg.naturalWidth || 256;
              const ch = img.clientHeight || ambientImg.naturalHeight || 256;
              canvas.width = Math.max(1, Math.round(cw * dpr));
              canvas.height = Math.max(1, Math.round(ch * dpr));
            } else {
              const naturalW = ambientImg.naturalWidth || img.width || 256;
              const naturalH = ambientImg.naturalHeight || img.height || 256;
              canvas.width = naturalW;
              canvas.height = naturalH;
            }

            const opts = {
              canvas,
              normalMap: normalImg,
              ambientMap: ambientImg,
            };
            if (isFloor) {
              opts.repeat = true; // tile the floor
              opts.metalness = 0.1;
              opts.roughness = 0.3;
              opts.baseColor = new Float32Array([0.1, 0.0001, 0.0002]);
              if (materialImg) {
                opts.materialMap = materialImg; // use provided per-pixel PBR params
              }
            } else {
              opts.repeat = false;
              opts.metalness = 0.1;
              opts.roughness = 0.9;
            }

        const lights = window.normalmap(opts);
        floorLightsRef = lights;
        lights.render();
        maybeInitVisibleLight();
        console.log('normalmap initialized for', img.id || img.src);
          } catch (e) {
            console.warn('normalmap initialization failed; reverting to ambient image.', e);
            canvas.remove();
            img.style.display = prevDisplay;
          }
        })
        .catch((err) => {
          console.warn('Failed to load images for normal mapping:', err);
          canvas.remove();
          img.style.display = prevDisplay;
        });
    });
  });

  function initFloorCanvas(canvas) {
    const ambientSrc = canvas.getAttribute('data-ambient') || null;
    const normalSrc = canvas.getAttribute('data-normal') || './normalmap_images/texture-normalmap.png';
    const materialSrc = canvas.getAttribute('data-material');

    const loaders = [loadImage(normalSrc)];
    if (ambientSrc) loaders.push(loadImage(ambientSrc));
    if (materialSrc) loaders.push(loadImage(materialSrc));

    Promise.all(loaders)
      .then((imgs) => {
        // Order: [normal, (optional) ambient, (optional) material]
        const normalImg = imgs[0];
        let idx = 1;
        const ambientImg = ambientSrc ? imgs[idx++] : undefined;
        const materialImg = materialSrc ? imgs[idx++] : undefined;

        // Keep tile scale as before but on a larger plane:
        // If the floor CSS width doubles, double the repeat count too.
        // normalmap.js repeat count = canvas.width / normalMap.width
        const texW = normalImg.naturalWidth || 256;
        const cssW = canvas.clientWidth || texW;
        // Base was 2 repeats at original size; scale repeats with CSS growth
        const repeats = Math.max(1, Math.round((cssW / texW) * 2));
        canvas.width = texW * repeats;
        canvas.height = (normalImg.naturalHeight || 256) * repeats;

        const opts = {
          canvas,
          normalMap: normalImg,
          repeat: true,
          metalness: 0.5,
          roughness: 0.8,
          baseColor: new Float32Array([0.0001, 0.0001, 0.0002]),
          singlePass: true,
        };
        if (ambientImg) opts.ambientMap = ambientImg;
        if (materialImg) opts.materialMap = materialImg;

        const lights = window.normalmap(opts);
        floorLightsRef = lights;
        maybeInitVisibleLight();
        lights.render();
        console.log('normalmap initialized for floor canvas');
      })
      .catch((err) => {
        console.warn('Failed to load floor images:', err);
      });
  }

  function initCharacterCanvas(canvas) {
    const ambientSrc = canvas.getAttribute('data-ambient') || './normalmap_images/angel-ambient.png';
    const normalSrc = canvas.getAttribute('data-normal') || './normalmap_images/angel-normalmap.png';
    const materialSrc = canvas.getAttribute('data-material');

    const loaders = [loadImage(ambientSrc), loadImage(normalSrc)];
    if (materialSrc) loaders.push(loadImage(materialSrc));
    Promise.all(loaders)
      .then((imgs) => {
        const ambientImg = imgs[0];
        const normalImg = imgs[1];
        const materialImg = imgs[2];
        // Use natural pixels for drawing buffer
        const naturalW = ambientImg.naturalWidth || 256;
        const naturalH = ambientImg.naturalHeight || 256;
        canvas.width = naturalW;
        canvas.height = naturalH;

        // Explicitly set CSS height to preserve aspect with given width
        const cs = window.getComputedStyle(canvas);
        let displayW = parseFloat(cs.width);
        if (!displayW || Number.isNaN(displayW)) displayW = 140; // fallback to CSS rule
        const displayH = Math.max(1, Math.round(displayW * (naturalH / naturalW)));
        canvas.style.width = displayW + 'px';
        canvas.style.height = displayH + 'px';

        const vec3 = (window.normalmap && window.normalmap.vec3) ? window.normalmap.vec3 : (r, g, b) => new Float32Array([r, g, b]);
        const isBuddha = canvas.id === 'buddha';
        const isDragon = canvas.id === 'dragon';
        const isMobile = /Mobile|android/i.test(navigator.userAgent);
        const common = {
          canvas,
          normalMap: normalImg,
          ambientMap: ambientImg,
          repeat: false,
        };
        const opts = isDragon
          ? {
              ...common,
              antiAliasing: true,
              metalness: 1.0,
              roughness: 0.2,
              baseColor: new Float32Array([0.672, 0.637, 0.585]),
              singlePass: isMobile,
              ambient: 0.9,
            }
          : isBuddha
          ? {
              ...common,
              antiAliasing: true,
              singlePass: isMobile,
              metalness: 1.0,
              roughness: 0.25,
              subSurfaceScattering: 1,
              baseColor: vec3(1.0, 0.6, 0.4),
              ambient: 1.0,
            }
          : {
              ...common,
              metalness: 0.0,
              roughness: 0.5,
              baseColor: vec3(0.3, 0.3, 0.3),
              singlePass: true,
              ambient: 0.1,
            };
        if (materialImg) opts.materialMap = materialImg;
        const lights = window.normalmap(opts);
        if (canvas.id === 'character') {
          characterLightsRef = lights;
        } else if (canvas.id === 'buddha') {
          buddhaLightsRef = lights;
        } else if (canvas.id === 'dragon') {
          dragonLightsRef = lights;
        }
        maybeInitVisibleLight();
        lights.render();
        console.log('normalmap initialized for', canvas.id || 'character canvas');
      })
      .catch((err) => {
        console.warn('Failed to load character images:', err);
      });
  }

  function loadImage(srcOrImg) {
    return new Promise((resolve, reject) => {
      if (!srcOrImg) return reject(new Error('no source'));
      if (typeof srcOrImg !== 'string') {
        const el = srcOrImg;
        if (el.complete && el.naturalWidth > 0) return resolve(el);
        el.addEventListener('load', () => resolve(el), { once: true });
        el.addEventListener('error', () => reject(new Error('image failed to load')), { once: true });
        return;
      }
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('image failed to load'));
      img.src = srcOrImg;
    });
  }

  function bindLight(lights, options) {
    const canvas = lights.canvas;
    const color = options?.color || new Float32Array([0.8, 0.8, 0.8]);
    const z = options?.zOffset ?? 2;
    let left = 0;
    let top = 0;
    let lastX = 0;
    let lastY = 0;

    function measure() {
      const rect = canvas.getBoundingClientRect();
      // pageX/pageY include scrolling; we normalize to client coords and add scroll offset
      left = rect.left + window.scrollX;
      top = rect.top + window.scrollY;
    }

    function renderAt(x, y) {
      lastX = x;
      lastY = y;
      const pos = new Float32Array(3);
      pos[0] = x / canvas.clientWidth;
      pos[1] = y / canvas.clientHeight;
      pos[2] = z;
      lights.addPointLight(pos, color);
      lights.render();
    }

    function onMove(pageX, pageY) {
      renderAt(pageX - left, pageY - top);
    }

    window.addEventListener('resize', () => {
      measure();
      // after resize, re-render at last location
      renderAt(lastX, lastY);
    });

    lights.configure({
      onContextRestored: function () {
        renderAt(lastX, lastY);
      },
    });

    document.addEventListener('mousemove', (e) => onMove(e.pageX, e.pageY));
    document.addEventListener('touchmove', (e) => {
      const t = e.touches && e.touches[0];
      if (t) onMove(t.pageX, t.pageY);
    }, { passive: true });
    canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });

    measure();
    // Initial position: near top-left to give depth (use client size)
    renderAt((canvas.clientWidth || canvas.width) * 0.25,
             (canvas.clientHeight || canvas.height) * 0.1);
  }

  function maybeInitVisibleLight(el) {
    const handle = el || document.getElementById('light');
    if (!handle) return;
    if (!floorLightsRef && !characterLightsRef && !buddhaLightsRef) return;

    // Already initialized
    if (handle.__nmBound) return;
    handle.__nmBound = true;

    const iso = document.querySelector('.iso');
    const plane = document.getElementById('light-plane');
    const floorCanvas = document.getElementById('floor');
    const characterCanvas = document.getElementById('character');
    const buddhaCanvas = document.getElementById('buddha');
    const dragonCanvas = document.getElementById('dragon');

    const color = new Float32Array([1.2, 1.15, 1.1]);
    const zFloor = 6.5; // higher so footprint is broader on floor
    const zChar = 1.2;  // closer to characters for stronger, visible effect

    function applyLight() {
      const rect = handle.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2 + window.scrollX;
      const centerY = rect.top + rect.height / 2 + window.scrollY;

      function lightFor(canvas, lights) {
        if (!canvas || !lights) return;
        const cr = canvas.getBoundingClientRect();
        const localX = centerX - (cr.left + window.scrollX);
        const localY = centerY - (cr.top + window.scrollY);
    const z = (canvas && (canvas.id === 'character' || canvas.id === 'buddha' || canvas.id === 'dragon')) ? zChar : zFloor;
        const pos = new Float32Array([
          Math.min(1, Math.max(0, localX / (canvas.clientWidth || 1))),
          Math.min(1, Math.max(0, localY / (canvas.clientHeight || 1))),
          z,
        ]);
        lights.addPointLight(pos, color);
        if (lights.render) lights.render();
      }

      lightFor(floorCanvas, floorLightsRef);
      lightFor(characterCanvas, characterLightsRef);
      lightFor(buddhaCanvas, buddhaLightsRef);
      lightFor(dragonCanvas, dragonLightsRef);
    }

    // Orbit animation: 1 rotation every ~10 seconds
    let orbitRAF = 0;
    let orbitStartTs = 0;
    let orbitStartAngle = 0;
    const omega = (Math.PI * 2) / 10; // rad/sec (1 rotation every 5s)

    function getPlaneSize() {
      const w = (plane && plane.clientWidth) || (iso && iso.clientWidth) || 256;
      const h = (plane && plane.clientHeight) || (iso && iso.clientHeight) || 256;
      return { w: Math.max(1, w), h: Math.max(1, h) };
    }

    function getHandleLocalPosition() {
      // Return current handle position in plane-local px
      const target = plane || iso;
      const tRect = target.getBoundingClientRect();
      const hRect = handle.getBoundingClientRect();
      const x = (hRect.left + hRect.width / 2) - (tRect.left + window.scrollX);
      const y = (hRect.top + hRect.height / 2) - (tRect.top + window.scrollY);
      return { x, y };
    }

    function setHandleLocalPosition(x, y) {
      if (plane) {
        handle.style.left = x + 'px';
        handle.style.top = y + 'px';
      } else {
        const { w, h } = getPlaneSize();
        handle.style.left = (x / w * 100) + '%';
        handle.style.top = (y / h * 100) + '%';
      }
    }

    function startOrbit() {
      cancelOrbit();
      const { w, h } = getPlaneSize();
      const cx = w / 2;
      const cy = h / 2;
      const margin = 12;
      const r = Math.max(8, Math.min(w, h) * 0.35) - margin;
      const { x, y } = getHandleLocalPosition();
      orbitStartAngle = Math.atan2(y - cy, x - cx) || 0;
      orbitStartTs = performance.now();

      function tick(ts) {
        const t = (ts - orbitStartTs) / 1000; // seconds
        const a = orbitStartAngle + omega * t;
        const nx = cx + r * Math.cos(a);
        const ny = cy + r * Math.sin(a);
        setHandleLocalPosition(nx, ny);
        applyLight();
        orbitRAF = requestAnimationFrame(tick);
      }
      orbitRAF = requestAnimationFrame(tick);
    }

    function cancelOrbit() {
      if (orbitRAF) {
        cancelAnimationFrame(orbitRAF);
        orbitRAF = 0;
      }
    }

    // Dragging
    let dragging = false;
    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
    function onDown(e) {
      dragging = true;
      handle.classList.add('dragging');
      e.preventDefault();
      cancelOrbit();
      onMove(e);
    }
    function onUp() {
      dragging = false;
      handle.classList.remove('dragging');
      startOrbit();
    }
    function onMove(e) {
      if (!dragging) return;
      const targetRect = (plane || iso).getBoundingClientRect();
      const pageX = (e.touches ? e.touches[0].pageX : e.pageX);
      const pageY = (e.touches ? e.touches[0].pageY : e.pageY);
      const relX = clamp(pageX - (targetRect.left + window.scrollX), 0, targetRect.width);
      const relY = clamp(pageY - (targetRect.top + window.scrollY), 0, targetRect.height);
      if (plane) {
        // Map screen space back to plane-local coordinates
        const localX = relX * ((plane.clientWidth || 256) / targetRect.width);
        const localY = relY * ((plane.clientHeight || 256) / targetRect.height);
        handle.style.left = localX + 'px';
        handle.style.top = localY + 'px';
      } else {
        handle.style.left = (relX / targetRect.width * 100) + '%';
        handle.style.top = (relY / targetRect.height * 100) + '%';
      }
      applyLight();
    }

    handle.addEventListener('mousedown', onDown);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    handle.addEventListener('touchstart', onDown, { passive: false });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);

    // Initial lighting from default position
    applyLight();
    // Begin orbit
    startOrbit();
  }
})();
