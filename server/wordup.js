const axios = require("axios");

const ENDPOINT = "https://api.wordup.com.tw/api/v1/cards";

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

function readConfig() {
  const missing = [];
  const cfg = {
    accessToken: process.env.WORDUP_ACCESS_TOKEN,
    client: process.env.WORDUP_CLIENT,
    uid: process.env.WORDUP_UID,
    deckId: process.env.WORDUP_DECK_ID,
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

async function uploadCard(entry) {
  const cfg = readConfig();
  const payload = buildPayload(entry, cfg.deckId);

  let res;
  try {
    res = await axios.post(ENDPOINT, payload, {
      headers: {
        "access-token": cfg.accessToken,
        client: cfg.client,
        uid: cfg.uid,
        "content-type": "application/json",
      },
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

module.exports = { uploadCard, buildPayload, readConfig, ConfigError, UploadError };
