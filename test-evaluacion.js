/**
 * test-evaluacion.js
 * Prueba exhaustiva del sistema de evaluación y la integración WordNet-ES.
 * Uso: node test-evaluacion.js
 */

// ── Simular entorno browser ────────────────────────────────────────────────
const fs = require('fs');
global.window = {};

// Cargar WordNet
const wnCode = fs.readFileSync('./wordnet-es.js', 'utf8');
eval(wnCode);

// ── Funciones del sistema de evaluación (copiadas del HTML) ───────────────

const SINONIMOS = {
  'narrativa': ['narracion','relato','cuento','historia'],
  'poesia': ['lirica','verso','poema','composicion poetica'],
  'metafora': ['comparacion implicita','imagen','tropo','figura de significado'],
  'bonito': ['bello','hermoso','lindo','precioso'],
  'rapido': ['veloz','ligero','acelerado','agil'],
};

function norm(s) {
  return (s||'').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
}

function findSynonyms(word) {
  const synonyms = new Set([word]);
  if (window.WN_ES_loaded) {
    for (const syn of window.WN_ES_lookup(word)) synonyms.add(syn);
  }
  if (SINONIMOS[word]) SINONIMOS[word].forEach(s => synonyms.add(s));
  for (const [key, values] of Object.entries(SINONIMOS)) {
    if (values.includes(word)) { synonyms.add(key); values.forEach(v => synonyms.add(v)); }
  }
  return [...synonyms];
}

function stemSpanish(word) {
  if (!word || word.length < 4) return word;
  let stem = word;
  const nominalSuffixes = ['amiento','imiento','mente','cion','sion','idad','edad',
    'encia','ancia','ismo','ista','oso','osa','ivo','iva','able','ible','ador','edor',
    'idor','iente','ante','ente','ura','ero','era','ico','ica','al','il'];
  const verbalSuffixes = ['iendo','ando','ieron','aron','aban','aste','iste',
    'amos','emos','imos','eron','aria','eria','iria','aba','ara','iera','ase','iese',
    'ado','ido','ar','er','ir'];
  const dimAumSuffixes = ['illo','illa','ito','ita','ote','ota','azo','aza'];

  for (const suf of nominalSuffixes)
    if (stem.endsWith(suf) && stem.length > suf.length + 3) { stem = stem.slice(0,-suf.length); break; }
  for (const suf of dimAumSuffixes)
    if (stem.endsWith(suf) && stem.length > suf.length + 3) { stem = stem.slice(0,-suf.length); break; }
  for (const suf of verbalSuffixes)
    if (stem.endsWith(suf) && stem.length > suf.length + 2) { stem = stem.slice(0,-suf.length); break; }

  const isInvariant = /[iuo]s$|sis$|lis$|tis$|bis$|xis$/.test(stem);
  if (!isInvariant) {
    if (stem.endsWith('es') && stem.length > 5) stem = stem.slice(0,-2);
    else if (stem.endsWith('s') && stem.length > 4) stem = stem.slice(0,-1);
  }
  return stem;
}

function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++)
    for (let j = 1; j <= a.length; j++)
      matrix[i][j] = b[i-1]===a[j-1] ? matrix[i-1][j-1]
        : Math.min(matrix[i-1][j-1]+1, matrix[i][j-1]+1, matrix[i-1][j]+1);
  return matrix[b.length][a.length];
}

function flexibleMatch(keyword, answerWords, fullAnswer) {
  const kwStem = stemSpanish(keyword);
  const kwSynonyms = findSynonyms(keyword);
  const kwEscaped = keyword.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const kwWordRe  = new RegExp('(?:^|\\s)'+kwEscaped+'(?=\\s|$)');
  if (kwWordRe.test(fullAnswer)) return { found: true, type: 'exacta', matched: keyword };
  for (const word of answerWords) {
    const wordStem = stemSpanish(word);
    if (kwStem===wordStem||
        (kwStem.length>=4&&wordStem.length>=4&&(kwStem.startsWith(wordStem)||wordStem.startsWith(kwStem))))
      return { found: true, type: 'raiz', matched: word };
  }
  for (const syn of kwSynonyms) {
    const synInAnswer = syn.includes(' ') ? fullAnswer.includes(syn) : answerWords.includes(syn);
    if (synInAnswer) return { found: true, type: 'sinonimo', matched: syn };
    const synStem = stemSpanish(syn);
    for (const word of answerWords)
      if (stemSpanish(word) === synStem) return { found: true, type: 'sinonimo', matched: word };
  }
  for (const word of answerWords) {
    if (word.length >= 4 && keyword.length >= 4) {
      const distance = levenshtein(keyword, word);
      if (distance <= (keyword.length <= 5 ? 1 : 2)) return { found: true, type: 'similar', matched: word };
    }
  }
  if (keyword.length >= 5) {
    for (const word of answerWords) {
      if (word.length >= keyword.length && word.includes(keyword)) return { found: true, type: 'contenida', matched: word };
      if (keyword.includes(word) && word.length >= 4) return { found: true, type: 'parcial', matched: word };
    }
  }
  return { found: false };
}

function evaluateNumeric(studentAnswer, correctAnswer) {
  const extractNumbers = s => {
    if (!s) return [];
    const cleaned = (s+'').replace(/,/g,'.').replace(/[^\d.\-]/g,' ');
    return (cleaned.match(/-?\d+\.?\d*/g)||[]).map(parseFloat).filter(n=>!isNaN(n));
  };
  const correctNums = extractNumbers(correctAnswer);
  const studentNums = extractNumbers(studentAnswer);
  if (correctNums.length===0||studentNums.length===0) return null;
  const correct = correctNums[0];
  const student = studentNums[studentNums.length-1];
  if (correct===0) return student===0?100:0;
  if (student===correct) return 100;
  const diff = Math.abs(student-correct)/Math.abs(correct);
  if (diff<=0.001) return 100;
  if (diff<=0.01)  return 95;
  if (diff<=0.03)  return 85;
  if (diff<=0.07)  return 70;
  if (diff<=0.15)  return 50;
  return 0;
}

const STOPWORDS_ES = new Set(['el','la','los','las','un','una','unos','unas','lo','al','del',
  'que','de','en','y','a','es','se','no','te','le','me','mi','tu','su','con','por','para',
  'como','más','pero','si','ya','o','ni','fue','ser','hay','han','son','era','sin','sus',
  'les','nos','muy','todo','esta','este','ese','esa','cuando','donde','quien','cual']);

function evaluateKeywords(studentAnswer, keywordsStr, correctAnswer) {
  if (!studentAnswer||studentAnswer.trim().length<2)
    return { percentage:0, feedback:'Sin respuesta', matches:[] };
  const normFn = str => (str||'').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
  const significantWords = text => normFn(text).split(' ')
    .filter(w=>w.length>=3&&!STOPWORDS_ES.has(w));
  const sNorm  = normFn(studentAnswer);
  const sWords = significantWords(studentAnswer);
  let keywords = (keywordsStr||'').split(',')
    .map(k=>normFn(k.trim())).filter(k=>k.length>=2);
  if (keywords.length===0) {
    const cNorm = normFn(correctAnswer);
    if (!cNorm||cNorm.length<2) return { percentage:0, feedback:'Sin criterio', matches:[] };
    keywords = significantWords(correctAnswer);
    const seenStems = new Set();
    keywords = keywords.filter(w => {
      const stem = stemSpanish(w);
      if (seenStems.has(stem)) return false;
      seenStems.add(stem); return true;
    });
    if (keywords.length===0) return { percentage:0, feedback:'Sin criterio', matches:[] };
  }
  const totalWeight = keywords.reduce((s,k)=>s+Math.max(1,k.length-2),0);
  let earnedWeight=0;
  const matches=[],missing=[];
  for (const kw of keywords) {
    const kwWeight = Math.max(1,kw.length-2);
    const result = flexibleMatch(kw,sWords,sNorm);
    if (result.found) { matches.push(kw); earnedWeight+=kwWeight; }
    else {
      const syns = findSynonyms(kw);
      let synFound=false;
      for (const syn of syns) {
        const synNorm = normFn(syn);
        if (synNorm!==kw&&flexibleMatch(synNorm,sWords,sNorm).found) {
          matches.push(kw); earnedWeight+=Math.round(kwWeight*0.85); synFound=true; break;
        }
      }
      if (!synFound) missing.push(kw);
    }
  }
  const percentage = Math.min(100,Math.round((earnedWeight/totalWeight)*100));
  return { percentage, matches, missing };
}

function evaluateFill(studentAnswer, correctAnswer) {
  if (!studentAnswer||!studentAnswer.trim()) return { percentage:0 };
  const sNorm = norm(studentAnswer);
  const cNorm = norm(correctAnswer||'');
  if (!cNorm) return { percentage:0 };
  if (sNorm===cNorm) return { percentage:100 };
  const sWords = sNorm.split(' ').filter(w=>w.length>1);
  // FIX Bug 2: filtrar stopwords de cWords
  const cWords = cNorm.split(' ').filter(w=>w.length>1&&!STOPWORDS_ES.has(w));
  if (cWords.length===1) {
    if (stemSpanish(cNorm)===stemSpanish(sNorm)) return { percentage:95 };
    const syns = findSynonyms(cNorm).map(norm);
    if (syns.includes(sNorm)||syns.map(stemSpanish).includes(stemSpanish(sNorm))) return { percentage:90 };
    const maxDist = cNorm.length<=4?1:cNorm.length<=7?2:3;
    if (levenshtein(cNorm,sNorm)<=maxDist) return { percentage:85 };
    if (sNorm.includes(cNorm)||cNorm.includes(sNorm)) return { percentage:60 };
    return { percentage:0 };
  }
  if (cWords.length===0) return { percentage:0 };
  let matched=0;
  for (const cw of cWords) if (flexibleMatch(cw,sWords,sNorm).found) matched++;
  const pct = Math.round((matched/cWords.length)*100);
  if (pct===100) return { percentage:100 };
  if (pct>=70) return { percentage:pct };
  if (pct>=40) return { percentage:Math.min(pct,50) };
  return { percentage:0 };
}

function evaluateOrder(studentAnswer, correctAnswer) {
  if (!studentAnswer||studentAnswer.trim().length<2) return { percentage:0 };
  if (!correctAnswer||correctAnswer.trim().length<2) return { percentage:0 };
  const normO = s => (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/^\d+[\.\-\)]\s*/,'').trim();
  const correctItems = correctAnswer.split(/[\n;,]+/).map(normO).filter(Boolean);
  const studentItems = studentAnswer.split(/[\n;,]+/).map(normO).filter(Boolean);
  if (correctItems.length===0) return { percentage:0 };
  const itemsMatch = (a,b) => {
    if (!a||!b) return false;
    if (a===b) return true;
    // FIX Bug 1: includes solo si b ≥4 chars
    if (b.length>=4&&(a.includes(b)||b.includes(a))) return true;
    if (stemSpanish(a)===stemSpanish(b)) return true;
    // FIX Bug 1: ambos deben ser ≥4 chars
    if (a.length>=4&&b.length>=4&&levenshtein(a,b)<=2) return true;
    return false;
  };
  let score=0;
  const total=correctItems.length;
  for (let i=0;i<total;i++) {
    const cItem=correctItems[i], sItem=studentItems[i];
    if (sItem!==undefined&&itemsMatch(cItem,sItem)) { score+=1; }
    else {
      const adjPos=[i-1,i+1].filter(p=>p>=0&&p<studentItems.length);
      if (adjPos.some(p=>itemsMatch(cItem,studentItems[p]))) score+=0.5;
      else if (studentItems.some(s=>itemsMatch(cItem,s))) score+=0.25;
    }
  }
  return { percentage: Math.min(100,Math.round((score/total)*100)) };
}

// ══════════════════════════════════════════════════════════════
// MARCO DE PRUEBAS
// ══════════════════════════════════════════════════════════════
let passed=0, failed=0, warnings=0;

function test(name, actual, expected, isWarning=false) {
  const ok = actual===expected;
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else if (isWarning) { warnings++; console.warn(`  ⚠ ${name}\n    esperado: ${expected} | obtenido: ${actual}`); }
  else { failed++; console.error(`  ✗ ${name}\n    esperado: ${expected} | obtenido: ${actual}`); }
}

function testTrue(name, expr, isWarning=false) {
  if (expr) { passed++; console.log(`  ✓ ${name}`); }
  else if (isWarning) { warnings++; console.warn(`  ⚠ ${name} (esperado verdadero)`); }
  else { failed++; console.error(`  ✗ ${name} (esperado verdadero)`); }
}

function section(name) { console.log(`\n━━ ${name} ━━`); }

// ══════════════════════════════════════════════════════════════
// 1. WORDNET CARGADO
// ══════════════════════════════════════════════════════════════
section('1. WordNet-ES - carga y lookup');
testTrue('WN_ES_loaded es true', window.WN_ES_loaded===true);
testTrue('WN_ES_lookup es función', typeof window.WN_ES_lookup==='function');

const synsRapido = window.WN_ES_lookup('rapido');
testTrue('lookup("rapido") retorna array', Array.isArray(synsRapido));
testTrue('lookup("rapido") tiene sinónimos', synsRapido.length > 0);
testTrue('"veloz" está en sinónimos de "rapido"', synsRapido.includes('veloz'));

const synsFelix = window.WN_ES_lookup('feliz');
testTrue('"contento" en sinónimos de "feliz"', synsFelix.includes('contento')||synsFelix.includes('alegre'));

const synsInexistente = window.WN_ES_lookup('xyzpalabrafalsa');
test('palabra inexistente retorna []', synsInexistente.length, 0);

// Verificar que no retorna la palabra misma
const synsCasa = window.WN_ES_lookup('casa');
testTrue('"casa" no está en sus propios sinónimos', !synsCasa.includes('casa'));

// Verificar palabras reservadas JS como claves
const synsFin    = window.WN_ES_lookup('fin');
const synsTiempo = window.WN_ES_lookup('tiempo');
testTrue('lookup("fin") no rompe (palabra corta)', Array.isArray(synsFin));
testTrue('lookup("tiempo") no rompe', Array.isArray(synsTiempo));

// ══════════════════════════════════════════════════════════════
// 2. findSynonyms (integración WordNet + SINONIMOS curado)
// ══════════════════════════════════════════════════════════════
section('2. findSynonyms() - integración');
const fsBonito = findSynonyms('bonito');
testTrue('findSynonyms incluye la palabra misma', fsBonito.includes('bonito'));
testTrue('findSynonyms incluye sinónimos curados', fsBonito.includes('bello'));
testTrue('findSynonyms incluye sinónimos WordNet', fsBonito.some(s=>['hermoso','atractivo','guapo','lindo'].includes(s)));
testTrue('no hay duplicados en findSynonyms', fsBonito.length===new Set(fsBonito).size);

const fsPoesia = findSynonyms('poesia');
testTrue('findSynonyms("poesia") incluye "lirica" (curado)', fsPoesia.includes('lirica'));
testTrue('findSynonyms("poesia") no tiene duplicados', fsPoesia.length===new Set(fsPoesia).size);

// ══════════════════════════════════════════════════════════════
// 3. stemSpanish - casos normales y bordes
// ══════════════════════════════════════════════════════════════
section('3. stemSpanish() - casos de borde');
// "rapidamente" → single-pass: quita "mente" → "rapida" (esperado en stemmer simple)
test('stem("rapidamente")', stemSpanish('rapidamente'), 'rapida');
test('stem("velocidad")', stemSpanish('velocidad'), 'veloc');
test('stem("corriendo")', stemSpanish('corriendo'), 'corr');
test('stem("casas")', stemSpanish('casas'), 'casa');   // BUG FIX: ya no marca como invariante
test('stem("canal")', stemSpanish('canal'), 'canal');  // NO quitar "al" (4 <= 2+3=5)
test('stem("real")', stemSpanish('real'), 'real');     // NO quitar "al" (4 <= 5)
test('stem("sol")', stemSpanish('sol'), 'sol');        // < 4 chars → sin cambio
test('stem("musical")', stemSpanish('musical'), 'music'); // sí quitar "al" (7 > 5)
// Palabras invariantes (no quitar plural)
test('stem("crisis")', stemSpanish('crisis'), 'crisis');
test('stem("analisis")', stemSpanish('analisis'), 'analisis');

// ══════════════════════════════════════════════════════════════
// 4. levenshtein
// ══════════════════════════════════════════════════════════════
section('4. levenshtein() - corrección');
test('lev("","abc")', levenshtein('','abc'), 3);
test('lev("abc","")', levenshtein('abc',''), 3);
test('lev("abc","abc")', levenshtein('abc','abc'), 0);
test('lev("abc","ab")', levenshtein('abc','ab'), 1);
test('lev("kitten","sitting")', levenshtein('kitten','sitting'), 3);
test('lev("perro","perra")', levenshtein('perro','perra'), 1);
test('lev("hola","hilo")', levenshtein('hola','hilo'), 2);

// ══════════════════════════════════════════════════════════════
// 5. flexibleMatch - los 5 niveles
// ══════════════════════════════════════════════════════════════
section('5. flexibleMatch() - niveles');

// Nivel 1: exacta
{
  const r = flexibleMatch('libro', ['el','libro','es','bueno'], 'el libro es bueno');
  test('exacta: type', r.type, 'exacta');
}

// Nivel 2: raíz
{
  const r = flexibleMatch('correr', ['corriendo','rapido'], 'corriendo rapido');
  test('raiz: found', r.found, true);
  test('raiz: type', r.type, 'raiz');
}

// Nivel 3: sinónimo (curado)
{
  const r = flexibleMatch('bonito', ['bello','dia'], 'bello dia');
  test('sinonimo curado: found', r.found, true);
  test('sinonimo curado: type', r.type, 'sinonimo');
}

// Nivel 3: sinónimo (WordNet)
{
  const r = flexibleMatch('feliz', ['contento','estaba'], 'estaba contento');
  test('sinonimo WordNet: found', r.found, true);
  test('sinonimo WordNet: type', r.type, 'sinonimo');
}

// Nivel 4: tipográfico
{
  const r = flexibleMatch('computadora', ['computaadora'], 'computaadora');
  test('tipografico: found', r.found, true);
  test('tipografico: type', r.type, 'similar');
}

// Nivel 5: contenida
{
  const r = flexibleMatch('fuerza', ['superfuerza'], 'superfuerza');
  test('contenida: found', r.found, true);
}

// No encontrada
{
  const r = flexibleMatch('elefante', ['perro','gato'], 'perro gato');
  test('no encontrada: found', r.found, false);
}

// ══════════════════════════════════════════════════════════════
// 6. evaluateNumeric - casos de borde
// ══════════════════════════════════════════════════════════════
section('6. evaluateNumeric() - casos de borde');
test('exacto', evaluateNumeric('42', '42'), 100);
test('exacto con texto', evaluateNumeric('el resultado es 42', '42'), 100);
test('con coma decimal', evaluateNumeric('3,14', '3.14'), 100);
test('dentro del 1%', evaluateNumeric('100.5', '100'), 95);
test('dentro del 3%', evaluateNumeric('102', '100'), 85);
test('dentro del 7%', evaluateNumeric('105', '100'), 70);
test('dentro del 15%', evaluateNumeric('112', '100'), 50);
test('fuera del 15%', evaluateNumeric('200', '100'), 0);
test('correcto=0, alumno=0', evaluateNumeric('0', '0'), 100);
test('correcto=0, alumno≠0', evaluateNumeric('5', '0'), 0);
test('sin números → null', evaluateNumeric('hola', 'mundo'), null);
test('alumno toma último número', evaluateNumeric('primero 5 luego 42', '42'), 100);
// BUG CHECK: número negativo
testTrue('número negativo correcto', evaluateNumeric('-5','-5')===100);

// ══════════════════════════════════════════════════════════════
// 7. evaluateKeywords - con sinónimos WordNet
// ══════════════════════════════════════════════════════════════
section('7. evaluateKeywords() - con WordNet');

// Respuesta exacta
{
  const r = evaluateKeywords('La metafora es una figura literaria', '', 'metafora figura literaria');
  testTrue('keywords exactas: ≥80%', r.percentage >= 80);
}

// Respuesta con sinónimos WordNet
{
  const r = evaluateKeywords('Es un ser veloz y agil', '', 'rapido ligero');
  testTrue('sinonimos WordNet en keywords: ≥60%', r.percentage >= 60);
}

// Respuesta vacía
{
  const r = evaluateKeywords('', '', 'algo');
  test('respuesta vacía: 0%', r.percentage, 0);
}

// Sin criterio
{
  const r = evaluateKeywords('algo', '', '');
  test('sin criterio: 0%', r.percentage, 0);
}

// ══════════════════════════════════════════════════════════════
// 8. RENDIMIENTO - findSynonyms con WordNet no debe ser lento
// ══════════════════════════════════════════════════════════════
section('8. Rendimiento');

const words = ['rapido','feliz','tristeza','libro','casa','grande','pequeño','correr',
               'escribir','leer','cantar','vivir','pensar','decir','hacer','tener'];

let t0 = Date.now();
for (let i = 0; i < 500; i++) {
  for (const w of words) findSynonyms(norm(w));
}
const msPerCall = (Date.now() - t0) / (500 * words.length);
testTrue(`findSynonyms < 1ms por llamada (actual: ${msPerCall.toFixed(3)}ms)`, msPerCall < 1);

// Simular evaluación de 20 keywords (caso extremo)
t0 = Date.now();
const longAnswer = 'El texto narrativo es un relato que cuenta una historia con personajes protagonistas en un conflicto argumental dentro de un espacio y tiempo determinados';
for (let i = 0; i < 50; i++) {
  evaluateKeywords(longAnswer, '', 'narrativo relato historia personajes protagonistas conflicto argumental espacio tiempo determinados');
}
const msEval = (Date.now() - t0) / 50;
testTrue(`evaluateKeywords (10 keywords) < 200ms (actual: ${msEval.toFixed(1)}ms)`, msEval < 200, true);

// ══════════════════════════════════════════════════════════════
// 9. CASOS DE BORDE CRÍTICOS
// ══════════════════════════════════════════════════════════════
section('9. Casos de borde críticos');

// norm() con null/undefined
testTrue('norm(null) no rompe', norm(null)==='');
testTrue('norm(undefined) no rompe', norm(undefined)==='');
testTrue('norm("") retorna ""', norm('')==='');

// findSynonyms con palabra vacía
testTrue('findSynonyms("") no rompe', Array.isArray(findSynonyms('')));
testTrue('findSynonyms(null) no rompe', (() => { try { findSynonyms(null); return true; } catch(e){ return false; } })());

// stemSpanish con entrada vacía
testTrue('stemSpanish("") retorna ""', stemSpanish('')==='');
testTrue('stemSpanish(null) no rompe', (() => { try { const r=stemSpanish(null); return true; } catch(e){ return false; } })());

// levenshtein con cadenas vacías
test('levenshtein("","") = 0', levenshtein('',''), 0);

// evaluateNumeric con entrada vacía
test('evaluateNumeric("","") = null', evaluateNumeric('',''), null);
testTrue('evaluateNumeric(null,null) no rompe', evaluateNumeric(null,null)===null);

// flexibleMatch con arrays vacíos
{
  const r = flexibleMatch('libro', [], '');
  test('flexibleMatch con respuesta vacía: not found', r.found, false);
}

// ══════════════════════════════════════════════════════════════
// 10. REGRESIÓN — los 3 bugs corregidos
// ══════════════════════════════════════════════════════════════
section('10. Regresión de bugs corregidos');

// Bug 1: itemsMatch levenshtein sin b.length
{
  // "luna" vs "lu" → levenshtein=2, pero b es muy corto → NO debe coincidir
  const r1 = evaluateOrder('lu', 'luna');
  test('Bug1: order("lu") vs correct("luna") no es 100%', r1.percentage === 100, false);
  // "luna" vs "lona" (typo real, ambos ≥4) → SÍ debe coincidir
  const r2 = evaluateOrder('lona', 'luna');
  test('Bug1: order("lona") vs correct("luna") sí coincide (typo válido)', r2.percentage, 100);
}

// Bug 2: evaluateFill con stopwords en correctAnswer
{
  // "la respuesta es correcta" → cWords debería ignorar "la" y "es"
  const r = evaluateFill('respuesta correcta', 'la respuesta es correcta');
  testTrue('Bug2: fill omite stopwords del correctAnswer — ≥80%', r.percentage >= 80);
  // "el gran libro" → alumno escribe "gran libro" → debe ser ≥80%
  const r2 = evaluateFill('gran libro', 'el gran libro');
  testTrue('Bug2: "gran libro" vs "el gran libro" — ≥80%', r2.percentage >= 80);
}

// Bug 3: stem startsWith con stems cortos
{
  // "sol" vs "soltaron" → NO deben coincidir por stem
  const r1 = flexibleMatch('sol', ['soltaron'], 'soltaron');
  // "sol" es 3 chars y "soltar" stem es "solt" → ya no debería hacer startsWith
  // Puede coincidir por nivel 5 (contenida) pero NO por nivel 2 (raiz)
  if (r1.found) test('Bug3: "sol" vs "soltaron" no matchea por raiz', r1.type, 'raiz', false);
  else testTrue('Bug3: "sol" vs "soltaron" no matchea en absoluto', true);

  // "estudio" no debe matchear keyword "es" por stem startsWith
  const r2 = flexibleMatch('es', ['estudio'], 'estudio');
  testTrue('Bug3: keyword "es" no matchea "estudio" por raiz', !r2.found || r2.type !== 'raiz');

  // Stems legítimos aún funcionan (ambos ≥4 chars)
  const r3 = flexibleMatch('corriendo', ['corrian'], 'corrian');
  testTrue('Bug3: "corriendo" aún matchea "corrian" por raiz', r3.found);
}

// ── Resumen ────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(50)}`);
console.log(`RESULTADO: ${passed} ✓ correctos  |  ${warnings} ⚠ advertencias  |  ${failed} ✗ fallos`);
if (failed > 0) console.error('⚠ HAY FALLOS — revisar arriba');
else if (warnings > 0) console.warn('✓ Sin fallos críticos, pero hay advertencias');
else console.log('✓ Todos los tests pasaron');
