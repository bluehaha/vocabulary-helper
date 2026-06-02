const fs = require("fs/promises");
const path = require("path");

const DECK_PATH = path.join(__dirname, "..", "data", "deck.json");

let writeChain = Promise.resolve();

const serialize = (fn) => {
  const next = writeChain.then(fn, fn);
  writeChain = next.catch(() => {});
  return next;
};

async function readFileSafe() {
  try {
    const raw = await fs.readFile(DECK_PATH, "utf8");
    if (!raw.trim()) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.deckId !== "number") return null;
    return parsed;
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

async function getCurrentDeckId() {
  const data = await readFileSafe();
  if (data && Number.isFinite(data.deckId)) return data.deckId;
  const envId = (process.env.WORDUP_DECK_ID || "").trim();
  if (!envId) return null;
  const parsed = parseInt(envId, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function setCurrentDeckId(deckId) {
  return serialize(async () => {
    await fs.mkdir(path.dirname(DECK_PATH), { recursive: true });
    await fs.writeFile(DECK_PATH, JSON.stringify({ deckId }, null, 2), "utf8");
    return deckId;
  });
}

module.exports = { getCurrentDeckId, setCurrentDeckId, DECK_PATH };
