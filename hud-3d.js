/* Three.js driving instruments. DOM nodes remain as accessible text and fallback. */
window.PODA_HUD3D = (() => {
  const FONT = 'Outfit, Arial, sans-serif';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function rounded(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r);
    g.closePath();
  }
  function panel(g, w, h, accent) {
    g.shadowColor = 'rgba(0,0,0,.42)'; g.shadowBlur = 12; g.shadowOffsetY = 4;
    rounded(g, 3, 3, w - 6, h - 7, 11);
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, 'rgba(30,42,53,.92)'); bg.addColorStop(1, 'rgba(9,18,26,.91)');
    g.fillStyle = bg; g.fill();
    g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0;
    g.strokeStyle = 'rgba(235,245,246,.46)'; g.lineWidth = 1; g.stroke();
    g.fillStyle = accent; rounded(g, 4, 12, 3, h - 25, 2); g.fill();
  }
  function label(g, text, x, y, size = 10) {
    g.font = `800 ${size}px ${FONT}`; g.fillStyle = '#d1dedf'; g.fillText(text.toUpperCase(), x, y);
  }
  function value(g, text, x, y, size = 24, color = '#fff', maxWidth) {
    g.font = `800 ${size}px ${FONT}`; g.fillStyle = color; g.fillText(text, x, y, maxWidth);
  }

  function create(THREE) {
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(0, 1, 0, -1, .1, 10);
    camera.position.z = 5;
    const meshes = {};
    let width = 1, height = 1, compact = false, state = {}, hintText = '', notice = null;
    const pressed = { horn: false, brake: false, gas: false };

    function surface(name, draw) {
      const canvas = document.createElement('canvas');
      const g = canvas.getContext('2d');
      const tex = new THREE.CanvasTexture(canvas);
      tex.encoding = THREE.sRGBEncoding;
      tex.minFilter = THREE.LinearFilter;
      const material = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
      mesh.renderOrder = 20;
      scene.add(mesh);
      meshes[name] = { canvas, g, tex, mesh, draw, last: '' };
    }
    function place(name, x, y, w, h) {
      const item = meshes[name];
      item.mesh.position.set(x + w / 2, -y - h / 2, 0);
      item.mesh.scale.set(w, h, 1);
      if (item.canvas.width !== Math.round(w * 2) || item.canvas.height !== Math.round(h * 2)) {
        item.canvas.width = Math.round(w * 2); item.canvas.height = Math.round(h * 2);
        item.last = '';
      }
      item.w = w; item.h = h;
    }
    function paint(name, key) {
      const item = meshes[name];
      if (key === item.last) return;
      item.last = key;
      const g = item.g;
      g.setTransform(2, 0, 0, 2, 0, 0); g.clearRect(0, 0, item.w, item.h);
      item.draw(g, item.w, item.h);
      item.tex.needsUpdate = true;
    }

    const small = (type, accent) => (g, w, h) => {
      panel(g, w, h, accent);
      const iconW = compact ? 25 : 36, x = iconW + (compact ? 11 : 16);
      g.fillStyle = accent; rounded(g, 10, (h - iconW) / 2, iconW, iconW, type === 'speed' ? iconW / 2 : 7); g.fill();
      g.fillStyle = '#13222b'; g.font = `900 ${compact ? 13 : 17}px ${FONT}`;
      g.textAlign = 'center'; g.fillText({ cash: 'Le', speed: '◉', pax: '●●', body: '▣' }[type], 10 + iconW / 2, h / 2 + (compact ? 4 : 6));
      g.textAlign = 'left';
      if (type === 'cash') { label(g, 'Earnings', x, compact ? 18 : 22, compact ? 8 : 10); value(g, state.cash || 'Le 0', x, compact ? 37 : 48, compact ? 18 : 25, '#fff', w - x - 9); }
      if (type === 'speed') { label(g, `Speed · ${state.distance || '0.00 km'}`, x, compact ? 18 : 22, compact ? 8 : 10); value(g, state.speed || '0 km/h', x, compact ? 37 : 48, compact ? 18 : 25, '#fff', w - x - 9); }
      if (type === 'pax') { value(g, state.pax || '0/14', x, compact ? 23 : 31, compact ? 18 : 25); label(g, 'Passengers', x, compact ? 38 : 48, compact ? 8 : 10); }
      if (type === 'body') {
        label(g, 'Body condition', x, compact ? 18 : 23, compact ? 8 : 10);
        g.fillStyle = '#5e6669'; rounded(g, x, compact ? 26 : 34, w - x - 14, compact ? 8 : 10, 5); g.fill();
        g.fillStyle = state.damaged ? '#eb5b55' : '#44dd79'; rounded(g, x, compact ? 26 : 34, (w - x - 14) * (state.damaged ? .5 : 1), compact ? 8 : 10, 5); g.fill();
      }
    };
    surface('cash', small('cash', '#42dd86'));
    surface('speed', small('speed', '#70bcff'));
    surface('pax', small('pax', '#ecf0ef'));
    surface('body', small('body', '#51dc7d'));
    surface('route', (g, w, h) => {
      panel(g, w, h, '#ffc83e');
      g.fillStyle = '#ffc83e'; rounded(g, 15, 16, compact ? 19 : 26, compact ? 22 : 30, 8); g.fill();
      g.fillStyle = '#162734'; g.beginPath(); g.arc(compact ? 24.5 : 28, compact ? 27 : 30, 4, 0, Math.PI * 2); g.fill();
      const x = compact ? 45 : 53;
      label(g, 'Next stop', x, compact ? 20 : 25, compact ? 9 : 11);
      value(g, state.stop || '—', x, compact ? 41 : 54, compact ? 19 : 27, '#fff', w - x - (compact ? 73 : 90));
      g.textAlign = 'right'; value(g, state.toStop || '0 m', w - 16, compact ? 42 : 53, compact ? 15 : 19, '#ffcd45'); g.textAlign = 'left';
      const barY = compact ? 58 : 77, barX = 19, barW = w - 38;
      g.fillStyle = '#79898b'; rounded(g, barX, barY, barW, 5, 3); g.fill();
      const progress = clamp(state.progress || 0, 0, 1);
      g.fillStyle = '#44dc83'; rounded(g, barX, barY, Math.max(5, barW * progress), 5, 3); g.fill();
      for (const p of [0, 1]) { g.fillStyle = p ? '#ebefef' : '#44dc83'; g.beginPath(); g.arc(barX + barW * p, barY + 2.5, 6, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#ffca39'; rounded(g, clamp(barX + barW * progress - 8, barX, barX + barW - 16), barY - 8, 16, 20, 4); g.fill();
      if (!compact) label(g, `${state.drops || 0} to drop`, 18, 101, 9);
    });
    surface('hint', (g, w, h) => {
      if (!hintText) return;
      panel(g, w, h, '#4fe18a');
      g.textAlign = 'center'; value(g, hintText, w / 2, h / 2 + 6, compact ? 13 : 15, '#f6fff7', w - 30); g.textAlign = 'left';
    });
    surface('notice', (g, w, h) => {
      if (!notice) return;
      panel(g, w, h, notice.kind === 'bad' ? '#f25a55' : '#4ce18b');
      g.textAlign = 'center';
      value(g, notice.text, w / 2, notice.subtitle ? h / 2 : h / 2 + 8, compact ? 18 : 25, notice.kind === 'money' ? '#ffd244' : '#fff', w - 28);
      if (notice.subtitle) { g.font = `600 ${compact ? 10 : 12}px ${FONT}`; g.fillStyle = '#cfdbd6'; g.fillText(notice.subtitle, w / 2, h / 2 + 17, w - 28); }
      g.textAlign = 'left';
    });
    for (const [name, color, icon] of [['horn', '#318fff', '◀))'], ['brake', '#f05b56', '◉'], ['gas', '#42e77c', '▥']]) {
      surface(name, (g, w, h) => {
        const cx = w / 2, cy = h / 2, r = w / 2 - 6;
        g.shadowColor = '#000a'; g.shadowBlur = 12; g.shadowOffsetY = 5;
        g.fillStyle = pressed[name] ? '#263b42' : '#0b1923';
        g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
        g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0;
        g.strokeStyle = color; g.lineWidth = 5; g.stroke();
        g.fillStyle = color; g.textAlign = 'center';
        g.font = `900 ${Math.round(w * .36)}px ${FONT}`; g.fillText(icon, cx, cy + 3, w - 20);
        g.fillStyle = '#fff'; g.font = `900 ${Math.round(w * .14)}px ${FONT}`; g.fillText(name.toUpperCase(), cx, cy + w * .29);
        g.textAlign = 'left';
      });
    }

    function resize(w, h) {
      width = w; height = h; compact = w < 700;
      camera.right = w; camera.bottom = -h; camera.updateProjectionMatrix();
      if (compact) {
        const sw = (w - 24) / 2, sy = 8;
        place('cash', 8, sy, sw, 45); place('speed', 8, sy + 49, sw, 45);
        place('pax', w - sw - 8, sy, sw, 45); place('body', w - sw - 8, sy + 49, sw, 45);
        place('route', (w - Math.min(w - 16, 340)) / 2, 107, Math.min(w - 16, 340), 74);
      } else {
        const sw = Math.min(220, w * .18), rw = Math.min(400, w - sw * 2 - 68);
        place('cash', 16, 16, sw, 62); place('speed', 16, 84, sw, 62);
        place('pax', w - sw - 16, 16, sw, 62); place('body', w - sw - 16, 84, sw, 62);
        place('route', (w - rw) / 2, 16, rw, 108);
      }
      const nw = Math.min(compact ? w - 24 : 480, w - 24);
      place('hint', (w - nw) / 2, compact ? h - 190 : h - 76, nw, compact ? 48 : 52);
      place('notice', (w - nw) / 2, h * .32, nw, compact ? 54 : 66);
      const showControls = matchMedia('(hover: none), (pointer: coarse)').matches;
      const size = clamp(w * .12, 74, 100), bottom = parseFloat(getComputedStyle(document.getElementById('touch')).paddingBottom) || 18;
      place('horn', 16, h - bottom - size, size, size);
      place('brake', w - 16 - size * 2 - 10, h - bottom - size, size, size);
      place('gas', w - 16 - size, h - bottom - size, size, size);
      for (const name of ['horn', 'brake', 'gas']) meshes[name].mesh.visible = showControls;
      Object.values(meshes).forEach(item => { item.last = ''; });
      for (const name of ['horn', 'brake', 'gas']) paint(name, String(pressed[name]));
      if (hintText) paint('hint', hintText);
      if (notice) paint('notice', notice.text + notice.kind + notice.subtitle);
    }
    function set(next) {
      state = next;
      paint('cash', next.cash);
      paint('speed', next.speed + next.distance);
      paint('pax', next.pax);
      paint('body', String(next.damaged));
      paint('route', `${next.stop}|${next.toStop}|${next.drops}|${Math.round(next.progress * 100)}`);
    }
    function setHint(text) {
      hintText = text || '';
      meshes.hint.mesh.visible = !!hintText;
      if (hintText) paint('hint', hintText);
    }
    function pop(text, kind = '', subtitle = '') {
      notice = { text, kind, subtitle, until: performance.now() + 1900 };
      meshes.notice.mesh.visible = true;
      paint('notice', text + kind + subtitle);
    }
    function control(name, down) {
      if (pressed[name] === down || !meshes[name]) return;
      pressed[name] = down;
      paint(name, String(down));
    }
    function render(renderer) {
      if (notice && performance.now() > notice.until) { notice = null; meshes.notice.mesh.visible = false; }
      const old = renderer.autoClear;
      renderer.autoClear = false;
      try { renderer.clearDepth(); renderer.render(scene, camera); }
      finally { renderer.autoClear = old; }
    }
    meshes.hint.mesh.visible = false; meshes.notice.mesh.visible = false;
    resize(innerWidth, innerHeight);
    return { set, setHint, pop, control, render, resize };
  }
  return { create };
})();
