const fs = require("fs/promises");
const path = require("path");

const HISTORY_PATH = path.join(__dirname, "..", "data", "history.json");

let writeChain = Promise.resolve();

const serialize = (fn) => {
  const next = writeChain.then(fn, fn);
  writeChain = next.catch(() => {});
  return next;
};

async function readFileSafe() {
  try {
    const raw = await fs.readFile(HISTORY_PATH, "utf8");
    if (!raw.trim()) return { words: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.words)) return { words: [] };
    return parsed;
  } catch (err) {
    if (err.code === "ENOENT") return { words: [] };
    throw err;
  }
}

async function writeFile(data) {
  await fs.mkdir(path.dirname(HISTORY_PATH), { recursive: true });
  await fs.writeFile(HISTORY_PATH, JSON.stringify(data, null, 2), "utf8");
}

const key = (word) => word.trim().toLowerCase();

async function load() {
  return readFileSafe();
}

function add(word, entry) {
  return serialize(async () => {
    const data = await readFileSafe();
    const k = key(word);
    const now = new Date().toISOString();
    const idx = data.words.findIndex((w) => key(w.word) === k);
    if (idx >= 0) {
      data.words[idx] = { ...data.words[idx], word: word.trim(), lookedUpAt: now, entry };
    } else {
      data.words.push({ word: word.trim(), lookedUpAt: now, entry });
    }
    await writeFile(data);
    return data.words[idx >= 0 ? idx : data.words.length - 1];
  });
}

function remove(words) {
  return serialize(async () => {
    const data = await readFileSafe();
    const removeSet = new Set(words.map(key));
    data.words = data.words.filter((w) => !removeSet.has(key(w.word)));
    await writeFile(data);
    return data;
  });
}

function previewFromEntry(entry) {
  if (!entry || !Array.isArray(entry.definition) || entry.definition.length === 0) return "";
  const first = entry.definition[0];
  const text = (first.translation || first.text || "").trim();
  if (text.length <= 80) return text;
  return text.slice(0, 77) + "...";
}

async function list({ withEntry = false } = {}) {
  const data = await readFileSafe();
  const rows = [...data.words].sort((a, b) => (b.lookedUpAt || "").localeCompare(a.lookedUpAt || ""));
  if (withEntry) return rows;
  return rows.map(({ word, lookedUpAt, entry }) => ({
    word,
    lookedUpAt,
    preview: previewFromEntry(entry),
  }));
}

async function getEntry(word) {
  const data = await readFileSafe();
  const k = key(word);
  const found = data.words.find((w) => key(w.word) === k);
  return found ? found.entry : null;
}

module.exports = { load, add, remove, list, getEntry, HISTORY_PATH };
