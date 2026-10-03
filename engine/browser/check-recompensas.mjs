/* ════════════════════════════════════════════════════════════════
   RECOMPENSAS, PACKS Y COLECCIÓN

   Lo que se comprueba aquí es lo que el jugador SIENTE:

   · que una recompensa no sea tres cartas malas (el suelo de calidad);
   · que un pack traiga siempre diez cartas y cumpla su contrato de
     casillas, incluida la de "monstruo de tu tipo";
   · que no te ofrezcan la cuarta copia de algo que ya tienes al máximo,
     que es un premio que no puedes usar;
   · que el mazo que sale de aquí sea LEGAL, porque de aquí va directo
     al motor y un mazo ilegal revienta en medio del duelo.

   Y sobre todo: que todo esto sea reproducible con la semilla.

   Uso:  node check-recompensas.mjs [cuántas muestras]
   ════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";
import { rngDeSemilla } from "./src/story/rng.js";
import { crearCatalogo, razaDominante, VALOR_RAREZA } from "./src/story/catalogo.js";
import { nuevaRun, azarDe } from "./src/story/estado.js";
import { alBinder, meterEnMazo, sacarDelMazo, revisarMazo, ponerStarter,
         copiasQueTengo, LIMITES_MAZO } from "./src/story/coleccion.js";
import { recompensaDuelo, abrirPack, morralla, FAMILIAS } from "./src/story/recompensas.js";
import { RECOMPENSA, PACK } from "./src/story/balance.js";

const D = "../data/";
const leer = f => JSON.parse(readFileSync(D+f, "utf-8"));
const cat = crearCatalogo({
  pools:   leer("story/cards.json"),
  db:      leer("pool_cards.json"),
  limites: leer("goat-limites.json"),
  pool:    leer("goat-pool.json"),
  nombres: leer("pool_texts.json"),
});
const DECKS = leer("story/decks.json");

let fallos = 0;
const ok  = t => console.log("  ✓ " + t);
const mal = (t,d="") => { fallos++; console.log("  ✗ " + t + (d?"   "+d:"")); };
const N = Number(process.argv[2] ?? 3000);

console.log(`\n═══ MODO HISTORIA · recompensas y packs (${N} muestras) ═══\n`);

/* ── el catálogo ── */
{
  const r = cat.porRareza("UR").length, s = cat.porRareza("SR").length;
  const rr = cat.porRareza("R").length, c = cat.porRareza("C").length;
  if(!r || !s || !rr) mal("las tres listas de rareza tienen cartas");
  else ok(`rarezas: ${r} UR · ${s} SR · ${rr} R · ${c} C (el resto del pool)`);
  if(cat.rareza(55144522) === "C" && cat.nombre(55144522).includes("Pot of Greed"))
    mal("Pot of Greed debería ser UR");
  else ok(`Pot of Greed es ${cat.rareza(55144522)}`);
  const espadas = cat.jugables.find(x => cat.nombre(x) === "Swords of Revealing Light");
  if(espadas && cat.rareza(espadas) === "UR")
    mal("las Espadas están limitadas pero NO son premio gordo");
  else ok(`Swords of Revealing Light es ${espadas ? cat.rareza(espadas) : "?"}, no UR`);
}

/* ── colección y legalidad ── */
{
  const run = nuevaRun({ semilla:"DK-COLE" });
  ponerStarter(run, DECKS["yugi-starter-a"]);
  if(revisarMazo(run, cat).length) mal("el starter de Yugi es un mazo legal", revisarMazo(run,cat)[0]);
  else ok("el starter de Yugi entra como mazo legal (40-60 y copias)");

  const carta = cat.porRareza("R")[0];
  alBinder(run, [carta, carta, carta, carta], cat);
  let metidas = 0;
  for(let i=0;i<4;i++) if(meterEnMazo(run, carta, cat).ok) metidas++;
  if(metidas > cat.tope(carta)) mal("no se puede pasar del tope de copias", `metió ${metidas}`);
  else ok(`el editor respeta el tope de copias (metió ${metidas}, el límite es ${cat.tope(carta)})`);

  const antes = run.mazo.main.length;
  sacarDelMazo(run, carta, cat);
  if(run.mazo.main.length !== antes-1 || !run.binder.includes(carta))
    mal("sacar una carta del mazo la devuelve al binder");
  else ok("sacar una carta del mazo la devuelve al binder");

  /* El mazo no puede pasar de 60 ni el Extra de 15. */
  const run2 = nuevaRun({ semilla:"DK-TOPES" });
  ponerStarter(run2, DECKS["yugi-starter-a"]);
  const relleno = cat.porRareza("C").slice(0, 40);
  alBinder(run2, [...relleno, ...relleno, ...relleno], cat);
  for(const c of [...relleno, ...relleno, ...relleno]) meterEnMazo(run2, c, cat);
  if(run2.mazo.main.length > LIMITES_MAZO.max) mal("el mazo no pasa de 60", `tiene ${run2.mazo.main.length}`);
  else ok(`el mazo se para en el máximo (${run2.mazo.main.length} cartas)`);
}

/* ── recompensas de duelo ── */
{
  const run = nuevaRun({ semilla:"DK-PREMIOS" });
  ponerStarter(run, DECKS["yugi-starter-a"]);
  const rng = azarDe(run);
  let bajos = 0, conSinergia = 0, distintas = 0, repetidasInutiles = 0;
  const rarezas = new Map();

  for(let i=0;i<N;i++){
    const acto = 1 + (i % 3);
    const trio = recompensaDuelo(run, cat, rng, { acto });
    if(trio.length !== RECOMPENSA.cuantas) mal("la recompensa son tres cartas", `salieron ${trio.length}`);
    if(!trio.some(x => VALOR_RAREZA[x.rareza] >= RECOMPENSA.suelo)) bajos++;
    if(new Set(trio.map(x=>x.code)).size === trio.length) distintas++;
    const raza = razaDominante(cat, run.mazo.main);
    if(trio[0] && cat.esMonstruo(trio[0].code) && cat.raza(trio[0].code) === raza) conSinergia++;
    for(const x of trio){
      rarezas.set(x.rareza, (rarezas.get(x.rareza) ?? 0) + 1);
      if(copiasQueTengo(run, x.code) >= cat.tope(x.code)) repetidasInutiles++;
    }
  }
  const pct = n => (n*100/N).toFixed(1);
  if(bajos > N*0.02) mal("casi nunca salen tres cartas malas", `pasó el ${pct(bajos)}%`);
  else ok(`tres cartas por debajo del suelo: ${pct(bajos)}% de las veces`);
  if(distintas < N*0.98) mal("las tres cartas de una recompensa son distintas", `solo el ${pct(distintas)}%`);
  else ok("las tres cartas de una recompensa son distintas");
  if(repetidasInutiles) mal("no se ofrecen cartas que ya tienes al máximo", `${repetidasInutiles} veces`);
  else ok("nunca se ofrece una carta que ya tienes al máximo de copias");
  ok(`la casilla de sinergia acierta el tipo el ${pct(conSinergia)}% de las veces`);
  console.log("     rarezas ofrecidas:", [...rarezas.entries()].sort((a,b)=>b[1]-a[1])
    .map(([k,v])=>`${k} ${(v*100/(N*3)).toFixed(0)}%`).join(" · "));
}

/* ── packs ── */
{
  const run = nuevaRun({ semilla:"DK-PACKS" });
  ponerStarter(run, DECKS["yugi-starter-a"]);
  const rng = azarDe(run);
  let malTamaño = 0, sinTipo = 0, urs = 0, packs = 0;
  const raza = razaDominante(cat, run.mazo.main);
  const porFamilia = new Map();

  for(let i=0;i<N;i++){
    const fam = FAMILIAS[i % FAMILIAS.length].id;
    const acto = 1 + (i % 3);
    const pack = abrirPack(run, cat, rng, { familia:fam, acto });
    packs++;
    if(pack.length !== PACK.length) malTamaño++;
    const tipo = pack.find(x=>x.casilla==="TIPO");
    if(!tipo || !cat.esMonstruo(tipo.code) || (raza && cat.raza(tipo.code)!==raza)) sinTipo++;
    urs += pack.filter(x=>x.rareza==="UR").length;
    const dela = pack.filter(x=>x.casilla==="FAMILIA")
                     .every(x => cat.familias[fam].includes(x.code));
    if(!dela) porFamilia.set(fam, (porFamilia.get(fam)??0)+1);
  }
  if(malTamaño) mal("todos los packs traen diez cartas", `${malTamaño} no`);
  else ok(`todos los packs traen ${PACK.length} cartas`);
  if(sinTipo) mal("la casilla 3 es siempre un monstruo de tu tipo", `falló ${sinTipo} veces`);
  else ok("la casilla 3 es siempre un monstruo del tipo que más juegas");
  if(porFamilia.size) mal("las casillas de familia son de la familia elegida", [...porFamilia.keys()].join(","));
  else ok("las casillas de familia son siempre de la familia que elegiste");
  ok(`cartas UR por pack: ${(urs/packs).toFixed(2)}`);
  if(urs/packs > 1.5) mal("un pack no debería ser una lluvia de cartas gordas", `${(urs/packs).toFixed(2)} por pack`);
}

/* ── morralla ── */
{
  const rng = rngDeSemilla("DK-BAUL");
  const bulk = morralla(cat, rng, 40);
  if(bulk.length !== 40) mal("el baúl da 40 cartas");
  else if(bulk.some(c => cat.rareza(c) !== "C")) mal("el baúl es solo morralla");
  else ok("el baúl del evento da 40 cartas de morralla legales");
}

/* ── reproducible ── */
{
  const uno = () => {
    const run = nuevaRun({ semilla:"DK-IGUAL" });
    ponerStarter(run, DECKS["yugi-starter-b"]);
    const rng = azarDe(run);
    return JSON.stringify([recompensaDuelo(run, cat, rng, {acto:2}),
                           abrirPack(run, cat, rng, {familia:"DRAGON", acto:2})]);
  };
  if(uno() !== uno()) mal("la misma semilla da las mismas recompensas");
  else ok("la misma semilla da exactamente las mismas recompensas y packs");
}

console.log(fallos ? `\n${fallos} fallo(s)\n` : "\nTodo correcto\n");
process.exit(fallos ? 1 : 0);
