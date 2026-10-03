/* ══════════════════════════════════════════════════════════════════
   EL MAPA DE LA ISLA — GENERADO, PERO NO AL AZAR

   Un mapa puramente aleatorio no sirve: sale una run de siete duelos
   seguidos, o una sin ningún pack, o —lo peor— una en la que es
   imposible juntar diez Star Chips aunque ganes todo. Aquí el azar solo
   decide DENTRO de una plantilla (`ACTOS` en balance.js): cada columna
   tiene una lista de tipos permitidos y el generador elige entre ellos.

   Después se comprueba contra TODOS los caminos posibles (son 2^5 como
   mucho, o sea nada) que:
     · ningún camino llega al jefe sin pasar por un pack;
     · en los actos I y II hay campamento o mercader en todo camino;
     · cada acto tiene entre 2 y 4 duelos;
     · existe al menos un camino que llega a los 10 chips.
   Lo que no cumple se repara; si no se puede reparar, se vuelve a
   generar con la siguiente tirada. Es la diferencia entre "mapa
   procedural" y "mapa jugable".
   ══════════════════════════════════════════════════════════════════ */
import { ACTOS, REGLAS_MAPA, CHIPS, torreDeLaRun } from "./balance.js";

const ES_DUELO = t => t==="DUELO" || t==="ELITE" || t==="JEFE";

/* Cuánto suma cada nodo si lo GANAS. Sale de la tabla de apuestas, no de
   números sueltos por aquí. */
export function chipsQueDa(tipo){
  if(tipo==="DUELO") return CHIPS.duelo.gana;
  if(tipo==="ELITE") return CHIPS.elite.gana;
  if(tipo==="JEFE")  return CHIPS.jefe.gana;
  return 0;
}

/* ── generar un acto ── */
function generarActo(acto, rng, indice, personaje){
  /* ══ LA TORRE NO SE GENERA: SE ESCRIBE ══
     El acto III no es un mapa. Es el torneo del castillo, con el orden
     fijo y sin ramas. Aquí no hay nada que sortear ni que reparar: se
     coloca un peldaño por columna, se quita al personaje que juegas y
     Pegasus cierra. Que esto sea distinto es el punto: el mapa se acaba
     y lo que queda es subir. NO LLEVA ARISTAS a propósito: `siguientes`
     la recorre por columnas, como una escalera. */
  if(acto.torre){
    const orden = torreDeLaRun(personaje);
    let paso = 0;
    /* La plantilla trae un peldaño de más para el Custom. Si esta run
       tiene menos duelistas que peldaños, sobra uno: se descarta en vez
       de dejar una columna sin nadie dentro (eso sería un nodo vacío que
       bloquea la torre). */
    const dePeldaño = acto.columnas.filter(c => c.tipos[0] === "TORRE").length;
    const sobran = Math.max(0, dePeldaño - orden.length);
    let tirados = 0;
    const plantilla = acto.columnas.filter((col, i) => {
      if(col.tipos[0] !== "TORRE" || tirados >= sobran) return true;
      /* Se quita de en medio, no el último: el último es Pegasus. */
      if(i > 0 && i < acto.columnas.length - 2){ tirados++; return false; }
      return true;
    });
    const columnas = plantilla.map((col, c) => {
      const tipo = col.tipos[0];
      const base = { id:`a${indice}c${c}n0`, acto:indice, col:c, fila:0,
                     tipo, resuelto:false };
      if(tipo !== "TORRE") return [base];
      const quien = orden[paso++];
      return [{ ...base, tipo: quien === "pegasus" ? "JEFE" : "ELITE",
                torre: quien, peldaño: paso }];
    });
    return { ...acto, indice, columnas };
  }

  /* ══════════════════════════════════════════════════════════════
     ANCHO VARIABLE, NO SIEMPRE DOS

     Antes toda columna con más de un tipo posible sacaba exactamente 2
     nodos, y desde cualquiera se podía ir a cualquiera de la siguiente:
     el mapa era una cuadrícula y elegir ruta no costaba nada. Ahora el
     ancho lo decide la tirada dentro de lo que permite la plantilla, y
     hay columnas de 1 (paso obligado), 2 y 3.
     ══════════════════════════════════════════════════════════════ */
  const columnas = acto.columnas.map((col, c) => {
    let cuantos;
    if(col.tipos.length === 1) cuantos = 1;            // entrada del acto y jefe
    else {
      /* Un paso obligado de vez en cuando da ritmo: si TODO se bifurca,
         ninguna bifurcación se nota. Y el 3 solo cabe si la plantilla
         ofrece tres tipos distintos. */
      const tirada = rng.entero(100);
      cuantos = tirada < 12 ? 1
              : (col.tipos.length >= 3 && tirada < 52) ? 3 : 2;
    }
    const tipos = cuantos === 1
      ? [rng.uno(col.tipos)]
      : rng.coger(col.tipos, Math.min(cuantos, col.tipos.length));
    /* Si la plantilla no daba tipos suficientes para el ancho pedido, se
       repite: el ancho manda para la forma del mapa. */
    while(tipos.length < cuantos) tipos.push(rng.uno(col.tipos));
    return tipos.map((tipo, f) => ({
      id: `a${indice}c${c}n${f}`,
      acto: indice, col: c, fila: f,
      tipo, suave: !!col.suave,
      resuelto: false,
      salidas: [],                 // se rellena en `tejer`
    }));
  });
  tejer(columnas, rng);
  return { ...acto, indice, columnas };
}

/* ══════════════════════════════════════════════════════════════════
   LAS ARISTAS: DE DÓNDE SALE EL COSTE DE OPORTUNIDAD

   Cada nodo lleva sus `salidas` escritas. Un nodo con UNA sola salida es
   lo que hace que elegir una rama cierre la otra: si vas al Elite, el
   Camp de al lado deja de estar a tu alcance, no porque el juego te lo
   prohíba sino porque no hay camino.

   Se teje por posición para que no salgan cruces absurdos: cada nodo
   mira a la parte de la columna siguiente que le queda enfrente, y solo
   se añade un vecino de vez en cuando (eso da las convergencias). Al
   final se garantizan dos cosas o el mapa no vale:
     · todo nodo tiene al menos una salida;
     · todo nodo de la columna siguiente tiene al menos una entrada
       (si no, sería inalcanzable y el mapa mentiría).
   ══════════════════════════════════════════════════════════════════ */
function tejer(columnas, rng){
  for(let c = 0; c < columnas.length - 1; c++){
    const de = columnas[c], a = columnas[c + 1];
    for(const n of de) n.salidas = [];
    /* 1 · cada origen mira a su enfrente. */
    for(let i = 0; i < de.length; i++){
      const centro = Math.min(a.length - 1,
        Math.floor(((i + 0.5) / de.length) * a.length));
      de[i].salidas.push(a[centro].id);
      /* 2 · a veces, también al vecino: eso abre abanicos y crea
         convergencias más adelante. Cuanto más estrecha es la columna
         de origen, más falta hace abrir. */
      const abre = de.length === 1 ? 92 : de.length < a.length ? 70 : 26;
      if(rng.entero(100) < abre){
        const vecinos = [centro - 1, centro + 1].filter(k => k >= 0 && k < a.length);
        const v = vecinos.length ? vecinos[rng.entero(vecinos.length)] : null;
        if(v != null && !de[i].salidas.includes(a[v].id)) de[i].salidas.push(a[v].id);
      }
    }
    /* 3 · ningún destino puede quedarse sin entrada. */
    for(let j = 0; j < a.length; j++){
      if(de.some(n => n.salidas.includes(a[j].id))) continue;
      let mejor = 0, dist = Infinity;
      for(let i = 0; i < de.length; i++){
        const p = Math.abs(((i + 0.5) / de.length) - ((j + 0.5) / a.length));
        if(p < dist){ dist = p; mejor = i; }
      }
      de[mejor].salidas.push(a[j].id);
    }
  }
  /* La última columna no lleva a ninguna parte dentro del acto. */
  for(const n of columnas[columnas.length - 1] ?? []) n.salidas = [];
}

/* Todos los caminos de un acto, SIGUIENDO LAS ARISTAS. Antes era el
   producto cartesiano de las columnas —o sea, se daba por hecho que
   desde cualquier nodo se llega a cualquiera—, y con aristas explícitas
   eso enumera rutas que no existen: el generador validaba un mapa
   distinto del que se juega. */
function caminos(columnas){
  if(!columnas.length) return [];
  const porId = new Map();
  for(const col of columnas) for(const n of col) porId.set(n.id, n);
  const rutas = [];
  const andar = (nodo, camino) => {
    const ruta = [...camino, nodo];
    const sig = (nodo.salidas ?? []).map(id => porId.get(id)).filter(Boolean);
    if(!sig.length){ rutas.push(ruta); return; }
    for(const s of sig) andar(s, ruta);
  };
  for(const n of columnas[0]) andar(n, []);
  return rutas;
}

/* ── reparar lo que incumple ──
   PRIMERA VERSIÓN, Y POR QUÉ NO VALÍA: arreglaba cada regla por su
   cuenta. El arreglo de "falta un pack" convertía un nodo en PACK y
   acto seguido el arreglo de "falta utilidad" lo convertía en MERCADER,
   dejando el acto sin pack otra vez. Los 2.000 mapas fallaban por eso.

   Ahora es una escalada simple: se prueba cada cambio posible —siempre
   dentro de los tipos que la plantilla permitía para esa columna— y solo
   se queda el que REDUCE el número de rutas defectuosas. Así ninguna
   regla puede pisar a otra, porque la medida es el total. */
function reparar(acto){
  const arreglos = [];
  for(let pasada=0; pasada<8; pasada++){
    let malas = revisarActo(acto).length;
    if(!malas) break;
    let mejor = null;
    for(const col of acto.columnas){
      if(col.length < 2) continue;              // ni la entrada del acto ni el jefe
      for(const nodo of col){
        const antes = nodo.tipo;
        for(const tipo of ACTOS[acto.indice].columnas[nodo.col].tipos){
          if(tipo === antes) continue;
          nodo.tipo = tipo;
          const ahora = revisarActo(acto).length;
          nodo.tipo = antes;
          if(ahora < malas && (!mejor || ahora < mejor.malas))
            mejor = { nodo, tipo, malas:ahora, antes };
        }
      }
    }
    if(!mejor) break;                            // no hay cambio que mejore: se descarta el mapa
    mejor.nodo.tipo = mejor.tipo;
    arreglos.push(`${mejor.nodo.id}: ${mejor.antes}→${mejor.tipo}`);
  }
  return arreglos;
}

/* ── comprobar ── */
export function revisarActo(acto){
  /* La torre no se revisa contra las reglas del mapa: no tiene rutas, no
     tiene ramas y sus nodos son obligatorios por diseño. */
  if(acto.torre) return [];
  const rutas = caminos(acto.columnas);
  const fallos = [];
  /* El mercader, no antes de tiempo: se paga con cartas del binder y al
     principio de la run no hay nada que darle. Es por NODO, no por ruta:
     un mercader en la segunda columna es malo esté en el camino que
     esté. `reparar` lo cuenta como un fallo más y lo cambia solo. */
  if(acto.indice === 0)
    for(const col of acto.columnas)
      for(const n of col)
        if(n.tipo === "MERCADER" && n.col < REGLAS_MAPA.mercaderDesdeColumna)
          fallos.push(`mercader en la columna ${n.col}`);
  for(const r of rutas){
    const duelos = r.filter(n=>ES_DUELO(n.tipo)).length;
    if(duelos < REGLAS_MAPA.duelosMinimos) fallos.push(`ruta con ${duelos} duelos`);
    if(duelos > REGLAS_MAPA.duelosMaximos) fallos.push(`ruta con ${duelos} duelos`);
    if(REGLAS_MAPA.packAntesDelJefe && !r.some(n=>n.tipo==="PACK"))
      fallos.push("ruta sin pack antes del jefe");
    if(REGLAS_MAPA.utilidadPorActo && acto.indice<2 &&
       !r.some(n=>n.tipo==="CAMPAMENTO"||n.tipo==="MERCADER"))
      fallos.push("ruta sin campamento ni mercader");
  }
  return [...new Set(fallos)];
}

/* Los chips que puedes llegar a tener si ganas todo lo que pisas, por el
   MEJOR camino. Es la comprobación que decide si una semilla es jugable:
   si esto no llega a 10, la run está muerta antes de empezar. */
export function chipsMaximos(mapa){
  let chips = CHIPS.inicio;
  for(const acto of mapa.actos){
    const rutas = caminos(acto.columnas);
    if(!rutas.length) continue;
    chips += Math.max(...rutas.map(r => r.reduce((s,n)=>s + chipsQueDa(n.tipo), 0)));
  }
  return chips;
}

/* ══ Y EL PEOR CAMINO, QUE ES EL QUE IMPORTA ══
   Con aristas de verdad ya no basta con que EXISTA una ruta a diez
   fichas: el jugador elige, y si una rama elegible no da para diez,
   quien la coja se queda fuera del castillo. Esto mide la ruta más pobre
   de la isla (actos I y II, la torre no cuenta: para entrar en ella ya
   hacen falta las diez). Se usa para descartar mapas al generar. */
export function chipsPeorRuta(mapa){
  let chips = CHIPS.inicio;
  for(const acto of mapa.actos){
    if(acto.torre) continue;
    const rutas = caminos(acto.columnas);
    if(!rutas.length) continue;
    chips += Math.min(...rutas.map(r => r.reduce((s,n)=>s + chipsQueDa(n.tipo), 0)));
  }
  return chips;
}

/* Estadísticas de forma, para el simulador: sin esto no hay forma de
   saber si el mapa que se genera se parece al que se quería. */
export function formaDelActo(acto){
  if(acto.torre) return null;
  const anchos = acto.columnas.map(c => c.length);
  let aristas = 0, convergencias = 0;
  for(let i = 0; i < acto.columnas.length - 1; i++){
    const entradas = new Map();
    for(const n of acto.columnas[i]){
      aristas += (n.salidas ?? []).length;
      for(const id of (n.salidas ?? [])) entradas.set(id, (entradas.get(id) ?? 0) + 1);
    }
    convergencias += [...entradas.values()].filter(v => v > 1).length;
  }
  const rutas = caminos(acto.columnas);
  const salidas = acto.columnas.flat().map(n => (n.salidas ?? []).length)
                    .filter((v,i,a) => true);
  return {
    anchos, rutas: rutas.length, aristas, convergencias,
    ramificacionMedia: salidas.length
      ? salidas.filter((_,i) => true).reduce((a,b)=>a+b,0) / Math.max(1, salidas.filter(v=>v>0).length)
      : 0,
    columnasDe1: anchos.filter(a => a === 1).length,
    columnasDe2: anchos.filter(a => a === 2).length,
    columnasDe3: anchos.filter(a => a >= 3).length,
    tiposPorRuta: rutas.map(r => r.map(n => n.tipo)),
  };
}

/* ── la entrada ── */
export function generarMapa(rng, personaje){
  /* 20 intentos bastaban cuando el mapa era una cuadrícula. Con aristas
     de verdad hay una condición más —que la RUTA más pobre llegue a diez
     fichas— y uno de cada quinientos mapas se quedaba sin cumplirla.
     Sesenta intentos lo dejan en cero y sigue siendo instantáneo: son
     unos milisegundos. */
  for(let intento=0; intento<60; intento++){
    const actos = ACTOS.map((a,i)=>generarActo(a, rng, i, personaje));
    for(const a of actos) reparar(a);
    const fallos = actos.flatMap((a,i)=>revisarActo(a).map(f=>`acto ${i+1}: ${f}`));
    const mapa = { actos, generadoEnIntento:intento+1 };
    /* Se exige por RUTA, no solo en total: que exista un camino a diez
       fichas no sirve de nada si la rama que el jugador elija no llega.
       `chipsPeorRuta` mide la más pobre de todas las elegibles. */
    if(!fallos.length
       && chipsMaximos(mapa)   >= REGLAS_MAPA.chipsAlcanzables
       && chipsPeorRuta(mapa)  >= CHIPS.meta)
      return mapa;
    if(intento===59) return { ...mapa, fallos };   // se devuelve con la queja dentro
  }
}

/* ══ LOS NODOS A LOS QUE PUEDES IR: SOLO LOS CONECTADOS ══
   Esto devolvía `acto.columnas[pos.col + 1]` entera, o sea que la ruta
   daba igual: estuvieras donde estuvieras, tenías delante toda la
   columna siguiente. Ahora se leen las `salidas` del nodo donde estás,
   que es lo único que hace que elegir tenga coste. */
export function siguientes(mapa, pos){
  const acto = mapa.actos[pos.acto];
  if(!acto) return [];
  const entrada = () => {
    const otro = mapa.actos[pos.acto + 1];
    return otro ? otro.columnas[0] : [];
  };
  /* Aún no has pisado nada en este acto: su primera columna. */
  if(pos.col < 0 || pos.id == null) return acto.columnas[0] ?? entrada();
  const aqui = nodoPorId(mapa, pos.id);
  if(!aqui) return [];
  /* La torre no tiene aristas escritas: es una escalera, un peldaño
     detrás de otro. Se mantiene tal cual estaba. */
  if(acto.torre || !aqui.salidas){
    const col = acto.columnas[pos.col + 1];
    return col ?? entrada();
  }
  if(aqui.salidas.length)
    return aqui.salidas.map(id => nodoPorId(mapa, id)).filter(Boolean);
  /* Última columna del acto: se pasa al siguiente. */
  return entrada();
}

export function nodoPorId(mapa, id){
  for(const a of mapa.actos){
    for(const c of a.columnas) for(const n of c) if(n.id === id) return n;
    /* Los duelos de última oportunidad no viven en ninguna columna: se
       crean cuando llegas a la puerta del castillo sin las diez fichas.
       Si no se buscan aquí, entrar en uno devuelve "ese nodo no existe"
       y la run se queda muerta justo en el peor sitio. */
    for(const n of (a.ultimaOportunidad ?? [])) if(n.id === id) return n;
  }
  return null;
}
