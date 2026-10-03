/* ══════════════════════════════════════════════════════════════════
   NINGUNA FUSIÓN NI RITUAL DECORATIVO

   Una Fusion en el extra deck que no se puede invocar nunca es peor que
   no tenerla: ocupa un hueco, sale en las recompensas y el jugador la
   guarda esperando una carta que no existe en el pool. Lo mismo con un
   Ritual sin su mágica ritual.

   Este validador NO mantiene una lista escrita a mano —eso se
   desincroniza en dos cambios—: lee el pool real, los textos reales de
   las cartas y las familias reales del generador de sobres, y para cada
   Fusion/Ritual comprueba que exista una ruta:

     FUSIÓN   · sus materiales están en el pool, y hay Polymerization
                (o la carta de fusión que pida), o bien
              · Metamorphosis + un monstruo del MISMO NIVEL para
                tributar, que es como se juega de verdad en Goat.
     RITUAL   · el monstruo ritual, SU mágica ritual concreta, y
                material de tributo suficiente en el pool.

   Y dice en qué sobres sale cada pieza, que es la pregunta que de
   verdad se hace el jugador.

   Uso:  node check-fusiones.mjs            resumen + INVALID
         node check-fusiones.mjs --todo     el informe entero
   ══════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";

const D = "../data/";
const leer = f => JSON.parse(readFileSync(D + f, "utf-8"));
const pool    = new Set(leer("goat-pool.json"));
const textos  = leer("pool_texts.json");
const cards   = leer("cards.json");
const pools   = leer("story/cards.json");

const porCodigo = new Map();
for(const k in cards){ const c = cards[k]; porCodigo.set(c.code, c); }

const nombreDe = c => { const v = textos[String(c)];
                        return (Array.isArray(v) ? v[0] : v) ?? String(c); };
const textoDe  = c => { const v = textos[String(c)];
                        return (Array.isArray(v) ? (v[1] ?? "") : "") ?? ""; };
const porNombre = new Map();
for(const c of pool){ const n = nombreDe(c); if(!porNombre.has(n)) porNombre.set(n, c); }
/* Los nombres del formato llevan sufijos —"(GOAT)", "(Pre-Errata)"— que
   NO aparecen en el texto de las fusiones. Se busca también sin ellos. */
const limpio = n => String(n).replace(/\s*\((GOAT|Pre-Errata)\)\s*$/i, "").trim();
const porNombreLimpio = new Map();
for(const c of pool){ const n = limpio(nombreDe(c));
                      if(!porNombreLimpio.has(n)) porNombreLimpio.set(n, c); }
const existe = n => porNombre.has(n) || porNombreLimpio.has(limpio(n));

const TIPO = { MONSTRUO:0x1, MAGIA:0x2, TRAMPA:0x4, RITUAL:0x80, FUSION:0x40 };
const es = (c, bit) => !!((porCodigo.get(c)?.type ?? 0) & bit);
const nivelDe = c => porCodigo.get(c)?.level ?? 0;

/* ── EN QUÉ SOBRE SALE CADA CARTA ──
   Sale de las mismas listas que usa el generador: si mañana se mueve una
   carta de familia, esto lo dice solo. */
const FAMILIAS = { ARCANE:"arcane", WARRIOR:"warrior", DRAGON:"dragon",
                   RECRUIT:"recruit", FORBID:"forbid" };
const sobresDe = c => {
  const dentro = [];
  for(const [id, clave] of Object.entries(FAMILIAS))
    if((pools[clave] ?? []).includes(c)) dentro.push(id);
  /* La casilla STAPLE de todos los sobres tira de las listas de rareza,
     así que una carta ultra/super/rara puede salir en cualquiera. */
  const porRareza = ["ultra","super","rare"].find(r => (pools[r] ?? []).includes(c));
  if(porRareza) dentro.push(`cualquiera (${porRareza})`);
  return dentro;
};

/* El conjunto de todo lo que un sobre puede darte, que es distinto de
   "está en el pool": el pool son 1.685 cartas y los sobres reparten
   doscientas y pico. */
const obtenibles = new Set([...Object.entries(pools)]
  .filter(([k,v]) => Array.isArray(v) && k !== "_nota_fusiones")
  .flatMap(([,v]) => v));

let fallos = 0;
const problemas = [];
const filas = [];
const TODO = process.argv.includes("--todo");

/* ══ LAS FUSIONES ══
   El texto de una Fusion de esta época es
   `"A" + "B"` o `"A" + 1 <algo>`. Se sacan los nombres entre comillas
   de la primera línea, que es donde va la receta. */
/* ══ SOLO LO QUE EL JUEGO OFRECE ══
   El pool tiene 52 fusiones pero el generador reparte unas pocas. Una
   fusión que nunca sale de un sobre no es un problema de diseño: es una
   carta que no existe para el jugador. Lo que hay que validar es lo que
   SÍ puede llegarle a las manos, que es como estaba escrito el encargo:
   "toda Fusion disponible durante Story". */
const ofrecidas = new Set([...(pools.fusion ?? []), ...(pools.fusionTematica ?? []),
  ...Object.values(FAMILIAS).flatMap(k => pools[k] ?? []),
  ...(pools.ultra ?? []), ...(pools.super ?? []), ...(pools.rare ?? []),
  ...(pools.maestria ?? [])]);
const fusiones = [...pool].filter(c => es(c, TIPO.FUSION) && ofrecidas.has(c));
const fusionesFuera = [...pool].filter(c => es(c, TIPO.FUSION) && !ofrecidas.has(c));
const materialesDe = c => {
  const t = textoDe(c).split(/\n|\r/)[0] ?? "";
  const entreComillas = [...t.matchAll(/"([^"]{3,60})"/g)].map(m => m[1]);
  return entreComillas;
};
/* ══ Y LAS PROPIAS PIEZAS DE FUSIÓN TIENEN QUE SALIR EN ALGÚN SOBRE ══
   Polymerization estaba en el pool pero en NINGUNA lista del generador,
   así que la ruta "materiales + Polymerization" era imposible para las
   52 fusiones y el validador la daba por buena. */
const alcanzableGlobal = nom => {
  const c = porNombre.get(nom) ?? porNombreLimpio.get(limpio(nom)) ?? null;
  return c != null && sobresDe(c).length > 0;
};
const hayPoly   = alcanzableGlobal("Polymerization");
const hayMeta   = alcanzableGlobal("Metamorphosis");

for(const f of fusiones){
  const mats = materialesDe(f);
  const nivel = nivelDe(f);
  /* Ruta 1 · los materiales de verdad + Polymerization. */
  const matsEnPool = mats.filter(existe);
  /* ══ ESTAR EN EL POOL NO ES PODER CONSEGUIRLA ══
     El pool son 1.685 cartas y solo una parte sale en los sobres. Un
     material que existe pero que el jugador no puede obtener durante la
     run no es una ruta: es la misma fusión decorativa con otro nombre.
     Se exige que cada pieza salga en alguna familia o en las listas de
     rareza, que es de donde tira el generador. */
  const alcanzable = c => c != null && sobresDe(c).length > 0;
  const codigoDe = nom => porNombre.get(nom) ?? porNombreLimpio.get(limpio(nom)) ?? null;
  const matsAlcanzables = mats.filter(m => alcanzable(codigoDe(m)));
  const porFusion = mats.length > 0 && matsEnPool.length === mats.length
                    && matsAlcanzables.length === mats.length && hayPoly;
  /* Ruta 2 · Metamorphosis: se tributa UN monstruo del mismo nivel, que
     también tiene que ser alcanzable. Sin esta condición el validador
     daba 0 INVALID sin comprobar nada, porque con 1.685 cartas siempre
     hay alguna de cualquier nivel. */
  const tributos = [...pool].filter(c => es(c, TIPO.MONSTRUO) && !es(c, TIPO.FUSION)
                                      && nivelDe(c) === nivel && alcanzable(c));
  const porMeta = hayMeta && tributos.length > 0;

  const valida = porFusion || porMeta;
  if(!valida){
    fallos++;
    problemas.push(`FUSIÓN ${nombreDe(f)} (nivel ${nivel}) — ` +
      (mats.length ? `no se pueden conseguir: ${mats.filter(m=>!alcanzable(codigoDe(m))).join(", ")}`
                   : "no se le lee la receta") +
      (hayMeta ? ` · y no hay ningún monstruo de nivel ${nivel} para Metamorphosis`
               : " · y no hay Metamorphosis en el pool"));
  }
  filas.push({ tipo:"FUSIÓN", nombre:nombreDe(f), nivel,
    piezas: mats.length ? mats.join(" + ") : "(receta ilegible)",
    ruta: porFusion ? "Polymerization" : porMeta ? `Metamorphosis (nivel ${nivel})` : "—",
    sobres: sobresDe(f).join(", ") || "solo en el extra",
    estado: valida ? "VALID" : "INVALID" });
}

/* ══ LOS RITUALES ══
   Cada monstruo ritual necesita SU mágica ritual, y el nombre del
   monstruo aparece en el texto de la mágica. */
const rituales = [...pool].filter(c => es(c, TIPO.MONSTRUO) && es(c, TIPO.RITUAL)
                                    && ofrecidas.has(c));
const ritualesFuera = [...pool].filter(c => es(c, TIPO.MONSTRUO) && es(c, TIPO.RITUAL)
                                         && !ofrecidas.has(c));
const magiasRituales = [...pool].filter(c => es(c, TIPO.MAGIA) && es(c, TIPO.RITUAL));

for(const r of rituales){
  const nom = limpio(nombreDe(r));
  const nivel = nivelDe(r);
  const suMagia = magiasRituales.find(m => textoDe(m).includes(nom));
  /* Material de tributo: con nivel total suficiente basta cualquier
     monstruo del pool; se comprueba que existan monstruos que sumen. */
  const hayMaterial = [...pool].some(c => es(c, TIPO.MONSTRUO) && !es(c, TIPO.RITUAL)
                                       && nivelDe(c) >= 1);
  const valida = !!suMagia && hayMaterial;
  if(!valida){
    fallos++;
    problemas.push(`RITUAL ${nombreDe(r)} (nivel ${nivel}) — ` +
      (!suMagia ? "no existe su mágica ritual en el pool"
                : "no hay material de tributo"));
  }
  filas.push({ tipo:"RITUAL", nombre:nombreDe(r), nivel,
    piezas: suMagia ? `${nombreDe(suMagia)} + tributos de nivel ${nivel}`
                    : "(sin mágica ritual)",
    ruta: suMagia ? nombreDe(suMagia) : "—",
    sobres: [...new Set([...sobresDe(r), ...(suMagia ? sobresDe(suMagia) : [])])]
              .join(", ") || "—",
    estado: valida ? "VALID" : "INVALID" });
}

/* ══ EL CASO INVERSO: UNA MÁGICA RITUAL HUÉRFANA ══
   Black Luster Ritual salía en el sobre ARCANE y su monstruo —Black
   Luster Soldier— no salía en ninguno: una carta muerta en la mano para
   siempre. El validador original solo miraba de monstruo a mágica, así
   que este agujero pasaba entero. */
for(const m of magiasRituales){
  if(!ofrecidas.has(m)) continue;
  const suMonstruo = rituales.concat(
    [...pool].filter(c => es(c, TIPO.MONSTRUO) && es(c, TIPO.RITUAL))
  ).find(r => textoDe(m).includes(limpio(nombreDe(r))) && ofrecidas.has(r));
  if(!suMonstruo){
    fallos++;
    problemas.push(`MÁGICA RITUAL ${nombreDe(m)} — se reparte en los sobres pero`
      + ` su monstruo ritual no sale en ninguno: carta muerta`);
    filas.push({ tipo:"RITUAL", nombre:nombreDe(m), nivel:0,
      piezas:"(su monstruo no se puede conseguir)", ruta:"—",
      sobres:sobresDe(m).join(", "), estado:"INVALID" });
  }
}

/* ── informe ── */
console.log(`\n═══ FUSIONES Y RITUALES DEL POOL ═══\n`);
const invalidos = filas.filter(f => f.estado === "INVALID");
const aMostrar = TODO ? filas : invalidos.length ? invalidos : filas.slice(0, 12);
console.log("  tipo    nombre                              piezas / ruta");
for(const f of aMostrar){
  const marca = f.estado === "VALID" ? " " : "✗";
  console.log(`  ${marca} ${f.tipo.padEnd(7)} ${f.nombre.slice(0,34).padEnd(35)} ${f.ruta}`);
  if(TODO) console.log(`       piezas: ${f.piezas}`);
  if(TODO) console.log(`       sobres: ${f.sobres}`);
}
if(!TODO && !invalidos.length && filas.length > 12)
  console.log(`  … y ${filas.length - 12} más (usa --todo para verlas)`);

const porPoly  = filas.filter(f => f.ruta === "Polymerization").length;
const porMetaN = filas.filter(f => /Metamorphosis/.test(f.ruta)).length;
console.log(`  rutas: ${porPoly} por Polymerization · ${porMetaN} solo por Metamorphosis`);
console.log(`  fuera de los sobres (nunca le llegan al jugador): ${fusionesFuera.length} fusiones, ${ritualesFuera.length} rituales`);
console.log(`\n  ${fusiones.length} fusiones · ${rituales.length} monstruos ritual`
          + ` · ${magiasRituales.length} mágicas rituales`);
console.log(`  VALID: ${filas.length - invalidos.length}   INVALID: ${invalidos.length}`);

/* ══ UN MONSTRUO CON CONDICIÓN SIN SU LLAVE TAMPOCO SE JUEGA ══
   E lo dijo entero: «todas las cartas que ofreces deben tener manera de
   jugarse, sean rituales, fusiones o monstruos con condición». Las
   fusiones y los rituales ya se miran arriba. Falta el tercer grupo:
   Horus LV6 necesita al LV4, Ultimate Insect LV5 necesita al LV3,
   Levia-Dragon necesita A Legendary Ocean. Si el sobre te da el escalón
   de arriba y nunca el de abajo, esa carta es un cromo.

   No hay lista escrita a mano: se busca en el TEXTO de la carta el
   nombre de cualquier otra carta del pool. Si la carta dice que no se
   puede invocar normalmente y nombra a otra, esa otra tiene que salir
   en algún sobre. */
{
  const nombresLargos = [...porNombre.keys()].filter(n => n.length >= 8)
    .sort((a,b) => b.length - a.length);
  const condicionales = [...obtenibles].filter(c =>
    es(c, TIPO.MONSTRUO) && !es(c, TIPO.FUSION) &&
    /cannot be Normal Summoned|can(?:not)? be Special Summoned (?:only )?by|This card can only be Special Summoned/i.test(textoDe(c)));
  const huerfanas = [];
  for(const c of condicionales){
    const t = textoDe(c);
    /* Los nombres que menciona, sin contarse a sí misma. */
    const llaves = nombresLargos.filter(n => n !== nombreDe(c) && t.includes(n))
                                .map(n => porNombre.get(n));
    if(!llaves.length) continue;               // condición genérica: nada que exigir
    if(!llaves.some(k => obtenibles.has(k)))
      huerfanas.push(`${nombreDe(c)} necesita ${llaves.map(nombreDe).join(" o ")}`
                   + `, y no sale en ningún sobre`);
  }
  if(huerfanas.length){
    fallos += huerfanas.length;
    console.log(`\n  ✗ ${huerfanas.length} monstruo(s) con condición sin su llave:`);
    for(const t of huerfanas) console.log("     · " + t);
  } else console.log(`  ✓ los ${condicionales.length} monstruos con condición tienen su llave en algún sobre`);
}

/* ══ UNA FUSIÓN EN EL MAIN DECK NO SE PUEDE JUGAR ══
   El starter de Fusión llevaba dos Flame Swordsman en el mazo
   principal. El motor no las deja salir de ahí, así que eran dos huecos
   muertos de cuarenta, y ninguna comprobación se quejaba porque las dos
   cartas estaban en el pool y dentro del límite de copias. Lo vio E
   leyendo la lista del mazo. El espejo también vale: algo que no sea
   fusión metido en el Extra tampoco se puede invocar. */
{
  const decks = leer("story/decks.json");
  const mal = [];
  for(const [id, m] of Object.entries(decks)){
    for(const c of new Set(m.main ?? []))
      if(es(c, TIPO.FUSION)) mal.push(`${id}: ${nombreDe(c)} es una fusión y está en el Main Deck`);
    for(const c of new Set(m.extra ?? []))
      if(!es(c, TIPO.FUSION)) mal.push(`${id}: ${nombreDe(c)} está en el Extra Deck sin ser una fusión`);
  }
  if(mal.length){
    fallos += mal.length;
    console.log(`\n  ✗ ${mal.length} carta(s) en la mitad del mazo que no les toca:`);
    for(const t of mal) console.log("     · " + t);
  } else console.log(`  ✓ ninguna fusión perdida en un Main Deck (${Object.keys(decks).length} mazos)`);
}

if(problemas.length){
  console.log("\n  ✗ SIN RUTA:");
  for(const p of problemas.slice(0, 20)) console.log("     · " + p);
  if(problemas.length > 20) console.log(`     … y ${problemas.length-20} más`);
}

console.log(`\n${fallos ? "FALLA: " + fallos + " sin ruta" : "Todo correcto: 0 INVALID"}`);
process.exit(fallos ? 1 : 0);
