const axios = require("axios");

const CARDS_ENDPOINT = "https://api.wordup.com.tw/api/v1/cards";
const DECKS_ENDPOINT = "https://api.wordup.com.tw/api/v1/decks";
const DECK_CARD_LIMIT = 45;

const POS_ABBREV = {
  verb: "v",
  noun: "n",
  adjective: "adj",
  adverb: "adv",
  preposition: "prep",
  pronoun: "pron",
  conjunction: "conj",
  determiner: "det",
  exclamation: "excl",
};

const abbreviatePos = (pos) => POS_ABBREV[pos] || pos;

const findVerbForm = (verbs, type) => {
  for (const v of verbs || []) {
    if (v && v.type === type) {
      const text = (v.text || "").trim();
      if (text) return text;
    }
  }
  return undefined;
};

const isRegularPast = (base, past) => {
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
};

class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConfigError";
  }
}

class UploadError extends Error {
  constructor(message, { kind, status, body } = {}) {
    super(message);
    this.name = "UploadError";
    this.kind = kind;
    this.status = status;
    this.body = body;
  }
}

function readAuthConfig() {
  const missing = [];
  const cfg = {
    accessToken: process.env.WORDUP_ACCESS_TOKEN,
    client: process.env.WORDUP_CLIENT,
    uid: process.env.WORDUP_UID,
  };
  for (const [k, v] of Object.entries(cfg)) {
    if (!v || !String(v).trim()) missing.push(k);
  }
  if (missing.length) {
    throw new ConfigError(
      `Missing WordUp config: ${missing.join(", ")}. Set them in .env or the environment.`
    );
  }
  return cfg;
}

function readConfig() {
  const auth = readAuthConfig();
  const deckId = process.env.WORDUP_DECK_ID;
  if (!deckId || !String(deckId).trim()) {
    throw new ConfigError(
      "Missing WordUp config: deckId. Set WORDUP_DECK_ID in .env or the environment."
    );
  }
  return { ...auth, deckId };
}

function authHeaders(cfg) {
  return {
    "access-token": cfg.accessToken,
    client: cfg.client,
    uid: cfg.uid,
    "content-type": "application/json",
  };
}

function buildPayload(entry, deckId) {
  const translations = [
    ...new Set(
      (entry.definition || [])
        .map((d) => {
          const text = (d.text || "").trim();
          if (!text) return "";
          const pos = (d.pos || "").trim();
          return pos ? `(${abbreviatePos(pos)}) ${text}` : text;
        })
        .filter(Boolean)
    ),
  ];

  const wordTypes = [
    ...new Set(
      (entry.definition || [])
        .map((d) => (d.pos || "").trim())
        .filter(Boolean)
    ),
  ];

  const sentences = [];
  for (const def of entry.definition || []) {
    for (const ex of def.example || []) {
      const text = (ex.text || "").trim();
      if (text) sentences.push(text);
    }
  }

  if ((entry.pos || []).includes("verb")) {
    const base = findVerbForm(entry.verbs, "Plain form");
    const past = findVerbForm(entry.verbs, "Past tense");
    if (base && past && !isRegularPast(base, past)) {
      const pp = findVerbForm(entry.verbs, "Past participle") || past;
      translations.unshift(`${past} | ${pp}`);
    }
  }

  return {
    word: entry.word,
    text_content: {
      explanations: [
        {
          translations,
          sentences,
          word_types: wordTypes,
          notes: [],
          images: [],
          synonyms: [],
        },
      ],
    },
    force_create: true,
    deck_id: deckId,
  };
}

async function uploadCard(entry, deckId) {
  const cfg = readAuthConfig();
  if (!Number.isFinite(deckId)) {
    throw new ConfigError(
      "Missing WordUp config: deckId. Set WORDUP_DECK_ID in .env or the environment."
    );
  }
  const payload = buildPayload(entry, deckId);

  let res;
  try {
    res = await axios.post(CARDS_ENDPOINT, payload, {
      headers: authHeaders(cfg),
      timeout: 15000,
      validateStatus: () => true,
    });
  } catch (err) {
    throw new UploadError(`Network error: ${err.message}`, { kind: "network" });
  }

  if (res.status < 200 || res.status >= 300) {
    throw new UploadError(`WordUp returned ${res.status}`, {
      kind: "http",
      status: res.status,
      body: res.data,
    });
  }

  return res.data;
}

async function showDeck(deckId) {
  const cfg = readAuthConfig();
  let res;
  try {
    res = await axios.get(`${DECKS_ENDPOINT}/${deckId}`, {
      headers: authHeaders(cfg),
      timeout: 15000,
      validateStatus: () => true,
    });
  } catch (err) {
    throw new UploadError(`Network error: ${err.message}`, { kind: "network" });
  }
  if (res.status < 200 || res.status >= 300) {
    throw new UploadError(`WordUp returned ${res.status}`, {
      kind: "http",
      status: res.status,
      body: res.data,
    });
  }
  return res.data && res.data.deck;
}

async function createDeck(name) {
  const cfg = readAuthConfig();
  let res;
  try {
    res = await axios.post(
      DECKS_ENDPOINT,
      { name, description: "" },
      {
        headers: authHeaders(cfg),
        timeout: 15000,
        validateStatus: () => true,
      }
    );
  } catch (err) {
    throw new UploadError(`Network error: ${err.message}`, { kind: "network" });
  }
  if (res.status < 200 || res.status >= 300) {
    throw new UploadError(`WordUp returned ${res.status}`, {
      kind: "http",
      status: res.status,
      body: res.data,
    });
  }
  return res.data && res.data.deck;
}

module.exports = {
  uploadCard,
  showDeck,
  createDeck,
  buildPayload,
  readConfig,
  readAuthConfig,
  ConfigError,
  UploadError,
  DECK_CARD_LIMIT,
};
