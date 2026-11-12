(() => {
  const MODELS = [
    { name: "claude-opus-4-6", provider: "Anthropic", color: "#e57b5a", req: 4120, tok: "1.34B", cachePct: 92.9, actual: 142.8, base: 342.0, disc: "-58%", share: 50.0, group: "Claude", mult: 2.2, inP: 5.0, cacheP: 0.5, outP: 25.0, keyOk: true },
    { name: "gpt-5.4", provider: "OpenAI", color: "#10a37f", req: 3480, tok: "866.4M", cachePct: 91.2, actual: 72.4, base: 148.5, disc: "-51%", share: 25.4, group: "OpenAI", mult: 1.0, inP: 2.5, cacheP: 0.25, outP: 15.0, keyOk: true },
    { name: "claude-sonnet-4-6", provider: "Anthropic", color: "#fb923c", req: 1890, tok: "355.6M", cachePct: 87.2, actual: 34.2, base: 68.4, disc: "-50%", share: 12.0, group: "Claude", mult: 2.2, inP: 3.0, cacheP: 0.3, outP: 15.0, keyOk: true },
    { name: "gemini-3.1-pro", provider: "Google", color: "#60a5fa", req: 1240, tok: "160.1M", cachePct: 80.1, actual: 16.9, base: 28.0, disc: "-40%", share: 5.9, group: "Gemini", mult: 1.0, inP: 2.0, cacheP: 0.2, outP: 12.0, keyOk: true },
    { name: "deepseek-v3.2", provider: "DeepSeek", color: "#818cf8", req: 890, tok: "75.7M", cachePct: 74.0, actual: 10.4, base: 14.2, disc: "-27%", share: 3.6, group: "DeepSeek", mult: 1.0, inP: 0.28, cacheP: 0.028, outP: 1.1, keyOk: false },
    { name: "glm-5.3-flash", provider: "Zhipu GLM", color: "#38bdf8", req: 520, tok: "36.2M", cachePct: 72.0, actual: 5.8, base: 7.4, disc: "-22%", share: 2.0, group: "OpenAI", mult: 1.0, inP: 0.14, cacheP: 0.014, outP: 0.7, keyOk: false },
    { name: "qwen3-coder-plus", provider: "Qwen", color: "#c084fc", req: 340, tok: "11.0M", cachePct: 60.0, actual: 2.85, base: 3.9, disc: "-27%", share: 1.1, group: "OpenAI", mult: 1.0, inP: 0.4, cacheP: 0.04, outP: 1.6, keyOk: true }
  ];

  const DAILY = [
    { d: "10-29", cost: 13.8, req: 515, tok: 107.5, base: 28.4 },
    { d: "10-30", cost: 7.4, req: 290, tok: 60.3, base: 16.2 },
    { d: "11-01", cost: 22.6, req: 780, tok: 179.0, base: 48.0 },
    { d: "11-02", cost: 29.8, req: 940, tok: 232.2, base: 64.5 },
    { d: "11-03", cost: 37.5, req: 1120, tok: 293.9, base: 82.0 },
    { d: "11-04", cost: 14.5, req: 540, tok: 120.4, base: 31.2 },
    { d: "11-05", cost: 19.6, req: 690, tok: 162.9, base: 43.1 },
    { d: "11-06", cost: 24.2, req: 810, tok: 194.8, base: 52.8 },
    { d: "11-07", cost: 44.1, req: 1350, tok: 355.1, base: 96.4 },
    { d: "11-08", cost: 21.1, req: 720, tok: 175.5, base: 46.2 },
    { d: "11-09", cost: 26.4, req: 880, tok: 213.1, base: 58.0 },
    { d: "11-10", cost: 18.7, req: 615, tok: 153.3, base: 41.0 },
    { d: "11-11", cost: 29.2, req: 970, tok: 238.7, base: 64.0 },
    { d: "11-12", cost: 7.92, req: 148, tok: 31.2, base: 18.4, today: true }
  ];

  const state = {
    tab: "overview",
    chartMetric: "cost",
    chartMode: "area",
    hmMetric: "cost",
    pricingGroup: "Все",
    pricingSearch: "",
    pricingUseMult: true,
    modelsFilter: "Все",
    pingMs: 82,
    wide: false,
    island: false,
    welcome: false,
    refreshSec: 60,
    lowAlertPct: 15,
    autostart: true,
    closeToTray: true,
    backdrop: "oled",
    activeSlice: null
  };

  const $ = (id) => document.getElementById(id);
  const simApp = $("simApp");
  const simViewport = $("simViewport");
  const simTabsWrap = $("simTabsWrap");
  const simFooter = $("simFooter");
  const tabIndicator = $("tabIndicator");
  const simIsland = $("simIsland");
  const simToast = $("simToast");
  let toastTimer = null;

  function showToast(msg) {
    simToast.textContent = msg;
    simToast.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => simToast.classList.add("hidden"), 2200);
  }

  function syncToolbarPills() {
    $("ctrlPortrait").classList.toggle("active", !state.wide && !state.island && !state.welcome);
    $("ctrlWide").classList.toggle("active", state.wide && !state.island && !state.welcome);
    $("ctrlIsland").classList.toggle("active", state.island);
    $("ctrlWelcome").classList.toggle("active", state.welcome);
  }

  function updateTabIndicator() {
    const activeBtn = document.querySelector(".tab-btn.active");
    if (!activeBtn || !tabIndicator || state.welcome || state.island) return;
    tabIndicator.style.width = `${activeBtn.offsetWidth}px`;
    tabIndicator.style.transform = `translateX(${activeBtn.offsetLeft - 3}px)`;
  }

  function setMode({ wide = state.wide, island = state.island, welcome = state.welcome }) {
    state.wide = wide;
    state.island = island;
    state.welcome = welcome;
    simApp.classList.toggle("is-wide", wide);
    simApp.classList.toggle("hidden", island);
    simIsland.classList.toggle("hidden", !island);
    simTabsWrap.classList.toggle("hidden", welcome);
    simFooter.classList.toggle("hidden", welcome);
    $("simStatusLabel").textContent = welcome ? "login" : "active";
    syncToolbarPills();
    render();
    requestAnimationFrame(() => setTimeout(updateTabIndicator, 40));
  }

  function buildAreaSvg(maxVal) {
    const stroke = state.chartMetric === "cost" ? "#30d158" : state.chartMetric === "req" ? "#60a5fa" : "#e4e4e7";
    const w = 520, h = 112, padX = 10, padT = 10, baseY = 104;
    const pts = DAILY.map((x, i) => ({
      x: padX + (i / (DAILY.length - 1)) * (w - padX * 2),
      y: baseY - (x[state.chartMetric] / maxVal) * (baseY - padT),
      d: x.d,
      tip: state.chartMetric === "cost" ? `$${x.cost.toFixed(2)}` : state.chartMetric === "req" ? `${x.req} запр.` : `${x.tok.toFixed(1)}M`
    }));
    let line = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
      line += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    const area = `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${baseY} L ${pts[0].x.toFixed(1)} ${baseY} Z`;
    const last = pts[pts.length - 1];
    const hits = pts.map((p) => `<rect x="${(p.x - 18).toFixed(1)}" y="0" width="36" height="${h}" fill="transparent" data-bar-tip="${p.d}: ${p.tip}" style="cursor:crosshair"></rect>`).join("");
    return `
      <svg viewBox="0 0 ${w} ${h}" class="area-sim-svg" preserveAspectRatio="none">
        <defs><linearGradient id="simAreaG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${stroke}" stop-opacity="0.34"/><stop offset="100%" stop-color="${stroke}" stop-opacity="0"/></linearGradient></defs>
        <line x1="${padX}" y1="${padT}" x2="${w - padX}" y2="${padT}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3 4"/>
        <line x1="${padX}" y1="${(padT + baseY) / 2}" x2="${w - padX}" y2="${(padT + baseY) / 2}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3 4"/>
        <line x1="${padX}" y1="${baseY}" x2="${w - padX}" y2="${baseY}" stroke="rgba(255,255,255,0.12)"/>
        <path d="${area}" fill="url(#simAreaG)"/>
        <path d="${line}" fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round"/>
        <line x1="${last.x.toFixed(1)}" y1="${padT}" x2="${last.x.toFixed(1)}" y2="${baseY}" stroke="rgba(255,255,255,0.28)" stroke-dasharray="2.5 3"/>
        <circle cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="3.5" fill="#000" stroke="${stroke}" stroke-width="2"/>
        ${hits}
      </svg>
      <div class="area-sim-ticks"><span>10-29</span><span>11-02</span><span>11-05</span><span>11-08</span><span>11-12</span></div>`;
  }

  function renderOverview() {
    const maxVal = Math.max(...DAILY.map((x) => x[state.chartMetric]));
    const barsHtml = DAILY.map((x) => {
      const h = Math.max(10, Math.round((x[state.chartMetric] / maxVal) * 92));
      const valTxt = state.chartMetric === "cost" ? `$${x.cost.toFixed(2)}` : state.chartMetric === "req" ? `${x.req} запр.` : `${x.tok.toFixed(1)}M`;
      return `<div class="bar-col ${x.today ? "today" : ""}" data-bar-tip="${x.d}: ${valTxt}">
        <div class="bar-fill" style="height:${h}px"></div>
        <span class="bar-lbl">${x.d}</span>
      </div>`;
    }).join("");

    const chartBodyHtml = state.chartMode === "bars" ? `<div class="bars-box">${barsHtml}</div>` : buildAreaSvg(maxVal);

    const topHtml = MODELS.slice(0, 5).map((m, idx) => {
      const w = Math.round((m.actual / 142.8) * 100);
      return `<div class="model-item" data-copy-id="${m.name}">
        <div><div class="m-name"><span style="color:${idx === 0 ? "#30d158" : "#71717a"};font-family:var(--font-mono);margin-right:6px;">${idx + 1}</span>${m.name}</div><div class="m-sub">${m.provider} · ${m.tok} ток.</div></div>
        <div class="m-track"><div class="m-bar" style="width:${w}%;background:${m.color}"></div></div>
        <div style="text-align:right;font-size:0.74rem;"><span style="color:#71717a;margin-right:6px;">${Math.round(m.share)}%</span><strong>$${m.actual.toFixed(2)}</strong> <span style="color:#71717a;">(${m.req})</span></div>
      </div>`;
    }).join("");

    return `
      <div class="sim-grid-hero">
        <div class="bento-card quota-full hero-aura-good">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span class="card-kicker">Квота пакета</span>
            <div style="display:inline-flex;gap:6px;align-items:center;">
              <span class="badge-pro">⏳ ~9 дн.</span>
              <span class="badge-pro">QUOTA</span>
            </div>
          </div>
          <div class="quota-row">
            <svg width="88" height="88" viewBox="0 0 100 100" style="flex-shrink:0;">
              <defs><linearGradient id="simRingG" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fff"/><stop offset="100%" stop-color="#30d158"/></linearGradient></defs>
              <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="9"></circle>
              <circle cx="50" cy="50" r="40" fill="none" stroke="url(#simRingG)" stroke-width="9" stroke-linecap="round"
                stroke-dasharray="251.3" stroke-dashoffset="${251.3 * (1 - 0.429)}" transform="rotate(-90 50 50)"></circle>
              <text x="50" y="48" text-anchor="middle" fill="#fff" font-size="16" font-weight="800">42.9%</text>
              <text x="50" y="63" text-anchor="middle" fill="#71717a" font-size="9">остаток</text>
            </svg>
            <div style="flex:1;min-width:0;">
              <div class="quota-val">$214<span class="dec-part">.65</span></div>
              <div class="quota-bar-row">
                <div class="quota-bar-track"><div class="quota-bar-fill" style="width:42.9%"></div></div>
                <span style="font-size:0.62rem;font-family:var(--font-mono);color:#71717a;">57% расх.</span>
              </div>
              <div class="quota-meta">
                <span>● Лимит: <strong style="color:#fff;">$500.00</strong></span>
                <span>● Потрачено: <strong style="color:#d4d4d8;">$285.35</strong></span>
              </div>
            </div>
          </div>
        </div>
        <div class="bento-card">
          <div style="display:flex;justify-content:space-between;align-items:center;"><span class="card-kicker">Сегодня</span><span class="green-pill">-35% к 7д</span></div>
          <div class="big-money">$7<span class="dec-part">.92</span><span class="old-money">$18.40</span><span class="green-pill">-57%</span></div>
          <div class="kv-row"><span>Запросы</span><strong>148</strong></div>
          <div class="kv-row"><span>Кэш-токены</span><strong>28.2M / 31.2M</strong></div>
          <div class="kv-row"><span>RPM / TPM</span><strong>4 / 184.2K</strong></div>
        </div>
        <div class="bento-card">
          <span class="card-kicker">Всего</span>
          <div class="big-money">$285<span class="dec-part">.35</span><span class="green-pill">-53%</span></div>
          <div class="kv-row"><span>Запросы</span><strong>12,480</strong></div>
          <div class="kv-row"><span>In / Out</span><strong>274.0M / 9.4M</strong></div>
          <div class="kv-row"><span>Всего токенов</span><strong>2.84B</strong></div>
        </div>
      </div>

      <div class="insights-row telemetry-dock">
        <div class="insight-card"><div class="insight-ico" style="color:#30d158;">✦</div><div><div class="card-kicker">Кэш-хит</div><div class="insight-v">90.0%</div><div class="insight-s">2.56B из кэша</div></div></div>
        <div class="insight-card"><div class="insight-ico" style="color:#38bdf8;">$</div><div><div class="card-kicker">Экономия</div><div class="insight-v">$327.05</div><div class="insight-s">база $612</div></div></div>
        <div class="insight-card"><div class="insight-ico" style="color:#ff9f0a;">⚡</div><div><div class="card-kicker">Ср. отклик</div><div class="insight-v">24.8с</div><div class="insight-s">~$0.023 / запр.</div></div></div>
        <div class="insight-card"><div class="insight-ico" style="color:#e4e4e7;">⏳</div><div><div class="card-kicker">Прогноз</div><div class="insight-v">~9 дн.</div><div class="insight-s">$24.5/день (7д)</div></div></div>
      </div>

      <div class="bento-card" style="margin-top:10px;">
        <div class="chart-header">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span class="card-kicker">Динамика (14 дней)</span>
            <div class="sub-pills">
              <button type="button" class="sub-pill ${state.chartMetric === "cost" ? "active" : ""}" data-cmetric="cost">Расход $</button>
              <button type="button" class="sub-pill ${state.chartMetric === "req" ? "active" : ""}" data-cmetric="req">Запросы</button>
              <button type="button" class="sub-pill ${state.chartMetric === "tok" ? "active" : ""}" data-cmetric="tok">Токены</button>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <div class="sub-pills">
              <button type="button" class="sub-pill ${state.chartMode === "area" ? "active" : ""}" data-cmode="area">Кривая</button>
              <button type="button" class="sub-pill ${state.chartMode === "bars" ? "active" : ""}" data-cmode="bars">Бары</button>
            </div>
            <span id="chartHoverTip" style="font-size:0.72rem;color:#30d158;font-weight:700;">Пик: $44.10</span>
          </div>
        </div>
        ${chartBodyHtml}
      </div>

      <div class="bento-card" style="margin-top:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span class="card-kicker">Топ нейросетей (клик копирует ID)</span>
          <button type="button" class="demo-pill" data-jump="models">Все модели (7) ›</button>
        </div>
        <div class="model-list">${topHtml}</div>
      </div>
    `;
  }

  function renderPricing() {
    const groups = ["Все", "Claude", "OpenAI", "Gemini", "DeepSeek"];
    const q = state.pricingSearch.trim().toLowerCase();
    const list = MODELS.filter((m) => (state.pricingGroup === "Все" || m.group === state.pricingGroup) && (!q || m.name.toLowerCase().includes(q)));
    const rows = list.map((m) => {
      const k = state.pricingUseMult ? m.mult : 1;
      return `<tr class="clickable" data-copy-id="${m.name}">
        <td><strong>${m.name}</strong> ${m.keyOk ? '<span class="green-pill">Key OK</span>' : ''}</td>
        <td>${m.group} <span class="badge-pro" style="color:#ff9f0a;">×${m.mult}</span></td>
        <td>$${(m.inP * k).toFixed(2)}</td>
        <td>$${(m.cacheP * k).toFixed(2)}</td>
        <td><strong>$${(m.outP * k).toFixed(2)}</strong></td>
      </tr>`;
    }).join("");

    return `
      <div class="bento-card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          <div>
            <div class="card-kicker">Публичный прайс true-sota.com</div>
            <strong style="font-size:1.05rem;">Тарифы моделей и коэффициенты</strong>
          </div>
          <button type="button" class="demo-pill ${state.pricingUseMult ? "active" : ""}" id="toggleMultBtn">
            Учёт ×Rate группы: ${state.pricingUseMult ? "ВКЛ" : "ВЫКЛ"}
          </button>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px;">
          ${groups.map((g) => `<button type="button" class="demo-pill ${state.pricingGroup === g ? "active" : ""}" data-pg="${g}">${g}</button>`).join("")}
        </div>
        <input id="pricingSearchInput" type="text" value="${state.pricingSearch}" placeholder="Поиск модели (claude, gpt, gemini, qwen)..."
          style="width:100%;margin-top:10px;padding:8px 11px;border-radius:9px;background:#000;border:1px solid var(--border);color:#fff;font-size:0.78rem;outline:none;" />
      </div>
      <div class="bento-card" style="margin-top:10px;padding:6px 8px;overflow-x:auto;">
        <table class="sim-table">
          <thead><tr><th>Модель</th><th>Группа</th><th>In / 1M</th><th>Cache / 1M</th><th>Out / 1M</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5" style="color:#71717a;text-align:center;padding:18px;">Ничего не найдено</td></tr>'}</tbody>
        </table>
      </div>
    `;
  }

  function renderMonitor() {
    return `
      <div class="bento-card">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span class="dot-green"></span>
            <div>
              <strong style="font-size:0.9rem;">API-шлюз TrueSOTA</strong>
              <div style="font-size:0.72rem;color:#a1a1aa;">HTTPS GET true-sota.com/v1/models · <strong style="color:#30d158;">HTTP 200 OK · ${state.pingMs} ms</strong></div>
            </div>
          </div>
          <button type="button" class="btn btn-primary" id="pingNowBtn" style="padding:6px 12px;font-size:0.74rem;">Пингануть /v1/models</button>
        </div>
      </div>
      <div class="bento-card" style="margin-top:10px;text-align:center;padding:34px 20px;">
        <div class="card-kicker">Встроенная веб-панель true-sota.com/monitor</div>
        <h3 style="margin:8px 0 6px;font-size:1.05rem;">Статус каналов в реальном времени</h3>
        <p style="font-size:0.78rem;color:#a1a1aa;max-width:440px;margin:0 auto 14px;">В десктопном Windows-приложении здесь открывается живая панель мониторинга каналов с автоматической проверкой задержки каждые 60 сек.</p>
        <div style="display:inline-flex;gap:8px;flex-wrap:wrap;justify-content:center;">
          <span class="badge-pro" style="color:#5deb81;border-color:rgba(48,209,88,0.35);">Claude Primary · 99.9%</span>
          <span class="badge-pro" style="color:#5deb81;border-color:rgba(48,209,88,0.35);">OpenAI / GPT · 100%</span>
          <span class="badge-pro" style="color:#5deb81;border-color:rgba(48,209,88,0.35);">Gemini / DeepSeek · 99.8%</span>
        </div>
      </div>
    `;
  }

  function renderAnalytics() {
    let cols = "";
    for (let w = 0; w < 22; w++) {
      let cells = "";
      for (let d = 0; d < 7; d++) {
        const seed = (w * 7 + d) % 19;
        const lv = w < 17 ? (seed === 4 ? "hm-l1" : "") : w < 20 ? (seed % 3 === 0 ? "hm-l2" : "hm-l1") : (d === 2 || d === 5 ? "hm-l4" : "hm-l3");
        const val = w < 17 ? 0 : (12 + ((w * 3 + d * 7) % 34)).toFixed(2);
        const label = state.hmMetric === "cost" ? `$${val}` : state.hmMetric === "tok" ? `${(val * 1.4).toFixed(1)}M ток.` : `${Math.round(val * 12)} запр.`;
        cells += `<div class="hm-cell ${lv}" data-hm-tip="Неделя ${w + 1}, день ${d + 1} · ${val == 0 ? "Нет активности" : label}"></div>`;
      }
      cols += `<div class="hm-col">${cells}</div>`;
    }

    const auditRows = MODELS.slice(0, 4).map((m) => `
      <div style="padding:9px 11px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);">
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.76rem;">
          <strong>${m.name}</strong>
          <span><span class="green-pill">${m.cachePct}% кэш</span> <strong>$${m.actual.toFixed(2)}</strong></span>
        </div>
        <div class="m-track" style="margin-top:6px;"><div class="m-bar" style="width:${m.cachePct}%;background:#30d158;"></div></div>
      </div>
    `).join("");

    return `
      <div class="bento-card">
        <div class="chart-header">
          <div>
            <span class="card-kicker">Тепловая карта активности · 22 недели</span>
            <div style="font-size:0.76rem;color:#a1a1aa;margin-top:2px;">Серия: <strong style="color:#fff;">12 дн.</strong> · Пик: <strong style="color:#fff;">$44.10</strong></div>
          </div>
          <div class="sub-pills">
            <button type="button" class="sub-pill ${state.hmMetric === "cost" ? "active" : ""}" data-hmetric="cost">Расход $</button>
            <button type="button" class="sub-pill ${state.hmMetric === "tok" ? "active" : ""}" data-hmetric="tok">Токены</button>
            <button type="button" class="sub-pill ${state.hmMetric === "req" ? "active" : ""}" data-hmetric="req">Запросы</button>
          </div>
        </div>
        <div class="hm-grid">${cols}</div>
        <div id="hmReadout" style="margin-top:9px;font-size:0.72rem;color:#a1a1aa;">Наведи на любую ячейку: <strong style="color:#fff;">12 Ноя 2026 · 148 запр. · $7.920</strong></div>
      </div>
      <div class="bento-card" style="margin-top:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span class="card-kicker">Prompt Cache Audit · Экономия $327.05</span>
          <span style="color:#30d158;font-size:0.76rem;font-weight:700;">90.0% Cache Hit</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:7px;">${auditRows}</div>
      </div>
    `;
  }

  function renderModels() {
    const provs = ["Все", "Anthropic", "OpenAI", "Google", "DeepSeek"];
    const filtered = MODELS.filter((m) => state.modelsFilter === "Все" || m.provider === state.modelsFilter);
    const circ = 2 * Math.PI * 38;
    let offset = 0;
    const arcs = MODELS.map((m) => {
      const len = (m.share / 100) * circ;
      const seg = `<circle cx="50" cy="50" r="38" fill="none" stroke="${m.color}" stroke-width="12"
        stroke-dasharray="${len} ${circ - len}" stroke-dashoffset="-${offset}" transform="rotate(-90 50 50)"
        style="cursor:pointer;" data-slice="${m.name} (${m.share}% · $${m.actual.toFixed(2)})"></circle>`;
      offset += len;
      return seg;
    }).join("");

    const rows = filtered.map((m) => `
      <tr class="clickable" data-copy-id="${m.name}">
        <td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${m.color};margin-right:6px;"></span><strong>${m.name}</strong></td>
        <td>${m.req.toLocaleString()}</td>
        <td>${m.tok}</td>
        <td><strong style="color:#30d158;">$${m.actual.toFixed(2)}</strong> <span style="color:#71717a;font-size:0.66rem;">${m.disc}</span></td>
      </tr>
    `).join("");

    return `
      <div class="bento-card" style="display:flex;align-items:center;gap:18px;flex-wrap:wrap;">
        <svg width="106" height="106" viewBox="0 0 100 100" style="flex-shrink:0;">
          ${arcs}
          <text x="50" y="48" text-anchor="middle" fill="#a1a1aa" font-size="7.5">РАСХОД</text>
          <text x="50" y="60" text-anchor="middle" fill="#fff" font-size="11.5" font-weight="800">$285.35</text>
        </svg>
        <div style="flex:1;min-width:180px;">
          <div class="card-kicker">Распределение по моделям</div>
          <div id="donutReadout" style="font-size:0.84rem;font-weight:700;margin:4px 0 8px;">${state.activeSlice || "Кликни на сектор круга или строку"}</div>
          <div style="display:flex;gap:5px;flex-wrap:wrap;">
            ${provs.map((p) => `<button type="button" class="demo-pill ${state.modelsFilter === p ? "active" : ""}" data-mf="${p}">${p}</button>`).join("")}
          </div>
        </div>
      </div>
      <div class="bento-card" style="margin-top:10px;padding:6px 8px;">
        <table class="sim-table">
          <thead><tr><th>Модель</th><th>Запросы</th><th>Токены</th><th>Факт / Скидка</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function renderHistory() {
    const rows = DAILY.slice().reverse().slice(0, 10).map((x) => `
      <tr>
        <td><strong>2026-${x.d}</strong></td>
        <td>${x.req}</td>
        <td style="color:#a1a1aa;">${x.tok.toFixed(1)}M</td>
        <td>90%</td>
        <td><strong style="color:#ff9f0a;">$${x.cost.toFixed(2)}</strong> <span style="color:#71717a;text-decoration:line-through;font-size:0.65rem;">$${x.base.toFixed(0)}</span></td>
      </tr>
    `).join("");
    return `<div class="bento-card" style="padding:6px 8px;">
      <table class="sim-table">
        <thead><tr><th>Дата</th><th>Запросы</th><th>Токены</th><th>Кэш</th><th>Расход</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  function renderSettings() {
    return `
      <div class="bento-card">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <strong>API-ключ и Windows DPAPI</strong>
            <div style="font-size:0.72rem;color:#30d158;">Шифруется через CryptProtectData в %APPDATA%\\TrueSOTA_Monitor</div>
          </div>
          <span class="badge-pro" style="color:#5deb81;border-color:rgba(48,209,88,0.35);">DPAPI OK</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:12px;border-top:1px solid var(--border);flex-wrap:wrap;gap:8px;">
          <span style="font-size:0.78rem;">Автообновление каждые <strong>${state.refreshSec ? state.refreshSec + "с" : "Выкл"}</strong></span>
          <div class="sub-pills">
            ${[0, 30, 60, 180].map((v) => `<button type="button" class="sub-pill ${state.refreshSec === v ? "active" : ""}" data-ref="${v}">${v === 0 ? "Выкл" : v === 180 ? "3м" : v + "с"}</button>`).join("")}
          </div>
        </div>
      </div>

      <div class="bento-card" style="margin-top:10px;">
        <span class="card-kicker">Системный трей и уведомления Windows</span>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
          <span style="font-size:0.78rem;">Запуск с Windows (тихо в трей)</span>
          <button type="button" class="demo-pill ${state.autostart ? "active" : ""}" id="toggleAutostart">${state.autostart ? "Включено" : "Выкл"}</button>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
          <span style="font-size:0.78rem;">Порог алерта квоты</span>
          <div class="sub-pills">
            ${[0, 25, 15, 10, 5].map((p) => `<button type="button" class="sub-pill ${state.lowAlertPct === p ? "active" : ""}" data-pct="${p}">${p === 0 ? "Выкл" : "<" + p + "%"}</button>`).join("")}
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:10px;border-top:1px solid var(--border);">
          <span style="font-size:0.76rem;color:#a1a1aa;">Проверить системное уведомление и обновления</span>
          <div style="display:flex;gap:6px;">
            <button type="button" class="demo-pill" id="testAlertBtn">Тест алерта</button>
            <button type="button" class="demo-pill active" id="checkUpdateSetBtn">Версия v1.2.0 ✓</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderWelcome() {
    return `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;min-height:620px;padding:18px;">
        <span class="badge-pro" style="color:#5deb81;border-color:rgba(48,209,88,0.35);">🔐 Шифрование Windows DPAPI · Без встроенных ключей</span>
        <h2 style="font-size:1.75rem;font-weight:800;margin:14px 0 6px;">TrueSOTA Monitor</h2>
        <p style="font-size:0.82rem;color:#a1a1aa;max-width:420px;">Мониторинг квоты, аналитика расхода и аудит Prompt Cache для Windows 11</p>
        <div class="bento-card" style="width:100%;max-width:460px;margin-top:18px;text-align:left;">
          <div class="card-kicker">Вход в аккаунт по ключу</div>
          <div style="display:flex;gap:8px;margin-top:10px;">
            <input id="welcomeKeyInput" type="text" value="demo-truesota-preview-key" style="flex:1;padding:9px 11px;border-radius:9px;background:#000;border:1px solid var(--border);color:#fff;font-family:var(--font-mono);font-size:0.76rem;outline:none;" />
            <button type="button" class="btn btn-primary" id="welcomeEnterBtn" style="border-radius:9px;padding:8px 16px;">Войти →</button>
          </div>
          <div style="font-size:0.68rem;color:#71717a;margin-top:10px;">Нажми <b>«Войти →»</b> чтобы вернуться в интерактивный дашборд.</div>
        </div>
      </div>
    `;
  }

  function render() {
    if (state.welcome) {
      simViewport.innerHTML = renderWelcome();
      $("welcomeEnterBtn")?.addEventListener("click", () => setMode({ welcome: false }));
      return;
    }

    const views = { overview: renderOverview, pricing: renderPricing, monitor: renderMonitor, analytics: renderAnalytics, models: renderModels, history: renderHistory, settings: renderSettings };
    simViewport.innerHTML = (views[state.tab] || renderOverview)();
    bindViewportEvents();
  }

  function bindViewportEvents() {
    document.querySelectorAll("[data-copy-id]").forEach((el) => {
      el.addEventListener("click", () => {
        const id = el.dataset.copyId;
        navigator.clipboard?.writeText(id).catch(() => {});
        showToast(`Скопирован ID: ${id}`);
      });
    });

    document.querySelectorAll("[data-cmetric]").forEach((b) => b.addEventListener("click", () => { state.chartMetric = b.dataset.cmetric; render(); }));
    document.querySelectorAll("[data-cmode]").forEach((b) => b.addEventListener("click", () => { state.chartMode = b.dataset.cmode; render(); }));
    document.querySelectorAll("[data-bar-tip]").forEach((b) => b.addEventListener("mouseenter", () => {
      const tip = $("chartHoverTip"); if (tip) tip.textContent = b.dataset.barTip;
    }));
    document.querySelectorAll("[data-jump]").forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.jump)));

    document.querySelectorAll("[data-pg]").forEach((b) => b.addEventListener("click", () => { state.pricingGroup = b.dataset.pg; render(); }));
    $("toggleMultBtn")?.addEventListener("click", () => { state.pricingUseMult = !state.pricingUseMult; render(); });
    $("pricingSearchInput")?.addEventListener("input", (e) => { state.pricingSearch = e.target.value; render(); $("pricingSearchInput")?.focus(); });

    $("pingNowBtn")?.addEventListener("click", () => {
      state.pingMs = 68 + Math.floor(Math.random() * 28);
      showToast(`Шлюз TrueSOTA: 200 OK (${state.pingMs} ms)`);
      render();
    });

    document.querySelectorAll("[data-hmetric]").forEach((b) => b.addEventListener("click", () => { state.hmMetric = b.dataset.hmetric; render(); }));
    document.querySelectorAll("[data-hm-tip]").forEach((c) => c.addEventListener("mouseenter", () => {
      const r = $("hmReadout"); if (r) r.innerHTML = `Выбрано: <strong style="color:#fff;">${c.dataset.hmTip}</strong>`;
    }));

    document.querySelectorAll("[data-mf]").forEach((b) => b.addEventListener("click", () => { state.modelsFilter = b.dataset.mf; render(); }));
    document.querySelectorAll("[data-slice]").forEach((s) => s.addEventListener("click", () => {
      state.activeSlice = s.dataset.slice;
      const r = $("donutReadout"); if (r) r.textContent = state.activeSlice;
    }));

    document.querySelectorAll("[data-ref]").forEach((b) => b.addEventListener("click", () => { state.refreshSec = Number(b.dataset.ref); render(); }));
    document.querySelectorAll("[data-pct]").forEach((b) => b.addEventListener("click", () => { state.lowAlertPct = Number(b.dataset.pct); render(); }));
    $("toggleAutostart")?.addEventListener("click", () => { state.autostart = !state.autostart; render(); });
    $("testAlertBtn")?.addEventListener("click", () => showToast("🔔 Windows Алерт: Остаток квоты ниже 15% ($214.65)"));
    $("checkUpdateSetBtn")?.addEventListener("click", () => showToast("У вас актуальная версия v1.3.0"));
  }

  function switchTab(tab) {
    state.tab = tab;
    if (state.welcome) state.welcome = false;
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    setMode({ welcome: false, island: false });
  }

  document.querySelectorAll(".tab-btn").forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)));

  // Top demo controls & traffic lights
  $("ctrlPortrait").addEventListener("click", () => setMode({ wide: false, island: false, welcome: false }));
  $("ctrlWide").addEventListener("click", () => setMode({ wide: true, island: false, welcome: false }));
  $("ctrlIsland").addEventListener("click", () => setMode({ island: true, welcome: false }));
  $("ctrlWelcome").addEventListener("click", () => setMode({ island: false, welcome: true }));
  $("islandExitBtn").addEventListener("click", () => setMode({ island: false, welcome: false }));

  $("tlWelcome").addEventListener("click", () => setMode({ welcome: !state.welcome, island: false }));
  $("tlIsland").addEventListener("click", () => setMode({ island: true, welcome: false }));
  $("tlSize").addEventListener("click", () => setMode({ wide: !state.wide, island: false, welcome: false }));
  $("btnIsland").addEventListener("click", () => setMode({ island: true, welcome: false }));

  $("btnRefresh").addEventListener("click", () => {
    $("btnRefresh").classList.add("spin");
    setTimeout(() => {
      $("btnRefresh").classList.remove("spin");
      $("simUpdatedAt").textContent = new Date().toTimeString().slice(0, 8);
      showToast("Данные обновлены с true-sota.com");
    }, 450);
  });

  // Profile Dropdown
  const profMenu = $("simProfileMenu");
  $("btnProfile").addEventListener("click", (e) => { e.stopPropagation(); profMenu.classList.toggle("hidden"); });
  document.addEventListener("click", (e) => { if (!profMenu.contains(e.target) && e.target !== $("btnProfile")) profMenu.classList.add("hidden"); });
  document.querySelectorAll("[data-backdrop]").forEach((b) => b.addEventListener("click", () => {
    state.backdrop = b.dataset.backdrop;
    simApp.classList.remove("backdrop-acrylic", "backdrop-mica");
    if (state.backdrop !== "oled") simApp.classList.add(`backdrop-${state.backdrop}`);
    document.querySelectorAll("[data-backdrop]").forEach((x) => x.classList.toggle("active", x === b));
    showToast(`Тема окна: ${state.backdrop.toUpperCase()}`);
  }));
  profMenu.querySelectorAll("[data-nav]").forEach((b) => b.addEventListener("click", () => { profMenu.classList.add("hidden"); switchTab(b.dataset.nav); }));
  $("menuShareBtn").addEventListener("click", () => { profMenu.classList.add("hidden"); $("simShareModal").classList.remove("hidden"); });
  $("menuUpdateBtn").addEventListener("click", () => { profMenu.classList.add("hidden"); showToast("Релиз v1.3.0 актуален ✓"); });
  $("menuDpapiBtn").addEventListener("click", () => { profMenu.classList.add("hidden"); switchTab("settings"); });
  $("menuLogoutBtn").addEventListener("click", () => { profMenu.classList.add("hidden"); setMode({ welcome: true }); });

  // Share Card Modal
  $("footerShare").addEventListener("click", () => $("simShareModal").classList.remove("hidden"));
  $("closeShareBtn").addEventListener("click", () => $("simShareModal").classList.add("hidden"));
  $("saveShareDemoBtn").addEventListener("click", () => { $("simShareModal").classList.add("hidden"); showToast("Сводка скопирована в буфер"); });
  $("footerCopy").addEventListener("click", () => showToast("Сводка за период скопирована в Markdown"));

  // Command Palette (Ctrl+K)
  const CMDS = [
    { t: "Обзор квоты и расхода", s: "Вкладка 1", act: () => switchTab("overview") },
    { t: "Тарифы моделей и групп", s: "Вкладка 2", act: () => switchTab("pricing") },
    { t: "Живой монитор каналов", s: "Вкладка 3", act: () => switchTab("monitor") },
    { t: "Аналитика · Heatmap & Prompt Cache", s: "Вкладка 4", act: () => switchTab("analytics") },
    { t: "Расход по моделям (Donut)", s: "Вкладка 5", act: () => switchTab("models") },
    { t: "История по дням", s: "Вкладка 6", act: () => switchTab("history") },
    { t: "Настройки, Трей и DPAPI", s: "Вкладка 7", act: () => switchTab("settings") },
    { t: "Переключить режим Dynamic Island", s: "Alt + I", act: () => setMode({ island: true }) },
    { t: "Формат окна: Портрет 620×900 / 16:9", s: "Пресет", act: () => setMode({ wide: !state.wide, island: false, welcome: false }) },
    { t: "Открыть Share Card (16:9)", s: "S", act: () => $("simShareModal").classList.remove("hidden") }
  ];

  function openPalette() {
    $("simPaletteModal").classList.remove("hidden");
    $("simPaletteInput").value = "";
    renderCmds("");
    $("simPaletteInput").focus();
  }
  function closePalette() { $("simPaletteModal").classList.add("hidden"); }

  function renderCmds(q) {
    const k = q.trim().toLowerCase();
    const list = CMDS.filter((c) => !k || c.t.toLowerCase().includes(k));
    $("simPaletteList").innerHTML = list.map((c, i) => `<button type="button" class="sim-cmd" data-cmd-i="${i}">${c.t}<span>${c.s}</span></button>`).join("");
    $("simPaletteList").querySelectorAll("[data-cmd-i]").forEach((b, idx) => {
      b.addEventListener("click", () => { closePalette(); list[idx].act(); });
    });
  }

  $("ctrlPalette").addEventListener("click", openPalette);
  $("btnCmdOpen").addEventListener("click", openPalette);
  $("footerCmd").addEventListener("click", openPalette);
  $("simPaletteInput").addEventListener("input", (e) => renderCmds(e.target.value));
  $("simPaletteModal").addEventListener("click", (e) => { if (e.target === $("simPaletteModal")) closePalette(); });
  $("simShareModal").addEventListener("click", (e) => { if (e.target === $("simShareModal")) $("simShareModal").classList.add("hidden"); });

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      $("simPaletteModal").classList.contains("hidden") ? openPalette() : closePalette();
    } else if (e.key === "Escape") {
      closePalette();
      $("simShareModal").classList.add("hidden");
      profMenu.classList.add("hidden");
    } else if (e.altKey && e.key.toLowerCase() === "i") {
      setMode({ island: !state.island, welcome: false });
    }
  });

  // SHA-256 copy buttons on download cards
  document.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", () => {
    navigator.clipboard?.writeText(b.dataset.copy).catch(() => {});
    const prev = b.textContent;
    b.textContent = "Скопировано ✓";
    setTimeout(() => { b.textContent = prev; }, 1600);
  }));

  window.addEventListener("resize", updateTabIndicator);
  render();
  requestAnimationFrame(updateTabIndicator);
})();
