// ============ Zen Plant Widget ============

const PLANT_GROWTH_STAGES = 256;
const PLANT_CYCLE_LENGTH = 366;
const PLANT_GENOME_SIZE = 1024;

function initPlant() {
  const canvas = document.getElementById('plantCanvas');
  if (!canvas) return;
  const wrap = document.getElementById('plantWrap');

  document.addEventListener('mousemove', (e) => {
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right &&
                   e.clientY >= r.top && e.clientY <= r.bottom;
    wrap.classList.toggle('plant-hover', inside);
  });

  const ctx = canvas.getContext('2d');
  const PAD = 20;
  const W = 140, H = 255;
  const CW = W + PAD * 2, CH = H + PAD * 2;
  canvas.width = CW * 2;
  canvas.height = CH * 2;
  ctx.scale(2, 2);
  ctx.translate(PAD, PAD);

  let plantData = { seed: null, birthDate: null, debugDays: null, genome: null };

  function mulberry32(a) {
    return function() {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function generateGenome(seed) {
    const rng = mulberry32(seed);
    const g = new Array(PLANT_GENOME_SIZE);
    for (let i = 0; i < PLANT_GENOME_SIZE; i++) g[i] = rng();
    return g;
  }

  function getEffectiveDays() {
    if (plantData.debugDays !== null && plantData.debugDays !== undefined) {
      return Math.max(0, plantData.debugDays);
    }
    if (!plantData.birthDate) return 0;
    const birth = new Date(plantData.birthDate + 'T00:00:00');
    return Math.max(0, Math.floor((new Date() - birth) / (1000 * 60 * 60 * 24)));
  }

  // Cycle starts with summer so the transition from full-growth is seamless
  function getSeasonInfo(days) {
    if (days <= PLANT_GROWTH_STAGES) return null;
    const cycleDay = (days - PLANT_GROWTH_STAGES) % PLANT_CYCLE_LENGTH;
    const cycleYear = Math.floor((days - PLANT_GROWTH_STAGES) / PLANT_CYCLE_LENGTH) + 1;
    if (cycleDay < 91) {
      return { season: 'spring', t: cycleDay / 90, cycleDay, cycleYear };
    } else if (cycleDay < 183) {
      return { season: 'summer', t: (cycleDay - 91) / 91, cycleDay, cycleYear };
    } else if (cycleDay < 275) {
      return { season: 'autumn', t: (cycleDay - 183) / 91, cycleDay, cycleYear };
    } else {
      return { season: 'winter', t: (cycleDay - 275) / 90, cycleDay, cycleYear };
    }
  }

  function getLeafSeasonParams(season) {
    if (!season) return { density: 1, hueShift: 0, satMod: 1, lumMod: 1, alphaMod: 1 };
    const firstCycle = season.cycleYear === 1;
    switch (season.season) {
      case 'summer':
        return { density: 1, hueShift: -5, satMod: 1.1, lumMod: 0.95, alphaMod: 1 };
      case 'autumn': {
        const falloff = 1 - season.t * 0.85;
        return { density: falloff, hueShift: -60 * season.t, satMod: 0.8 + 0.2 * (1 - season.t), lumMod: 1 + 0.15 * season.t, alphaMod: falloff };
      }
      case 'winter':
        return { density: 0.12 + 0.03 * (1 - season.t), hueShift: -40, satMod: 0.4, lumMod: 0.8, alphaMod: 0.5 };
      case 'spring': {
        if (firstCycle) {
          return { density: 1, hueShift: 0, satMod: 1, lumMod: 1, alphaMod: 1 };
        }
        return { density: 0.7 + 0.3 * season.t, hueShift: 5 * season.t, satMod: 0.9 + 0.1 * season.t, lumMod: 1, alphaMod: 0.7 + 0.3 * season.t };
      }
      default:
        return { density: 1, hueShift: 0, satMod: 1, lumMod: 1, alphaMod: 1 };
    }
  }

  function hsl(h, s, l, a) {
    return a !== undefined ? `hsla(${h},${s}%,${l}%,${a})` : `hsl(${h},${s}%,${l}%)`;
  }

  function G(i) {
    const genome = plantData.genome;
    if (!genome) return 0.5;
    return genome[i % PLANT_GENOME_SIZE];
  }

  // Genome value with small deterministic per-cycle drift (first cycle keeps growth values)
  function Gc(i, cycleYear) {
    const base = G(i);
    if (cycleYear <= 1) return base;
    const drift = (Math.sin(i * 127.1 + cycleYear * 311.7) * 0.5 + 0.5 - 0.5) * 0.15;
    return Math.max(0, Math.min(1, base + drift));
  }

  function drawLabel(baseX, baseY, growthStage) {
    const fade = growthStage >= 50 ? Math.max(0, 1 - (growthStage - 50) / 10) : 1;
    if (fade <= 0) return;

    ctx.save();
    ctx.globalAlpha = fade;

    const angle = 0.2 + G(11) * 0.25;
    const stickHue = 25 + G(12) * 20;
    const anchorX = baseX + 3 + G(13) * 2;
    const anchorY = baseY;
    const stickLen = 16 + G(14) * 6;

    ctx.save();
    ctx.translate(anchorX, anchorY);
    ctx.rotate(angle);

    ctx.strokeStyle = hsl(stickHue, 35, 34, 0.9);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -stickLen);
    ctx.stroke();

    const lw = 13.2 + G(15) * 4.4;
    const lh = 8.8 + G(16) * 4.4;
    const lx = -lw / 2;
    const ly = -stickLen - lh + 1;
    const labelHue = 48 + G(17) * 12;
    const labelSat = 55 + G(18) * 30;
    const labelLum = 92 + G(19) * 6;
    const cornerR = 1 + G(20) * 1.5;

    ctx.fillStyle = hsl(labelHue, labelSat, labelLum, 0.95);
    ctx.beginPath();
    ctx.moveTo(lx + cornerR, ly);
    ctx.lineTo(lx + lw - cornerR, ly);
    ctx.arcTo(lx + lw, ly, lx + lw, ly + cornerR, cornerR);
    ctx.lineTo(lx + lw, ly + lh - cornerR);
    ctx.arcTo(lx + lw, ly + lh, lx + lw - cornerR, ly + lh, cornerR);
    ctx.lineTo(lx + cornerR, ly + lh);
    ctx.arcTo(lx, ly + lh, lx, ly + lh - cornerR, cornerR);
    ctx.lineTo(lx, ly + cornerR);
    ctx.arcTo(lx, ly, lx + cornerR, ly, cornerR);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = hsl(labelHue - 5, labelSat + 10, labelLum - 30, 0.3);
    ctx.lineWidth = 0.5;
    ctx.stroke();

    const lineCount = 2 + Math.floor(G(21) * 2);
    const inkHue = 90 + G(22) * 60;
    const inkSat = 30 + G(23) * 30;
    const inkLum = 30 + G(24) * 15;
    ctx.strokeStyle = hsl(inkHue, inkSat, inkLum, 0.6);
    ctx.lineWidth = 0.7;
    ctx.lineCap = 'round';
    const margin = 2;
    const lineSpacing = (lh - margin * 2) / (lineCount + 1);

    for (let i = 0; i < lineCount; i++) {
      const lineY = ly + margin + lineSpacing * (i + 1);
      const lineLen = (lw - margin * 2) * (0.5 + G(25 + i * 3) * 0.5);
      ctx.beginPath();
      const segs = 4 + Math.floor(G(26 + i * 3) * 4);
      for (let s = 0; s <= segs; s++) {
        const t = s / segs;
        const sx = lx + margin + t * lineLen;
        const sy = lineY + (G(27 + i * 3 + s) - 0.5) * 1.4;
        if (s === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }

    ctx.restore();
    ctx.restore();
  }

  function drawPlant(days) {
    ctx.clearRect(-PAD, -PAD, CW, CH);
    if (days <= 0) { drawPot(G(9), G(10)); drawLabel(W / 2, H - 18, 0); return; }

    const growthStage = Math.min(PLANT_GROWTH_STAGES, days);
    const progress = growthStage / PLANT_GROWTH_STAGES;
    const season = getSeasonInfo(days);

    const baseHue = 90 + Math.floor(G(0) * 40 - 20);
    const asymmetry = G(1) * 0.4 - 0.2;
    const leafStyle = G(3);
    const flowerHue = Math.floor(G(4) * 360);
    const trunkBend = (G(5) - 0.5) * 0.15;
    const flowerStyle = G(7);
    const fruitStyle = G(8);
    const barkHue = 10 + G(2) * 35;
    const barkSat = 20 + G(2) * 30;

    drawPot(G(9), G(10));

    if (growthStage < 60) {
      drawLabel(W / 2 + asymmetry * 10, H - 18, growthStage);
    }

    const trunkH = 20 + progress * 140;
    const trunkW = 1 + progress * 5;
    const baseX = W / 2 + asymmetry * 10;
    const baseY = H - 18;

    drawTrunk(baseX, baseY, trunkH, trunkW, trunkBend, progress, barkHue, barkSat);

    if (growthStage > 15) {
      drawBranches(baseX, baseY, trunkH, trunkW, trunkBend, progress, barkHue, barkSat, asymmetry, growthStage, season);
    }
    if (growthStage > 30) {
      drawLeaves(baseX, baseY, trunkH, trunkBend, progress, baseHue, leafStyle, asymmetry, growthStage, season);
    }
    if (season) {
      if (season.season === 'spring') {
        drawFlowers(baseX, baseY, trunkH, trunkBend, progress, flowerHue, flowerStyle, season);
      }
      if (season.season === 'summer' || (season.season === 'autumn' && season.t < 0.3)) {
        drawFruits(baseX, baseY, trunkH, trunkBend, progress, fruitStyle, season);
      }
      if (season.season === 'autumn' && season.t > 0.2) {
        drawFallenLeaves(baseX, baseY, leafStyle, season);
      }
    }
  }

  function getPotColor(v) {
    if (v < 0.3) return { h: 12 + v * 30, s: 45 + v * 20, l: 35 };
    if (v < 0.6) return { h: 20 + (v - 0.3) * 40, s: 25 + (v - 0.3) * 30, l: 28 };
    if (v < 0.85) return { h: 30, s: 8 + (v - 0.6) * 20, l: 33 + (v - 0.6) * 20 };
    return { h: 200 + (v - 0.85) * 40, s: 10 + (v - 0.85) * 20, l: 32 };
  }

  function drawPot(colorVal, shapeVal) {
    const cx = W / 2, by = H - 2;
    const c = getPotColor(colorVal);
    ctx.save();

    if (shapeVal < 0.25) {
      // Classic trapezoid
      ctx.fillStyle = hsl(c.h, c.s, c.l, 0.7);
      ctx.beginPath();
      ctx.moveTo(cx - 14, by - 16);
      ctx.lineTo(cx + 14, by - 16);
      ctx.lineTo(cx + 11, by);
      ctx.lineTo(cx - 11, by);
      ctx.closePath();
      ctx.fill();
      // Rim
      ctx.fillStyle = hsl(c.h, c.s + 5, c.l + 5, 0.8);
      ctx.beginPath();
      ctx.moveTo(cx - 16, by - 16);
      ctx.lineTo(cx + 16, by - 16);
      ctx.lineTo(cx + 15, by - 13);
      ctx.lineTo(cx - 15, by - 13);
      ctx.closePath();
      ctx.fill();
    } else if (shapeVal < 0.5) {
      // Rounded bowl
      ctx.fillStyle = hsl(c.h, c.s, c.l, 0.7);
      ctx.beginPath();
      ctx.moveTo(cx - 15, by - 14);
      ctx.quadraticCurveTo(cx - 13, by + 2, cx, by);
      ctx.quadraticCurveTo(cx + 13, by + 2, cx + 15, by - 14);
      ctx.closePath();
      ctx.fill();
      // Rim
      ctx.fillStyle = hsl(c.h, c.s + 5, c.l + 5, 0.8);
      ctx.beginPath();
      ctx.moveTo(cx - 17, by - 14);
      ctx.lineTo(cx + 17, by - 14);
      ctx.lineTo(cx + 16, by - 11);
      ctx.lineTo(cx - 16, by - 11);
      ctx.closePath();
      ctx.fill();
    } else if (shapeVal < 0.75) {
      // Tall narrow
      ctx.fillStyle = hsl(c.h, c.s, c.l, 0.7);
      ctx.beginPath();
      ctx.moveTo(cx - 10, by - 20);
      ctx.lineTo(cx + 10, by - 20);
      ctx.lineTo(cx + 9, by);
      ctx.lineTo(cx - 9, by);
      ctx.closePath();
      ctx.fill();
      // Rim
      ctx.fillStyle = hsl(c.h, c.s + 5, c.l + 5, 0.8);
      ctx.beginPath();
      ctx.moveTo(cx - 12, by - 20);
      ctx.lineTo(cx + 12, by - 20);
      ctx.lineTo(cx + 11, by - 17);
      ctx.lineTo(cx - 11, by - 17);
      ctx.closePath();
      ctx.fill();
    } else {
      // Wide squat
      ctx.fillStyle = hsl(c.h, c.s, c.l, 0.7);
      ctx.beginPath();
      ctx.moveTo(cx - 17, by - 12);
      ctx.lineTo(cx + 17, by - 12);
      ctx.lineTo(cx + 14, by);
      ctx.lineTo(cx - 14, by);
      ctx.closePath();
      ctx.fill();
      // Rim
      ctx.fillStyle = hsl(c.h, c.s + 5, c.l + 5, 0.8);
      ctx.beginPath();
      ctx.moveTo(cx - 19, by - 12);
      ctx.lineTo(cx + 19, by - 12);
      ctx.lineTo(cx + 18, by - 9);
      ctx.lineTo(cx - 18, by - 9);
      ctx.closePath();
      ctx.fill();
    }

    // Soil top
    const rimY = shapeVal < 0.25 ? by - 16 : shapeVal < 0.5 ? by - 14 : shapeVal < 0.75 ? by - 20 : by - 12;
    const rimW = shapeVal < 0.75 ? 15 : 18;
    ctx.fillStyle = hsl(c.h, Math.max(5, c.s - 15), c.l - 8, 0.5);
    ctx.beginPath();
    ctx.ellipse(cx, rimY, rimW, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawTrunk(bx, by, height, width, bend, progress, barkH, barkS) {
    ctx.save();
    const segments = 12;
    for (let i = 0; i < segments; i++) {
      const t = i / segments;
      const nt = (i + 1) / segments;
      const w1 = width * (1 - t * 0.6);
      const w2 = width * (1 - nt * 0.6);
      const x1 = bx + Math.sin(t * Math.PI) * bend * height;
      const x2 = bx + Math.sin(nt * Math.PI) * bend * height;
      const y1 = by - t * height;
      const y2 = by - nt * height;
      const lightness = 22 + t * 12;
      ctx.fillStyle = hsl(barkH, barkS, lightness, 0.9);
      ctx.beginPath();
      ctx.moveTo(x1 - w1 / 2, y1);
      ctx.lineTo(x2 - w2 / 2, y2);
      ctx.lineTo(x2 + w2 / 2, y2);
      ctx.lineTo(x1 + w1 / 2, y1);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBranches(bx, by, trunkH, trunkW, bend, progress, barkH, barkS, asym, stage, season) {
    ctx.save();
    const cy = season ? season.cycleYear : 0;
    const numBranches = Math.min(14, Math.floor(2 + progress * 14));
    const minStart = 0.3;
    const base = 10;

    for (let i = 0; i < numBranches; i++) {
      const gi = base + i * 6;
      const t = minStart + Gc(gi, cy) * (1 - minStart);
      const side = (i % 2 === 0) ? -1 : 1;
      const angle = 0.3 + Gc(gi + 1, cy) * 0.6 + asym * 0.3;
      const len = (12 + Gc(gi + 2, cy) * 35) * progress;
      const thickness = Math.max(0.5, trunkW * (1 - t) * 0.5);

      const startX = bx + Math.sin(t * Math.PI) * bend * trunkH;
      const startY = by - t * trunkH;
      const endX = startX + Math.cos(angle - Math.PI / 2) * len * side;
      const endY = startY - Math.abs(Math.sin(angle)) * len * 0.7;

      ctx.strokeStyle = hsl(barkH, barkS - 5, 28, 0.8);
      ctx.lineWidth = thickness;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      const cpx = (startX + endX) / 2 + (Gc(gi + 3, cy) - 0.5) * 8;
      const cpy = Math.min(startY, endY) - Gc(gi + 4, cy) * 8;
      ctx.quadraticCurveTo(cpx, cpy, endX, endY);
      ctx.stroke();

      if (stage > 60 && G(gi + 5) > 0.4) {
        const subLen = len * 0.5;
        const subAngle = angle + (Gc(gi + 3, cy) - 0.5) * 0.8;
        const subEndX = endX + Math.cos(subAngle - Math.PI / 2) * subLen * side;
        const subEndY = endY - Math.abs(Math.sin(subAngle)) * subLen * 0.6;
        ctx.lineWidth = thickness * 0.5;
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(subEndX, subEndY);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawLeaves(bx, by, trunkH, bend, progress, hue, style, asym, growthStage, season) {
    ctx.save();
    const sp = getLeafSeasonParams(season);
    const cy = season ? season.cycleYear : 0;

    const maxLeaves = 140;
    const baseCount = season ? maxLeaves : Math.min(maxLeaves, Math.floor(5 + progress * maxLeaves));
    const numLeaves = Math.floor(baseCount * sp.density);
    const leafProgress = season ? 1 : Math.min(1, (growthStage - 30) / 200);
    const base = 200;

    for (let i = 0; i < numLeaves; i++) {
      const gi = base + i * 8;
      const t = 0.3 + Gc(gi, cy) * 0.75;
      const spread = (15 + progress * 55) * leafProgress;
      const ox = (Gc(gi + 1, cy) - 0.5) * spread * 2 + asym * 5;
      const oy = (Gc(gi + 2, cy) - 0.5) * spread;

      const px = bx + Math.sin(t * Math.PI) * bend * trunkH + ox;
      const py = by - t * trunkH + oy;
      if (py > by - 5 || py < by - trunkH - 30) continue;

      const leafSize = (2 + Gc(gi + 3, cy) * 4) * leafProgress;
      const leafAngle = Gc(gi + 4, cy) * Math.PI * 2;
      const hueShift = (Gc(gi + 5, cy) - 0.5) * 30 + sp.hueShift;
      const lum = Math.min(80, (30 + Gc(gi + 6, cy) * 25) * sp.lumMod);
      const sat = Math.max(10, (50 + Gc(gi + 6, cy) * 30) * sp.satMod);
      const alpha = Math.min(1, (0.7 + Gc(gi + 7, cy) * 0.3) * sp.alphaMod);
      ctx.fillStyle = hsl(hue + hueShift, sat, lum, alpha);

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(leafAngle);

      if (style < 0.33) {
        ctx.beginPath();
        ctx.ellipse(0, 0, leafSize, leafSize * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (style < 0.66) {
        ctx.beginPath();
        ctx.moveTo(0, -leafSize);
        ctx.quadraticCurveTo(leafSize * 0.8, 0, 0, leafSize * 0.5);
        ctx.quadraticCurveTo(-leafSize * 0.8, 0, 0, -leafSize);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, leafSize * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function drawFlowers(bx, by, trunkH, bend, progress, flowerHue, style, season) {
    ctx.save();
    const cy = season.cycleYear;
    const intensity = season.t < 0.5 ? season.t * 2 : (1 - season.t) * 2;
    const numFlowers = Math.floor(5 + intensity * 18);
    const base = 930;

    for (let i = 0; i < numFlowers; i++) {
      const gi = base + i * 6;
      const t = 0.3 + Gc(gi, cy) * 0.65;
      const spread = 15 + progress * 55;
      const ox = (Gc(gi + 1, cy) - 0.5) * spread * 2;
      const oy = (Gc(gi + 2, cy) - 0.5) * spread;

      const px = bx + Math.sin(t * Math.PI) * bend * trunkH + ox;
      const py = by - t * trunkH + oy;
      if (py > by - 10) continue;

      const size = (3 + Gc(gi + 3, cy) * 4) * intensity;
      const petals = 4 + Math.floor(G(gi + 4) * 3);
      const fHue = flowerHue + (Gc(gi + 5, cy) - 0.5) * 40;
      const petalAlpha = 0.8 * intensity;

      if (style < 0.25) {
        // Round petal blossoms
        for (let p = 0; p < petals; p++) {
          const a = (p / petals) * Math.PI * 2;
          ctx.fillStyle = hsl(fHue, 70, 70, petalAlpha);
          ctx.beginPath();
          ctx.arc(px + Math.cos(a) * size, py + Math.sin(a) * size, size * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (style < 0.5) {
        // Star / pointed petals
        ctx.fillStyle = hsl(fHue, 70, 70, petalAlpha);
        ctx.beginPath();
        for (let p = 0; p <= petals * 2; p++) {
          const a = (p / (petals * 2)) * Math.PI * 2 - Math.PI / 2;
          const r = p % 2 === 0 ? size * 1.1 : size * 0.35;
          const method = p === 0 ? 'moveTo' : 'lineTo';
          ctx[method](px + Math.cos(a) * r, py + Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
      } else if (style < 0.75) {
        // Daisy — many thin elongated petals
        const daisyPetals = petals + 3;
        for (let p = 0; p < daisyPetals; p++) {
          const a = (p / daisyPetals) * Math.PI * 2;
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(a);
          ctx.fillStyle = hsl(fHue, 65, 80, petalAlpha);
          ctx.beginPath();
          ctx.ellipse(size * 0.7, 0, size * 0.6, size * 0.2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      } else {
        // Cherry blossom — 5 wide overlapping petals with notch
        const cbPetals = 5;
        for (let p = 0; p < cbPetals; p++) {
          const a = (p / cbPetals) * Math.PI * 2 - Math.PI / 2;
          const tipX = px + Math.cos(a) * size * 1.1;
          const tipY = py + Math.sin(a) * size * 1.1;
          ctx.fillStyle = hsl(fHue, 60, 78, petalAlpha);
          ctx.beginPath();
          ctx.arc(tipX, tipY, size * 0.55, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // Center
      ctx.fillStyle = hsl(45, 80, 65, 0.9 * intensity);
      ctx.beginPath();
      ctx.arc(px, py, size * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawFruits(bx, by, trunkH, bend, progress, style, season) {
    ctx.save();
    const cy = season.cycleYear;
    let intensity;
    if (season.season === 'summer') {
      intensity = Math.min(1, season.t * 2);
    } else {
      intensity = 1 - season.t / 0.3;
    }

    const fruitHue = Math.floor(320 + G(6) * 60) % 360;
    const numFruits = Math.floor(2 + intensity * 10);
    const base = 900;

    for (let i = 0; i < numFruits; i++) {
      const gi = base + i * 4;
      const t = 0.3 + Gc(gi, cy) * 0.65;
      const spread = 15 + progress * 55;
      const ox = (Gc(gi + 1, cy) - 0.5) * spread * 2;
      const oy = (Gc(gi + 2, cy) - 0.5) * spread;

      const px = bx + Math.sin(t * Math.PI) * bend * trunkH + ox;
      const py = by - t * trunkH + oy;
      if (py > by - 10) continue;

      const size = (2.5 + Gc(gi + 3, cy) * 3) * intensity;
      const alpha = 0.85 * intensity;
      const hlAlpha = 0.4 * intensity;

      if (style < 0.25) {
        // Round apples
        ctx.fillStyle = hsl(fruitHue, 70, 45, alpha);
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hsl(fruitHue, 60, 65, hlAlpha);
        ctx.beginPath();
        ctx.arc(px - size * 0.3, py - size * 0.3, size * 0.35, 0, Math.PI * 2);
        ctx.fill();
      } else if (style < 0.5) {
        // Oval plums
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(Gc(gi, cy) * 0.6 - 0.3);
        ctx.fillStyle = hsl(fruitHue - 10, 65, 40, alpha);
        ctx.beginPath();
        ctx.ellipse(0, 0, size * 0.7, size * 1.1, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hsl(fruitHue - 10, 55, 60, hlAlpha);
        ctx.beginPath();
        ctx.ellipse(-size * 0.15, -size * 0.35, size * 0.25, size * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (style < 0.75) {
        // Berry clusters — 3 small berries
        const berryR = size * 0.55;
        for (let b = 0; b < 3; b++) {
          const ba = (b / 3) * Math.PI * 2 - Math.PI / 2;
          const bx2 = px + Math.cos(ba) * size * 0.45;
          const by2 = py + Math.sin(ba) * size * 0.45;
          ctx.fillStyle = hsl(fruitHue + 10, 65, 35, alpha);
          ctx.beginPath();
          ctx.arc(bx2, by2, berryR, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = hsl(fruitHue + 10, 55, 55, hlAlpha);
          ctx.beginPath();
          ctx.arc(bx2 - berryR * 0.25, by2 - berryR * 0.25, berryR * 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // Pear-shaped
        ctx.fillStyle = hsl(fruitHue + 15, 60, 48, alpha);
        ctx.beginPath();
        ctx.arc(px, py - size * 0.3, size * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(px, py + size * 0.25, size * 0.85, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hsl(fruitHue + 15, 50, 65, hlAlpha);
        ctx.beginPath();
        ctx.arc(px - size * 0.2, py - size * 0.4, size * 0.25, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawFallenLeaves(bx, by, leafStyle, season) {
    ctx.save();
    const cy = season.cycleYear;
    const intensity = Math.min(1, (season.t - 0.2) / 0.5);
    const numFallen = Math.floor(5 + intensity * 18);
    const base = 800;

    for (let i = 0; i < numFallen; i++) {
      const gi = base + i * 5;
      const ox = (Gc(gi, cy) - 0.5) * 60;
      const oy = Gc(gi + 1, cy) * 6;
      const px = bx + ox;
      const py = by + oy - 3;

      const leafSize = 1.5 + Gc(gi + 2, cy) * 2.5;
      const leafAngle = Gc(gi + 3, cy) * Math.PI * 2;
      const warmHue = 20 + Gc(gi + 4, cy) * 40;
      ctx.fillStyle = hsl(warmHue, 55, 40, 0.5 * intensity);

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(leafAngle);

      if (leafStyle < 0.33) {
        ctx.beginPath();
        ctx.ellipse(0, 0, leafSize, leafSize * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (leafStyle < 0.66) {
        ctx.beginPath();
        ctx.moveTo(0, -leafSize * 0.7);
        ctx.quadraticCurveTo(leafSize * 0.6, 0, 0, leafSize * 0.4);
        ctx.quadraticCurveTo(-leafSize * 0.6, 0, 0, -leafSize * 0.7);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, leafSize * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function render() {
    drawPlant(getEffectiveDays());
  }

  function initPlantData(stored) {
    let needsSave = false;
    if (!stored.seed) {
      stored.seed = Math.floor(Math.random() * 2147483647);
      needsSave = true;
    }
    if (!stored.birthDate) {
      const now = new Date();
      stored.birthDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      needsSave = true;
    }
    if (!stored.genome || stored.genome.length !== PLANT_GENOME_SIZE) {
      stored.genome = generateGenome(stored.seed);
      needsSave = true;
    }
    plantData = stored;
    if (needsSave) chrome.storage.local.set({ plantData });
  }

  chrome.storage.local.get('plantData', (result) => {
    const stored = result.plantData || {};
    const isBirth = !stored.seed;
    initPlantData(stored);
    render();

    if (isBirth && wrap && typeof createZenPulse === 'function') {
      setTimeout(() => {
        const r = wrap.getBoundingClientRect();
        const px = r.left + r.width * 0.5;
        const py = r.bottom - r.height * 0.08;
        createZenPulse(px, py);
        setTimeout(() => createZenPulse(px, py), 600);
        setTimeout(() => createZenPulse(px, py), 1200);
      }, 300);
    }
  });

  let lastRenderedDay = getEffectiveDays();
  setInterval(() => {
    const today = getEffectiveDays();
    if (today !== lastRenderedDay) {
      lastRenderedDay = today;
      render();
    }
  }, 60000);

  const debugSlider = document.getElementById('plantDebugDays');
  const debugValue = document.getElementById('plantDebugValue');
  if (debugSlider) {
    chrome.storage.local.get('plantData', (result) => {
      const pd = result.plantData || {};
      if (pd.debugDays !== null && pd.debugDays !== undefined) {
        debugSlider.value = pd.debugDays;
        if (debugValue) debugValue.textContent = pd.debugDays;
      }
    });
    debugSlider.addEventListener('input', () => {
      const val = parseInt(debugSlider.value);
      if (debugValue) debugValue.textContent = val;
      plantData.debugDays = val;
      chrome.storage.local.set({ plantData });
      render();
    });
  }

  const resetGenomeBtn = document.getElementById('plantResetGenomeBtn');
  if (resetGenomeBtn) {
    resetGenomeBtn.addEventListener('click', () => {
      const newSeed = Math.floor(Math.random() * 2147483647);
      const newGenome = generateGenome(newSeed);
      plantData.seed = newSeed;
      plantData.genome = newGenome;
      chrome.storage.local.set({ plantData });
      render();
    });
  }

  window._plantRender = render;
  window._plantData = plantData;

}
