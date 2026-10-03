/* ══════════════════════════════════════════════════════════════════
   QUIÉN TE TOCA Y CON QUÉ JUEGA

   Un rival del modo historia son cuatro cosas: quién es, con qué mazo
   viene, en qué nivel juega el bot y cuánto vale ganarle. Las tres
   primeras salen de datos (`personajes.json` + `decks.json`), no de
   código, para que añadir a alguien sea añadir una entrada.

   DOS REGLAS QUE VIENEN DEL BRIEF Y QUE IMPORTAN:

   1. La dificultad sube por MAZO, no por bot tonto. Los tres tiers de
      cada personaje son el mismo personaje jugando mejores cartas; el
      nivel de IA sube en paralelo, pero el salto de verdad está en la
      lista. Un Weevil de tier 3 lleva Pot of Greed y Mirror Force.
   2. Nadie repite sin sentido. Si ya le ganaste a Weevil, no vuelve a
      salir con el mismo mazo dos nodos después: o no sale, o vuelve con
      un tier más alto. Para eso está el registro de derrotados.
   ══════════════════════════════════════════════════════════════════ */
import { ACTOS } from "./balance.js";

/* El nivel del bot por acto y tipo de nodo. Los nombres son los del
   simulador (`NIVELES` de ai/brain.js): novato, normal, duro, experto.
   El brief pide que los dos primeros duelos sean suaves y que el
   castillo entero sea experto. */
export function nivelDeIA(){
  /* ══ SIEMPRE EXPERTO ══
     Los niveles bajos del simulador no son "juega peor": son lastres
     concretos —`combateTonto` ataca sin mirar, `cadenaTonta` responde con
     lo primero que tenga, `malaSeleccion` descarta al azar—. Eso, en una
     aventura, no se lee como un rival flojo: se lee como un juego roto.
     E lo vio tres veces seguidas: monstruos suicidándose contra muros y
     el jefe negando sus propias cartas.

     Lo dijo él y coincide con el brief: la dificultad tiene que venir del
     MAZO, no de un bot que se equivoca a propósito. Un Weevil de tier 1
     con cartas de anime ya es fácil de ganar jugando bien; y cuando en el
     acto III el mismo Weevil vuelve con Pot of Greed y Mirror Force, el
     salto se nota por lo que juega, no por lo que deja de pensar.

     Se deja la firma con los mismos parámetros para no tocar quien la
     llama, y `ACTOS[n].nivelIA` sigue en balance.js por si algún día se
     quiere un modo "fácil de verdad". */
  return "experto";
}

/* El tier del mazo: el del acto, y uno más si el nodo es Elite o si es
   la segunda vez que te cruzas con esa persona. */
export function tierDe(acto, { tipo="DUELO", yaDerrotado=false } = {}){
  let t = ACTOS[acto].tier;
  if(tipo === "ELITE" || yaDerrotado) t += 1;
  return Math.min(3, Math.max(1, t));
}

/* ── a quién te encuentras ── */
export function elegirRival(run, datos, rng, { acto=0, tipo="DUELO", suave=false } = {}){
  const { personajes, jefes, pegasus } = datos;

  /* Los jefes están escritos: son el final del acto y tienen que ser
     reconocibles, no una sorpresa aleatoria. */
  if(tipo === "JEFE"){
    const jefe = jefes[String(acto+1)];
    if(!jefe) return null;
    if(jefe.personaje === "pegasus")
      return { ...pegasus, tier:3, nivel:"experto", esJefe:true, esPegasus:true };
    const p = personajes.find(x => x.id === jefe.personaje);
    return { ...p, tier:jefe.tier, nivel:nivelDeIA(acto, {tipo}), esJefe:true,
             tituloJefe: jefe.nombre };
  }

  const derrotados = new Set(run.derrotados ?? []);
  const enEsteActo = personajes.filter(p => p.actos.includes(acto+1));
  /* Primero los que no has visto; los repetibles solo cuando no queda
     nadie nuevo, y entonces con un tier más. */
  const nuevos = enEsteActo.filter(p => !derrotados.has(p.id));
  const lista = nuevos.length ? nuevos : enEsteActo.filter(p => p.repetible);
  if(!lista.length) return null;

  const p = rng.uno(lista);
  const yaDerrotado = derrotados.has(p.id);
  const tier = tierDe(acto, { tipo, yaDerrotado });
  return { ...p, tier, nivel:nivelDeIA(acto, {suave, tipo}), yaDerrotado,
           esJefe:false, esElite: tipo==="ELITE" };
}

/* El mazo con el que viene, ya resuelto a cartas. Un rival sin mazo
   para su tier cae al que tenga (por eso los tres tiers son
   obligatorios en los datos: si falta uno, se ve aquí). */
export function mazoDeRival(rival, decks, { maestria=0, mazosDelSimulador=[] } = {}){
  if(rival.esPegasus){
    const plan = rival.porMaestria[String(Math.min(maestria, 3))]
              ?? rival.porMaestria["0"];
    if(plan.mazo) return { id:plan.mazo, ...decks[plan.mazo] };
    /* A partir de la segunda maestría, Pegasus juega mazos meta que YA
       existen en el simulador: no se duplican listas, se referencian por
       nombre exacto de mazos.json. */
    const nombres = plan.mazosDelSimulador ?? [];
    const cand = mazosDelSimulador.filter(m => nombres.includes(m.nombre));
    return cand.length ? { id:cand[0].nombre, main:cand[0].main, extra:cand[0].extra,
                           delSimulador:true } : { id:"pegasus-m1-boss", ...decks["pegasus-m1-boss"] };
  }
  const id = rival.mazos?.[String(rival.tier)] ?? Object.values(rival.mazos ?? {})[0];
  return { id, ...decks[id] };
}

/* Pegasus a partir de la maestría 2 elige mazo con la semilla, no con
   `Math.random`: la misma run tiene que dar el mismo jefe final. */
export function mazoDePegasus(pegasus, decks, mazosDelSimulador, maestria, rng){
  const plan = pegasus.porMaestria[String(Math.min(maestria, 3))] ?? pegasus.porMaestria["0"];
  if(plan.mazo) return { id:plan.mazo, ...decks[plan.mazo] };
  const cand = mazosDelSimulador.filter(m => (plan.mazosDelSimulador ?? []).includes(m.nombre));
  if(!cand.length) return { id:"pegasus-m1-boss", ...decks["pegasus-m1-boss"] };
  const m = rng.uno(cand);
  return { id:m.nombre, main:m.main, extra:m.extra, delSimulador:true };
}

/* ══════════════════════════════════════════════════════════════════
   LA MANO DE SALIDA DE UN JEFE

   El orden del array del mazo ES el orden de robo: el motor no vuelve a
   barajar (comprobado, y `check-jefes.mjs` lo vigila). El FINAL del array
   es lo primero que se roba.

   Con eso, a un jefe se le puede garantizar su motor en la mano inicial.
   No es hacer trampa: no ve tu mano, no roba de más y juega con su mazo
   legal de 40. Lo único que se evita es el jefe final abriendo sin Toon
   World y jugando con nueve cartas muertas, que es como Pegasus perdía
   contra un mazo inicial SIN mejorar. Y como jugador se lee bien:
   "Pegasus siempre abre con Toon World" es carácter, no un bot raro.

   Se siembran cartas DISTINTAS, nunca tres copias de lo mismo: una mano
   de tres Toon World es igual de mala que ninguna. */
export function sembrarManoDeJefe(mazoBarajado, manoInicial, rng, nombreDe){
  if(!manoInicial?.cartas?.length) return mazoBarajado;
  const cuantas = manoInicial.cuantas ?? 2;
  const mazo = [...mazoBarajado];
  const puestas = [];
  /* OTRA VEZ EL SUFIJO "(GOAT)". En el pool la carta se llama "Toon
     Summoned Skull (GOAT)" y "Scapegoat (GOAT)": comparar el nombre tal
     cual no encontraba nada y la siembra no hacía absolutamente nada,
     con el mismo resultado que sin sembrar. Se compara sin sufijo. */
  const canon = t => String(t ?? "")
    .replace(/\s*\((GOAT|Pre-errata|Pre-Errata|Anime|Manga)\)\s*$/i, "").trim();

  for(const nombre of rng.barajar(manoInicial.cartas)){
    if(puestas.length >= cuantas) break;
    const i = mazo.findIndex(c => canon(nombreDe(c)) === canon(nombre));
    if(i < 0) continue;                       // esa carta no está en este mazo
    puestas.push(mazo.splice(i, 1)[0]);
  }
  /* Al final del array = arriba del mazo = lo primero que se roba. Van
     separadas por una carta cualquiera para que la mano no sea un bloque
     y el jefe también robe cosas normales. */
  for(const c of puestas) mazo.push(c);
  return mazo;
}

/* ══════════════════════════════════════════════════════════════════
   QUIÉN TE ESPERA EN CADA NODO, DECIDIDO DE ANTEMANO

   Antes el rival se elegía al ENTRAR en el nodo. Eso hacía imposible
   pintar su cara en el mapa, y la cara es justo lo que convierte el mapa
   en un viaje: en el anime sabes que arriba está Pegasus y que en la
   playa te espera Weevil. Ahora se asigna al generar la run, con un azar
   derivado de la semilla y del id del nodo —así el mapa se puede volver
   a pintar mil veces y siempre sale lo mismo— y respetando la regla de
   no repetir duelista mientras queden nuevos. */
export function asignarRivales(run, datos, rngDeSemilla){
  const { personajes, jefes, pegasus } = datos;
  /* ══ EL PERSONAJE QUE ESTÁS JUGANDO NO SE DUELA CONSIGO MISMO ══
     Suena obvio y sin embargo es la clase de cosa que se cuela: si
     eliges a Joey, Joey no puede salir en la isla ni en la torre. Ghost
     Kaiba es OTRO personaje —el impostor de la isla— así que jugando con
     Kaiba sigue apareciendo, y eso es canónico. */
  const yo = run.personaje ?? null;
  const disponibles = personajes.filter(p => p.id !== yo);

  for(const acto of run.mapa.actos){
    const usados = new Set();
    /* ══ EL REPARTO DEL ACTO, DECIDIDO DE UNA VEZ ══
       La lista de duelistas de este acto, ordenada por CRONOLOGÍA y con
       la dureza como desempate. Se calcula una sola vez: hacerlo dentro
       del bucle daba una lista distinta en cada nodo —porque `usados` la
       encogía— y con eso el orden se descuadraba en el 48% de los mapas.
       El azar decide QUIÉNES entran cuando hay más candidatos que
       huecos; el orden en que salen lo decide el anime. */
    const ordenActo = disponibles
      .filter(p => p.actos.includes(acto.indice+1))
      .sort((a,b) => (a.cronologia ?? 50) - (b.cronologia ?? 50) ||
                     (a.dureza ?? 50) - (b.dureza ?? 50));
    /* Cuántas columnas de duelo llevamos: es el índice dentro de esa
       lista. Las dos opciones de una misma columna comparten índice. */
    let indiceCol = -1;
    for(const col of acto.columnas){
      if(col.some(n => ["DUELO","ELITE"].includes(n.tipo) && !n.torre)) indiceCol++;
      for(const nodo of col){
        if(!["DUELO","ELITE","JEFE"].includes(nodo.tipo)) continue;
        const r = rngDeSemilla(run.semilla + ":" + nodo.id);

        /* La torre lleva su rival escrito desde que se generó el mapa: el
           orden es fijo y no se sortea nada. */
        if(nodo.torre){
          const quien = nodo.torre === "pegasus" ? pegasus
                      : (datos.jugables ?? []).find(x => x.id === nodo.torre);
          if(!quien) continue;
          nodo.rival = { id:quien.id, nombre:quien.nombre, avatar:quien.avatar,
                         frase:quien.frase, tier:3,
                         esPegasus: nodo.torre === "pegasus",
                         esJefe: true, esTorre: true,
                         tituloJefe: nodo.torre === "pegasus" ? quien.nombre : null,
                         mazoTorre: quien.torre ?? null };
          continue;
        }

        if(nodo.tipo === "JEFE"){
          const jefe = jefes[String(acto.indice+1)];
          if(!jefe) continue;
          if(jefe.personaje === "pegasus"){
            nodo.rival = { id:"pegasus", nombre:pegasus.nombre, avatar:pegasus.avatar,
                           frase:pegasus.frase, tier:3, esPegasus:true, esJefe:true };
          } else {
            const p = disponibles.find(x => x.id === jefe.personaje);
            if(!p) continue;
            nodo.rival = { id:p.id, nombre:p.nombre, avatar:p.avatar, frase:p.frase,
                           tier:jefe.tier, esJefe:true, tituloJefe:jefe.nombre };
          }
          continue;
        }
        if(!ordenActo.length) continue;

        /* ══ EL TIEMPO SOLO VA HACIA ADELANTE ══
           Los encuentros llevan un `cronologia` que es el orden en que
           pasan las cosas en Duelist Kingdom: Weevil (10), Joey y Mai
           (20), Mako (30), Ghost Kaiba (50), Rex (60), PaniK (80), Bonz
           (90), los Hermanos Paradoja (100). El mapa puede barajar la
           RUTA, pero no puede enseñarte el laberinto antes que la playa.

           Además, dentro de esa ventana, los duelistas se reparten de
           más blando a más duro (`dureza`, medida jugando el starter
           contra su tier 1). Antes el rival salía al azar dentro del
           acto y tu PRIMER duelo podía ser Weevil —el starter le gana el
           85%— o Mako —31%—. Eso no es dificultad, es lotería.

           Las dos cosas ordenan lo mismo casi siempre porque el anime ya
           iba de menos a más; cuando chocan, manda la cronología. */
        /* EN ORDEN, NO "MÁS O MENOS EN ORDEN". Se reparten de la lista
           del acto —ya ordenada por cronología— según avanzan las
           columnas. Las dos opciones de una MISMA columna comparten
           índice: son alternativas del mismo momento del viaje, así que
           da igual cuál elijas, no adelantas ni retrasas el tiempo. */
        const p = ordenActo[Math.min(indiceCol, ordenActo.length - 1)];
        if(!p) continue;
        usados.add(p.id);
        nodo.rival = { id:p.id, nombre:p.nombre, avatar:p.avatar, frase:p.frase,
                       tier: tierDe(acto.indice, { tipo:nodo.tipo, yaDerrotado:false }),
                       esElite: nodo.tipo === "ELITE" };
      }
    }
  }
  return run.mapa;
}

/* Apuntar que le has ganado. Es lo que evita que el mismo duelista
   aparezca tres veces en el mismo acto. */
export function apuntarDerrota(run, rivalId){
  if(!run.derrotados.includes(rivalId)) run.derrotados.push(rivalId);
}

/* ══════════════════════════════════════════════════════════════════
   MAESTRÍA — PROGRESIÓN HORIZONTAL

   Lo que se gana al terminar una run con un personaje NO son estadísticas.
   No hay +ATK, ni puntos de vida extra, ni un Pot of Greed regalado: eso
   es power creep y a la tercera vuelta el juego se cae solo. Lo que se
   gana son DECISIONES nuevas que se toman antes de empezar.

   Y solo se usa UNA por run aunque tengas varias desbloqueadas. Si se
   apilaran, la quinta vuelta empezaría con medio mazo hecho y la
   aventura dejaría de serlo.

   Los niveles viven en `personajes.json` (`maestria.niveles`), así que
   añadir uno es añadir una fila, no tocar esto.
   ══════════════════════════════════════════════════════════════════ */

/* Los pasivos que tiene desbloqueados un personaje con esa maestría. */
export function pasivosDe(personaje, maestria, datos){
  const niveles = datos?.maestria?.niveles ?? [];
  return niveles.filter(n => n.nivel <= (maestria ?? 0));
}
/* Y el siguiente, para poder decir qué te falta por desbloquear. */
export function proximoPasivo(maestria, datos){
  const niveles = datos?.maestria?.niveles ?? [];
  return niveles.find(n => n.nivel > (maestria ?? 0)) ?? null;
}

/* Las diez cartas de la especialidad del personaje. Hechiceros para
   Yugi, guerreros para Joey, viento para Mai, máquinas para Keith y
   dragones para Kaiba — todas buenas de verdad en Goat y validadas
   contra el pool al escribirlas. */
export function cartasDeMaestro(personaje, datos){
  const j = (datos?.jugables ?? []).find(x => x.id === personaje);
  return j?.cartasDeMaestro ?? [];
}

/* COMPATIBILIDAD: la primera versión tenía una tabla `PASIVOS` con la
   sabiduría del abuelo solo para Yugi. Se deja el nombre exportado para
   no romper a quien lo llame, pero ahora sale de los datos. */
export const PASIVOS = {};
export function cartasDelAbuelo(cat, datos, personaje = "yugi"){
  const codes = cartasDeMaestro(personaje, datos);
  return codes.length ? codes : (cat?.maestriaYugi ?? []);
}

/* ══════════════════════════════════════════════════════════════════
   QUIÉN SE PUEDE ELEGIR

   Los cinco protagonistas, siempre. El sexto —el Duelista libre— solo
   después de haber ganado el torneo una vez con cualquiera de ellos.
   La comprobación va AQUÍ y no en la pantalla: la pantalla se puede
   volver a pintar, y un desbloqueo que vive en el render es un
   desbloqueo que se pierde.
   ══════════════════════════════════════════════════════════════════ */
export function jugablesDisponibles(datos, meta = {}){
  const ganadas = Math.max(0, Number(meta?.runsGanadas ?? 0) || 0);
  return (datos.jugables ?? []).filter(j => !j.esCustom || ganadas >= 1);
}
export function esCustom(id, datos){
  return !!(datos.jugables ?? []).find(j => j.id === id)?.esCustom;
}
