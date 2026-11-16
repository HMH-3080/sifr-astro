/**
 * Hero zero scene — a machined metallic zero with animated technical details.
 *
 * Layers, from back to front:
 *   1. A sculpted zero with luminous machined edge details
 *   2. Rotating scan arcs, calibration marks and a sparse particle field
 *   3. A fast assembly reveal followed by controlled, continuous motion
 *
 * Design goals:
 *   - A striking, unmistakable zero with a precise engineering finish.
 *   - Rich motion that stays legible and respects reduced-motion preferences.
 *   - Graceful degradation: falls back to the CSS orb when WebGL, reduced
 *     motion, save-data or low memory conditions apply.
 *   - Cheap to run: lazy boot, render loop paused when off-screen or when the
 *     tab is hidden, adaptive pixel ratio, single RAF pipeline.
 */

const THREE_VERSION = '0.169.0';

type Stage = HTMLElement & { dataset: DOMStringMap };

const stage = document.getElementById('orbStage') as Stage | null;
const canvas = document.getElementById('orbCanvas') as HTMLCanvasElement | null;

const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let reduceMotion = motionQuery.matches;

type NetworkInformationLike = { saveData?: boolean };
const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
const saveData = Boolean(connection?.saveData);

const nav = navigator as Navigator & { deviceMemory?: number };
const lowMemory = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 2;

let booted = false;

async function boot() {
  if (booted || !stage || !canvas) return;
  booted = true;

  let THREE: typeof import('three');
  try {
    THREE = await import('three');
  } catch {
    stage.classList.add('no-webgl');
    return;
  }

  let renderer: import('three').WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
  } catch {
    renderer = null as unknown as import('three').WebGLRenderer;
  }
  if (!renderer) {
    stage.classList.add('no-webgl');
    return;
  }

  const small = window.matchMedia('(max-width: 760px)').matches;
  let pixelRatio = Math.min(window.devicePixelRatio || 1, small ? 1.6 : 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.setClearColor(0x000000, 0);

  let RoomEnvironment: new () => import('three').Scene;
  try {
    ({ RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js'));
  } catch {
    renderer.dispose();
    stage.classList.add('no-webgl');
    return;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0.08, 4.45);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.8;
  pmrem.dispose();

  scene.add(new THREE.AmbientLight(0x9eb8dc, 0.72));

  const keyLight = new THREE.DirectionalLight(0xf4f7ff, 3.2);
  keyLight.position.set(-3.5, 4.5, 4);
  scene.add(keyLight);

  const blueLight = new THREE.PointLight(0x5b9cff, 24, 8, 2);
  blueLight.position.set(2.6, 0.8, 1.4);
  scene.add(blueLight);

  const warmLight = new THREE.PointLight(0xf0b978, 12, 7, 2);
  warmLight.position.set(-2.8, -1.7, 1.1);
  scene.add(warmLight);

  const pointerLight = new THREE.PointLight(0x9fc8ff, 0, 5, 2);
  scene.add(pointerLight);

  const root = new THREE.Group();
  scene.add(root);

  /* ---------- Sculpted zero ---------- */
  const zeroGroup = new THREE.Group();
  zeroGroup.rotation.set(-0.26, 0.2, -0.08);

  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xb5c4d9,
    metalness: 0.76,
    roughness: 0.17,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    emissive: 0x142440,
    emissiveIntensity: 0.42,
  });
  const zeroBody = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.23, 48, 192), bodyMaterial);
  zeroGroup.add(zeroBody);

  const wireOverlay = new THREE.Mesh(
    new THREE.TorusGeometry(0.72, 0.232, 24, 96),
    new THREE.MeshBasicMaterial({
      color: 0xd6e6ff,
      wireframe: true,
      transparent: true,
      opacity: 0.035,
    }),
  );
  zeroGroup.add(wireOverlay);

  const trimMaterial = new THREE.MeshBasicMaterial({
    color: 0xa9c9fa,
    transparent: true,
    opacity: 0.78,
  });
  const outerTrim = new THREE.Mesh(new THREE.TorusGeometry(0.94, 0.009, 8, 192), trimMaterial);
  const innerTrim = new THREE.Mesh(
    new THREE.TorusGeometry(0.5, 0.006, 8, 192),
    new THREE.MeshBasicMaterial({ color: 0x759bd0, transparent: true, opacity: 0.5 }),
  );
  zeroGroup.add(outerTrim, innerTrim);
  root.add(zeroGroup);

  /* ---------- Precision marks ---------- */
  const tickPoints: import('three').Vector3[] = [];
  const tickCount = 96;
  for (let i = 0; i < tickCount; i += 1) {
    const angle = (i / tickCount) * Math.PI * 2;
    const outerRadius = 1.16;
    const innerRadius = outerRadius - (i % 12 === 0 ? 0.1 : i % 4 === 0 ? 0.06 : 0.03);
    tickPoints.push(
      new THREE.Vector3(Math.cos(angle) * innerRadius, Math.sin(angle) * innerRadius, 0),
      new THREE.Vector3(Math.cos(angle) * outerRadius, Math.sin(angle) * outerRadius, 0),
    );
  }
  const ticks = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(tickPoints),
    new THREE.LineBasicMaterial({ color: 0xa9c5eb, transparent: true, opacity: 0.45 }),
  );
  root.add(ticks);

  const scanArcs = [0, 1, 2].map((index) => {
    const arcGroup = new THREE.Group();
    const radius = 1.12 + index * 0.08;
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(radius, index === 1 ? 0.009 : 0.0045, 8, 120, Math.PI * (0.32 + index * 0.08)),
      new THREE.MeshBasicMaterial({
        color: index === 1 ? 0xd6e6ff : index === 2 ? 0xd9b78c : 0x6d9ce0,
        transparent: true,
        opacity: index === 1 ? 0.9 : 0.58,
      }),
    );
    arc.rotation.z = index * 2.1;
    arcGroup.rotation.set(index * 0.46, index * 0.31, 0);
    arcGroup.add(arc);
    root.add(arcGroup);
    return arcGroup;
  });

  const particleCount = small ? 90 : 150;
  const particlePositions = new Float32Array(particleCount * 3);
  const particleAngles = new Float32Array(particleCount);
  const particleRadii = new Float32Array(particleCount);
  for (let i = 0; i < particleCount; i += 1) {
    particleAngles[i] = Math.random() * Math.PI * 2;
    particleRadii[i] = 1.26 + Math.random() * 0.55;
    particlePositions[i * 3] = Math.cos(particleAngles[i]) * particleRadii[i];
    particlePositions[i * 3 + 1] = Math.sin(particleAngles[i]) * particleRadii[i];
    particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 0.48;
  }
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  const particles = new THREE.Points(
    particleGeometry,
    new THREE.PointsMaterial({
      color: 0xc5d9f7,
      size: small ? 0.022 : 0.018,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  root.add(particles);

  const centerMark = new THREE.Mesh(
    new THREE.SphereGeometry(0.018, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xe7efff }),
  );
  root.add(centerMark);

  /* ---------- Pointer parallax ---------- */
  const pointer = {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    strength: 0,
    targetStrength: 0,
  };

  window.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
      const rect = stage!.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      pointer.targetX = Math.max(-1, Math.min(1, x));
      pointer.targetY = Math.max(-1, Math.min(1, y));

      const distance = Math.hypot(x, y);
      const proximity = Math.max(0, Math.min(1, (1.18 - distance) / 0.72));
      pointer.targetStrength = proximity * proximity * (3 - 2 * proximity);
    },
    { passive: true },
  );

  stage.addEventListener('pointerleave', () => {
    pointer.targetX = 0;
    pointer.targetY = 0;
    pointer.targetStrength = 0;
  }, { passive: true });

  /* ---------- Resize ---------- */
  const resize = () => {
    const width = stage!.clientWidth;
    const height = stage!.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage);
  window.addEventListener('resize', resize, { passive: true });
  resize();

  /* ---------- Intro flourish: assemble on first paint ---------- */
  const introStart = performance.now();
  const INTRO_MS = reduceMotion ? 0 : 1900;
  zeroGroup.scale.setScalar(0.001);

  /* ---------- Render loop ---------- */
  let frame = 0;
  let elapsed = 0;
  let last = 0;
  let slowFrames = 0;

  const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);
  const easeOutBack = (t: number) => {
    const c1 = 1.35;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };

  const renderFrame = (now: number) => {
    frame = requestAnimationFrame(renderFrame);
    if (!last) last = now;
    const delta = Math.min(0.05, (now - last) / 1000);
    last = now;
    elapsed += delta;

    // Adaptive quality: quietly drop resolution if the device struggles.
    if (delta > 0.026) slowFrames += 1;
    else slowFrames = Math.max(0, slowFrames - 2);
    if (slowFrames > 90 && pixelRatio > 1) {
      pixelRatio = Math.max(1, pixelRatio - 0.5);
      renderer.setPixelRatio(pixelRatio);
      slowFrames = 0;
    }

    // Intro: the blueprint resolves from its origin.
    if (INTRO_MS) {
      const t = Math.min(1, (now - introStart) / INTRO_MS);
      const e = easeOutBack(t);
      zeroGroup.scale.setScalar(0.001 + e * 0.999);
      zeroGroup.rotation.y = 0.2 + (1 - easeOut(t)) * Math.PI * 1.8;
      zeroGroup.rotation.x = -0.26 + (1 - easeOut(t)) * 1.15;
    } else {
      zeroGroup.scale.setScalar(1);
    }

    // Pointer easing + parallax.
    pointer.x += (pointer.targetX - pointer.x) * 0.045;
    pointer.y += (pointer.targetY - pointer.y) * 0.045;
    pointer.strength += (pointer.targetStrength - pointer.strength) * 0.075;

    const introComplete = Math.min(1, (now - introStart) / INTRO_MS);
    const motion = reduceMotion ? 0 : easeOut(introComplete);
    zeroGroup.rotation.y += delta * (0.46 + motion * 0.18);
    zeroGroup.rotation.z = -0.08 + Math.sin(elapsed * 0.65) * 0.035;
    root.rotation.y =
      Math.sin(elapsed * 0.42) * 0.035 + pointer.x * pointer.strength * 0.2;
    root.rotation.x =
      Math.sin(elapsed * 0.58) * 0.025 + pointer.y * pointer.strength * 0.14;
    root.position.x = pointer.x * pointer.strength * 0.045;
    root.position.y = Math.sin(elapsed * 1.1) * 0.025 - pointer.y * pointer.strength * 0.035;
    root.scale.setScalar(1 + pointer.strength * 0.025);

    pointerLight.position.set(pointer.x * 1.7, -pointer.y * 1.7, 1.25);
    pointerLight.intensity = pointer.strength * 16;

    scanArcs[0].rotation.z = elapsed * (1.05 + pointer.strength * 0.75);
    scanArcs[1].rotation.z = -elapsed * (0.76 + pointer.strength * 0.58);
    scanArcs[2].rotation.z = elapsed * (0.52 + pointer.strength * 0.42);
    particles.rotation.z = -elapsed * (0.2 + pointer.strength * 0.4);
    bodyMaterial.emissiveIntensity =
      0.48 + Math.sin(elapsed * 2.8) * 0.16 + pointer.strength * 0.28;
    blueLight.intensity = 22 + Math.sin(elapsed * 2.2) * 5;

    renderer.render(scene, camera);
  };

  const start = () => {
    if (frame || reduceMotion || document.hidden) return;
    last = 0;
    frame = requestAnimationFrame(renderFrame);
  };
  const stop = () => {
    if (!frame) return;
    cancelAnimationFrame(frame);
    frame = 0;
  };

  motionQuery.addEventListener('change', (event) => {
    reduceMotion = event.matches;
    if (reduceMotion) {
      zeroGroup.scale.setScalar(1);
      zeroGroup.rotation.set(-0.26, 0.2, -0.08);
      root.rotation.set(0, 0, 0);
      root.position.set(0, 0, 0);
      root.scale.setScalar(1);
      scanArcs.forEach((arc, index) => {
        arc.rotation.z = index * 2.1;
      });
      particles.rotation.z = 0;
      bodyMaterial.emissiveIntensity = 0.42;
      pointerLight.intensity = 0;
      pointer.strength = 0;
      pointer.targetStrength = 0;
      renderer.render(scene, camera);
      stop();
    } else {
      start();
    }
  });

  renderer.render(scene, camera);
  stage.classList.add('scene-ready');
  start();

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => (entry.isIntersecting ? start() : stop()));
      },
      { threshold: 0.01 },
    ).observe(stage);
  }

  document.addEventListener('visibilitychange', () => {
      if (document.hidden || reduceMotion) stop();
    else start();
  });

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    stop();
    stage!.classList.remove('scene-ready');
    stage!.classList.add('no-webgl');
  });

  canvas.addEventListener('webglcontextrestored', () => {
    stage!.classList.remove('no-webgl');
    stage!.classList.add('scene-ready');
    start();
  });
}

/* Lazy, conditional boot: never pay for WebGL unless it will be seen and wanted. */
if (stage && canvas && !saveData && !lowMemory) {
  const watchForVisibility = () => {
    if (reduceMotion) return;
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            io.disconnect();
            boot();
          }
        },
        { rootMargin: '320px 0px' },
      );
      io.observe(stage);
    } else if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(boot, { timeout: 2500 });
    } else {
      setTimeout(boot, 800);
    }
  };

  motionQuery.addEventListener('change', (event) => {
    reduceMotion = event.matches;
    if (!reduceMotion) watchForVisibility();
  });

  watchForVisibility();
}

export { THREE_VERSION };