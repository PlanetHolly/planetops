const PG = (() => {
  const state = {
    manifest: null,
    pms: [],
    selectedPms: [],
    template: null,
    art: null,
    proofDataUrl: null,
    mockupCanvas: null,
    proofCanvas: null,
    markImage: null,
    markLoadFailed: false,
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const fmtDate = v => v ? new Date(v).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "";
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const statusClass = s => "status-" + String(s || "Submitted").replace(/\s+/g, "-");
  const badge = s => `<span class="badge ${statusClass(s)}">${esc(s || "Submitted")}</span>`;

  async function loadJson(path) {
    const r = await fetch(path, { cache: "no-store" });
    if (!r.ok) throw new Error(`${path}: ${r.status}`);
    return r.json();
  }

  async function initData() {
    if (!state.manifest) state.manifest = await loadJson("assets/manifest.json");
    if (!state.pms.length) state.pms = await loadJson("assets/pms.json");
    return state;
  }

  async function loadMarkImage() {
    if (state.markImage || state.markLoadFailed) return state.markImage;
    try {
      state.markImage = await imageFromUrl("assets/pa-mark.svg");
    } catch {
      state.markLoadFailed = true;
    }
    return state.markImage;
  }

  function imageFromUrl(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function imageFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => imageFromUrl(reader.result).then(img => resolve({ img, dataUrl: reader.result })).catch(reject);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function canvas(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }

  function drawImageToCanvas(img) {
    const c = canvas(img.naturalWidth || img.width, img.naturalHeight || img.height);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c;
  }

  function trimTransparent(img) {
    const src = drawImageToCanvas(img);
    const ctx = src.getContext("2d");
    const data = ctx.getImageData(0, 0, src.width, src.height).data;
    let minX = src.width, minY = src.height, maxX = -1, maxY = -1;
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        if (data[(y * src.width + x) * 4 + 3] > 8) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return src;
    const out = canvas(maxX - minX + 1, maxY - minY + 1);
    out.getContext("2d").drawImage(src, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
    return out;
  }

  function steppedResize(src, w, h, exact) {
    let cur = src;
    let cw = src.width;
    let ch = src.height;
    while (exact && (cw * 0.5 > w && ch * 0.5 > h)) {
      const next = canvas(Math.max(w, Math.floor(cw * 0.5)), Math.max(h, Math.floor(ch * 0.5)));
      const nctx = next.getContext("2d");
      nctx.imageSmoothingEnabled = true;
      nctx.imageSmoothingQuality = "high";
      nctx.drawImage(cur, 0, 0, next.width, next.height);
      cur = next;
      cw = next.width;
      ch = next.height;
    }
    const out = canvas(w, h);
    const ctx = out.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = exact ? "high" : "medium";
    ctx.drawImage(cur, 0, 0, out.width, out.height);
    return out;
  }

  async function selectTemplate(product, slug) {
    await initData();
    const item = state.manifest.products[product].find(x => x.slug === slug) || state.manifest.products[product][0];
    const img = await imageFromUrl(item.src);
    state.template = { ...item, product, img };
    return state.template;
  }

  async function setArtFile(file) {
    const art = await imageFromFile(file);
    state.art = { ...art, name: file.name, size: file.size, type: file.type };
    return state.art;
  }

  function composeMockup({ exact = false, scale = 0.72, texture = 0.22, previewMax = 760 } = {}) {
    if (!state.template) throw new Error("Pick a template first.");
    const t = state.template;
    const ratio = exact ? 1 : Math.min(1, previewMax / Math.max(t.width, t.height));
    const W = Math.round(t.width * ratio);
    const H = Math.round(t.height * ratio);
    const out = canvas(W, H);
    const ctx = out.getContext("2d", { willReadFrequently: true });
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(t.img, 0, 0, W, H);

    let artBox = null;
    let artAlpha = null;
    if (state.art) {
      const trimmed = trimTransparent(state.art.img);
      const zone = t.imprintZone.map(v => v * ratio);
      const zw = (zone[2] - zone[0]) * scale;
      const zh = (zone[3] - zone[1]) * scale;
      const fit = Math.min(zw / trimmed.width, zh / trimmed.height);
      const aw = Math.max(1, Math.round(trimmed.width * fit));
      const ah = Math.max(1, Math.round(trimmed.height * fit));
      const artCanvas = steppedResize(trimmed, aw, ah, exact);
      const px = Math.round((zone[0] + zone[2]) / 2 - aw / 2);
      const py = Math.round((zone[1] + zone[3]) / 2 - ah / 2);
      ctx.drawImage(artCanvas, px, py);
      artBox = [px, py, px + aw, py + ah];
      artAlpha = artCanvas.getContext("2d").getImageData(0, 0, aw, ah).data;
    }

    if (artBox && texture > 0 && !t.flat) {
      applyFabricTexture(out, t.img, artBox, artAlpha, texture, ratio);
    }

    const mask = canvas(W, H);
    mask.getContext("2d").drawImage(t.img, 0, 0, W, H);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(mask, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    state.mockupCanvas = out;
    return out;
  }

  function applyFabricTexture(compCanvas, templateImg, box, artAlphaData, strength, ratio) {
    const ctx = compCanvas.getContext("2d", { willReadFrequently: true });
    const tcan = canvas(compCanvas.width, compCanvas.height);
    const tctx = tcan.getContext("2d", { willReadFrequently: true });
    tctx.drawImage(templateImg, 0, 0, tcan.width, tcan.height);

    const [l, top, r, b] = box;
    const w = r - l;
    const h = b - top;
    if (w <= 0 || h <= 0) return;
    const comp = ctx.getImageData(l, top, w, h);
    const temp = tctx.getImageData(l, top, w, h);
    let sum = 0;
    let count = 0;
    const lum = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const ti = i * 4;
      const y = 0.299 * temp.data[ti] + 0.587 * temp.data[ti + 1] + 0.114 * temp.data[ti + 2];
      lum[i] = y;
      if (artAlphaData[ti + 3] > 16) {
        sum += y;
        count++;
      }
    }
    if (!count) return;
    const mean = Math.max(sum / count, 1.0);
    const lo = 1.0 - strength;
    const hi = 1.0 + strength * 0.4;
    for (let i = 0; i < w * h; i++) {
      const ti = i * 4;
      const aa = artAlphaData[ti + 3];
      if (aa <= 0) continue;
      let mod = 1.0 - strength * (mean - lum[i]) / mean;
      mod = Math.min(hi, Math.max(lo, mod));
      const a = aa / 255;
      comp.data[ti] = comp.data[ti] * (1 - a) + comp.data[ti] * mod * a;
      comp.data[ti + 1] = comp.data[ti + 1] * (1 - a) + comp.data[ti + 1] * mod * a;
      comp.data[ti + 2] = comp.data[ti + 2] * (1 - a) + comp.data[ti + 2] * mod * a;
    }
    ctx.putImageData(comp, l, top);
  }

  async function buildProof(opts = {}) {
    await document.fonts?.load?.("900 30px Montserrat");
    await loadMarkImage();
    const mock = composeMockup({ exact: true, scale: opts.scale ?? 0.72, texture: 0.22 });
    const W = 1700, H = 2200, M = 110;
    const c = canvas(W, H);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);
    drawHeader(ctx, W, M);
    let y = M + 205;
    text(ctx, (opts.customer || "CUSTOMER").toUpperCase(), M, y, 58, 900, "#141414", 2);
    y += 92;
    if (opts.project) {
      text(ctx, opts.project, M, y, 34, 400, "#787878");
      y += 70;
    }
    y += 20;
    const fit = Math.min((W - 2 * M) / mock.width, 980 / mock.height);
    const mw = mock.width * fit;
    const mh = mock.height * fit;
    ctx.drawImage(mock, M + (W - 2 * M - mw) / 2, y, mw, mh);
    y += mh + 60;
    ctx.strokeStyle = "#e1e1e1";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(M, y);
    ctx.lineTo(W - M, y);
    ctx.stroke();
    y += 34;
    const rows = [
      ["IMPRINT", opts.imprint || ""],
      ["COLORWAYS", opts.colorways || ""],
      ["INK / PMS", pmsText()]
    ].filter(r => r[1]);
    for (const [label, val] of rows) {
      text(ctx, label, M, y, 26, 900, "#787878", 3);
      text(ctx, val, M + 320, y - 2, 30, 400, "#141414");
      y += 62;
    }
    drawPmsCallout(ctx, W - M - 360, M + 205);
    drawFooter(ctx, W, H, M);
    state.proofCanvas = c;
    state.proofDataUrl = c.toDataURL("image/jpeg", 0.9);
    return c;
  }

  function text(ctx, value, x, y, size, weight, fill, spacing = 0) {
    ctx.fillStyle = fill;
    ctx.font = `${weight} ${size}px Montserrat, Avenir Next, sans-serif`;
    if (!spacing) return ctx.fillText(value, x, y);
    let cx = x;
    for (const ch of value) {
      ctx.fillText(ch, cx, y);
      cx += ctx.measureText(ch).width + spacing;
    }
  }

  function drawHeader(ctx, W, M) {
    drawWordmark(ctx, M, M - 4, 430, 54);
    drawMark(ctx, W - M - 76, M - 18, 76);
    text(ctx, "MOCKUP", M, M + 122, 30, 900, "#141414", 6);
    ctx.fillStyle = "#f7be00";
    ctx.fillRect(M, M + 150, W - 2 * M, 6);
  }

  function drawWordmark(ctx, x, y) {
    drawMark(ctx, x, y + 2, 48);
    text(ctx, "PLANET APPAREL", x + 64, y + 41, 32, 900, "#141414", 0);
  }

  function drawMark(ctx, x, y, size) {
    if (state.markImage) {
      ctx.drawImage(state.markImage, x, y, size, size);
      return;
    }
    ctx.save();
    ctx.strokeStyle = "#141414";
    ctx.lineWidth = Math.max(4, size * 0.08);
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size * 0.38, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "#f7be00";
    ctx.lineWidth = Math.max(5, size * 0.09);
    ctx.beginPath();
    ctx.moveTo(x + size * 0.66, y + size * 0.08);
    ctx.lineTo(x + size * 0.34, y + size * 0.92);
    ctx.stroke();
    ctx.restore();
  }

  function drawPmsCallout(ctx, x, y) {
    if (!state.selectedPms.length) return;
    ctx.save();
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#dedede";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, 360, 44 + state.selectedPms.length * 42);
    text(ctx, "PMS SOLID COATED", x + 20, y + 31, 18, 900, "#787878", 2);
    state.selectedPms.forEach((p, i) => {
      const yy = y + 60 + i * 42;
      ctx.fillStyle = p.hex;
      ctx.beginPath();
      ctx.arc(x + 30, yy - 8, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#aaa";
      ctx.stroke();
      text(ctx, `${p.code}  ${p.name}`, x + 54, yy, 20, 700, "#141414");
    });
    ctx.restore();
  }

  function drawFooter(ctx, W, H, M) {
    const fy = H - M - 40;
    ctx.fillStyle = "#f7be00";
    ctx.fillRect(M, fy - 26, W - 2 * M, 4);
    drawMark(ctx, M, fy - 2, 42);
    text(ctx, `PLANET APPAREL  -  SAN DIEGO, CA   |   ${new Date().toLocaleDateString([], { month: "short", day: "2-digit", year: "numeric" })}`, M + 66, fy + 27, 22, 400, "#787878");
    text(ctx, "MOCKUP FOR APPROVAL - COLORS SHOWN FOR PLACEMENT/LAYOUT REFERENCE. FINAL INK MATCHED TO PANTONE SOLID COATED.", M, fy + 64, 18, 400, "#a0a0a0");
  }

  function pmsText() {
    return state.selectedPms.map(p => p.code).join(" / ");
  }

  function bindPmsSearch(input, results, chips) {
    const renderChips = () => {
      chips.innerHTML = state.selectedPms.map((p, i) => `<span class="chip"><span class="swatch" style="background:${p.hex}"></span>${esc(p.code)}<button type="button" data-rm-pms="${i}" aria-label="Remove ${esc(p.code)}">x</button></span>`).join("");
      $$("[data-rm-pms]", chips).forEach(btn => btn.addEventListener("click", () => {
        state.selectedPms.splice(Number(btn.dataset.rmPms), 1);
        renderChips();
        input.dispatchEvent(new CustomEvent("pmschange"));
      }));
      input.dispatchEvent(new CustomEvent("pmschange"));
    };
    const renderResults = () => {
      const q = input.value.trim().toLowerCase();
      if (!q) {
        results.classList.add("hidden");
        return;
      }
      const matches = state.pms.filter(p => `${p.code} ${p.name}`.toLowerCase().includes(q)).slice(0, 10);
      results.innerHTML = matches.map((p, i) => `<div class="pms-option" data-pms="${i}"><span class="swatch" style="background:${p.hex}"></span><strong>${esc(p.code)}</strong><span>${esc(p.name)}</span></div>`).join("");
      results.classList.toggle("hidden", !matches.length);
      $$(".pms-option", results).forEach((el, i) => el.addEventListener("click", () => {
        const p = matches[i];
        if (!state.selectedPms.some(x => x.code === p.code)) state.selectedPms.push(p);
        input.value = "";
        results.classList.add("hidden");
        renderChips();
      }));
    };
    input.addEventListener("input", renderResults);
    renderChips();
  }

  function fillProductSelects(productSel, colorSel) {
    const renderColors = () => {
      const product = productSel.value;
      colorSel.innerHTML = state.manifest.products[product].map(x => `<option value="${x.slug}">${esc(x.label)}</option>`).join("");
      if (product === "tee") colorSel.value = "black";
    };
    productSel.innerHTML = `<option value="bandana">Bandana</option><option value="paisley">Paisley Bandana</option><option value="tee">Apparel Tee</option>`;
    productSel.addEventListener("change", renderColors);
    renderColors();
  }

  function readRows(table) {
    return $$("tbody tr", table).map(tr => Object.fromEntries($$("input", tr).map(input => [input.name, input.value.trim()]))).filter(row => Object.values(row).some(Boolean));
  }

  function api(path, opts) {
    return fetch(path, { ...opts, headers: { "Content-Type": "application/json", ...(opts?.headers || {}) } }).then(async r => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      return data;
    });
  }

  return {
    state, $, $$, esc, fmtDate, badge, initData, selectTemplate, setArtFile, composeMockup,
    buildProof, bindPmsSearch, fillProductSelects, readRows, api, pmsText
  };
})();
