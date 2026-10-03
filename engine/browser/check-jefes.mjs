/* ════════════════════════════════════════════════════════════════
   LA MANO DE SALIDA DE UN JEFE

   Pegasus perdía contra un mazo inicial SIN mejorar. El motivo no era la
   IA: era que abría sin Toon World y jugaba con nueve cartas muertas.
   La solución es una mecánica de jefe: se le garantizan dos o tres piezas
   de su motor en la mano de salida. No ve tu mano, no roba de más y su
   mazo sigue siendo legal.

   Esto vigila las tres cosas que pueden romperlo, y las tres han fallado
   ya durante el desarrollo:

   1. **El motor no vuelve a barajar.** El orden del array que le pasamos
      ES el orden de robo y el FINAL del array es lo primero que se roba.
      Si algún día eso cambia, la siembra deja de hacer nada — sin dar
      ningún error.
   2. **El sufijo "(GOAT)".** En el pool la carta se llama "Toon Summoned
      Skull (GOAT)". La primera versión comparaba el nombre tal cual, no
      encontraba nada, y el resultado era EXACTAMENTE el mismo que sin
      sembrar: mismo marcador, mismos turnos. Un fallo perfecto.
   3. **Que las cartas sembradas sean distintas.** Abrir con tres Toon
      World es tan malo como abrir sin ninguna.

   Uso:  node check-jefes.mjs
   ════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";
import * as X from "./out/ocgcore.bundle.js";
import { scriptReader } from "./out/scripts.bundle.js";
import { GoatDuel } from "./src/duel.mjs";
import { sembrarManoDeJefe } from "./src/story/personajes.js";
import { rngDeSemilla } from "./src/story/rng.js";

const D = "../data/";
const leer = f => JSON.parse(readFileSync(D+f, "utf-8"));
const raw   = leer("cards.json");
const names = JSON.parse(readFileSync("./out/names.subset.json","utf-8"));
const DECKS = leer("story/decks.json");
const DATOS = leer("story/personajes.json");
const db = new Map();
for(const k in raw){ const c = raw[k]; db.set(c.code, {...c, race:BigInt(c.race)}); }

let fallos = 0;
const ok  = t => console.log("  ✓ " + t);
const mal = (t,d="") => { fallos++; console.log("  ✗ " + t + (d?"   "+d:"")); };
const nombreDe = c => names[c]?.name ?? "";
const canon = t => String(t).replace(/\s*\((GOAT|Pre-errata|Pre-Errata|Anime|Manga)\)\s*$/i,"").trim();

console.log("\n═══ MODO HISTORIA · la mano de salida de los jefes ═══\n");

/* Reparte de verdad y devuelve la mano inicial del jugador 1. */
async function manoDe(mazo, seed){
  const lib  = await X.default({ sync:true });
  const duel = new GoatDuel({ lib, X, cardDb:db, scriptReader, onEvent:()=>{} });
  await duel.create({ deck0:[...DECKS["yugi-starter-a"].main], deck1:mazo,
                      extra0:[], extra1:[], seed:[BigInt(seed),7n,13n,29n] });
  await duel.run();
  return (duel.zones[1][2] ?? []).map(c => nombreDe(c.code));
}

const P = DECKS["pegasus-m0-boss"];

/* ── 1. el orden del array manda ── */
{
  const toon = P.main.find(c => canon(nombreDe(c)) === "Toon World");
  if(!toon){ mal("el mazo de Pegasus lleva Toon World"); }
  else {
    const resto = P.main.filter(c => c !== toon);
    const arriba = [...resto, toon];            // final del array = arriba del mazo
    const abajo  = [toon, ...resto];
    const m1 = await manoDe(arriba, 11);
    const m2 = await manoDe(abajo, 11);
    if(!m1.some(n => canon(n) === "Toon World"))
      mal("el final del array es lo primero que se roba (el motor NO rebaraja)");
    else if(m2.some(n => canon(n) === "Toon World"))
      mal("el principio del array debería quedarse al fondo del mazo");
    else ok("el orden del array es el orden de robo y el motor no rebaraja");
  }
}

/* ── 2. la siembra llega a la mano ── */
{
  const mano = DATOS.pegasus.manoInicial;
  let conMotor = 0, distintas = 0, veces = 12;
  for(let i=0;i<veces;i++){
    const barajado = rngDeSemilla("MEZCLA-"+i).barajar(P.main);
    const sembrado = sembrarManoDeJefe(barajado, mano, rngDeSemilla("SIEMBRA-"+i), nombreDe);
    if(sembrado.length !== P.main.length){ mal("sembrar no cambia el tamaño del mazo"); break; }
    const m = await manoDe(sembrado, 100+i);
    const claves = m.filter(n => mano.cartas.some(x => canon(x) === canon(n)));
    if(claves.length >= (mano.cuantas ?? 2)) conMotor++;
    /* OJO CON MEDIR ESTO EN LA MANO: la segunda Toon World puede llegar
       por robo normal, y eso no es un fallo de la siembra. Lo que hay que
       mirar es lo SEMBRADO, o sea las últimas cartas del array. */
    const puestas = sembrado.slice(-(mano.cuantas ?? 2)).map(c => canon(nombreDe(c)));
    if(new Set(puestas).size === puestas.length) distintas++;
  }
  if(conMotor < veces) mal(`el jefe abre con sus ${mano.cuantas} piezas`, `pasó ${conMotor}/${veces}`);
  else ok(`el jefe abre SIEMPRE con sus ${mano.cuantas} piezas clave (${veces} repartos)`);
  if(distintas < veces) mal("las cartas sembradas son distintas entre sí", `falló ${veces-distintas}`);
  else ok("las cartas sembradas son siempre distintas, nunca tres copias de lo mismo");
}

/* ── 3. el sufijo (GOAT) ──
   La prueba que habría cazado el fallo silencioso: sembrar por un nombre
   que en el pool lleva sufijo y comprobar que se encuentra igual. */
{
  const conSufijo = P.main.find(c => /\(GOAT\)$/.test(nombreDe(c)));
  const nombre = canon(nombreDe(conSufijo));
  const sembrado = sembrarManoDeJefe([...P.main], { cartas:[nombre], cuantas:1 },
                                     rngDeSemilla("SUFIJO"), nombreDe);
  if(canon(nombreDe(sembrado[sembrado.length-1])) !== nombre)
    mal(`sembrar "${nombre}" funciona aunque en el pool se llame "${nombreDe(conSufijo)}"`);
  else ok(`el sufijo (GOAT) no impide sembrar: "${nombre}" se coloca bien`);
}

/* ── 4. sigue siendo un mazo legal ── */
{
  const mano = DATOS.pegasus.manoInicial;
  const sembrado = sembrarManoDeJefe([...P.main], mano, rngDeSemilla("LEGAL"), nombreDe);
  const igual = [...sembrado].sort().join(",") === [...P.main].sort().join(",");
  if(!igual) mal("sembrar solo REORDENA: no añade ni quita cartas");
  else ok("sembrar solo reordena el mazo: las mismas 40 cartas");
}

/* ── 5. el HTML de verdad lo lleva dentro ── */
{
  const html = readFileSync("./out/goat.html","utf-8");
  if(!html.includes("sembrarManoDeJefe")) mal("la función viaja dentro del HTML");
  else if(!html.includes("globalThis.Story = Story")) mal("el HTML expone Story para main.js");
  else if(!/config\?\.manoRival/.test(html)) mal("main.js aplica la mano del jefe al repartir");
  else ok("el HTML lleva la siembra dentro y main.js la aplica al repartir");
}

console.log(fallos ? `\n${fallos} fallo(s)\n` : "\nTodo correcto\n");
process.exit(fallos ? 1 : 0);
