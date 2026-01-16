
/**
 * Ensure first column always has real text nodes.
 */
function ensureFirstColumnText(tasks, root = document) {
    const cells = root.querySelectorAll("td.p-col1");
    cells.forEach((td, i) => {
        if (!td.textContent.trim()) {
            td.textContent = tasks[i] || "";
        }
    });
}

/**
 * Build the radio group for column 2.
 */
function buildStatusRadios(rowIndex) {
    const group = document.createElement("div");
    group.className = "radio-group";

    const options = [
        { id: `complete-${rowIndex}`, label: "Complete" },
        { id: `na-${rowIndex}`, label: "Not Applicable" }
    ];

    options.forEach(opt => {
        const wrap = document.createElement("label");
        wrap.className = "radio-option";

        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = `status-${rowIndex}`;
        radio.id = opt.id;

        const text = document.createTextNode(opt.label);

        wrap.appendChild(radio);
        wrap.appendChild(text);
        group.appendChild(wrap);
    });

    return group;
}

/**
 * Build the date picker for column 3.
 */
function buildDatePicker(rowIndex) {
    const input = document.createElement("input");
    input.type = "date";
    input.className = "date-input";
    input.id = `date-${rowIndex}`;
    return input;
}

/**
 * Render all rows based on tasks.
 */
function renderStatusTable(tasks) {
    const tbody = document.getElementById("stw-body");
    tbody.innerHTML = ""; // reset

    tasks.forEach((task, i) => {
        const tr = document.createElement("tr");

        // Column 1 — initially empty, populated later
        const td1 = document.createElement("td");
        td1.className = "p-col1";
        tr.appendChild(td1);

        // Column 2 — status radios
        const td2 = document.createElement("td");
        td2.appendChild(buildStatusRadios(i));
        tr.appendChild(td2);

        // Column 3 — date picker
        const td3 = document.createElement("td");
        td3.appendChild(buildDatePicker(i));
        tr.appendChild(td3);

        tbody.appendChild(tr);
    });

    // Fill column 1 text immediately
    ensureFirstColumnText(tasks, tbody);
}

/**
 * Watch for late DOM changes (Jotform sometimes adds or wraps elements).
 */
function observeLateRows(tasks) {
    const tbody = document.getElementById("stw-body");
    const obs = new MutationObserver(() => ensureFirstColumnText(tasks, tbody));
    obs.observe(tbody, { childList: true, subtree: true });
}

window.StatusTableWidget = {
    init({ tasks = [] } = {}) {
        renderStatusTable(tasks);
        observeLateRows(tasks);
    }
};
