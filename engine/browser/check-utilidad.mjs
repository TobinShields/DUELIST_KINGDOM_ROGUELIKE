/* ════════════════════════════════════════════════════════════════
   MERCADER, CAMPAMENTO Y EVENTOS

   Estos nodos tocan el inventario y las fichas, o sea las dos cosas que
   pueden dejar una run en un estado imposible. Lo que se comprueba:

   · que el mercader COBRE de verdad (y del binder, nunca del mazo);
   · que no ofrezca recetas que no te puedes permitir;
   · que el campamento no acumule vida hasta lo absurdo y que solo
     devuelva fichas que perdiste;
   · que un evento no te deje con fichas negativas ni te dé cartas que
     no puedes usar;
   · que todo salga igual con la misma semilla.

   Uso:  node check-utilidad.mjs
   ════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";
import { crearCatalogo } from "./src/story/catalogo.js";
import { nuevaRun, azarDe } from "./src/story/estado.js";
import { alBinder, ponerStarter, copiasQueTengo } from "./src/story/coleccion.js";
import * as recompensas from "./src/story/recompensas.js";
import { recetasDisponibles, ofertaMercader, pagarMercader, inventario,
         opcionesCampamento, acampar, lpDelDuelo, gastarBuff,
         elegirEvento, aplicarEvento } from "./src/story/utilidad.js";
import { CAMPAMENTO } from "./src/story/balance.js";

const D = "../data/";
const leer = f => JSON.parse(readFileSync(D+f, "utf-8"));
const cat = crearCatalogo({
  pools: leer("story/cards.json"), db: leer("pool_cards.json"),
  limites: leer("goat-limites.json"), pool: leer("goat-pool.json"),
  nombres: leer("pool_texts.json"),
});
const DECKS   = leer("story/decks.json");
const EVENTOS = leer("story/eventos.json");

let fallos = 0;
const ok  = t => console.log("  ✓ " + t);
const mal = (t,d="") => { fallos++; console.log("  ✗ " + t + (d?"   "+d:"")); };

console.log("\n═══ MODO HISTORIA · mercader, campamento y eventos ═══\n");

const runNueva = (semilla="DK-UTIL") => {
  const r = nuevaRun({ semilla });
  ponerStarter(r, DECKS["yugi-starter-a"]);
  return r;
};

/* ── mercader ── */
{
  const run = runNueva();
  const rng = azarDe(run);
  let recetas = recetasDisponibles(run, cat);
  if(recetas.some(r=>r.puede)) mal("con el binder vacío no se puede comprar nada");
  else ok("con el binder vacío el mercader no ofrece nada");

  alBinder(run, recompensas.morralla(cat, rng, 30), cat);
  recetas = recetasDisponibles(run, cat);
  const bulk = recetas.find(r=>r.id==="morralla");
  if(!bulk?.puede) mal("con 30 cartas de morralla se puede pagar la receta de 10");
  else ok("con morralla en el binder se abren las recetas que se pueden pagar");

  const antes = run.binder.length;
  const oferta = ofertaMercader(run, cat, rng, bulk);
  if(oferta.length !== 3) mal("el mercader ofrece tres cartas", `ofreció ${oferta.length}`);
  else if(oferta.some(c=>cat.rareza(c)!=="R")) mal("la receta de morralla da cartas R");
  else ok("la receta de morralla ofrece tres cartas R para elegir");

  const pago = pagarMercader(run, cat, bulk, oferta[0]);
  if(!pago.ok) mal("la receta se cobra", pago.motivo);
  else if(run.binder.length !== antes - 10 + 1)
    mal("cobra diez cartas y da una", `el binder pasó de ${antes} a ${run.binder.length}`);
  else ok("cobra diez cartas del binder y mete la elegida");

  /* El mazo no se toca ni por asomo. */
  const mazoAntes = JSON.stringify(run.mazo);
  pagarMercader(run, cat, bulk, oferta[1]);
  if(JSON.stringify(run.mazo) !== mazoAntes) mal("el mercader NUNCA cobra del mazo");
  else ok("el mercader nunca cobra cartas del mazo, solo del binder");

  /* La receta de prestigio es una vez por visita. */
  const run2 = runNueva("DK-PRESTIGIO");
  alBinder(run2, [...cat.porRareza("SR").slice(0,2), ...cat.porRareza("R").slice(0,2)], cat);
  const r2 = recetasDisponibles(run2, cat).find(r=>r.id==="prestigio");
  if(!r2?.puede) mal("con 2 SR y 2 R se puede pagar la receta de prestigio");
  else ok("la receta de prestigio se abre con 2 SR y 2 R");
  const r3 = recetasDisponibles(run2, cat, { prestigio:1 }).find(r=>r.id==="prestigio");
  if(r3?.puede) mal("la receta de prestigio es una vez por visita");
  else ok("la receta de prestigio se agota tras usarla en la visita");
}

/* ── campamento ── */
{
  const run = runNueva("DK-CAMPA");
  const rng = azarDe(run);
  const ops = opcionesCampamento(run);
  if(ops.find(o=>o.id==="ficha").puede) mal("sin fichas perdidas no se puede recuperar ninguna");
  else ok("sin fichas perdidas, esa opción sale bloqueada");

  acampar(run, cat, rng, "fortificar");
  if(lpDelDuelo(run) !== 8000 + CAMPAMENTO.fortificar.lpExtra)
    mal("fortificar da 1000 de vida extra", `da ${lpDelDuelo(run)}`);
  else ok(`fortificar deja el duelo en ${lpDelDuelo(run)} puntos de vida`);

  acampar(run, cat, rng, "fortificar");
  if(lpDelDuelo(run) > 8000 + CAMPAMENTO.fortificar.lpExtra)
    mal("fortificar NO se acumula", `da ${lpDelDuelo(run)}`);
  else ok("fortificar no se acumula: repetirlo solo renueva la duración");

  for(let i=0;i<CAMPAMENTO.fortificar.duelos;i++) gastarBuff(run);
  if(lpDelDuelo(run) !== 8000) mal("el buff se acaba a los tres duelos", `sigue en ${lpDelDuelo(run)}`);
  else ok("el buff se gasta en tres duelos y vuelve a 8000");

  /* Refinar: sacrifica y sube de escalón, del mismo palo. */
  const run2 = runNueva("DK-REFINAR");
  const rng2 = azarDe(run2);
  const monstruoC = cat.porRareza("C").find(c=>cat.esMonstruo(c));
  alBinder(run2, [monstruoC], cat);
  const ref = acampar(run2, cat, rng2, "refinar", { carta:monstruoC });
  if(!ref.ok) mal("refinar funciona", ref.motivo);
  else if(ref.opciones.some(c=>cat.rareza(c)!=="R")) mal("refinar sube un escalón exacto");
  else if(ref.opciones.some(c=>cat.categoria(c)!=="MONSTRUO"))
    mal("refinar un monstruo ofrece monstruos");
  else if(run2.binder.includes(monstruoC)) mal("la carta sacrificada desaparece del binder");
  else ok("refinar un monstruo C ofrece tres monstruos R y se come el sacrificio");
}

/* ── eventos ── */
{
  const run = runNueva("DK-EVENTOS");
  const rng = azarDe(run);
  const vistos = new Set();
  for(let i=0;i<5;i++){
    const ev = elegirEvento(run, EVENTOS, rng, { acto:1 });
    vistos.add(ev.id);
    run.historial.push({ tipo:"EVENTO", evento:ev.id });
  }
  if(vistos.size < 4) mal("los eventos no se repiten mientras queden sin ver", `salieron ${vistos.size} distintos`);
  else ok(`no se repiten eventos mientras queden sin ver (${vistos.size} distintos de 5)`);

  /* Todos los eventos del catálogo tienen que poder aplicarse sin
     reventar y sin dejar el estado en algo imposible. */
  let malos = 0;
  for(const ev of EVENTOS){
    for(const op of ev.opciones){
      const r = runNueva("DK-EV-"+ev.id);
      r.chips = 3;
      const rr = azarDe(r);
      let res;
      try{ res = aplicarEvento(r, cat, rr, op, { recompensas }); }
      catch(e){ malos++; mal(`el evento ${ev.id} revienta`, e.message); continue; }
      if(r.chips < 0) { malos++; mal(`el evento ${ev.id} deja fichas negativas`); }
      for(const c of res.cartas ?? [])
        if(copiasQueTengo(r, c) > cat.tope(c)){ malos++; mal(`el evento ${ev.id} da copias de más de ${cat.nombre(c)}`); }
    }
  }
  if(!malos) ok(`los ${EVENTOS.length} eventos y sus opciones se aplican sin dejar nada imposible`);

  /* El baúl da morralla de verdad. */
  const r = runNueva("DK-BAUL2");
  const rr = azarDe(r);
  const baul = EVENTOS.find(e=>e.id==="baul");
  const res = aplicarEvento(r, cat, rr, baul.opciones[0], { recompensas });
  if(res.cartas.length !== 40) mal("el baúl mete 40 cartas", `metió ${res.cartas.length}`);
  else if(r.binder.length !== 40) mal("las 40 acaban en el binder");
  else ok("el baúl del evento mete 40 cartas de morralla en el binder");
}

/* ── reproducible ── */
{
  const uno = () => {
    const run = runNueva("DK-REPRO");
    const rng = azarDe(run);
    alBinder(run, recompensas.morralla(cat, rng, 25), cat);
    const receta = recetasDisponibles(run, cat).find(r=>r.id==="morralla");
    const ev = elegirEvento(run, EVENTOS, rng, { acto:1 });
    return JSON.stringify([ofertaMercader(run, cat, rng, receta), ev.id]);
  };
  if(uno() !== uno()) mal("la misma semilla da el mismo mercader y el mismo evento");
  else ok("la misma semilla da el mismo mercader y el mismo evento");
}

console.log(fallos ? `\n${fallos} fallo(s)\n` : "\nTodo correcto\n");
process.exit(fallos ? 1 : 0);
