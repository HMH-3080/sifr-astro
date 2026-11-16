/**
 * Hero orb scene — enhanced WebGL centrepiece.
 *
 * Layers, from back to front:
 *   1. Soft core glow + a slowly counter-rotating particle field (the "system")
 *   2. A glass torus with iridescence and a refractive-ish physical material
 *   3. Two inclined orbital rings with satellites that ride the rings
 *   4. A wireframe icosahedron core that breathes and counter-rotates
 *   5. A cursor-following light that sweeps across the glass
 *
 * Design goals:
 *   - Meaningful motion: rotation, breathing, satellites and a pointer-driven
 *     parallax, so the scene reads as an engineered object rather than a spinner.
 *   - Graceful degradation: falls back to the CSS orb when WebGL, reduced
 *     motion, save-data or low memory conditions apply.
 *   - Cheap to run: lazy boot, render loop paused when off-screen or when the
 *     tab is hidden, adaptive pixel ratio, single RAF pipeline.
 */

const THREE_VERSION = '0.169.0';

type Stage = HTMLElement & { dataset: DOMStringMap };

const stage = document.getElementById('orbStage') as Stage | null;
const canvas = document.getElementById('orbCanvas') as HTMLCanvasElement | null;

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  let RoomEnvironment: new () => import('three').Scene;

  try {
    THREE = await import('three');
    ({ RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js'));
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

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0.08, 4.9);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.72;
  pmrem.dispose();

  scene.add(new THREE.AmbientLight(0xffffff, 0.3));

  const key = new THREE.DirectionalLight(0xffffff, 1.3);
  key.position.set(3.2, 4, 4.4);
  scene.add(key);

  const rim = new THREE.PointLight(0x9dc0ff, 11, 16);
  rim.position.set(-3.4, 1.4, -2.6);
  scene.add(rim);

  const warm = new THREE.PointLight(0xffd7a3, 5, 14);
  warm.position.set(2.6, -2.4, 2.4);
  scene.add(warm);

  // Cursor-following light: makes the glass feel lit by the viewer.
  const cursorLight = new THREE.PointLight(0xdfeaff, 0, 9, 2);
  cursorLight.position.set(0, 0, 2.4);
  scene.add(cursorLight);

  const root = new THREE.Group();
  scene.add(root);

  /* ---------- Glass torus ---------- */
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xc6d5ef,
    metalness: 0.16,
    roughness: 0.1,
    clearcoat: 0.85,
    clearcoatRoughness: 0.1,
    iridescence: 0.75,
    iridescenceIOR: 1.28,
    iridescenceThicknessRange: [160, 480],
    envMapIntensity: 0.9,
    transparent: true,
    opacity: 0.9,
  });

  const torusGroup = new THREE.Group();
  const torus = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.22, 48, 192), glass);
  torus.rotation.set(-0.3, 0.34, 0.22);
  torusGroup.add(torus);
  root.add(torusGroup);

  /* ---------- Core ---------- */
  const core = new THREE.Group();
  core.add(
    new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.32, 1),
      new THREE.MeshStandardMaterial({
        color: 0x0d1420,
        metalness: 0.85,
        roughness: 0.25,
        emissive: 0x27436b,
        emissiveIntensity: 0.55,
      }),
    ),
  );
  const coreWire = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.36, 1),
    new THREE.MeshBasicMaterial({
      color: 0xcfe0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.28,
    }),
  );
  core.add(coreWire);
  root.add(core);

  /* ---------- Orbital rings + satellites ---------- */
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0xcfe0ff,
    transparent: true,
    opacity: 0.22,
  });

  const orbitA = new THREE.Mesh(new THREE.TorusGeometry(1.86, 0.005, 6, 220), ringMaterial);
  orbitA.rotation.set(1.15, 0.2, 0.35);
  root.add(orbitA);

  const orbitB = new THREE.Mesh(
    new THREE.TorusGeometry(2.16, 0.004, 6, 220),
    ringMaterial.clone(),
  );
  (orbitB.material as import('three').MeshBasicMaterial).opacity = 0.1;
  orbitB.rotation.set(1.35, -0.4, -0.2);
  root.add(orbitB);

  /* Satellites: one per ring. Each lives in the ring's own rotated frame and
     orbits along its local Z axis, so it visually rides the ring ellipse. */
  const makeSatellite = (radius: number, size: number, color: number) => {
    const pivot = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(size, 16, 16),
      new THREE.MeshBasicMaterial({ color }),
    );
    mesh.position.set(radius, 0, 0);
    pivot.add(mesh);
    return pivot;
  };

  const satelliteA = makeSatellite(1.86, 0.038, 0xffffff);
  satelliteA.rotation.copy(orbitA.rotation);
  root.add(satelliteA);

  const satelliteB = makeSatellite(2.16, 0.028, 0xcfe0ff);
  satelliteB.rotation.copy(orbitB.rotation);
  root.add(satelliteB);

  /* ---------- Particle field ---------- */
  const particleCount = small ? 96 : 180;
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i += 1) {
    const radius = 1.85 + Math.random() * 1.15;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi) * 0.78;
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const particles = new THREE.Points(
    particleGeometry,
    new THREE.PointsMaterial({
      color: 0xcfe0ff,
      size: 0.022,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    }),
  );
  root.add(particles);

  /* ---------- Pointer parallax ---------- */
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };

  window.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
      const rect = stage!.getBoundingClientRect();
      pointer.targetX = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1));
      pointer.targetY = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1));
    },
    { passive: true },
  );

  stage.addEventListener('pointerleave', () => {
    pointer.targetX = 0;
    pointer.targetY = 0;
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
  const INTRO_MS = reduceMotion ? 0 : 1400;
  torusGroup.scale.setScalar(0.001);
  core.scale.setScalar(0.001);

  /* ---------- Render loop ---------- */
  let frame = 0;
  let elapsed = 0;
  let last = 0;
  let slowFrames = 0;

  const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

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

    // Intro: glass assembles, core catches up slightly later.
    if (INTRO_MS) {
      const t = Math.min(1, (now - introStart) / INTRO_MS);
      const e = easeOut(t);
      torusGroup.scale.setScalar(0.001 + e * 0.999);
      torusGroup.rotation.y = (1 - e) * -0.9;
      const tc = Math.min(1, Math.max(0, (now - introStart - 220) / INTRO_MS));
      const ec = easeOut(tc);
      core.scale.setScalar(0.001 + ec * 0.999);
    } else {
      torusGroup.scale.setScalar(1);
      core.scale.setScalar(1);
    }

    // Pointer easing + parallax.
    pointer.x += (pointer.targetX - pointer.x) * 0.045;
    pointer.y += (pointer.targetY - pointer.y) * 0.045;

    root.rotation.y = elapsed * 0.12 + pointer.x * 0.35;
    root.rotation.x = Math.sin(elapsed * 0.24) * 0.06 + pointer.y * 0.2;
    root.position.y = Math.sin(elapsed * 0.5) * 0.04;

    // Glass torus slow wobble.
    torus.rotation.z = 0.18 + Math.sin(elapsed * 0.3) * 0.05;

    // Core breathing and counter-rotation.
    core.rotation.y = -elapsed * 0.35;
    core.rotation.x = elapsed * 0.22;
    const coreTarget = 1 + Math.sin(elapsed * 0.8) * 0.04;
    core.scale.setScalar(core.scale.x + (coreTarget - core.scale.x) * 0.1);
    coreWire.rotation.y = elapsed * 0.5;

    // Satellites ride their rings.
    satelliteA.rotation.z = elapsed * 0.55;
    satelliteB.rotation.z = -elapsed * 0.34;

    // Particle drift.
    particles.rotation.y = -elapsed * 0.02;

    // Cursor light: sits between camera and scene, follows the pointer.
    cursorLight.position.x += (pointer.x * 2.6 - cursorLight.position.x) * 0.06;
    cursorLight.position.y += (-pointer.y * 1.8 - cursorLight.position.y) * 0.06;
    cursorLight.intensity = 3.2 + Math.sin(elapsed * 1.2) * 0.4;

    renderer.render(scene, camera);
  };

  const start = () => {
    if (frame) return;
    last = 0;
    frame = requestAnimationFrame(renderFrame);
  };
  const stop = () => {
    if (!frame) return;
    cancelAnimationFrame(frame);
    frame = 0;
  };

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
    if (document.hidden) stop();
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
if (stage && canvas && !reduceMotion && !saveData && !lowMemory) {
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
}

export { THREE_VERSION };