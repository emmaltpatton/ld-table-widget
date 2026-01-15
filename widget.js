
/* L&D Table – Updated widget.js with CSV upload support */

(function () {
  "use strict";

  /************  Mode detection  ************/
  // Treat as Jotform ONLY when in iframe + API present
  const isInIframe = window.self !== window.top;
  const insideJotform =
    isInIframe && typeof window.JFCustomWidget !== "undefined";

  function log(...args) {
    if (window.__LD_DEBUG__) {
      console.log("[L&D Widget]", ...args);
    }
  }

  function getQueryParam(name) {
    try {
      const u = new URL(window.location.href);
      return u.searchParams.get(name);
    } catch {
      return null;
    }
  }

  function toBool(v, def = false) {
    if (v === undefined || v === null) return def;
    if (typeof v === "boolean") return v;
    const s = String(v).trim().toLowerCase();
    return ["1", "true", "on", "yes"].includes(s);
  }

  function todayStr() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
  }

  function stripHtml(html) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html || "";
    return (tmp.textContent || tmp.innerText || "").trim();
  }

  /************  DOM refs  ************/
  const dom = {
    tbody: null,
    error: null,
    tableTitle: null,
    qHeader: null,
    choiceHeader: null,
    dateHeader: null,
    reloadBtn: null,
    status: null,
  };

  /************  Defaults  ************/
  const DEFAULTS = {
    tableTitle: "Learning & Development Evaluation",
    colQuestionHeader: "Question",
    colChoiceHeader: "Response",
    colDateHeader: "Date",

    choices: ["Yes", "No", "N/A"],
    enforceRequired: false,
    restrictMaxToday: true,
    updateDateOnChange: false,
    showReloadButton: true,

    csvUrl: "",
    csvText: "",
    csvFile: "",           // NEW — uploaded CSV URL
    csvHasHeader: true,
    csvQuestionColumn: "Question",
    csvChoicesColumn: "Choices",
    csvChoicesDelimiter: "|",
    csvCodeColumn: "Code",
    csvCacheBuster: true,

    questions: [
      "Access Employee Portal within PageUp",
      "Complete Workplace Behaviour training",
      "Review HSE Essentials procedures",
    ],
  };

  const PARAMS = [
    "tableTitle",
    "colQuestionHeader",
    "colChoiceHeader",
    "colDateHeader",
    "choices",
    "enforceRequired",
    "restrictMaxToday",
    "updateDateOnChange",
    "showReloadButton",
    "csvFile",              // NEW
    "csvUrl",
    "csvText",
    "csvHasHeader",
    "csvQuestionColumn",
    "csvChoicesColumn",
    "csvChoicesDelimiter",
    "csvCodeColumn",
    "csvCacheBuster",
    "questions"
  ];

  let ROWS = [];

  /************  Read widget settings ************/
  function readSettings() {
    const cfg = { ...DEFAULTS };

    function gs(n, def) {
      try {
        if (
          insideJotform &&
          typeof JFCustomWidget.getWidgetSetting === "function"
        ) {
          const v = JFCustomWidget.getWidgetSetting(n);
          if (v !== undefined && v !== null && v !== "") return v;
        }
      } catch {}
      const q = getQueryParam(n);
      if (q !== null) return q;
      return def;
    }

    PARAMS.forEach((key) => {
      const base = DEFAULTS[key];
      const val = gs(key, base);

      if (typeof base === "boolean") {
        cfg[key] = toBool(val, base);
      } else if (Array.isArray(base)) {
        try {
          cfg[key] = typeof val === "string"
            ? val
                .replace(/^\[/, "")
                .replace(/\]$/, "")
                .split(/, */)
                .map((x) => x.trim())
            : val;
        } catch {
          cfg[key] = base;
        }
      } else {
        cfg[key] = val;
      }
    });

    window.__LD_DEBUG__ = toBool(getQueryParam("debug"), false);
    log("Settings loaded:", cfg);

    return cfg;
  }

  /************  CSV loader  ************/
  async function loadCsvText(url, inlineText, useBuster) {
    if (url) {
      const finalUrl =
        useBuster && url
          ? url + (url.includes("?") ? "&" : "?") + "_=" + Date.now()
          : url;

      const resp = await fetch(finalUrl, { cache: "no-store" });
      if (!resp.ok) throw new Error(`CSV HTTP ${resp.status}`);
      return await resp.text();
    }
    return inlineText || "";
  }

  /************  CSV parser (Papa Parse)  ************/
  function resolveColumn(hasHeader, fields, spec) {
    if (!hasHeader) {
      if (/^\d+$/.test(spec)) return parseInt(spec, 10);
      return 0;
    }
    if (typeof spec === "string" && !/^\d+$/.test(spec)) {
      const idx = fields.indexOf(spec);
      return idx >= 0 ? idx : 0;
    }
    if (/^\d+$/.test(spec)) return parseInt(spec, 10);
    return 0;
  }

  function parseCsvToRows(text, hasHeader, qCol, cCol, codeCol, delim) {
    if (!text) return [];

    const parsed = Papa.parse(text, {
      header: !!hasHeader,
      skipEmptyLines: "greedy",
      transformHeader: (h) => String(h || "").trim(),
    });

    const rows = [];
    const fields = parsed.meta?.fields || [];

    parsed.data.forEach((row) => {
      const q = String(
        hasHeader ? row[qCol] : row[resolveColumn(false, null, qCol)]
      ).trim();
      if (!q) return;

      const out = { q };

      if (cCol != null) {
        const raw = String(
          hasHeader ? row[cCol] : row[resolveColumn(false, null, cCol)]
        ).trim();
        if (raw) out.choices = raw.split(delim).map((x) => x.trim());
      }

      if (codeCol != null) {
        const raw = String(
          hasHeader ? row[codeCol] : row[resolveColumn(false, null, codeCol)]
        ).trim();
        if (raw) out.code = raw;
      }

      rows.push(out);
    });

    return rows;
  }

  async function getRowsFromConfig(cfg) {
    // NEW — priority order including uploaded CSV
    const effectiveUrl =
      cfg.csvFile ||                   // 1: Uploaded CSV URL
      getQueryParam("csvUrl") ||       // 2: Query override
      cfg.csvUrl ||                    // 3: Manual URL
      "";                              // else inline text or fallback

    try {
      const text = await loadCsvText(
        effectiveUrl,
        cfg.csvText,
        cfg.csvCacheBuster
      );

      const rows = parseCsvToRows(
        text,
        cfg.csvHasHeader,
        cfg.csvQuestionColumn,
        cfg.csvChoicesColumn || null,
        cfg.csvCodeColumn || null,
        cfg.csvChoicesDelimiter
      );

      if (rows.length) return rows;
    } catch (e) {
      log("CSV failed, falling back:", e);
    }

    // Fallback questions
    return cfg.questions.map((q) => ({ q }));
  }

  /************  UI Rendering  ************/
  function renderTable(rows, cfg) {
    dom.tbody.innerHTML = "";

    rows.forEach((row, idx) => {
      const tr = document.createElement("tr");

      // Question column
      const tdQ = document.createElement("td");
      const p = document.createElement("p");
      p.className = "q";
      p.innerHTML = row.q;
      tdQ.appendChild(p);
      tr.appendChild(tdQ);

      // Choices column
      const tdChoice = document.createElement("td");
      const group = document.createElement("div");
      group.className = "radio-group";

      const opts =
        Array.isArray(row.choices) && row.choices.length
          ? row.choices
          : cfg.choices;

      opts.forEach((label, j) => {
        const id = `r-${idx}-${j}`;
        const wrap = document.createElement("div");
        wrap.className = "radio-wrap";

        const input = document.createElement("input");
        input.type = "radio";
        input.name = `grp-${idx}`;
        input.id = id;
        input.value = label;

        const lab = document.createElement("label");
        lab.setAttribute("for", id);
        lab.textContent = label;

        wrap.appendChild(input);
        wrap.appendChild(lab);
        group.appendChild(wrap);
      });

      tdChoice.appendChild(group);
      tr.appendChild(tdChoice);

      // Date column
      const tdDate = document.createElement("td");
      const date = document.createElement("input");
      date.type = "date";
      date.className = "date";
      if (cfg.restrictMaxToday) date.max = todayStr();
      tdDate.appendChild(date);
      tr.appendChild(tdDate);

      dom.tbody.appendChild(tr);
    });
  }

  /************  Submit + validation  ************/
  function collectData(rows) {
    const out = [];

    dom.tbody.querySelectorAll("tr").forEach((tr) => {
      const qHtml = tr.querySelector(".q")?.innerHTML ?? "";
      const qText = stripHtml(qHtml);

      const choice =
        tr.querySelector('input[type="radio"]:checked')?.value ?? "";
      const date =
        tr.querySelector('input[type="date"]')?.value ?? "";

      const meta = rows.find(
        (r) => stripHtml(r.q) === qText
      );

      const entry = { question: qText, choice, date };
      if (meta?.code) entry.code = meta.code;
      out.push(entry);
    });

    return out;
  }

  /************  Fetch & render  ************/
  async function fetchAndRender(cfg) {
    dom.status.textContent = "Loading…";
    dom.reloadBtn.disabled = true;

    try {
      ROWS = await getRowsFromConfig(cfg);
      renderTable(ROWS, cfg);
      dom.error.hidden = true;
    } catch (e) {
      dom.error.hidden = false;
      dom.error.textContent = "Failed to load questions.";
    } finally {
      dom.status.textContent = "";
      dom.reloadBtn.disabled = false;
    }
  }

  /************  Init  ************/
  async function init() {
    dom.tbody = document.getElementById("tbody");
    dom.error = document.getElementById("error");
    dom.tableTitle = document.getElementById("tableTitle");
    dom.qHeader = document.getElementById("qHeader");
    dom.choiceHeader = document.getElementById("choiceHeader");
    dom.dateHeader = document.getElementById("dateHeader");
    dom.reloadBtn = document.getElementById("reloadBtn");
    dom.status = document.getElementById("status");

    const cfg = readSettings();

    dom.tableTitle.textContent = cfg.tableTitle;
    dom.qHeader.textContent = cfg.colQuestionHeader;
    dom.choiceHeader.textContent = cfg.colChoiceHeader;
    dom.dateHeader.textContent = cfg.colDateHeader;
    dom.reloadBtn.style.display = cfg.showReloadButton ? "inline-flex" : "none";

    dom.reloadBtn.addEventListener("click", () => fetchAndRender(cfg));

    await fetchAndRender(cfg);

    if (insideJotform) {
      JFCustomWidget.subscribe("submit", () => {
        const value = collectData(ROWS);
        JFCustomWidget.sendSubmit({
          valid: true,
          value: JSON.stringify(value),
        });
      });
    }
  }

  /************  Bootstrap  ************/
  try {
    let started = false;
    const start = () => {
      if (!started) {
        started = true;
        init().catch((e) => log("Init error:", e));
      }
    };

    if (insideJotform && typeof JFCustomWidget.subscribe === "function") {
      JFCustomWidget.subscribe("ready", start);
      setTimeout(() => {
        if (!started) start();
      }, 800);
    } else {
      document.addEventListener("DOMContentLoaded", start);
    }
  } catch (e) {
    document.addEventListener("DOMContentLoaded", () =>
      init().catch((err) => log("Init error:", err))
    );
  }
})();
