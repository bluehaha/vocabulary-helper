require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");

const { fetchEntry } = require("./cambridge");
const history = require("./history");
const {
  uploadCard,
  showDeck,
  createDeck,
  ConfigError,
  UploadError,
  DECK_CARD_LIMIT,
} = require("./wordup");
const deckStore = require("./deckStore");

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.BIND_HOST || "127.0.0.1";
const LANG = process.env.DICTIONARY_LANG || "en-tw";

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));

app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDir, "search.html"));
});

app.get("/upload", (_req, res) => {
  res.sendFile(path.join(publicDir, "upload.html"));
});

app.get("/api/dictionary/:word", async (req, res) => {
  const word = (req.params.word || "").trim();
  if (!word) {
    return res.status(400).json({ status: "error", message: "Empty word" });
  }

  const result = await fetchEntry(word, LANG);
  if (result.status === "not_found") {
    return res.status(404).json({ status: "not_found", word });
  }
  if (result.status === "error") {
    return res.status(502).json({ status: "error", message: result.message });
  }

  // Key history off the entry's canonical word (base form for verbs) so that
  // inflected and base lookups (e.g. "spat" and "spit") dedupe to one row.
  const canonicalWord = result.entry.word || word;
  try {
    await history.add(canonicalWord, result.entry);
  } catch (err) {
    console.warn(`Failed to persist history for "${canonicalWord}":`, err.message);
  }

  res.json({ status: "ok", entry: result.entry });
});

app.get("/api/history", async (_req, res) => {
  try {
    const rows = await history.list({ withEntry: false });
    res.json({ words: rows });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.delete("/api/history", async (req, res) => {
  const words = Array.isArray(req.body && req.body.words) ? req.body.words : [];
  if (words.length === 0) {
    return res.status(400).json({ status: "error", message: "No words provided" });
  }
  try {
    await history.remove(words);
    const rows = await history.list({ withEntry: false });
    res.json({ words: rows });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

function todayStamp() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

async function maybeRotateDeck(deckId) {
  const prefix = (process.env.WORDUP_DECK_NAME_PREFIX || "").trim();
  if (!prefix) {
    console.warn("Deck rotation skipped: WORDUP_DECK_NAME_PREFIX is not set.");
    return;
  }
  try {
    const deck = await showDeck(deckId);
    const count = deck && typeof deck.cards_count === "number" ? deck.cards_count : null;
    if (count === null) {
      console.warn(`Deck rotation skipped: could not read cards_count for deck ${deckId}.`);
      return;
    }
    if (count <= DECK_CARD_LIMIT) return;
    const name = `${prefix} ${todayStamp()}`;
    const created = await createDeck(name);
    if (!created || !Number.isFinite(created.id)) {
      console.warn(`Deck rotation skipped: createDeck returned no id for "${name}".`);
      return;
    }
    await deckStore.setCurrentDeckId(created.id);
    console.log(`Deck rotated: ${deckId} (${count} cards) -> ${created.id} ("${name}").`);
  } catch (err) {
    console.warn("Deck rotation failed:", err.message);
  }
}

app.post("/api/upload", async (req, res) => {
  const words = Array.isArray(req.body && req.body.words) ? req.body.words : [];
  if (words.length === 0) {
    return res.status(400).json({ status: "error", message: "No words provided" });
  }

  const deckId = await deckStore.getCurrentDeckId();
  if (!Number.isFinite(deckId)) {
    return res.status(400).json({
      status: "config_error",
      message:
        "Missing WordUp config: deckId. Set WORDUP_DECK_ID in .env or the environment.",
      results: [],
    });
  }

  const results = [];
  const successful = [];

  for (const word of words) {
    const entry = await history.getEntry(word).catch(() => null);
    if (!entry) {
      results.push({ word, status: "failed", error: "Not found in local history" });
      continue;
    }
    try {
      await uploadCard(entry, deckId);
      results.push({ word, status: "success" });
      successful.push(word);
    } catch (err) {
      if (err instanceof ConfigError) {
        return res.status(400).json({
          status: "config_error",
          message: err.message,
          results,
        });
      }
      const detail =
        err instanceof UploadError
          ? err.kind === "http"
            ? `HTTP ${err.status}: ${typeof err.body === "string" ? err.body : JSON.stringify(err.body)}`
            : err.message
          : err.message;
      results.push({ word, status: "failed", error: detail });
    }
  }

  if (successful.length) {
    try {
      await history.remove(successful);
    } catch (err) {
      console.warn("Failed to remove successful words from history:", err.message);
    }
    await maybeRotateDeck(deckId);
  }

  res.json({ status: "ok", results });
});

app.listen(PORT, HOST, () => {
  console.log(`vocabulary-helper running at http://${HOST}:${PORT}`);
});
