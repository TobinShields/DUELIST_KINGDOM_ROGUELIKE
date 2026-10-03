/* ════════════════════════════════════════════════════════════════
   UNA RUN ENTERA, DE PRINCIPIO A FIN

   Las piezas del modo historia ya están probadas por separado. Esto
   prueba la máquina completa: se juegan cientos de runs de punta a
   punta —eligiendo camino y opciones al azar, y ganando o perdiendo los
   duelos con una moneda— y se comprueba que la partida NUNCA se queda
   en un estado sin salida.

   Es la comprobación que caza lo que ninguna otra ve: un nodo del que no
   se puede salir, un mazo que se vuelve ilegal a mitad de run, una
   recompensa que no cabe, o una run que llega al castillo sin poder
   clasificarse y sin poder morirse.

   Uso:  node check-run.mjs [cuántas runs]
   ════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";
import { crearCatalogo } from "./src/story/catalogo.js";
import { crearHistoria } from "./src/story/historia.js";
import { crearAlmacen } from "./src/story/estado.js";
import { revisarMazo, meterEnMazo } from "./src/story/coleccion.js";
import { rngDeSemilla, semillaTexto } from "./src/story/rng.js";

const D = "../data/";
const leer = f => JSON.parse(readFileSync(D+f, "utf-8"));
const cat = crearCatalogo({
  pools: leer("story/cards.json"), db: leer("pool_cards.json"),
  limites: leer("goat-limites.json"), pool: leer("goat-pool.json"),
  nombres: leer("pool_texts.json"),
});
const DECKS = leer("story/decks.json");
const DATOS = leer("story/personajes.json");
const EVENTOS = leer("story/eventos.json");
const MAZOS = leer("mazos.json");

let fallos = 0;
const ok  = t => console.log("  ✓ " + t);
const mal = (t,d="") => { fallos++; console.log("  ✗ " + t + (d?"   "+d:"")); };
const N = Number(process.argv[2] ?? 300);

console.log(`\n═══ MODO HISTORIA · ${N} runs completas ═══\n`);

function almacenDePrueba(){
  const mem = new Map();
  return crearAlmacen({ getItem:k=>mem.get(k)??null, setItem:(k,v)=>mem.set(k,v),
                        removeItem:k=>mem.delete(k) });
}

/* Un jugador de mentira: elige camino al azar, se queda la primera carta
   de cada recompensa, abre packs de una familia al azar y gana los
   duelos con la probabilidad que se le diga. */
function jugarRun(semilla, probGanar, r){
  const H = crearHistoria({ datos:DATOS, decks:DECKS, eventos:EVENTOS, cat,
                            almacen:almacenDePrueba(), mazosDelSimulador:MAZOS });
  /* LOS CINCO PERSONAJES, no solo Yugi. Cada uno tiene su starter y su
     torre —que excluye al que juegas—, así que una run de Kaiba recorre
     un camino distinto al final. Si algo se rompe solo para uno de los
     cinco, aquí sale. */
  const quien = r.uno(DATOS.jugables ?? [{id:"yugi"}]);
  const starter = r.uno(quien.starters ?? ["yugi-starter-a"]);
  H.empezar({ semilla, personaje:quien.id, starter });
  const traza = { duelos:0, nodos:0, packs:0, premios:0, eventos:0,
                  nodosDuelo:new Set(),
                  personaje:quien.id, torre:[], preparaciones:0 };
  let ilegal = null;

  for(let paso=0; paso<60; paso++){
    const est = H.estado();
    if(est.terminada) break;
    const ops = H.opciones();
    if(!ops.length) break;                    // se acabó el mapa
    const nodo = ops[r.entero(ops.length)];
    let carga = H.entrar(nodo.id);
    traza.nodos++;

    if(carga.error) return { error:carga.error };
    switch(carga.tipo){
      /* La parada de preparación del castillo: eliges UNA utilidad y el
         nodo pasa a comportarse como ella. */
      case "PREPARACION": {
        traza.preparaciones++;
        const cual = r.uno(carga.opciones ?? ["PACK"]);
        carga = H.elegirPreparacion(cual);
        if(!carga) return { error:"la preparación no devolvió nodo" };
        continue;
      }
      case "DUELO": case "ELITE": case "JEFE": {
        if(!carga.rival) return { error:`nodo ${carga.tipo} sin rival` };
        /* Los peldaños de la torre se apuntan para comprobar el orden. */
        if(nodo.torre) traza.torre.push(nodo.torre);
        if(!carga.mazoRival?.main?.length) return { error:`${carga.rival.nombre} sin mazo` };
        if(carga.problemas.length) ilegal = ilegal ?? carga.problemas[0];
        const ganado = r() < probGanar;
        const res = H.resolverDuelo({ ganado, rivalId:carga.rival.id,
                                      elite:carga.tipo==="ELITE" });
        traza.duelos++;
        traza.nodosDuelo.add(nodo.id);
        if(res.premio?.length){ H.cogerPremio(res.premio[0].code); traza.premios++; }
        break;
      }
      case "PACK": {
        const fam = carga.familias[r.entero(carga.familias.length)].id;
        const cartas = H.abrirPack(fam);
        if(cartas.length !== 10) return { error:`pack de ${cartas.length} cartas` };
        traza.packs++;
        break;
      }
      case "MERCADER": {
        const puede = carga.recetas.filter(x=>x.puede);
        let hecho = false;
        if(puede.length){
          const receta = puede[r.entero(puede.length)];
          const oferta = H.ofertaDe(receta.id);
          if(oferta.length) hecho = !!H.comerciar(receta.id, oferta[0])?.ok;
        }
        if(!hecho) H.saltarNodo();      // no hay nada que cambiar: se sigue
        break;
      }
      case "CAMPAMENTO": {
        const puede = carga.opciones.filter(o=>o.puede && o.id!=="refinar");
        const hecho = puede.length && H.acampar(puede[r.entero(puede.length)].id)?.ok;
        if(!hecho) H.saltarNodo();
        break;
      }
      case "EVENTO": {
        const op = carga.evento.opciones[r.entero(carga.evento.opciones.length)];
        H.elegirEnEvento(op);
        traza.eventos++;
        break;
      }
    }
    /* Meter en el mazo lo que se pueda: un jugador de verdad lo hace, y
       así se prueba que el editor aguanta cientos de cambios. */
    if(H.run.binder.length > 3 && r() < 0.5){
      const c = H.run.binder[r.entero(H.run.binder.length)];
      meterEnMazo(H.run, c, cat);
    }
    if(revisarMazo(H.run, cat).length && !ilegal) ilegal = revisarMazo(H.run, cat)[0];
  }
  return { estado:H.estado(), traza, ilegal, run:H.run };
}

/* ── cientos de runs ── */
{
  const r = rngDeSemilla("DK-RUNS");
  let errores = 0, ilegales = 0, atascadas = 0, ganadas = 0, muertas = 0;
  const duelos = [], nodos = [], duelosNodo = [];

  for(let i=0;i<N;i++){
    const prob = 0.35 + r()*0.45;                 // jugadores de todo tipo
    const res = jugarRun(semillaTexto(r), prob, r);
    if(res.error){ errores++; if(errores<=3) mal("una run se rompe", res.error); continue; }
    if(res.ilegal){ ilegales++; if(ilegales<=3) mal("el mazo se vuelve ilegal", res.ilegal); }
    duelos.push(res.traza.duelos);
    duelosNodo.push(res.traza.nodosDuelo.size);
    duelosNodo.push(res.traza.nodosDuelo.size); nodos.push(res.traza.nodos);
    if(res.estado.ganada) ganadas++;
    else if(res.estado.chips <= 0) muertas++;
    else atascadas++;
  }
  const media = a => a.length ? (a.reduce((s,x)=>s+x,0)/a.length).toFixed(1) : "—";
  if(!errores) ok(`las ${N} runs llegan al final sin romperse`);
  if(!ilegales) ok("el mazo sigue siendo legal durante toda la run");
  ok(`nodos por run: ${media(nodos)} · duelos por run: ${media(duelos)}`);
  ok(`desenlace: ${Math.round(ganadas*100/N)}% ganadas · ${Math.round(muertas*100/N)}% sin fichas` +
     ` · ${Math.round(atascadas*100/N)}% llegan al final del mapa sin ganar`);

  /* ══ DUELOS JUGADOS ≠ NODOS DE DUELO ══
     Desde que perder no completa el nodo, un duelo perdido se REPITE:
     esa es la regla, y significa que "duelos jugados" cuenta INTENTOS,
     no casillas. Con la mitad de derrotas salen dos intentos por nodo y
     el número se dobla sin que nada esté mal.

     Lo que hay que vigilar es la forma de la run —cuántos nodos de duelo
     tiene— y que los intentos no se disparen, que sería señal de que la
     dificultad se ha vuelto un muro. */
  const dm = Number(media(duelos));
  const nodosDuelo = Number(media(duelosNodo));
  ok(`nodos de duelo por run: ${nodosDuelo} · intentos: ${dm}`);
  if(nodosDuelo < 5 || nodosDuelo > 12)
    mal("los nodos de duelo por run se van del objetivo", `son ${nodosDuelo}`);
  else if(dm > nodosDuelo * 2.6)
    mal("se repiten demasiados duelos: la dificultad puede ser un muro",
        `${dm} intentos para ${nodosDuelo} nodos`);
  else ok(`los duelos jugados están en el objetivo (${dm})`);
}

/* ── un jugador que gana siempre CLASIFICA y llega a Pegasus ── */
{
  const r = rngDeSemilla("DK-CAMPEON");
  let clasificados = 0, lleganAPegasus = 0, ganan = 0;
  for(let i=0;i<40;i++){
    const res = jugarRun(semillaTexto(r), 1.0, r);
    if(res.error) continue;
    if(res.run.clasificado) clasificados++;
    if(res.run.historial.some(h=>h.tipo==="JEFE" && h.nodo?.startsWith("a2"))) lleganAPegasus++;
    if(res.estado.ganada) ganan++;
  }
  if(clasificados < 40) mal("ganándolo todo siempre se llega a las 10 fichas", `${clasificados}/40`);
  else ok("quien gana todos sus duelos siempre se clasifica para el castillo");
  if(ganan < 40) mal("ganándolo todo se gana la run", `${ganan}/40`);
  else ok("quien gana todos sus duelos termina la run y desbloquea la maestría");
}

/* ── un jugador que pierde siempre se queda sin fichas y se acaba ── */
{
  const r = rngDeSemilla("DK-PUPAS");
  let muertas = 0;
  for(let i=0;i<40;i++){
    const res = jugarRun(semillaTexto(r), 0.0, r);
    if(res.error) continue;
    if(res.estado.chips <= 0 && res.estado.terminada) muertas++;
  }
  if(muertas < 40) mal("perdiéndolo todo la run se acaba", `${muertas}/40`);
  else ok("quien pierde todos sus duelos se queda sin fichas y la run termina");
}

/* ── continuar donde lo dejaste ── */
{
  const almacen = almacenDePrueba();
  const H = crearHistoria({ datos:DATOS, decks:DECKS, eventos:EVENTOS, cat, almacen,
                            mazosDelSimulador:MAZOS });
  H.empezar({ semilla:"DK-SIGUE", starter:"yugi-starter-a" });
  const n = H.opciones()[0];
  H.entrar(n.id);
  const antes = JSON.stringify(H.estado());

  const H2 = crearHistoria({ datos:DATOS, decks:DECKS, eventos:EVENTOS, cat, almacen,
                             mazosDelSimulador:MAZOS });
  const vuelto = H2.continuar();
  if(!vuelto) mal("se puede continuar una partida guardada");
  else if(JSON.stringify(vuelto) !== antes) mal("continuar deja el estado exactamente igual");
  else ok("cerrar y volver deja la run exactamente donde estaba");
}

/* ── la torre, dentro de runs de verdad ──
   Que el orden salga bien al generar el mapa ya lo comprueba
   `check-rivales`. Aquí interesa lo otro: que se pueda ATRAVESAR jugando
   —con sus recompensas, sus paradas de preparación y su guardado— y que
   Pegasus sea siempre el último al que te enfrentas. */
{
  const { torreDeLaRun } = await import("./src/story/balance.js");
  let conTorre = 0, desordenadas = 0, sinPegasus = 0, sinPreparacion = 0;
  for(let i=0;i<120;i++){
    const r = rngDeSemilla("DK-TORRE"+i);
    const res = jugarRun("DK-TORRE"+i, 1, r);       // gana siempre: llega al castillo
    if(!res.traza?.torre?.length) continue;
    conTorre++;
    const esperado = torreDeLaRun(res.traza.personaje);
    const vistos = res.traza.torre;
    /* Los peldaños jugados tienen que ser un prefijo del orden fijo. */
    if(vistos.join().length && esperado.join().indexOf(vistos.join()) !== 0) desordenadas++;
    if(vistos.includes("pegasus") && vistos[vistos.length-1] !== "pegasus") sinPegasus++;
    if(vistos.length >= 3 && !res.traza.preparaciones) sinPreparacion++;
  }
  if(!conTorre) mal("alguna run llega a la torre", "ninguna de 120 llegó al castillo");
  else if(desordenadas) mal("la torre se juega en su orden", `${desordenadas} desordenadas`);
  else if(sinPegasus) mal("Pegasus es el último al que te enfrentas", `${sinPegasus} veces no`);
  else if(sinPreparacion) mal("hay parada de preparación antes de Pegasus", `${sinPreparacion} sin ella`);
  else ok(`${conTorre} runs atraviesan la torre en orden, con preparación y Pegasus al final`);
}

/* ── perder en la torre no te deja subir ──
   Cada peldaño del castillo es obligatorio. E lo reportó tal cual: "al
   perder la run no se acaba, te deja continuar como si hubieses
   ganado". La causa era que los peldaños son nodos ELITE y la regla de
   la revancha solo cubría a los JEFE. */
{
  const H = crearHistoria({ datos:DATOS, decks:DECKS, eventos:EVENTOS, cat,
                            almacen:almacenDePrueba(), mazosDelSimulador:MAZOS });
  H.empezar({ semilla:"DK-PERDER-TORRE", personaje:"yugi" });
  let peldaño = null;
  for(let i=0;i<40 && !peldaño;i++){
    const ops = H.opciones(); if(!ops.length) break;
    const n = ops[0], c = H.entrar(n.id);
    if(n.torre){ peldaño = n; break; }
    if(["DUELO","ELITE","JEFE"].includes(c.tipo)){
      const res = H.resolverDuelo({ ganado:true, rivalId:c.rival?.id, elite:c.tipo==="ELITE" });
      if(res.premio?.length) H.cogerPremio(res.premio[0].code);
    }
    else if(c.tipo==="PREPARACION"){ H.elegirPreparacion("PACK"); H.abrirPack("ARCANE"); }
    else if(c.tipo==="PACK") H.abrirPack("ARCANE");
    else if(c.tipo==="CAMPAMENTO"){ if(!H.acampar("lp")?.ok) H.saltarNodo(); }
    else if(c.tipo==="EVENTO") H.elegirEnEvento(c.evento.opciones[0]);
    else { const nd = H.nodoActual(); if(nd) nd.resuelto = true; }
  }
  if(!peldaño) mal("una run ganándolo todo llega a la torre");
  else {
    const carga = H.entrar(peldaño.id);
    const c0 = H.estado().chips;
    H.resolverDuelo({ ganado:false, rivalId:carga.rival?.id, elite:true });
    const c1 = H.estado().chips;
    /* E, 03-10: en el castillo las estrellas tienen que pesar. Perder un
       peldaño quita DOS y ganarlo da UNA (`CHIPS.torre`). */
    if(carga.apuesta?.gana !== 1 || carga.apuesta?.pierde !== -2)
      mal("el castillo enseña la apuesta del castillo (+1 / −2)", JSON.stringify(carga.apuesta));
    else if(c0 - c1 !== Math.min(2, c0))
      mal("perder un peldaño quita dos estrellas", `${c0} → ${c1}`);
    else ok(`perder un peldaño del castillo quita dos estrellas (${c0} → ${c1})`);
    const ops = H.opciones();
    if(!(ops.length === 1 && ops[0].id === peldaño.id && ops[0].revancha))
      mal("perder un peldaño de la torre obliga a repetirlo",
          `opciones tras perder: ${ops.map(o=>o.torre ?? o.tipo).join(", ")}`);
    else {
      /* Y perdiendo hasta quedarse sin fichas, la run se acaba y NO
         cuenta como ganada. */
      for(let i=0;i<15 && !H.estado().terminada;i++){
        H.entrar(H.opciones()[0].id);
        H.resolverDuelo({ ganado:false, rivalId:carga.rival?.id, elite:true });
      }
      const est = H.estado();
      if(!est.terminada) mal("perder hasta cero fichas termina la run", `quedan ${est.chips}`);
      else if(est.ganada) mal("una run perdida NO cuenta como ganada");
      else ok("perder en la torre obliga a la revancha, y a cero fichas la run termina perdida");
    }
  }
}

/* ── la última oportunidad se juega a tier 2 ──
   M9 (02-10): los duelos que da la isla cuando se acaba el mapa sin las
   diez fichas nacen a tier 2, pero `entrar` los subía a 3 si ya le
   habías ganado a ese duelista —que a esas alturas es casi siempre—.
   Medido en runs completas, ese bucle se ganaba el 30% de las veces: una
   ruina asegurada. Aquí se llega a la puerta del castillo sin
   clasificar, habiéndole ganado ya a todos, y se mira el tier. */
{
  const H = crearHistoria({ datos:DATOS, decks:DECKS, eventos:EVENTOS, cat,
                            almacen:almacenDePrueba(), mazosDelSimulador:MAZOS });
  H.empezar({ semilla:"DK-ULTIMA", personaje:"yugi" });
  const run = H.run;
  const acto = run.mapa.actos[1];
  const jefe = acto.columnas[acto.columnas.length-1][0];
  jefe.resuelto = true; run.resueltos.push(jefe.id);
  run.pos = { acto:1, col:jefe.col, id:jefe.id };
  run.chips = 5; run.clasificado = false;
  run.derrotados = DATOS.personajes.map(p => p.id);
  const ops = H.opciones();
  const tiers = ops.filter(o => o.ultimaOportunidad).map(o => H.entrar(o.id).rival?.tier);
  if(!tiers.length) mal("sin clasificar, la puerta del castillo ofrece duelos de la isla");
  else if(tiers.some(t => t !== 2)) mal("la última oportunidad se juega a tier 2", `salió ${tiers.join(", ")}`);
  else ok("la última oportunidad se juega a tier 2 aunque ya les hayas ganado");
}

console.log(fallos ? `\n${fallos} fallo(s)\n` : "\nTodo correcto\n");
process.exit(fallos ? 1 : 0);
