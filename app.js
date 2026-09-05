/* Meteo Matrimonio — rendering lato client di forecast.json e trend.json */
(async function () {
  const $ = (sel) => document.querySelector(sel);
  const DAYS_LABEL = {
    "2026-09-11": { title: "🎶 Serenata", date: "venerdì 11 · sera", short: "ven 11" },
    "2026-09-12": { title: "💍 Matrimonio", date: "sabato 12 · ore 15:00", short: "sab 12" },
    "2026-09-13": { title: "Domenica 13", date: "il giorno dopo", short: "dom 13" },
    "2026-09-14": { title: "Lunedì 14", date: "due giorni dopo", short: "lun 14" },
  };
  const WEDDING = "2026-09-12";
  const WEDDING_TS = new Date("2026-09-12T15:00:00+02:00").getTime();

  function wmo(code, rainProb) {
    const map = [
      [[0], "☀️", "sereno"],
      [[1], "🌤️", "quasi sereno"],
      [[2], "⛅", "parzialmente nuvoloso"],
      [[3], "☁️", "coperto"],
      [[45, 48], "🌫️", "nebbia"],
      [[51, 53, 55, 56, 57], "🌦️", "pioviggine"],
      [[61, 63, 80], "🌧️", "pioggia"],
      [[65, 81, 82], "🌧️", "pioggia forte"],
      [[66, 67], "🌧️", "pioggia gelata"],
      [[71, 73, 75, 77, 85, 86], "🌨️", "neve"],
      [[95, 96, 99], "⛈️", "temporale"],
    ];
    if (code != null) {
      for (const [codes, icon, desc] of map)
        if (codes.includes(code)) return { icon, desc };
    }
    if (rainProb != null) {
      if (rainProb >= 60) return { icon: "🌧️", desc: "pioggia probabile" };
      if (rainProb >= 30) return { icon: "🌦️", desc: "possibili rovesci" };
      return { icon: "🌤️", desc: "in prevalenza sereno" };
    }
    return { icon: "❓", desc: "n.d." };
  }

  const probClass = (p) =>
    p == null ? "" : p < 30 ? "p-low" : p < 60 ? "p-mid" : "p-high";
  const fmt = (v, suffix = "", digits = 0) =>
    v == null ? "—" : Number(v).toFixed(digits) + suffix;

  // ------------------------------------------------ countdown
  function tickCountdown() {
    const el = $("#countdown");
    let ms = WEDDING_TS - Date.now();
    if (ms <= 0) {
      el.innerHTML = "<p style='font-size:1.4rem'>🎉 Oggi sposi!</p>";
      return;
    }
    const d = Math.floor(ms / 864e5);
    const h = Math.floor((ms % 864e5) / 36e5);
    const m = Math.floor((ms % 36e5) / 6e4);
    const s = Math.floor((ms % 6e4) / 1e3);
    el.innerHTML = [[d, "giorni"], [h, "ore"], [m, "minuti"], [s, "secondi"]]
      .map(([n, l]) =>
        `<span class="unit"><span class="num">${n}</span><span class="lbl">${l}</span></span>`
      ).join("");
  }
  tickCountdown();
  setInterval(tickCountdown, 1000);

  // ------------------------------------------------ dati
  let data, trend;
  try {
    [data, trend] = await Promise.all([
      fetch("data/forecast.json?" + Date.now()).then((r) => r.json()),
      fetch("data/trend.json?" + Date.now()).then((r) => r.json()).catch(() => []),
    ]);
  } catch (e) {
    $("#updated").textContent = "Dati non ancora disponibili.";
    return;
  }

  const updated = new Date(data.updatedAt);
  $("#updated").textContent =
    "Dati aggiornati: " +
    updated.toLocaleString("it-IT", {
      timeZone: "Europe/Rome",
      weekday: "long", day: "numeric", month: "long",
      hour: "2-digit", minute: "2-digit",
    }) + " · prossimo aggiornamento tra ~2 ore";

  const dayKeys = Object.keys(data.days).sort();          // cronologico
  const eventDays = Object.keys(data.events || {}).sort().reverse(); // 12 poi 11
  const daysToGo = Math.max(0, Math.ceil((WEDDING_TS - Date.now()) / 864e5));
  const ens = data.ensemble || {};
  const focusOf = (day) => (data.focusHours || {})[day] ?? 15;

  // ------------------------------------------------ 1. verdetto
  function renderVerdict() {
    const v = data.verdict;
    const card = $("#verdictCard");
    if (!v) { card.hidden = true; return; }
    const meta = {
      verde:   ["🟢", "Prevalentemente favorevole"],
      giallo:  ["🟡", "Incerto (normale a questa distanza)"],
      arancio: ["🟠", "Rischio concreto di peggioramento"],
      rosso:   ["🔴", "Peggioramento molto probabile"],
    }[v.level] || ["🟡", "Incerto"];
    const c12 = ens[WEDDING]?.combined;
    card.className = `verdict-card v-${v.level}`;
    card.innerHTML = `
      <div class="verdict-head">
        <span class="verdict-emoji">${meta[0]}</span>
        <div>
          <h2 class="verdict-title">${meta[1]}</h2>
          <p class="verdict-sub">Verdetto per sabato 12 settembre, calcolato dai
          ${v.members ?? "—"} scenari dei modelli probabilistici (non dalle icone delle app).</p>
        </div>
      </div>
      <div class="verdict-nums">
        <div class="vn"><b>${fmt(v.pSlot, "%")}</b><span>scenari con pioggia<br>tra le 14 e le 24</span></div>
        <div class="vn"><b>${fmt(v.p1, "%")}</b><span>scenari con &gt;1 mm<br>nelle 24 ore</span></div>
        <div class="vn"><b>${fmt(c12?.median, " mm", 1)}</b><span>pioggia nello<br>scenario mediano</span></div>
        <div class="vn"><b>${daysToGo}</b><span>giorni al matrimonio:<br>${daysToGo > 8 ? "previsione ancora ballerina" : daysToGo > 4 ? "attendibilità in crescita" : "previsione ormai solida"}</span></div>
      </div>
      <p class="verdict-rule">Regola: ${v.rule}</p>`;
  }
  renderVerdict();

  // ------------------------------------------------ 2. card eventi
  $("#days").innerHTML = eventDays.map((day) => {
    const c = data.days[day].consensus;
    const f = c.summary.focus;
    const lbl = DAYS_LABEL[day];
    const isWedding = day === WEDDING;
    if (!c.sourcesAvailable) {
      return `<article class="day-card ${isWedding ? "wedding" : ""}">
        <h2>${lbl.title}</h2><p class="day-date">${lbl.date}</p>
        <p class="pending">Nessuna fonte copre ancora questa data.</p></article>`;
    }
    const w = wmo(f.code, f.rainProb);
    const votes = c.rainVoters
      ? `${c.rainVotes} su ${c.rainVoters}`
      : "—";
    let vc = "good", vt = "🌂 Ombrello a casa: le fonti vedono bel tempo.";
    if (f.rainProb >= 60 || (c.rainVoters && c.rainVotes / c.rainVoters >= 0.6)) {
      vc = "bad"; vt = "☔ Meglio avere un piano B al coperto.";
    } else if (f.rainProb >= 30 || (c.rainVoters && c.rainVotes / c.rainVoters >= 0.3)) {
      vc = "warn"; vt = "🌦️ Qualche fonte è incerta: da tenere d'occhio.";
    }
    return `<article class="day-card ${isWedding ? "wedding" : ""}">
      <h2>${lbl.title}</h2><p class="day-date">${lbl.date}</p>
      <div class="day-main">
        <span class="icon">${w.icon}</span>
        <div>
          <span class="temp">${fmt(f.temp, "°", 0)}</span>
          <div class="desc">${w.desc} alle ${String(f.hour ?? "?").padStart(2, "0")}:00</div>
        </div>
      </div>
      <div class="day-stats">
        <span class="k">Pioggia (ora evento)</span><span><span class="prob ${probClass(f.rainProb)}">${fmt(f.rainProb, "%")}</span></span>
        <span class="k">Min / max giorno</span><span>${fmt(c.summary.tempMin, "°")} / ${fmt(c.summary.tempMax, "°")}</span>
        <span class="k">Vento</span><span>${fmt(f.wind, " km/h")}</span>
        <span class="k">Nuvolosità</span><span>${fmt(f.cloud, "%")}</span>
        <span class="k">Fonti disponibili</span><span>${c.sourcesAvailable} su ${data.days[day].sources.length}</span>
        <span class="k">Fonti che vedono pioggia</span><span>${votes}</span>
      </div>
      <div class="verdict ${vc}">${vt}</div>
    </article>`;
  }).join("");

  // ------------------------------------------------ 3. confronto 11-14
  function reliability(day) {
    const models = ens[day]?.models || [];
    if (models.length < 2) return ["Bassa", "pochi ensemble disponibili"];
    const p1s = models.map((m) => m.p1);
    const spread = Math.max(...p1s) - Math.min(...p1s);
    if (daysToGo > 8) return ["Bassa", `a ${daysToGo} giorni è fisiologico`];
    if (spread > 25) return ["Media", `modelli discordanti (${spread} punti)`];
    return ["Buona", "modelli concordi"];
  }
  function scenario(day) {
    const c = ens[day]?.combined;
    if (!c) return "dati insufficienti";
    if (c.p1 < 25) return "asciutto o quasi";
    if (c.p1 < 45) return "incerto, prevalenza asciutto";
    if (c.p1 < 65) return "instabilità probabile";
    return "pioggia probabile";
  }
  $("#compareTable").innerHTML = `<thead><tr>
      <th>Giorno</th><th>Scenario prevalente</th><th>Rischio pioggia (24h)</th>
      <th>Fascia 14–24</th><th>mm mediani</th><th>Affidabilità</th>
    </tr></thead><tbody>` +
    dayKeys.map((day) => {
      const c = ens[day]?.combined;
      const [rel, relWhy] = reliability(day);
      const lbl = DAYS_LABEL[day];
      return `<tr class="${day === WEDDING ? "hl" : ""}">
        <td>${day === WEDDING ? "💍 " : ""}<b>${lbl.short}</b></td>
        <td>${scenario(day)}</td>
        <td><span class="prob ${probClass(c?.p1)}">${fmt(c?.p1, "%")}</span></td>
        <td><span class="prob ${probClass(c?.pSlot)}">${fmt(c?.pSlot, "%")}</span></td>
        <td>${fmt(c?.median, " mm", 1)}</td>
        <td>${rel} <span class="src-origin">· ${relWhy}</span></td>
      </tr>`;
    }).join("") + "</tbody>";

  // ------------------------------------------------ 4. barre ensemble
  function bar(label, sub, pct) {
    const cls = pct == null ? "f-low" : pct < 30 ? "f-low" : pct < 60 ? "f-mid" : "f-high";
    return `<div class="ens-row">
      <div class="lbl">${label}<span class="sub">${sub}</span></div>
      <div class="bar-track"><div class="bar-fill ${cls}" style="width:${pct ?? 0}%"></div></div>
      <div class="val">${fmt(pct, "%")} <small>con pioggia</small></div>
    </div>`;
  }
  $("#ensembleBars").innerHTML = dayKeys.map((day) => {
    const e = ens[day];
    if (!e || !e.models?.length) return "";
    const lbl = DAYS_LABEL[day];
    return `<div class="ens-day">
      <h3>${data.events[day] ? lbl.title + " · " : ""}${lbl.short === lbl.title.toLowerCase() ? "" : lbl.short}</h3>
      ${e.models.map((m) =>
        bar(m.name, `${m.members} scenari · mediana ${fmt(m.median, " mm", 1)}`, m.p1)
      ).join("")}
      ${bar("<b>Tutti insieme</b>", `${e.combined.members} scenari totali`, e.combined.p1)}
    </div>`;
  }).join("");
  $("#ensembleNote").textContent =
    "P(>1 mm) nelle 24 ore. ICON-EPS (40 scenari) entrerà quando le date saranno nel suo orizzonte di ~7 giorni.";

  // ------------------------------------------------ 5. fascia 14-24
  (function renderSlot() {
    const c = ens[WEDDING]?.combined;
    const el = $("#slotPanel");
    if (!c || c.pSlot == null) { el.hidden = true; return; }
    const models = ens[WEDDING].models
      .map((m) => `${m.name}: <b>${fmt(m.pSlot, "%")}</b>`).join(" · ");
    el.innerHTML = `
      <h2>Il momento che conta: 14:00–24:00 di sabato 12</h2>
      <p class="explain">Cerimonia, foto, ricevimento: tutto succede qui. Questa è la
      probabilità che in quella fascia cada pioggia apprezzabile (&gt;0.5 mm), scenario per scenario.</p>
      <div class="slot-flex">
        <div class="slot-big">${c.pSlot}%</div>
        <div>
          <div>${c.pSlot < 20 ? "La grande maggioranza degli scenari è asciutta in quella fascia."
            : c.pSlot < 40 ? "La maggior parte degli scenari resta asciutta, ma una parte vede rovesci: da monitorare."
            : c.pSlot < 60 ? "Gli scenari si dividono quasi a metà: rischio reale, non ancora una condanna."
            : "La maggioranza degli scenari bagna la fascia dell'evento."}</div>
          <div class="muted" style="margin-top:6px">${models}</div>
        </div>
      </div>`;
  })();

  // ------------------------------------------------ 5b. divergenze fra fonti
  (function renderDiverge() {
    const el = $("#divergePanel");
    const focusH = focusOf(WEDDING);
    const vals = data.days[WEDDING].sources
      .filter((s) => s.available && s.summary.focus.rainProb != null)
      .map((s) => ({ name: s.name, p: s.summary.focus.rainProb }))
      .sort((a, b) => b.p - a.p);
    if (vals.length < 2) { el.hidden = true; return; }
    const hi = vals[0], lo = vals[vals.length - 1];
    const spread = hi.p - lo.p;
    const c = ens[WEDDING]?.combined;
    const row = (name, sub, p, cls) => `
      <div class="ens-row" style="grid-template-columns:210px 1fr 70px">
        <div class="lbl">${name}${sub ? `<span class="sub">${sub}</span>` : ""}</div>
        <div class="bar-track"><div class="bar-fill ${cls || (p < 30 ? "f-low" : p < 60 ? "f-mid" : "f-high")}" style="width:${p}%"></div></div>
        <div class="val">${p}%</div>
      </div>`;
    el.innerHTML = `
      <h2>Perché i siti dicono cose diverse</h2>
      <p class="explain">Alle ${focusH}:00 del 12 le ${vals.length} fonti che pubblicano una
      probabilità vanno da <b>${lo.p}%</b> a <b>${hi.p}%</b>. Non è un errore: ogni sito usa un
      modello diverso e, soprattutto, definisce la «probabilità» a modo suo.</p>
      ${vals.map((v, i) => row(
        v.name,
        i === 0 ? "la più pessimista" : i === vals.length - 1 ? "la più ottimista" : "",
        v.p
      )).join("")}
      ${c ? row(`<b>Ensemble · ${c.members} scenari</b>`,
                "la probabilità vera, fascia 14–24", c.pSlot) : ""}
      <p class="explain" style="margin-top:14px">
      <b>Come leggerlo.</b> Un sito che segna ${hi.p}% spesso indica la probabilità su una
      <i>fascia di 6 ore</i> (es. tutto il pomeriggio) e su un'area, non sull'istante e sul punto:
      è quindi più alta per costruzione. Chi segna ${lo.p}% sta mostrando il suo singolo run
      deterministico, che essendo uno solo non ha vere probabilità.
      ${spread >= 40 ? "Uno scarto così ampio a questa distanza significa una cosa sola: i modelli non hanno ancora deciso." : "Lo scarto è contenuto: le fonti sono ragionevolmente allineate."}
      ${c ? `La riga da guardare è l'ultima: ${c.members} scenari diversi dello stesso futuro, di cui ${c.pSlot}% bagnati.` : ""}</p>`;
  })();

  // ------------------------------------------------ 6. sinottica
  (function renderSynoptic() {
    const syn = data.synoptic || {};
    $("#synopticText").innerHTML = (syn.text || [])
      .map((t) => `<li>${t}</li>`).join("");
    const days = Object.keys(syn.days || {}).sort();
    if (!days.length) return;
    $("#synopticTable").innerHTML = `<thead><tr><th></th>${days.map((d) =>
      `<th>${d.slice(8)}/09</th>`).join("")}</tr></thead><tbody>` +
      [["z500", "Geopotenziale 500 hPa (m)"], ["t850", "Temperatura 850 hPa (°C)"]]
        .flatMap(([key, label]) =>
          ["ecmwf", "gfs"].map((model) =>
            `<tr><td>${label} · ${model.toUpperCase()}</td>` +
            days.map((d) => `<td>${fmt(syn.days[d]?.[key]?.[model], "", key === "z500" ? 0 : 1)}</td>`).join("") +
            "</tr>"
          )
        ).join("") + "</tbody>";
  })();

  // ------------------------------------------------ 7. trend run-to-run
  (function renderTrend() {
    const pts = (key) => trend
      .map((e, i) => ({ i, at: e.at, v: e.ens?.[WEDDING]?.[key] }))
      .filter((p) => p.v != null);
    const slotPts = pts("pSlot"), dayPts = pts("p1");
    const tv = $("#trendVerdict");
    const last = slotPts[slotPts.length - 1];
    // il confronto ha senso solo tra run distanti almeno mezza giornata
    const ref = last && [...slotPts].reverse().find((p) =>
      new Date(last.at) - new Date(p.at) >= 12 * 36e5);
    if (ref) {
      const delta = last.v - ref.v;
      const hrs = Math.round((new Date(last.at) - new Date(ref.at)) / 36e5);
      tv.textContent =
        Math.abs(delta) < 8
          ? `➡️ Segnale stabile nelle ultime ${hrs} ore: ${ref.v}% → ${last.v}% (fascia 14–24 del 12).`
          : delta < 0
            ? `📉 Il rischio si sta INDEBOLENDO: ${ref.v}% → ${last.v}% nelle ultime ${hrs} ore.`
            : `📈 Il rischio si sta RAFFORZANDO: ${ref.v}% → ${last.v}% nelle ultime ${hrs} ore.`;
    } else if (last) {
      tv.textContent =
        `Rilevazione attuale: ${last.v}% (fascia 14–24 del 12). Per dire se il segnale ` +
        "si rafforza o si indebolisce serve almeno mezza giornata di aggiornamenti.";
    } else {
      tv.textContent = "⏳ Servono ancora un paio di aggiornamenti per leggere la tendenza.";
    }
    if (slotPts.length < 2) {
      $("#trendChart").innerHTML =
        "<p class='muted'>Il grafico apparirà dopo qualche aggiornamento.</p>";
      return;
    }
    const W = 720, H = 220, padL = 34, padR = 10, padB = 34, padT = 12;
    const n = trend.length;
    const x = (i) => padL + (W - padL - padR) * (n === 1 ? 0.5 : i / (n - 1));
    const y = (v) => padT + (H - padT - padB) * (1 - v / 100);
    const path = (ps) =>
      ps.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
    const firstAt = new Date(trend[0].at), lastAt = new Date(trend[n - 1].at);
    const dfmt = (d) => d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
    $("#trendChart").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Evoluzione previsione">
      <line class="axis" x1="${padL}" y1="${H - padB}" x2="${W - padR}" y2="${H - padB}"/>
      <text x="2" y="${y(100) + 4}">100%</text><text x="8" y="${y(50) + 4}">50%</text><text x="14" y="${y(0) + 4}">0%</text>
      <text x="${padL}" y="${H - padB + 16}">${dfmt(firstAt)}</text>
      <text x="${W - padR}" y="${H - padB + 16}" text-anchor="end">${dfmt(lastAt)}</text>
      <path class="trend-line" stroke="var(--gold)" d="${path(slotPts)}"/>
      ${dayPts.length >= 2 ? `<path class="trend-line" stroke="var(--rain)" stroke-dasharray="5 4" d="${path(dayPts)}"/>` : ""}
      <text x="${padL}" y="${H - 6}" fill="var(--gold)">— fascia 14–24 del 12</text>
      <text x="${padL + 190}" y="${H - 6}" fill="var(--rain)">- - 24 ore del 12</text>
    </svg>`;
  })();

  // ------------------------------------------------ 8. ottimista/pessimista
  (function renderWatch() {
    const c = ens[WEDDING]?.combined;
    const p = c?.pSlot;
    $("#optimistList").innerHTML = [
      p != null
        ? `la quota di scenari bagnati nella fascia 14–24 (oggi <b>${p}%</b>) scende sotto il 20% e ci resta per 2-3 aggiornamenti di fila;`
        : "gli ensemble iniziano a coprire la data con pochi scenari bagnati;",
      "il geopotenziale a 500 hPa resta ≥ 5800 m (anticiclone saldo);",
      "le fonti a corto raggio che entreranno (ICON-2I italiano, MeteoAM, 3BMeteo) vedono asciutto;",
      "l'eventuale disturbo slitta chiaramente su domenica 13 o si dissolve.",
    ].map((t) => `<li>${t}</li>`).join("");
    $("#pessimistList").innerHTML = [
      p != null
        ? `quella quota (oggi <b>${p}%</b>) sale stabilmente sopra il 50%;`
        : "gli ensemble entrano con molti scenari bagnati;",
      "ECMWF e GFS convergono su un calo del geopotenziale proprio tra 11 e 12;",
      "la temperatura a 850 hPa crolla il 12 (passaggio frontale, possibili temporali);",
      "i millimetri mediani degli scenari superano i 5 mm nelle 24 ore.",
    ].map((t) => `<li>${t}</li>`).join("");
  })();

  // ------------------------------------------------ toggle riutilizzabile
  function makeToggle(el, onSelect, defaultDay = WEDDING) {
    el.innerHTML = dayKeys.map((d) =>
      `<button role="tab" data-day="${d}" class="${d === defaultDay ? "active" : ""}">
        ${DAYS_LABEL[d].title}</button>`
    ).join("");
    el.addEventListener("click", (ev) => {
      const btn = ev.target.closest("button");
      if (!btn) return;
      el.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      onSelect(btn.dataset.day);
    });
  }

  // ------------------------------------------------ 9. ora per ora
  const hourlyState = { day: WEDDING, source: "consensus" };
  function renderHourlyTable() {
    const { day, source } = hourlyState;
    const info = data.days[day];
    const focusH = focusOf(day);
    const h = source === "consensus"
      ? info.consensus.hourly
      : info.sources.find((s) => s.id === source)?.hourly;
    if (!h) { $("#hourlyTable").innerHTML = ""; return; }
    const rows = [];
    for (let hr = 0; hr < 24; hr++) {
      const any = ["temp", "rainProb", "precip", "cloud", "wind"]
        .some((k) => h[k][hr] != null);
      if (!any) continue;
      const w = wmo(h.code[hr], h.rainProb[hr]);
      const star = data.events[day] && hr === focusH;
      rows.push(`<tr class="${star ? "hl" : ""}">
        <td>${star ? "⭐ " : ""}${String(hr).padStart(2, "0")}:00</td>
        <td>${w.icon} ${w.desc}</td>
        <td>${fmt(h.temp[hr], "°", 1)}</td>
        <td><span class="prob ${probClass(h.rainProb[hr])}">${fmt(h.rainProb[hr], "%")}</span></td>
        <td>${fmt(h.precip[hr], " mm", 1)}</td>
        <td>${fmt(h.cloud[hr], "%")}</td>
        <td>${fmt(h.wind[hr], " km/h")}</td>
      </tr>`);
    }
    $("#hourlyTable").innerHTML = rows.length
      ? `<thead><tr><th>Ora</th><th>Cielo</th><th>Temp</th><th>Pioggia</th>
         <th>Precip.</th><th>Nuvole</th><th>Vento</th></tr></thead>
         <tbody>${rows.join("")}</tbody>`
      : "<tbody><tr><td class='na'>Questa fonte non copre ancora questo giorno.</td></tr></tbody>";
  }
  function fillSourceSelect() {
    const sel = $("#hourlySource");
    const opts = ['<option value="consensus">Consenso (mediana fonti)</option>'];
    for (const s of data.days[hourlyState.day].sources)
      if (s.available) opts.push(`<option value="${s.id}">${s.name}</option>`);
    sel.innerHTML = opts.join("");
    if (![...sel.options].some((o) => o.value === hourlyState.source))
      hourlyState.source = "consensus";
    sel.value = hourlyState.source;
  }
  makeToggle($("#hourlyToggle"), (day) => {
    hourlyState.day = day;
    fillSourceSelect();
    renderHourlyTable();
  });
  $("#hourlySource").addEventListener("change", (e) => {
    hourlyState.source = e.target.value;
    renderHourlyTable();
  });
  fillSourceSelect();
  renderHourlyTable();

  // ------------------------------------------------ 10. grafico orario
  function renderHourly(day) {
    const c = data.days[day].consensus.hourly;
    const focusH = focusOf(day);
    const W = 720, H = 240, padL = 34, padR = 34, padB = 26, padT = 14;
    const iw = (W - padL - padR) / 24;
    const temps = c.temp.filter((v) => v != null);
    const tMin = temps.length ? Math.min(...temps) - 2 : 0;
    const tMax = temps.length ? Math.max(...temps) + 2 : 30;
    const ty = (v) => padT + (H - padT - padB) * (1 - (v - tMin) / (tMax - tMin || 1));
    const py = (v) => padT + (H - padT - padB) * (1 - v / 100);
    let bars = "", line = "", labels = "";
    const path = [];
    for (let h = 0; h < 24; h++) {
      const x = padL + h * iw;
      if (c.rainProb[h] != null)
        bars += `<rect class="bar" x="${x + 1}" y="${py(c.rainProb[h])}" width="${iw - 2}" height="${H - padB - py(c.rainProb[h])}"><title>${h}:00 · pioggia ${c.rainProb[h]}%</title></rect>`;
      if (c.temp[h] != null)
        path.push(`${path.length ? "L" : "M"}${(x + iw / 2).toFixed(1)},${ty(c.temp[h]).toFixed(1)}`);
      if (h % 3 === 0)
        labels += `<text x="${x + iw / 2}" y="${H - 8}" text-anchor="middle">${h}</text>`;
    }
    if (path.length) line = `<path class="temp-line" d="${path.join(" ")}"/>`;
    const fx = padL + focusH * iw + iw / 2;
    const marker = data.events[day]
      ? `<line class="focus-marker" x1="${fx}" y1="${padT}" x2="${fx}" y2="${H - padB}"/>
         <text x="${fx}" y="${padT + 2}" text-anchor="middle" dominant-baseline="hanging">⭐ ${focusH}:00</text>`
      : "";
    $("#hourlyChart").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Andamento orario">
      <line class="axis" x1="${padL}" y1="${H - padB}" x2="${W - padR}" y2="${H - padB}"/>
      <text x="2" y="${py(100) + 4}">100%</text><text x="8" y="${py(50) + 4}">50%</text>
      <text x="${W - padR + 4}" y="${ty(tMax - 2) + 4}">${Math.round(tMax - 2)}°</text>
      <text x="${W - padR + 4}" y="${ty(tMin + 2) + 4}">${Math.round(tMin + 2)}°</text>
      ${bars}${line}${marker}${labels}
    </svg>`;
  }
  makeToggle($("#chartToggle"), renderHourly);
  renderHourly(WEDDING);

  // ------------------------------------------------ 11. confronto fonti
  function renderTable(day) {
    const focusH = focusOf(day);
    const rows = data.days[day].sources.map((s) => {
      if (!s.available) {
        return `<tr><td>${s.name}<div class="src-origin">${s.origin}</div></td>
          <td class="na" colspan="5">non copre ancora questa data</td></tr>`;
      }
      const f = s.summary.focus;
      const w = wmo(f.code, f.rainProb);
      return `<tr>
        <td>${s.name}<div class="src-origin">${s.origin}</div></td>
        <td>${w.icon} ${w.desc}</td>
        <td><span class="prob ${probClass(f.rainProb)}">${fmt(f.rainProb, "%")}</span></td>
        <td>${fmt(f.temp, "°", 1)}</td>
        <td>${fmt(f.precip, " mm", 1)}</td>
        <td>${fmt(s.summary.tempMin, "°")} / ${fmt(s.summary.tempMax, "°")}</td>
      </tr>`;
    }).join("");
    $("#sourcesTable").innerHTML = `<thead><tr>
      <th>Fonte</th><th>Alle ${focusH}:00</th><th>Pioggia</th>
      <th>Temp</th><th>Precip.</th><th>Min/Max</th>
    </tr></thead><tbody>${rows}</tbody>`;
  }
  makeToggle($("#sourceToggle"), renderTable);
  renderTable(WEDDING);

  // ------------------------------------------------ 12. link esterni
  $("#extLinks").innerHTML = [
    ["Windy · ECMWF", "https://www.windy.com/43.910/12.913?ecmwf,43.910,12.913,8"],
    ["Meteoblue multimodel", "https://www.meteoblue.com/it/tempo/previsioni/multimodel/pesaro_italia_3171173"],
    ["Meteoblue rainSPOT", "https://www.meteoblue.com/it/tempo/previsioni/settimana/pesaro_italia_3171173"],
    ["Meteologix ensemble", "https://meteologix.com/it/forecast/3171173-pesaro/ensemble"],
    ["Meteociel · carte ECMWF", "https://www.meteociel.fr/modeles/ecmwf.php"],
    ["Wetterzentrale · z500", "https://www.wetterzentrale.de/it/topkarten.php?model=ecm&var=1"],
    ["3BMeteo Pesaro", "https://www.3bmeteo.com/meteo/pesaro/7"],
    ["AccuWeather Pesaro", "https://www.accuweather.com/it/it/pesaro/214190/daily-weather-forecast/214190?day=13"],
    ["TempoItalia lungo termine", "https://www.tempoitalia.it/meteo/lungo-termine/pesaro"],
    ["MeteoLive Pesaro", "https://www.meteolive.it/previsione-meteo/italia/marche/Pesaro/12/"],
    ["Meteo5 Pesaro", "https://www.meteo5.com/europe/italy/marche/pesaro?page=day#date=2026-09-12"],
    ["iLMeteo Pesaro", "https://www.ilmeteo.it/meteo/Pesaro"],
    ["MeteoAM Pesaro", "https://www.meteoam.it/it/meteo-citta/pesaro"],
    ["Foreca Pesaro", "https://www.foreca.it/Italy/Pesaro"],
    ["yr.no Pesaro", "https://www.yr.no/en/forecast/daily-table/2-3171173"],
  ].map(([t, u]) => `<a href="${u}" target="_blank" rel="noopener">${t} ↗</a>`).join("");

  // ricarica la pagina ogni 30 minuti per prendere dati freschi
  setTimeout(() => location.reload(), 30 * 60 * 1000);
})();
