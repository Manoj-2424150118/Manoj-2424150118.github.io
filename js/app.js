import * as pdfjsLib from '../vendor/pdfjs/pdf.min.mjs';

// Configure pdf.js worker and hardening against CVE-2024-4367
pdfjsLib.GlobalWorkerOptions.workerSrc = './vendor/pdfjs/pdf.worker.min.mjs';

async function renderResume() {
  const canvas = document.getElementById('resumeCanvas');
  if (!canvas) return;
  try {
    const loadingTask = pdfjsLib.getDocument({
      url: 'Manoj_Resume_2026.pdf',
      isEvalSupported: false
    });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.5 });
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    await page.render({ canvasContext: context, viewport: viewport }).promise;
  } catch (err) {
    console.error('PDF render error:', err);
  }
}

// Initialise resume render
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderResume);
} else {
  renderResume();
}

// Main Interactive Experience
(function() {
  const rm = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Scroll reveals
  const els = document.querySelectorAll('.reveal');
  if (rm.matches || !('IntersectionObserver' in window)) {
    els.forEach(function(e) { e.classList.add('in'); });
  } else {
    const io = new IntersectionObserver(function(en) {
      en.forEach(function(x) {
        if (x.isIntersecting) {
          x.target.classList.add('in');
          io.unobserve(x.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    els.forEach(function(e) { io.observe(e); });
  }

  // 3D Background
  const c = document.getElementById('bg');
  if (!window.THREE || rm.matches) {
    if (c) c.style.display = 'none';
    return;
  }

  let renderer, scene, camera, raf, mx = 0, my = 0;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: c,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
  } catch (e) {
    if (c) c.style.display = 'none';
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 100);
  camera.position.z = 28;

  // --- Solar System ---
  const solarSystem = new THREE.Group();
  solarSystem.position.set(6, -2, -15);
  solarSystem.rotation.x = 0.25 * Math.PI;
  solarSystem.rotation.y = -0.15 * Math.PI;
  scene.add(solarSystem);

  const tLoader = new THREE.TextureLoader();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  function loadTex(url) {
    const t = tLoader.load(url, function(tex) {
      if (tex.image && tex.image.width > 4096) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 4096;
        tempCanvas.height = Math.round(tex.image.height * (4096 / tex.image.width));
        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(tex.image, 0, 0, tempCanvas.width, tempCanvas.height);
        tex.image = tempCanvas;
        tex.needsUpdate = true;
      }
    }, undefined, function(err) {
      console.error('Texture error:', url, err);
    });
    t.anisotropy = maxAniso;
    t.encoding = THREE.sRGBEncoding;
    return t;
  }
  const TEX_BASE = 'textures/';

  // High-Res Sun
  const sunMesh = new THREE.Mesh(
    new THREE.SphereGeometry(2.5, 128, 128),
    new THREE.MeshBasicMaterial({ map: loadTex(TEX_BASE + 'sun.jpg'), color: 0xffffee })
  );
  sunMesh.userData = {
    name: 'Sun',
    desc: 'The star around which the Earth and other planets revolve.',
    facts: [
      'The Sun is a yellow dwarf star at the center of our solar system.',
      'It contains 99.86% of the mass in the entire solar system.',
      "The Sun's core is about 27 million degrees Fahrenheit (15 million degrees Celsius).",
      'Its gravity holds the solar system together, keeping everything from planets to debris in orbit.',
      'The Sun will continue to burn for about another 5 billion years.'
    ]
  };
  solarSystem.add(sunMesh);

  const systemLight = new THREE.PointLight(0xffeedd, 2.5, 200);
  sunMesh.add(systemLight);
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));

  const planetsData = [
    { name: 'Mercury', tex: loadTex(TEX_BASE + 'mercury.jpg'), size: 0.15, orbit: 4.5, period: 88, rough: 1.0, desc: 'The smallest and innermost planet.', facts: ['Mercury is the fastest planet, zipping around the Sun every 88 Earth days.', 'It has no atmosphere to retain heat, leading to extreme temperature fluctuations.', 'Despite being closest to the Sun, it is not the hottest planet (Venus is).', "Mercury is slightly larger than Earth's Moon.", "NASA's MESSENGER spacecraft mapped 100% of Mercury's surface."] },
    { name: 'Venus', tex: loadTex(TEX_BASE + 'venus.jpg'), size: 0.35, orbit: 6.0, period: 225, rough: 0.9, desc: "Earth's sister planet.", facts: ['Venus spins slowly in the opposite direction of most planets.', 'Its thick atmosphere traps heat in a runaway greenhouse effect, making it the hottest planet.', 'Surface temperatures on Venus reach 900 degrees Fahrenheit (475 degrees Celsius).', 'Venus has a solid surface covered in dome-like volcanoes, rifts, and mountains.', 'It is the second brightest natural object in the night sky after the Moon.'] },
    { name: 'Earth', tex: loadTex(TEX_BASE + 'earth.jpg'), size: 0.4, orbit: 8.0, period: 365.25, rough: 0.6, desc: 'Our home planet.', facts: ['Earth is the only planet known to harbor life and have liquid water on its surface.', "Earth's atmosphere protects us from meteoroids and radiation.", 'It is the densest planet in the solar system.', 'Earth is the third planet from the Sun in our solar system.', "Our planet's rotation is gradually slowing down by about 17 milliseconds per 100 years."] },
    { name: 'Mars', tex: loadTex(TEX_BASE + 'mars.jpg'), size: 0.25, orbit: 10.0, period: 687, rough: 0.9, desc: 'The Red Planet.', facts: ['Mars is known as the Red Planet because iron minerals in Martian soil rust.', 'It is home to Olympus Mons, the largest volcano in the solar system.', 'Mars has a very thin atmosphere made mostly of carbon dioxide.', 'Evidence suggests Mars once had liquid water on its surface.', 'NASA has multiple rovers currently exploring the Martian surface.'] },
    { name: 'Jupiter', tex: loadTex(TEX_BASE + 'jupiter.jpg'), size: 1.1, orbit: 14.5, period: 4333, rough: 0.7, desc: 'The largest planet.', facts: ['Jupiter is more than twice as massive as all other planets combined.', 'The Great Red Spot is a giant storm that has raged for centuries.', 'Jupiter has the shortest day in the solar system, taking only 10 hours.', 'It is a gas giant primarily composed of hydrogen and helium.', "NASA's Juno spacecraft is currently studying Jupiter from orbit."] },
    { name: 'Saturn', tex: loadTex(TEX_BASE + 'saturn.jpg'), size: 0.9, orbit: 19.0, period: 10759, ring: true, rough: 0.7, desc: 'Famous for its prominent ring system.', facts: ['Saturn is adorned with a dazzling system of icy rings.', "It is the only planet whose density is less than water's.", 'Saturn has 146 known moons, more than any other planet.', 'It is a gas giant made mostly of hydrogen and helium.', 'A day on Saturn is only 10.7 hours long.'] },
    { name: 'Uranus', tex: loadTex(TEX_BASE + 'uranus.jpg'), size: 0.6, orbit: 23.0, period: 30685, rough: 0.5, desc: 'An ice giant tilted on its side.', facts: ['Uranus rotates on its side with an axial tilt of 98 degrees.', "It is an ice giant composed of water, ammonia, and methane.", 'Uranus has the coldest atmosphere in the solar system.', 'It has 13 known faint rings and 27 known moons.', 'Voyager 2 is the only spacecraft to have visited Uranus.'] },
    { name: 'Neptune', tex: loadTex(TEX_BASE + 'neptune.jpg'), size: 0.6, orbit: 26.5, period: 60190, rough: 0.5, desc: 'The farthest known major planet.', facts: ['Neptune is the most distant major planet orbiting our Sun.', 'It is cold and whipped by supersonic winds up to 1,200 mph.', 'Neptune was first predicted mathematically before being observed.', 'It has 14 known moons and five main rings.', 'Its blue color comes from atmospheric methane absorbing red light.'] },
    { name: 'Pluto', tex: loadTex(TEX_BASE + 'pluto.jpg'), size: 0.1, orbit: 29.5, period: 90560, rough: 1.0, desc: 'A dwarf planet in the Kuiper belt.', facts: ['Pluto was reclassified as a dwarf planet by the IAU in 2006.', 'It has a prominent heart-shaped glacier named Tombaugh Regio.', "Pluto's orbit is highly elliptical and tilted.", 'It has a thin atmosphere of nitrogen and methane.', "NASA's New Horizons spacecraft visited Pluto in 2015."] }
  ];

  const daysSinceJ2000 = (Date.now() - 946728000000) / (1000 * 60 * 60 * 24);
  const planets = [];
  const interactables = [sunMesh];

  planetsData.forEach(function(p) {
    const mat = new THREE.MeshStandardMaterial({ map: p.tex, roughness: p.rough, metalness: 0.1 });
    if (p.rough > 0.8 && p.name !== 'Earth') {
      mat.bumpMap = p.tex;
      mat.bumpScale = 0.015;
    }

    const pMesh = new THREE.Mesh(new THREE.SphereGeometry(p.size, 128, 128), mat);
    pMesh.userData = { name: p.name, desc: p.desc, facts: p.facts };
    interactables.push(pMesh);

    if (p.ring) {
      const rCanvas = document.createElement('canvas');
      rCanvas.width = 256;
      rCanvas.height = 1;
      const rCtx = rCanvas.getContext('2d');
      const rGrad = rCtx.createLinearGradient(0, 0, 256, 0);
      rGrad.addColorStop(0, 'rgba(234,214,184,0)');
      rGrad.addColorStop(0.2, 'rgba(234,214,184,0.8)');
      rGrad.addColorStop(0.5, 'rgba(206,184,184,0.9)');
      rGrad.addColorStop(0.8, 'rgba(234,214,184,0.5)');
      rGrad.addColorStop(1, 'rgba(234,214,184,0)');
      rCtx.fillStyle = rGrad;
      rCtx.fillRect(0, 0, 256, 1);

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(p.size * 1.4, p.size * 2.2, 64),
        new THREE.MeshStandardMaterial({
          map: new THREE.CanvasTexture(rCanvas),
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.9
        })
      );
      ring.rotation.x = Math.PI / 2.2;
      pMesh.add(ring);
    }

    const pathMesh = new THREE.Mesh(
      new THREE.RingGeometry(p.orbit, p.orbit + 0.08, 128),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.8 })
    );
    pathMesh.rotation.x = Math.PI / 2;
    solarSystem.add(pathMesh);

    solarSystem.add(pMesh);
    p.baseAngle = (daysSinceJ2000 / p.period) * Math.PI * 2;

    planets.push({ mesh: pMesh, data: p, path: pathMesh });
  });

  const accentLight = new THREE.PointLight(0x10b981, 2.5, 40);
  accentLight.position.set(5, -5, 2);
  scene.add(accentLight);

  // Realistic Asteroids
  const MAX_ASTEROIDS = 2000;
  const asteroidCount = 800;
  const asteroidGeo = new THREE.BufferGeometry();
  const astPos = new Float32Array(MAX_ASTEROIDS * 3);
  const astVel = [];

  for (let i = 0; i < MAX_ASTEROIDS; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 11.0 + Math.random() * 3.0;
    const inclination = (Math.random() - 0.5) * 0.4;

    if (i < asteroidCount) {
      astPos[i * 3] = Math.cos(a) * r;
      astPos[i * 3 + 1] = Math.sin(a) * r * inclination;
      astPos[i * 3 + 2] = Math.sin(a) * r;
    } else {
      astPos[i * 3] = 9999;
      astPos[i * 3 + 1] = 9999;
      astPos[i * 3 + 2] = 9999;
    }

    const GM = 4.0;
    const v = Math.sqrt(GM / r);
    const vx = -Math.sin(a) * v;
    const vy = Math.cos(a) * v * inclination;
    const vz = Math.cos(a) * v;
    astVel.push(new THREE.Vector3(vx, vy, vz));
  }
  asteroidGeo.setAttribute('position', new THREE.BufferAttribute(astPos, 3));
  const asteroidMat = new THREE.PointsMaterial({ color: 0x999999, size: 0.05, transparent: true, opacity: 0.6 });
  const asteroidSystem = new THREE.Points(asteroidGeo, asteroidMat);
  solarSystem.add(asteroidSystem);

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2(-1, -1);
  const infoPanel = document.getElementById('infoPanel');
  const infoTitle = document.getElementById('infoTitle');
  const infoDesc = document.getElementById('infoDesc');
  const infoFact = document.getElementById('infoFact');

  let selectedObj = null;
  addEventListener('pointermove', function(e) {
    mx = (e.clientX / innerWidth - 0.5);
    my = (e.clientY / innerHeight - 0.5);
    mouse.x = (e.clientX / innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const visibleInteractables = interactables.filter(function(obj) { return obj.visible; });
    const intersects = raycaster.intersectObjects(visibleInteractables);

    if (intersects.length > 0) {
      const objData = intersects[0].object.userData;
      if (objData && objData.name) {
        if (selectedObj !== objData) {
          selectedObj = objData;
          if (infoTitle) infoTitle.innerText = objData.name;
          if (infoDesc) infoDesc.innerText = objData.desc;
          if (typeof objData.factIndex === 'undefined') objData.factIndex = 0;
          const queuedFact = objData.facts[objData.factIndex];
          if (infoFact) infoFact.innerText = 'Fun Fact: ' + queuedFact;
          objData.factIndex = (objData.factIndex + 1) % objData.facts.length;
        }
        const pw = infoPanel ? (infoPanel.offsetWidth || 280) : 280;
        const ph = infoPanel ? (infoPanel.offsetHeight || 150) : 150;
        let px = e.clientX + 15;
        let py = e.clientY + 15;
        if (px + pw > window.innerWidth) px = e.clientX - pw - 15;
        if (py + ph > window.innerHeight) py = e.clientY - ph - 15;
        if (infoPanel) {
          infoPanel.style.left = px + 'px';
          infoPanel.style.top = py + 'px';
          infoPanel.classList.add('visible');
        }
      }
    } else {
      selectedObj = null;
      if (infoPanel) infoPanel.classList.remove('visible');
    }
  }, { passive: true });

  let timeScale = 1.0;
  let userTimeScale = 1.0;

  // UI logic for Motion Settings
  const moContainer = document.getElementById('motionContainer');
  const moHeader = document.getElementById('motionHeader');
  const moArrow = document.getElementById('motionArrow');
  const tsSlider = document.getElementById('timeScaleSlider');

  if (moHeader && moContainer) {
    moHeader.addEventListener('click', function() {
      moContainer.classList.toggle('open');
      if (moArrow) {
        moArrow.style.transform = moContainer.classList.contains('open') ? 'rotate(180deg)' : 'rotate(0deg)';
        moArrow.style.transition = 'transform 0.3s';
      }
    });
  }
  if (tsSlider) {
    tsSlider.addEventListener('input', function(e) {
      userTimeScale = parseFloat(e.target.value);
    });
  }

  // Camera tracking logic for Infinite Zoom
  const sections = [
    { id: 'header', planet: null },
    { id: 'about', planet: 'Earth' },
    { id: 'experience', planet: 'Jupiter' },
    { id: 'research', planet: 'Saturn' },
    { id: 'skills', planet: 'Pluto' },
    { id: 'education', planet: 'Mars' },
    { id: 'contact', planet: 'Uranus' }
  ];

  let currentTargetPlanet = null;
  function updateActiveSection() {
    const wh = window.innerHeight;
    let bestSection = null;
    let maxVis = -1;

    sections.forEach(function(sec) {
      const el = document.getElementById(sec.id);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const top = Math.max(0, rect.top);
      const bottom = Math.min(wh, rect.bottom);
      const vis = bottom - top;
      if (vis > maxVis) {
        maxVis = vis;
        bestSection = sec;
      }
    });

    if (bestSection) {
      currentTargetPlanet = bestSection.planet;
    }
  }

  window.addEventListener('scroll', updateActiveSection, { passive: true });
  updateActiveSection();

  const currentLookAt = new THREE.Vector3(0, 0, 0);
  const targetCameraPos = new THREE.Vector3(0, 0, 28);

  scene.add(camera);
  const camLight = new THREE.PointLight(0xffffff, 0.4, 60);
  camera.add(camLight);

  let t = 0;
  function loop() {
    raf = requestAnimationFrame(loop);

    const targetScale = currentTargetPlanet ? 0.05 * userTimeScale : 1.0 * userTimeScale;
    timeScale += (targetScale - timeScale) * 0.05;

    t += 0.0035 * timeScale;

    // Physics update for asteroids
    const dt = 0.016 * timeScale;
    const positions = asteroidGeo.attributes.position.array;
    for (let i = 0; i < asteroidCount; i++) {
      const px = positions[i * 3];
      const py = positions[i * 3 + 1];
      const pz = positions[i * 3 + 2];

      const distSq = px * px + py * py + pz * pz;
      const dist = Math.sqrt(distSq);
      if (dist > 0.1) {
        const force = 4.0 / distSq;
        const ax = -px / dist * force;
        const ay = -py / dist * force;
        const az = -pz / dist * force;

        astVel[i].x += ax * dt;
        astVel[i].y += ay * dt;
        astVel[i].z += az * dt;
      }

      positions[i * 3] += astVel[i].x * dt;
      positions[i * 3 + 1] += astVel[i].y * dt;
      positions[i * 3 + 2] += astVel[i].z * dt;
    }
    asteroidGeo.attributes.position.needsUpdate = true;

    // Solar system revolution (clean planetary orbits without satellites)
    const animTime = t * 0.5;
    planets.forEach(function(p) {
      const currentAngle = p.data.baseAngle + (animTime * (365.25 / p.data.period));
      p.mesh.position.x = p.data.orbit * Math.cos(currentAngle);
      p.mesh.position.z = p.data.orbit * Math.sin(currentAngle);
      p.mesh.position.y = 0;
      p.mesh.rotation.y += 0.01 * timeScale;
    });

    const baseTargetPos = new THREE.Vector3(0, 0, 28);
    const baseTargetLook = new THREE.Vector3(0, 0, 0);

    const targetOpacity = currentTargetPlanet ? 0.0 : 0.3;
    planets.forEach(function(p) {
      if (p.path) p.path.material.opacity += (targetOpacity - p.path.material.opacity) * 0.1;
    });

    if (currentTargetPlanet) {
      const pData = planets.find(function(p) { return p.data.name === currentTargetPlanet; });
      if (pData) {
        const worldPos = new THREE.Vector3();
        pData.mesh.getWorldPosition(worldPos);

        let dist = pData.data.size * 9.5;
        if (pData.data.name === 'Saturn') dist *= 1.4;

        const panLeft = window.innerWidth > 1024 ? dist * 0.22 : 0;
        baseTargetLook.copy(worldPos).add(new THREE.Vector3(-panLeft, 0, 0));
        const offset = new THREE.Vector3(-panLeft, pData.data.size * 0.5, dist);
        baseTargetPos.copy(worldPos).add(offset);
      }
    }

    const parallaxMult = currentTargetPlanet ? 0.3 : 2.2;
    targetCameraPos.copy(baseTargetPos).add(new THREE.Vector3(mx * parallaxMult, -my * (parallaxMult * 0.6), 0));

    camera.position.lerp(targetCameraPos, 0.05);
    currentLookAt.lerp(baseTargetLook, 0.05);
    camera.lookAt(currentLookAt);

    renderer.render(scene, camera);
  }
  loop();

  let rt;
  addEventListener('resize', function() {
    clearTimeout(rt);
    rt = setTimeout(function() {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    }, 140);
  });
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      cancelAnimationFrame(raf);
    } else {
      loop();
    }
  });

  // Mobile Menu Toggle
  const menuBtn = document.getElementById('menuToggle');
  const navlinks = document.getElementById('navlinks');
  if (menuBtn && navlinks) {
    menuBtn.addEventListener('click', function() {
      navlinks.classList.toggle('open');
      menuBtn.classList.toggle('open');
    });
    navlinks.addEventListener('click', function(e) {
      if (e.target.tagName === 'A') {
        navlinks.classList.remove('open');
        menuBtn.classList.remove('open');
      }
    });
  }

  // Resume Card Flip In-Place
  const card = document.getElementById('resumeCard');
  const hintText = document.getElementById('flipHintText');
  if (card) {
    card.addEventListener('click', function(e) {
      if (e.target.closest('#viewFullscreenBtn')) {
        return;
      }
      card.classList.toggle('is-flipped');
      if (hintText) {
        hintText.textContent = card.classList.contains('is-flipped') ? 'Flip to view Profile' : 'Flip to view Resume';
      }
    });
  }

  // Education Card Handler (replacing inline onclick)
  const mcaCard = document.getElementById('mcaDegreeCard');
  if (mcaCard) {
    mcaCard.addEventListener('click', function(e) {
      e.preventDefault();
      alert('Degree Certificate: In Progress (Expected June 2026)');
    });
  }
})();
