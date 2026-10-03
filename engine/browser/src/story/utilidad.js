/* ══════════════════════════════════════════════════════════════════
   MERCADER, CAMPAMENTO Y EVENTOS — LOS NODOS QUE NO SON DUELOS

   Un roguelike sin nodos de descanso es una lista de peleas. Estos tres
   son los que convierten el mapa en decisiones:

   · MERCADER: no hay dinero. Se pagan CARTAS. Es lo que le da sentido a
     la morralla que se acumula y a los baúles de cuarenta cartas: diez
     cartas malas valen una buena.
   · CAMPAMENTO: puntos de vida extra, recuperar una ficha perdida o
     mejorar una carta. Solo una de las tres.
   · EVENTOS: un retrato, dos o tres frases y una decisión. Todo sale de
     `engine/data/story/eventos.json`, así que añadir uno es añadir una
     entrada, no escribir código.
   ══════════════════════════════════════════════════════════════════ */
import { MERCADER, CAMPAMENTO } from "./balance.js";
import { alBinder, copiasQueTengo } from "./coleccion.js";
import { resolverDuelo, recuperarChip } from "./estado.js";
import { VALOR_RAREZA, RAREZAS } from "./catalogo.js";

/* ══════════ MERCADER ══════════ */

/* Lo que tienes en el binder, ordenado por rareza y categoría. El mazo
   NO se toca: pagar con cartas que estás jugando sería una forma
   estupenda de dejarte sin mazo por accidente. */
export function inventario(run, cat){
  const por = { C:[], R:[], SR:[], UR:[] };
  for(const c of run.binder) por[cat.rareza(c)].push(c);
  return por;
}

export function recetasDisponibles(run, cat, usadas = {}){
  const inv = inventario(run, cat);
  return MERCADER.recetas.map(r => {
    let puede = false, motivo = "";
    if(r.pide.rareza === "C"){
      if(r.pide.mismaCategoria){
        /* Quince cartas de la MISMA categoría: hay que mirar por
           monstruo/mágica/trampa, no el total. */
        const cuenta = {};
        for(const c of inv.C){ const k = cat.categoria(c); cuenta[k] = (cuenta[k]??0)+1; }
        puede = Object.values(cuenta).some(n => n >= r.pide.n);
        motivo = `te faltan cartas de una misma categoría (${r.pide.n})`;
      } else {
        puede = inv.C.length >= r.pide.n;
        motivo = `tienes ${inv.C.length} de las ${r.pide.n} que pide`;
      }
    } else if(r.pide.mezcla){
      puede = r.pide.mezcla.every(([rar,n]) => inv[rar].length >= n);
      motivo = "no tienes las cartas que pide";
    } else if(r.pide.mismaRarezaN){
      puede = RAREZAS.some(rar => inv[rar].length >= r.pide.mismaRarezaN);
      motivo = "necesitas dos cartas de la misma rareza";
    }
    const agotada = r.porVisita && (usadas[r.id] ?? 0) >= r.porVisita;
    return { ...r, puede: puede && !agotada,
             motivo: agotada ? "ya la has usado en esta visita" : (puede ? "" : motivo) };
  });
}

/* Qué te ofrece a cambio: tres cartas, eliges una. */
export function ofertaMercader(run, cat, rng, receta, { categoria=null, rareza=null } = {}){
  const filtro = c => copiasQueTengo(run, c) < cat.tope(c);
  let candidatas = [];
  if(receta.da.mismaRareza)  candidatas = cat.porRareza(rareza ?? "R");
  else if(receta.da.rareza === "R+SR") candidatas = [...cat.porRareza("R"), ...cat.porRareza("SR")];
  else candidatas = cat.porRareza(receta.da.rareza);
  if(receta.da.mismaCategoria && categoria)
    candidatas = candidatas.filter(c => cat.categoria(c) === categoria);
  candidatas = candidatas.filter(filtro);
  if(!candidatas.length) candidatas = cat.porRareza("R");
  return rng.coger(candidatas, Math.min(receta.da.elegir ?? 3, candidatas.length));
}

/* Cobrar la receta: se quitan las cartas del binder y entra la elegida.
   Se cobra SIEMPRE lo mismo (las más baratas primero) para que el
   jugador no tenga que ir señalando cartas de una en una. */
/* QUÉ CARTAS te va a cobrar exactamente. Está separado del cobro para
   poder ENSEÑARLO antes: cobrar en silencio, aunque sean las más baratas,
   se siente como un robo. Lo dijo E: "que salgan antes de que me las
   cobre, que sea lo más claro posible". */
export function cartasQuePaga(run, cat, receta, { categoria=null, rareza=null } = {}){
  const inv = inventario(run, cat);
  const quitar = [];
  if(receta.pide.rareza === "C"){
    let pila = inv.C;
    if(receta.pide.mismaCategoria && categoria) pila = pila.filter(c=>cat.categoria(c)===categoria);
    if(pila.length < receta.pide.n) return [];
    quitar.push(...pila.slice(0, receta.pide.n));
  } else if(receta.pide.mezcla){
    for(const [rar, n] of receta.pide.mezcla){
      if(inv[rar].length < n) return [];
      quitar.push(...inv[rar].slice(0, n));
    }
  } else if(receta.pide.mismaRarezaN){
    const rar = rareza ?? RAREZAS.find(r => inv[r].length >= receta.pide.mismaRarezaN);
    if(!rar || inv[rar].length < receta.pide.mismaRarezaN) return [];
    quitar.push(...inv[rar].slice(0, receta.pide.mismaRarezaN));
  }
  return quitar;
}

export function pagarMercader(run, cat, receta, elegida, extra = {}){
  const quitar = cartasQuePaga(run, cat, receta, extra);
  if(!quitar.length) return { ok:false, motivo:"no llegas al precio" };
  for(const c of quitar){
    const i = run.binder.indexOf(c);
    if(i >= 0) run.binder.splice(i, 1);
  }
  alBinder(run, [elegida], cat);
  return { ok:true, pagadas:quitar.length, recibida:elegida };
}

/* ══════════ CAMPAMENTO ══════════ */
export function opcionesCampamento(run){
  return [
    { id:"fortificar", puede:true,
      texto:`+${CAMPAMENTO.fortificar.lpExtra} puntos de vida en los próximos ${CAMPAMENTO.fortificar.duelos} duelos` },
    { id:"ficha", puede: run.chipsPerdidos > 0,
      texto: run.chipsPerdidos > 0 ? "Recuperar una Star Chip perdida"
                                   : "No has perdido ninguna ficha todavía" },
    { id:"refinar", puede: run.binder.length > 0,
      texto:"Sacrificar una carta y elegir entre tres del escalón siguiente" },
  ];
}

export function acampar(run, cat, rng, opcion, { carta=null } = {}){
  if(opcion === "fortificar"){
    /* No se acumula: volver a elegirlo renueva la duración. Acumular
       llevaba a runs con 14.000 de vida, que no es una decisión, es un
       botón de "hazme inmortal". */
    run.buffs.lpExtra = Math.min(CAMPAMENTO.fortificar.lpExtra, CAMPAMENTO.fortificar.topeLP - 8000);
    run.buffs.duelosBuff = CAMPAMENTO.fortificar.duelos;
    return { ok:true, texto:`+${run.buffs.lpExtra} LP durante ${run.buffs.duelosBuff} duelos` };
  }
  if(opcion === "ficha"){
    return recuperarChip(run) ? { ok:true, texto:"Has recuperado una Star Chip" }
                              : { ok:false, motivo:"no has perdido ninguna" };
  }
  if(opcion === "refinar"){
    if(carta == null) return { ok:false, motivo:"elige la carta que sacrificas" };
    const i = run.binder.indexOf(carta);
    if(i < 0) return { ok:false, motivo:"esa carta no está en el binder" };
    const actual = cat.rareza(carta);
    const siguiente = RAREZAS[Math.min(RAREZAS.indexOf(actual)+1, RAREZAS.length-1)];
    /* Del mismo palo: refinar un monstruo te da monstruos. Sin esto,
       sacrificabas un bicho y te ofrecían tres trampas. */
    const mismas = cat.porRareza(siguiente).filter(c =>
      cat.categoria(c) === cat.categoria(carta) &&
      copiasQueTengo(run, c) < cat.tope(c));
    const de = mismas.length ? mismas : cat.porRareza(siguiente);
    run.binder.splice(i, 1);
    return { ok:true, opciones: rng.coger(de, Math.min(3, de.length)),
             sacrificada: carta, subeA: siguiente };
  }
  return { ok:false, motivo:"esa opción no existe" };
}

/* Al empezar un duelo: cuántos puntos de vida de más llevas y gastar un
   turno del buff. */
export function lpDelDuelo(run){
  const extra = run.buffs.duelosBuff > 0 ? run.buffs.lpExtra : 0;
  return 8000 + extra;
}
export function gastarBuff(run){
  if(run.buffs.duelosBuff > 0){
    run.buffs.duelosBuff -= 1;
    if(run.buffs.duelosBuff === 0) run.buffs.lpExtra = 0;
  }
}

/* ══════════ EVENTOS ══════════ */
/* `catalogo` es el JSON de eventos. Se elige uno que no haya salido ya
   en esta run: repetir el mismo evento tres veces mata la ilusión de
   que la isla tiene gente dentro. */
export function elegirEvento(run, catalogo, rng, { acto=1 } = {}){
  const vistos = new Set(run.historial.filter(h=>h.tipo==="EVENTO").map(h=>h.evento));
  const posibles = catalogo.filter(e =>
    (!e.actos || e.actos.includes(acto)) && !vistos.has(e.id));
  const de = posibles.length ? posibles : catalogo;
  return rng.uno(de);
}

/* Aplicar una opción de evento. Los efectos son datos, no código:
   { chips:+1 } { chips:-1 } { cartas:{rareza:"SR",n:1} } { morralla:40 }
   { apuesta:{chips:2} } { mejorarProxima:true } */
export function aplicarEvento(run, cat, rng, opcion, { recompensas } = {}){
  const ef = opcion.efecto ?? {};
  const salida = { texto: opcion.resultado ?? "", cartas:[] };

  if(typeof ef.chips === "number"){
    if(ef.chips > 0){
      run.chips += ef.chips;
      if(run.chips >= 10) run.clasificado = true;
    } else {
      const antes = run.chips;
      run.chips = Math.max(0, run.chips + ef.chips);
      run.chipsPerdidos += antes - run.chips;
      if(run.chips <= 0) run.terminada = true;
    }
    salida.chips = ef.chips;
  }
  if(ef.apuesta){
    /* Doble o nada: se resuelve con el azar de la run, así que la
       semilla decide y no se puede recargar la página para repetirlo. */
    const ganas = rng() < (ef.apuesta.probabilidad ?? 0.5);
    const delta = ganas ? ef.apuesta.chips : -ef.apuesta.chips;
    const r = resolverDuelo(run, { tipo:"DUELO", ganado:ganas,
                                   altaApuesta: ef.apuesta.chips >= 2 });
    salida.apuesta = { ganas, delta, chips:run.chips, detalle:r };
  }
  if(ef.cartas){
    const de = cat.porRareza(ef.cartas.rareza ?? "R")
                  .filter(c => copiasQueTengo(run, c) < cat.tope(c));
    const dadas = rng.coger(de, Math.min(ef.cartas.n ?? 1, de.length));
    alBinder(run, dadas, cat);
    salida.cartas.push(...dadas);
  }
  if(ef.morralla){
    const bulk = recompensas.morralla(cat, rng, ef.morralla);
    alBinder(run, bulk, cat);
    salida.cartas.push(...bulk);
  }
  if(ef.mejorarProxima) run.buffs.mejorarProxima = true;
  return salida;
}
