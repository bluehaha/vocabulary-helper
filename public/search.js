const form = document.getElementById("search-form");
const input = document.getElementById("search-input");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");

function showStatus(kind, text) {
  resultEl.hidden = true;
  resultEl.innerHTML = "";
  statusEl.hidden = false;
  statusEl.className = `status status--${kind}`;
  statusEl.textContent = text;
}

function clearStatus() {
  statusEl.hidden = true;
  statusEl.textContent = "";
}

// First non-empty `entry.verbs` row of a given type. Mirrors
// `server/wordup.js#findVerbForm`.
function findVerbForm(verbs, type) {
  for (const v of verbs || []) {
    if (v && v.type === type) {
      const text = (v.text || "").trim();
      if (text) return text;
    }
  }
  return undefined;
}

// Whether `past` is the regular inflection of `base`. Ported verbatim from
// `server/wordup.js#isRegularPast` — keep in sync; the server is the source
// of truth.
function isRegularPast(base, past) {
  const b = base.toLowerCase();
  const p = past.toLowerCase();
  if (p === b + "ed") return true;
  if (b.endsWith("e") && p === b + "d") return true;
  if (b.length >= 2 && /[bcdfghjklmnpqrstvwxz]y$/.test(b) && p === b.slice(0, -1) + "ied") return true;
  if (
    b.length <= 5 &&
    /[aeiou][bcdfghjklmnpqrstvz]$/.test(b) &&
    !/[aeiou]{2}[bcdfghjklmnpqrstvz]$/.test(b) &&
    p === b + b.slice(-1) + "ed"
  ) {
    return true;
  }
  return false;
}

// Header line showing a verb's past tense and past participle. Returns "" for
// non-verbs (no Past tense / Past participle rows). Irregular verbs get a
// modifier class so their forms render in bold.
function verbFormsHtml(entry) {
  const verbs = entry.verbs || [];
  const past = findVerbForm(verbs, "Past tense");
  const pastParticiple = findVerbForm(verbs, "Past participle");
  if (!past && !pastParticiple) return "";

  const base = findVerbForm(verbs, "Plain form");
  const irregular = base && past && !isRegularPast(base, past);

  const forms = [past, pastParticiple].filter(Boolean).join(" · ");
  const cls = irregular ? "entry__verbforms entry__verbforms--irregular" : "entry__verbforms";
  return `<div class="${cls}">${forms}</div>`;
}

function renderEntry(entry) {
  statusEl.hidden = true;
  resultEl.hidden = false;
  resultEl.classList.add("result--hide-zh");

  const pron = (entry.pronunciation || [])
    .map((p) => {
      const audio = p.url
        ? `<button type="button" class="audio" data-url="${p.url}" aria-label="Play pronunciation" aria-pressed="false">▶</button>`
        : "";
      return `<span class="pron"><span class="pron__lang">${p.lang || ""}</span> <span class="pron__pos">${p.pos || ""}</span> <span class="pron__ipa">${p.pron || ""}</span> ${audio}</span>`;
    })
    .join("");

  const defs = (entry.definition || [])
    .map((d) => {
      const examples = (d.example || [])
        .map(
          (ex) =>
            `<li class="example"><div class="example__en">${ex.text || ""}</div>${
              ex.translation ? `<div class="example__zh">${ex.translation}</div>` : ""
            }</li>`
        )
        .join("");
      return `
        <article class="def">
          <header class="def__head"><span class="def__pos">${d.pos || ""}</span></header>
          <p class="def__text">${d.text || ""}</p>
          ${d.translation ? `<p class="def__trans">${d.translation}</p>` : ""}
          ${examples ? `<ol class="examples">${examples}</ol>` : ""}
        </article>`;
    })
    .join("");

  resultEl.innerHTML = `
    <header class="entry__head">
      <h2 class="entry__word">${entry.word}</h2>
      <div class="entry__pos">${(entry.pos || []).join(", ")}</div>
      ${verbFormsHtml(entry)}
      <div class="entry__pron">${pron}</div>
    </header>
    <div class="result__toolbar">
      <button type="button" id="toggle-zh" class="secondary" aria-pressed="false">Show Chinese</button>
    </div>
    <div id="audio-error" class="audio-error" hidden></div>
    <section class="entry__defs">${defs}</section>
  `;

  const toggle = resultEl.querySelector("#toggle-zh");
  toggle.addEventListener("click", () => {
    const nowHidden = resultEl.classList.toggle("result--hide-zh");
    toggle.textContent = nowHidden ? "Show Chinese" : "Hide Chinese";
    toggle.setAttribute("aria-pressed", nowHidden ? "false" : "true");
  });

  const audioError = resultEl.querySelector("#audio-error");
  let currentAudio = null;
  let currentButton = null;

  const showAudioError = (msg) => {
    audioError.textContent = msg;
    audioError.hidden = false;
  };
  const clearAudioError = () => {
    audioError.textContent = "";
    audioError.hidden = true;
  };

  const resetButton = (btn) => {
    btn.classList.remove("audio--playing");
    btn.setAttribute("aria-pressed", "false");
    btn.textContent = "▶";
  };

  const stopCurrent = () => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    if (currentButton) {
      resetButton(currentButton);
      currentButton = null;
    }
  };

  const failPlayback = (btn, msg) => {
    if (currentButton === btn) {
      resetButton(btn);
      currentAudio = null;
      currentButton = null;
    }
    showAudioError(msg);
  };

  const playFromButton = (btn) => {
    const wasPlaying = btn === currentButton;
    stopCurrent();
    clearAudioError();
    if (wasPlaying) return;

    const audio = new Audio(btn.dataset.url);
    audio.addEventListener("ended", () => {
      if (currentButton === btn) {
        resetButton(btn);
        currentAudio = null;
        currentButton = null;
      }
    });
    audio.addEventListener("error", () => {
      failPlayback(btn, "Could not play audio.");
    });

    currentAudio = audio;
    currentButton = btn;
    btn.classList.add("audio--playing");
    btn.setAttribute("aria-pressed", "true");
    btn.textContent = "⏸";

    const playResult = audio.play();
    if (playResult && typeof playResult.catch === "function") {
      playResult.catch((err) => {
        failPlayback(btn, `Could not play audio: ${err.message}`);
      });
    }
  };

  resultEl.querySelectorAll("button.audio").forEach((btn) => {
    btn.addEventListener("click", () => playFromButton(btn));
  });

  const firstAudio = resultEl.querySelector("button.audio");
  if (firstAudio) playFromButton(firstAudio);
}

async function lookup(word) {
  showStatus("loading", `Looking up "${word}"…`);
  try {
    const res = await fetch(`/api/dictionary/${encodeURIComponent(word)}`);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.status === "ok") {
      renderEntry(data.entry);
      input.value = "";
      return;
    }
    if (res.status === 404 || data.status === "not_found") {
      showStatus("not-found", `"${word}" not found in Cambridge Dictionary.`);
      return;
    }
    showStatus("error", `Lookup failed: ${data.message || res.statusText || "unknown error"}`);
  } catch (err) {
    showStatus("error", `Lookup failed: ${err.message}`);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const word = (input.value || "").trim();
  if (!word) {
    clearStatus();
    return;
  }
  lookup(word);
});
