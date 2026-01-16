
/* ========================================================================
 * Status Table Widget — Standalone + Jotform Custom Widget
 * - Column 1 is populated from "Seed rows" (one per line)
 * - Works on GitHub and inside Jotform (JFCustomWidget)
 * - Live-updates Column 1 when "Seed rows" changes in the settings panel
 * ===================================================================== */

/* ---------------------------
 * Utilities
 * --------------------------*/
function parseSeedRows(input) {
  if (Array.isArray(input)) return input.map(String);
  if (typeof input !== 'string') return [];
  return input
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);
}

function ensureFirstColumnText(tasks, root = document) {
  const cells = root.querySelectorAll('td.p-col1');
  cells.forEach((td, i) => {
    if (!td.textContent.trim()) {
      td.textContent = tasks[i] || '';
    }
  });
}

function toArrayLines(maybeString) {
  return parseSeedRows(maybeString || '');
}

function byId(id) {
  return document.getElementById(id);
}

/* ---------------------------
 * Builders
 * --------------------------*/
function buildStatusRadios(rowIndex, options) {
  const group = document.createElement('div');
  group.className = 'radio-group';

  const optList = (options && options.length)
    ? options
    : ['Complete', 'Not Applicable'];

  optList.forEach((label, idx) => {
    const wrap = document.createElement('label');
    wrap.className = 'radio-option';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = `status-${rowIndex}`;
    radio.id = `status-${rowIndex}-${idx}`;

    wrap.appendChild(radio);
    wrap.appendChild(document.createTextNode(label));
    group.appendChild(wrap);
  });

  return group;
}

function buildDatePicker(rowIndex /*, format */) {
  const input = document.createElement('input');
  input.type = 'date';
  input.className = 'date-input';
  input.id = `date-${rowIndex}`;
  return input;
}

/* ---------------------------
 * Rendering
 * --------------------------*/
function renderStatusTable(state) {
  const { tasks, choiceOptions, firstColLabel, secondColLabel, thirdColLabel, dateFormat } = state;
  const tbody = byId('stw-body');
  if (!tbody) return;

  // Update headers if provided
  const thead = document.querySelector('.status-table thead');
  if (thead) {
    const ths = thead.querySelectorAll('th');
    if (ths[0] && firstColLabel)  ths[0].textContent = firstColLabel;
    if (ths[1] && secondColLabel) ths[1].textContent = secondColLabel;
    if (ths[2] && thirdColLabel)  ths[2].textContent = thirdColLabel;
  }

  tbody.innerHTML = '';

  tasks.forEach((task, i) => {
    const tr = document.createElement('tr');

    // Column 1 — initially empty (filled immediately after)
    const td1 = document.createElement('td');
    td1.className = 'p-col1';
    tr.appendChild(td1);

    // Column 2 — status radios
    const td2 = document.createElement('td');
    td2.appendChild(buildStatusRadios(i, choiceOptions));
    tr.appendChild(td2);

    // Column 3 — date picker
    const td3 = document.createElement('td');
    td3.appendChild(buildDatePicker(i, dateFormat));
    tr.appendChild(td3);

    tbody.appendChild(tr);
  });

  // Immediately put real text nodes in Column 1
  ensureFirstColumnText(tasks, tbody);
}

/**
 * Update only Column 1 for an existing table body,
 * and add/remove rows if the size changed.
 */
function applyTasksToExistingTable(state) {
  const tbody = byId('stw-body');
  if (!tbody) return;

  const { tasks, choiceOptions, dateFormat } = state;
  const currentRows = Array.from(tbody.querySelectorAll('tr'));
  const delta = tasks.length - currentRows.length;

  // Add rows if we need more
  if (delta > 0) {
    for (let i = currentRows.length; i < tasks.length; i++) {
      const tr = document.createElement('tr');

      const td1 = document.createElement('td');
      td1.className = 'p-col1';
      tr.appendChild(td1);

      const td2 = document.createElement('td');
      td2.appendChild(buildStatusRadios(i, choiceOptions));
      tr.appendChild(td2);

      const td3 = document.createElement('td');
      td3.appendChild(buildDatePicker(i, dateFormat));
      tr.appendChild(td3);

      tbody.appendChild(tr);
    }
  }

  // Remove extra rows if tasks shrank
  if (delta < 0) {
    for (let i = 0; i < Math.abs(delta); i++) {
      if (tbody.lastElementChild) tbody.removeChild(tbody.lastElementChild);
    }
  }

  // Now update Column 1 text
  const cells = tbody.querySelectorAll('td.p-col1');
  cells.forEach((td, i) => {
    td.textContent = tasks[i] || '';
  });
}

/* ---------------------------
 * Observer: keep Column 1 safe if host mutates DOM
 * --------------------------*/
function observeLateRows(state) {
  const tbody = byId('stw-body');
  if (!tbody) return;

  const obs = new MutationObserver(muts => {
    let added = false;
    muts.forEach(m => {
      if (m.type === 'childList' && m.addedNodes.length > 0) added = true;
    });
    if (added) ensureFirstColumnText(state.tasks, tbody);
  });

  obs.observe(tbody, { childList: true, subtree: true });
}

/* ---------------------------
 * Global State
 * --------------------------*/
const State = {
  tasks: [],
  firstColLabel: 'Task',
  secondColLabel: 'Status',
  thirdColLabel: 'Date',
  choiceOptions: ['Complete', 'Not Applicable'],
  dateFormat: 'YYYY-MM-DD' // hint only; native input uses browser locale
};

/* ---------------------------
 * Public API (Standalone-friendly)
 * --------------------------*/
window.StatusTableWidget = {
  /**
   * Initialize with tasks (array or multi-line string) and optional labels/options.
   * When running under Jotform, init is called with settings from getWidgetSetting().
   */
  init(settings = {}) {
    // Accept either { tasks: [...] } or Jotform-style RowHTML_Defaults
    const seed = settings.RowHTML_Defaults ?? settings.tasks ?? '';

    State.tasks = parseSeedRows(seed);

    // Optional labels/options if provided
    if (settings.FirstColumnLabel)  State.firstColLabel  = String(settings.FirstColumnLabel);
    if (settings.SecondColumnLabel) State.secondColLabel = String(settings.SecondColumnLabel);
    if (settings.ThirdColumnLabel)  State.thirdColLabel  = String(settings.ThirdColumnLabel);

    if (settings.ChoiceOptions) {
      const opts = toArrayLines(settings.ChoiceOptions);
      if (opts.length) State.choiceOptions = opts;
    }

    if (settings.DateFormat) {
      State.dateFormat = String(settings.DateFormat);
    }

    renderStatusTable(State);
    observeLateRows(State);
  },

  /**
   * Update Column 1 at runtime (used by your "Seed rows" setting).
   * Accepts array<string> or multi-line string.
   */
  setTasks(input) {
    State.tasks = parseSeedRows(input);
    applyTasksToExistingTable(State);
  },

  /**
   * Optional helpers if you want to update labels and options live.
   */
  setLabels({ first, second, third } = {}) {
    if (typeof first  === 'string') State.firstColLabel  = first;
    if (typeof second === 'string') State.secondColLabel = second;
    if (typeof third  === 'string') State.thirdColLabel  = third;
    renderStatusTable(State);
  },

  setChoiceOptions(multiLine) {
    const opts = toArrayLines(multiLine);
    if (opts.length) {
      State.choiceOptions = opts;
      renderStatusTable(State);
    }
  }
};

/* ========================================================================
   JOTFORM WIDGET INTEGRATION (robust / waits for API / logs events)
   - Works in Jotform and Standalone (GitHub).
   - Dynamically updates Column 1 when "Seed rows" changes.
   ===================================================================== */

/* ---- Lightweight debug overlay (turn off with Debug.on = false) ---- */
const Debug = {
  node: null,
  on: true,
  init() {
    if (this.node || !this.on) return;
    this.node = document.createElement('div');
    this.node.style.cssText = `
      position: fixed; right: 8px; bottom: 8px; z-index: 2147483647;
      background: rgba(12,35,64,.92); color: #fff; font: 12px/1.35 system-ui, sans-serif;
      padding: 8px 10px; border-radius: 6px; box-shadow: 0 6px 18px rgba(0,0,0,.25);
      max-width: 360px; white-space: pre-wrap; pointer-events: none;
    `;
    document.body.appendChild(this.node);
  },
  show(objOrMsg) {
    if (!this.on) return;
    this.init();
    const msg = typeof objOrMsg === 'string' ? objOrMsg : JSON.stringify(objOrMsg, null, 2);
    if (this.node) this.node.textContent = msg;
    try { console.log('[Widget Debug]', objOrMsg); } catch(e) {}
  }
};

/* ---- Helpers to read settings and wire events ---- */
function initFromSettings(settings) {
  window.StatusTableWidget.init(settings || {});
  try { window.JFCustomWidget && window.JFCustomWidget.sendData({ valid: true }); } catch(e){}
  Debug.show({ event: 'init', settings });
}

function updateFromSettings(settings) {
  if (!settings) return;
  if (typeof settings.RowHTML_Defaults !== 'undefined') {
    window.StatusTableWidget.setTasks(settings.RowHTML_Defaults);
  }
  if (typeof settings.FirstColumnLabel  !== 'undefined'
   || typeof settings.SecondColumnLabel !== 'undefined'
   || typeof settings.ThirdColumnLabel  !== 'undefined') {
    window.StatusTableWidget.setLabels({
      first:  settings.FirstColumnLabel,
      second: settings.SecondColumnLabel,
      third:  settings.ThirdColumnLabel
    });
  }
  if (typeof settings.ChoiceOptions !== 'undefined') {
    window.StatusTableWidget.setChoiceOptions(settings.ChoiceOptions);
  }
  try { window.JFCustomWidget && window.JFCustomWidget.sendData({ valid: true }); } catch(e){}
  Debug.show({ event: 'update', settings });
}

/* ---- Wire up Jotform when available; fall back to standalone ---- */
(function boot() {
  let attempts = 0;
  const MAX_ATTEMPTS = 120; // ~6s at 50ms
  const iv = setInterval(() => {
    attempts++;

    if (typeof window.JFCustomWidget !== 'undefined'
        && typeof window.JFCustomWidget.getWidgetSetting === 'function') {

      clearInterval(iv);
      Debug.show('Mode: Jotform (JFCustomWidget detected)');

      // Prefer "ready", but also attempt immediate fetch (some envs differ)
      try {
        window.JFCustomWidget.subscribe('ready', function() {
          try {
            window.JFCustomWidget.getWidgetSetting(function(settings) {
              Debug.show({ event: 'getWidgetSetting (ready)', settings });
              initFromSettings(settings);
            });
          } catch (e) {
            console.warn('getWidgetSetting (ready) failed:', e);
          }
        });
      } catch (e) {
        console.warn('subscribe("ready") failed:', e);
      }

      try {
        window.JFCustomWidget.getWidgetSetting(function(settings) {
          Debug.show({ event: 'getWidgetSetting (immediate)', settings });
          initFromSettings(settings);
        });
      } catch (e) {
        console.warn('getWidgetSetting (immediate) failed:', e);
      }

      // Live updates after clicking "Update Widget" in settings pane
      ['populate', 'settingsChanged', 'valueChanged'].forEach(evt => {
        try {
          window.JFCustomWidget.subscribe(evt, function(payload) {
            Debug.show({ event: evt, payload });
            updateFromSettings(payload);
          });
        } catch (e) {
          /* some events may not exist on all tenants */
        }
      });

      return;
    }

    if (attempts >= MAX_ATTEMPTS) {
      clearInterval(iv);
      Debug.show('Mode: Standalone (GitHub) — JFCustomWidget not detected');

      // Standalone: seed from a textarea or a global TASKS if present
      const seedTextArea = document.querySelector('[data-stw="seed-rows"]');
      const initialTasks = seedTextArea
        ? seedTextArea.value
        : (window.TASKS || []);
      window.StatusTableWidget.init({ tasks: initialTasks });

      if (seedTextArea) {
        seedTextArea.addEventListener('input', () => {
          window.StatusTableWidget.setTasks(seedTextArea.value);
        });
      }
    }
  }, 50);
})();
