const queueRegion = document.getElementById("queue-region");
const uploadBtn = document.getElementById("upload-btn");
const deleteBtn = document.getElementById("delete-btn");
const selectionCountEl = document.getElementById("selection-count");
const statusEl = document.getElementById("status");

let rows = [];
let uploading = false;
const selected = new Set();
const rowStatus = new Map();

const PENDING_ICON = "⏳";

function showStatus(kind, text) {
  statusEl.hidden = false;
  statusEl.className = `status status--${kind}`;
  statusEl.textContent = text;
}

function clearStatus() {
  statusEl.hidden = true;
  statusEl.textContent = "";
  statusEl.className = "status";
}

function fmtTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function render() {
  if (!rows || rows.length === 0) {
    queueRegion.innerHTML = `<p class="empty">No words yet. Look one up on the <a href="/">search page</a> and it will show up here.</p>`;
    updateActionState();
    return;
  }

  const body = rows
    .map((row) => {
      const checked = selected.has(row.word) ? "checked" : "";
      const disabled = uploading ? "disabled" : "";
      const status = rowStatus.get(row.word);
      const statusIcon =
        status && status.kind === "pending"
          ? PENDING_ICON
          : status && status.kind === "success"
            ? "✓"
            : status
              ? "✗"
              : "";
      const statusCell = status
        ? `<span class="row__status--${status.kind}">${statusIcon} ${escapeHtml(status.text || "")}</span>`
        : "";
      return `
        <tr data-word="${escapeHtml(row.word)}">
          <td><input type="checkbox" class="row__check" ${checked} ${disabled} /></td>
          <td class="row__word">${escapeHtml(row.word)}</td>
          <td class="row__time">${escapeHtml(fmtTime(row.lookedUpAt))}</td>
          <td class="row__preview">${escapeHtml(row.preview || "")}</td>
          <td class="row__status">${statusCell}</td>
        </tr>`;
    })
    .join("");

  queueRegion.innerHTML = `
    <table class="queue">
      <thead>
        <tr>
          <th><input type="checkbox" id="select-all" /></th>
          <th>Word</th>
          <th>Looked up</th>
          <th>Preview</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;

  const selectAll = document.getElementById("select-all");
  selectAll.checked = rows.length > 0 && rows.every((r) => selected.has(r.word));
  selectAll.disabled = uploading;
  selectAll.addEventListener("change", () => {
    if (selectAll.checked) {
      rows.forEach((r) => selected.add(r.word));
    } else {
      selected.clear();
    }
    render();
  });

  queueRegion.querySelectorAll("tr[data-word]").forEach((tr) => {
    const word = tr.dataset.word;
    const cb = tr.querySelector(".row__check");
    cb.addEventListener("change", () => {
      if (cb.checked) selected.add(word);
      else selected.delete(word);
      render();
    });
  });

  updateActionState();
}

function updateActionState() {
  const count = selected.size;
  uploadBtn.disabled = uploading || count === 0;
  deleteBtn.disabled = uploading || count === 0;
  selectionCountEl.textContent = count ? `${count} selected` : "";
}

function pruneSelection() {
  const present = new Set(rows.map((r) => r.word));
  for (const w of [...selected]) if (!present.has(w)) selected.delete(w);
  for (const w of [...rowStatus.keys()]) if (!present.has(w)) rowStatus.delete(w);
}

async function loadHistory() {
  try {
    const res = await fetch("/api/history");
    const data = await res.json();
    rows = Array.isArray(data.words) ? data.words : [];
    pruneSelection();
    render();
  } catch (err) {
    showStatus("error", `Failed to load history: ${err.message}`);
  }
}

async function onDelete() {
  if (selected.size === 0) return;
  clearStatus();
  const words = [...selected];
  try {
    const res = await fetch("/api/history", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ words }),
    });
    const data = await res.json();
    if (!res.ok) {
      showStatus("error", data.message || "Delete failed");
      return;
    }
    rows = Array.isArray(data.words) ? data.words : [];
    selected.clear();
    render();
  } catch (err) {
    showStatus("error", `Delete failed: ${err.message}`);
  }
}

function clearPending(words) {
  for (const w of words) {
    const s = rowStatus.get(w);
    if (s && s.kind === "pending") rowStatus.delete(w);
  }
}

async function onUpload() {
  if (uploading) return;
  if (selected.size === 0) return;
  clearStatus();
  const words = [...selected];

  uploading = true;
  for (const w of words) rowStatus.set(w, { kind: "pending" });
  showStatus("loading", `Uploading ${words.length} word${words.length === 1 ? "" : "s"} to WordUp…`);
  render();

  try {
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ words }),
    });
    const data = await res.json();

    clearPending(words);

    if (data.status === "config_error") {
      showStatus("error", data.message);
      (data.results || []).forEach((r) => {
        rowStatus.set(r.word, { kind: r.status, text: r.error || "" });
      });
      uploading = false;
      render();
      return;
    }

    (data.results || []).forEach((r) => {
      rowStatus.set(r.word, { kind: r.status, text: r.error || "" });
    });
    clearStatus();
    uploading = false;
    render();

    await loadHistory();
  } catch (err) {
    clearPending(words);
    uploading = false;
    showStatus("error", `Upload failed: ${err.message}`);
    render();
  }
}

uploadBtn.addEventListener("click", onUpload);
deleteBtn.addEventListener("click", onDelete);

loadHistory();
