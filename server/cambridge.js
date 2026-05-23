const axios = require("axios");
const cheerio = require("cheerio");

const CACHE_TTL_MS = 1000 * 60 * 30;
const cache = new Map();

const httpClient = axios.create({
  timeout: 10000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  },
  validateStatus: () => true,
});

const cacheKey = (s) => s.replace(/[^a-zA-Z0-9]/g, "_");

const getCached = (key) => {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  cache.delete(key);
  return null;
};

const setCached = (key, value) => {
  cache.set(key, { value, at: Date.now() });
  if (cache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of cache.entries()) {
      if (now - v.at > CACHE_TTL_MS) cache.delete(k);
    }
  }
};

const langSpec = (lang) => {
  switch (lang) {
    case "en":
      return { language: "english", nation: "us" };
    case "uk":
      return { language: "english", nation: "uk" };
    case "en-tw":
      return { language: "english-chinese-traditional", nation: "us" };
    case "en-cn":
      return { language: "english-chinese-simplified", nation: "us" };
    default:
      return null;
  }
};

const fetchVerbs = async (wikiUrl) => {
  const key = cacheKey(wikiUrl);
  const cached = getCached(key);
  if (cached) return cached;

  try {
    const res = await httpClient.get(wikiUrl);
    if (res.status !== 200) {
      setCached(key, []);
      return [];
    }
    const $$ = cheerio.load(res.data);
    const verbs = [];
    $$(".inflection-table tr td").each((_, cell) => {
      const $cell = $$(cell);
      const text = $cell.text().trim();
      if (!text) return;
      const $p = $cell.find("p");
      if ($p.length === 0) return;

      const parts = $p
        .text()
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      if (parts.length >= 2) {
        verbs.push({ id: verbs.length, type: parts[0], text: parts[1] });
        return;
      }

      const html = $p.html();
      if (html && html.includes("<br>")) {
        const [typeHtml, textHtml] = html.split("<br>");
        const type = $$(typeHtml).text().trim() || typeHtml.replace(/<[^>]*>/g, "").trim();
        const value = $$(textHtml).text().trim() || textHtml.replace(/<[^>]*>/g, "").trim();
        if (type && value) {
          verbs.push({ id: verbs.length, type, text: value });
        }
      }
    });
    setCached(key, verbs);
    return verbs;
  } catch (err) {
    console.warn(`Failed to fetch verbs from ${wikiUrl}:`, err.message);
    return [];
  }
};

const parseEntry = (html) => {
  const $ = cheerio.load(html);
  const siteurl = "https://dictionary.cambridge.org";

  const word = $(".hw.dhw").first().text();
  if (!word) return null;

  const pos = [
    ...new Set(
      $(".pos.dpos")
        .map((_, el) => $(el).text())
        .get()
    ),
  ];

  const pronunciation = [];
  $(".pos-header.dpos-h").each((_, header) => {
    const $header = $(header);
    const posNode = $header.find(".dpos-g").first();
    if (!posNode.length) return;
    const p = posNode.text();
    $header.find(".dpron-i").each((_, node) => {
      const $node = $(node);
      const lang = $node.find(".region.dreg").text();
      const audioSrc = $node.find("audio source").attr("src");
      const pron = $node.find(".pron.dpron").text();
      if (audioSrc && pron) {
        pronunciation.push({ pos: p, lang, url: siteurl + audioSrc, pron });
      }
    });
  });

  const definition = $(".def-block.ddef_block")
    .map((index, el) => {
      const $el = $(el);
      const dpos = $el.closest(".pr.entry-body__el").find(".pos.dpos").first().text();
      const source = $el.closest(".pr.dictionary").attr("data-id");
      const text = $el.find(".def.ddef_d.db").text();
      const translation = $el.find(".def-body.ddef_b > span.trans.dtrans").text();
      const example = $el
        .find(".def-body.ddef_b > .examp.dexamp")
        .map((i, ex) => {
          const $ex = $(ex);
          return {
            id: i,
            text: $ex.find(".eg.deg").text(),
            translation: $ex.find(".trans.dtrans").text(),
          };
        })
        .get();
      return { id: index, pos: dpos, source, text, translation, example };
    })
    .get();

  return { word, pos, pronunciation, definition };
};

async function fetchEntry(word, lang = "en-tw") {
  const spec = langSpec(lang);
  if (!spec) {
    return { status: "error", message: `Unsupported language: ${lang}` };
  }

  const url = `https://dictionary.cambridge.org/${spec.nation}/dictionary/${spec.language}/${encodeURIComponent(
    word
  )}`;
  const wikiUrl = `https://simple.wiktionary.org/wiki/${encodeURIComponent(word)}`;
  const key = cacheKey(url);

  const cached = getCached(key);
  if (cached) return { status: "ok", entry: cached };

  let dictRes;
  try {
    [dictRes] = await Promise.all([httpClient.get(url)]);
  } catch (err) {
    return { status: "error", message: err.message };
  }

  if (!dictRes || dictRes.status >= 500) {
    return { status: "error", message: `Upstream status ${dictRes && dictRes.status}` };
  }
  if (dictRes.status === 404 || dictRes.status >= 400) {
    return { status: "not_found" };
  }

  let parsed;
  try {
    parsed = parseEntry(dictRes.data);
  } catch (err) {
    return { status: "error", message: `Parse failure: ${err.message}` };
  }

  if (!parsed) return { status: "not_found" };

  let verbs = [];
  try {
    verbs = await fetchVerbs(wikiUrl);
  } catch {
    verbs = [];
  }

  const entry = {
    word: parsed.word,
    pos: parsed.pos,
    verbs,
    pronunciation: parsed.pronunciation,
    definition: parsed.definition,
  };

  setCached(key, entry);
  return { status: "ok", entry };
}

module.exports = { fetchEntry };
