/* ══════════════════════════════════════════════════════════════════
   CADA CARTA CON SU PROPIA ILUSTRACIÓN

   E llevaba sesiones diciendo que veía "cartas sin arte" sin poder
   apuntar cuál. No hacía falta que la apuntara: se puede deducir de la
   base, y lo que salió no era arte FALTANTE sino arte EQUIVOCADO.

   La causa: `alias` en la base de ocgcore es una regla de NOMBRE —dice
   qué cartas comparten el límite de tres copias— y se estaba usando
   también para pedir la imagen. Para las variantes "(GOAT)" y
   "(Pre-Errata)" las dos cosas coinciden, que es por lo que colaba; para
   las cartas que cuentan como otra sin parecerse en nada, no:

     A Legendary Ocean    ->  se dibujaba con el arte de Umi
     Harpie Lady 1, 2 y 3 ->  las tres con el arte de Harpie Lady
     Cyber Harpie Lady    ->  también

   O sea que el starter de arpías enseñaba la misma imagen cinco veces.

   Esta comprobación no puede pedir imágenes —no hay red en el sandbox y
   tampoco es asunto suyo—, así que mira lo que sí es comprobable:
     1. que ninguna carta del pool acabe pidiendo un passcode inventado,
        que el servidor de imágenes no puede tener;
     2. que cuando una carta se redirige, sea a una carta CON SU MISMO
        NOMBRE (quitando el sufijo de variante). Redirigir a otra carta
        distinta es exactamente el bug de arriba;
     3. y que el simulador y el deck builder resuelvan IGUAL, porque el
        mismo mazo se ve en los dos sitios.

   Uso:  node check-arte.mjs
   ══════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";

const pool  = JSON.parse(readFileSync("../data/goat-pool.json","utf-8")).map(Number);
const cards = JSON.parse(readFileSync("./out/cards.subset.json","utf-8"));
const names = JSON.parse(readFileSync("./out/names.subset.json","utf-8"));
const full  = JSON.parse(readFileSync("../data/full_cards.json","utf-8"));
const imgAlias = JSON.parse(readFileSync("../data/img-alias.json","utf-8"));

let fallos = 0;
const ok  = t => console.log("  ✓ " + t);
const mal = (t,d="") => { fallos++; console.log("  ✗ " + t + (d ? "   " + d : "")); };
console.log("\n═══ LA ILUSTRACIÓN DE CADA CARTA ═══\n");

/* ══ LAS DOS IMPLEMENTACIONES SE SACAN DEL HTML CONSTRUIDO ══
   Copiarlas aquí a mano era lo cómodo, y con eso el punto 3 —"los dos
   piden la misma imagen"— comparaba mi copia contra mi copia: verde
   siempre, mida lo que mida el juego. Es exactamente el verde falso que
   este proyecto ya ha pagado varias veces. Así que se extrae el texto
   REAL de cada archivo y se ejecuta con su propia tabla al lado. */
const DE_KONAMI = c => String(c).length <= 8;

function sacarFuncion(archivo, patron, quien){
  const txt = readFileSync(archivo,"utf-8");
  const m = txt.match(patron);
  if(!m) throw new Error(
    `\n\n  ${quien}: no encuentro la función que elige la ilustración.\n` +
    `  Si la has renombrado, actualiza el patrón de check-arte.mjs — pero\n` +
    `  NO copies aquí una versión a mano: entonces esto deja de medir.\n`);
  return m[1];
}

/* El simulador: `const artCode = c => (...)`. El deck builder: `const arte
   = c => (...)`. Las dos se evalúan con `IMG_ALIAS`, `CARDS` y un `DB`
   con la misma forma que en su archivo. */
const cuerpoSim = sacarFuncion("./out/goat.html",
  /const artCode\s*=\s*(c\s*=>[\s\S]{0,240}?);\n/, "goat.html");
const cuerpoDB  = sacarFuncion("../deckbuilder/deckbuilder.html",
  /const arte\s*=\s*(c\s*=>[\s\S]{0,240}?);\n/, "deckbuilder.html");

const hacer = (cuerpo) => {
  const DB = { get: c => cards[c] };
  const CARDS = cards, IMG_ALIAS = imgAlias;
  const PASSCODE_DE_KONAMI = DE_KONAMI;
  // eslint-disable-next-line no-new-func
  return new Function("DB","CARDS","IMG_ALIAS","PASSCODE_DE_KONAMI","globalThis_",
    `const globalThis = globalThis_; return (${cuerpo});`)
    (DB, CARDS, IMG_ALIAS, PASSCODE_DE_KONAMI, { IMG_ALIAS: imgAlias });
};
const arteSimulador   = hacer(cuerpoSim);
const arteDeckBuilder = hacer(cuerpoDB);

const nombreDe = c => names[c]?.name ?? full[c]?.name ?? null;
const sinSufijo = n => String(n)
  .replace(/\s*\((GOAT|Pre-Errata|Anime|Action Field)\)\s*$/i,"").trim().toLowerCase();

/* ── 1 · nadie pide un passcode que no existe fuera de aquí ── */
{
  const inventados = pool.filter(c => !DE_KONAMI(Number(arteSimulador(c))));
  if(inventados.length)
    mal(`ninguna carta pide un passcode inventado`,
        inventados.slice(0,5).map(c => `${nombreDe(c)} (${c})`).join(" · "));
  else ok(`las ${pool.length} cartas del pool piden un passcode que el servidor puede tener`);
}

/* ── 2 · y si se redirige, es a la MISMA carta ── */
{
  const equivocadas = [];
  for(const c of pool){
    const a = Number(arteSimulador(c));
    if(a === c) continue;
    const nOrig = nombreDe(c), nDest = nombreDe(a);
    if(!nDest){ equivocadas.push(`${nOrig} -> ${a} (no existe)`); continue; }
    if(sinSufijo(nOrig) !== sinSufijo(nDest))
      equivocadas.push(`${nOrig} -> ${nDest}`);
  }
  if(equivocadas.length)
    mal("ninguna carta se dibuja con el arte de OTRA carta",
        equivocadas.slice(0,6).join(" · "));
  else ok("ninguna carta se dibuja con el arte de otra carta distinta");
}

/* ── 3 · el simulador y el deck builder, de acuerdo ── */
{
  const discrepan = pool.filter(c => Number(arteSimulador(c)) !== Number(arteDeckBuilder(c)));
  if(discrepan.length)
    mal("el simulador y el deck builder piden la misma imagen",
        discrepan.slice(0,5).map(c => `${nombreDe(c)}: ${arteSimulador(c)} vs ${arteDeckBuilder(c)}`).join(" · "));
  else ok("el simulador y el deck builder piden la misma imagen para cada carta");
}

/* ── 4 · y las cinco del reporte, una por una ──
   Con nombre y apellidos: si alguien vuelve a poner `alias` por delante,
   estas cinco son las que lo dicen en voz alta. */
{
  const CASOS = [
    [295517,  "A Legendary Ocean"],
    [91932350,"Harpie Lady 1"],
    [27927359,"Harpie Lady 2"],
    [54415063,"Harpie Lady 3"],
    [80316585,"Cyber Harpie Lady"],
  ];
  const rotas = CASOS.filter(([code]) => Number(arteSimulador(code)) !== code);
  if(rotas.length)
    mal("las cinco del reporte de E se dibujan con su propio arte",
        rotas.map(([c,n]) => `${n} -> ${arteSimulador(c)}`).join(" · "));
  else ok("A Legendary Ocean y las cuatro arpías se dibujan con su propio arte");
}

/* ── 5 · el tamaño del passcode NO basta, y estas dos lo demuestran ──
   Night Assailant y Big Shield Gardna (Pre-Errata) llevan passcodes
   INVENTADOS de ocho dígitos: por tamaño parecen de Konami y no lo son,
   así que sin la tabla de imagen se piden tal cual y no existen. Estas
   dos son las que de verdad salían sin ilustración. */
{
  const OCHO_FALSOS = [[16226796,"Night Assailant (Pre-Errata)",16226786],
                       [65240394,"Big Shield Gardna (Pre-Errata)",65240384]];
  const rotas = OCHO_FALSOS.filter(([c,,esperado]) =>
    Number(arteSimulador(c)) !== esperado || Number(arteDeckBuilder(c)) !== esperado);
  if(rotas.length)
    mal("los Pre-Errata con passcode falso de 8 dígitos usan la tabla de imagen",
        rotas.map(([c,n]) => `${n}: sim ${arteSimulador(c)} · db ${arteDeckBuilder(c)}`).join(" · "));
  else ok("los dos Pre-Errata con passcode falso de 8 dígitos usan la tabla de imagen");
}

/* ── 6 · y los DOS html construidos llevan la corrección ── */
{
  const html = readFileSync("./out/goat.html","utf-8");
  if(/artCode\s*=\s*c\s*=>\s*\(DB\.get\(c\)\?\.alias/.test(html))
    mal("el simulador construido lleva el orden nuevo",
        "sigue pidiendo el alias de reglas ANTES que nada");
  else ok("el simulador construido lleva el orden nuevo");

  const db = readFileSync("../deckbuilder/deckbuilder.html","utf-8");
  if(!/const arte\s*=/.test(db) || /\$\{IMG\}\$\{base\(/.test(db))
    mal("el deck builder construido pide la imagen con `arte`, no con `base`",
        "`base` es el alias de REGLAS: con él las cuatro arpías salen iguales");
  else ok("el deck builder construido pide la imagen con `arte`, no con `base`");
}

console.log(`\n${fallos ? "FALLA: " + fallos : "Todo correcto"}`);
process.exit(fallos ? 1 : 0);
