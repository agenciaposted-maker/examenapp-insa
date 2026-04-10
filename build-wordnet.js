/**
 * build-wordnet.js
 * Descarga y procesa el Multilingual Central Repository (MCR) para español
 * Genera wordnet-es.js con los datos listos para uso offline en el browser.
 *
 * Uso: node build-wordnet.js
 * Fuente: https://github.com/omwn/omw-data (CC BY 3.0)
 */

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

const TAB_URL   = 'https://raw.githubusercontent.com/omwn/omw-data/main/wns/mcr/wn-data-spa.tab';
const CACHE_FILE = path.join(__dirname, 'wn-data-spa.tab.cache');
const OUT_FILE   = path.join(__dirname, 'wordnet-es.js');

// ─── Normalización (igual que norm() en el HTML) ────────────────────────────
function norm(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // eliminar tildes
    .replace(/[^a-z0-9\s]/g, ' ')     // eliminar puntuación
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Descarga ────────────────────────────────────────────────────────────────
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file  = fs.createWriteStream(dest);
    console.log('Descargando', url, '...');
    proto.get(url, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error('HTTP ' + res.statusCode));
      }
      const total = parseInt(res.headers['content-length'] || '0');
      let got = 0;
      let lastPct = -1;
      res.on('data', chunk => {
        got += chunk.length;
        if (total) {
          const pct = Math.floor(got / total * 100);
          if (pct !== lastPct && pct % 10 === 0) {
            process.stdout.write(`\r  ${pct}%`);
            lastPct = pct;
          }
        }
      });
      res.pipe(file);
      file.on('finish', () => { file.close(); console.log('\r  100%'); resolve(); });
    }).on('error', err => { fs.unlinkSync(dest); reject(err); });
  });
}

// ─── Procesado ───────────────────────────────────────────────────────────────
function processTab(content) {
  const synsetMap = {};   // synsetId → Set<normalizedLemma>

  const lines = content.split('\n');
  let lemmaCount = 0;

  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;
    const parts = line.split('\t');
    if (parts.length < 3) continue;
    const [synset, field, value] = parts;
    if (field !== 'spa:lemma') continue;

    const normalized = norm(value);
    if (!normalized || normalized.length < 2) continue;

    if (!synsetMap[synset]) synsetMap[synset] = new Set();
    synsetMap[synset].add(normalized);
    lemmaCount++;
  }

  console.log(`Lemmas procesados: ${lemmaCount}`);

  // Solo conservar synsets con 2+ palabras distintas
  const synsets = [];
  for (const words of Object.values(synsetMap)) {
    const arr = [...words];
    if (arr.length >= 2) synsets.push(arr);
  }

  console.log(`Synsets con 2+ palabras: ${synsets.length}`);

  // Construir índice inverso: palabra → índices de synsets
  // Object.create(null) evita colisión con propiedades del prototipo
  const wordIndex = Object.create(null);
  for (let i = 0; i < synsets.length; i++) {
    for (const word of synsets[i]) {
      if (!Array.isArray(wordIndex[word])) wordIndex[word] = [];
      wordIndex[word].push(i);
    }
  }

  console.log(`Palabras indexadas: ${Object.keys(wordIndex).length}`);

  return { synsets, wordIndex };
}

// ─── Genera función getSynonyms integrada ────────────────────────────────────
function buildJs({ synsets, wordIndex }) {
  const s = JSON.stringify(synsets);
  const w = JSON.stringify(wordIndex);

  return `// wordnet-es.js — Multilingual Central Repository (Español), CC BY 3.0
// Generado automáticamente por build-wordnet.js
// Synsets: ${synsets.length} | Palabras: ${Object.keys(wordIndex).length}
// NO EDITAR MANUALMENTE

(function() {
  var WN = { s: ${s}, w: ${w} };

  /**
   * Retorna un array con los sinónimos normalizados de una palabra.
   * @param {string} word  Palabra ya normalizada (sin tildes, minúsculas)
   * @returns {string[]}
   */
  window.WN_ES_lookup = function(word) {
    var indices = WN.w[word];
    if (!indices) return [];
    var result = new Set();
    for (var i = 0; i < indices.length; i++) {
      var synset = WN.s[indices[i]];
      for (var j = 0; j < synset.length; j++) {
        if (synset[j] !== word) result.add(synset[j]);
      }
    }
    return Array.from(result);
  };

  window.WN_ES_loaded = true;
  console.log('[WordNet-ES] Cargado: ${synsets.length} synsets, ${Object.keys(wordIndex).length} palabras.');
})();
`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // Usar caché si existe
  if (!fs.existsSync(CACHE_FILE)) {
    await download(TAB_URL, CACHE_FILE);
  } else {
    const stats = fs.statSync(CACHE_FILE);
    console.log(`Usando caché: ${CACHE_FILE} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
  }

  console.log('Procesando...');
  const content = fs.readFileSync(CACHE_FILE, 'utf8');
  const data = processTab(content);

  const js = buildJs(data);
  fs.writeFileSync(OUT_FILE, js, 'utf8');

  const sizeMB = (fs.statSync(OUT_FILE).size / 1024 / 1024).toFixed(2);
  console.log(`\nGenerado: ${OUT_FILE} (${sizeMB} MB)`);
  console.log('Listo. Agrega <script src="wordnet-es.js"></script> en el HTML.');
}

main().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
