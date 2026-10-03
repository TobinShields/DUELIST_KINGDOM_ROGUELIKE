/* ══════════════════════════════════════════════════════════════════
   EL ORQUESTADOR — LA MÁQUINA DE LA RUN

   Todo lo de `src/story/` son piezas sueltas: el mapa, las fichas, las
   recompensas, el mercader. Esto es lo que las junta y contesta a las
   dos únicas preguntas que hace la interfaz:

       ¿qué puedo hacer ahora?      → `opciones()`
       he hecho esto, ¿y ahora?     → `entrar()` / `resolver()`

   La interfaz NO toca el estado a mano. Pinta lo que devuelven estas
   funciones y llama a la siguiente. Así el modo historia entero se puede
   jugar sin navegador —que es como se prueba— y la pantalla es solo
   pintura.

   Y guarda después de CADA acción que cambie algo. Una run son cuarenta
   minutos: perderlos porque se cierra una pestaña sería imperdonable.
   ══════════════════════════════════════════════════════════════════ */
import { nuevaRun, azarDe, resolverDuelo, guardar, cargar, borrarRun,
         apuntarVictoriaFinal, cargarMeta, guardarMeta, puertaDelCastillo,
         exportarProgreso, importarProgreso } from "./estado.js";
import { siguientes, nodoPorId, chipsQueDa } from "./mapa.js";
import { recordDe, apuntarRunEmpezada, apuntarDuelo, apuntarRunTerminada,
         apuntarChips, apuntarSobre, apuntarEncuentro, apuntarCarta,
         revisarLogros, completado, LOGROS } from "./record.js";
import { ponerStarter, alBinder, revisarMazo, mazoParaDuelo,
         meterEnMazo, sacarDelMazo, reordenarTodo } from "./coleccion.js";
import { recompensaDuelo, abrirPack, morralla, FAMILIAS } from "./recompensas.js";
/* ══ NADA DE `import * as` EN LOS MÓDULOS DEL REINO ══
   El HTML final no son módulos: `build-html.mjs` los concatena dentro de
   un mismo ámbito y BORRA los imports. Un `import * as recompensasMod`
   desaparece sin dejar rastro y la referencia se queda colgada — en el
   navegador salía "recompensasMod is not defined" al resolver cualquier
   encuentro que reparta morralla, y en node no pasaba porque ahí SÍ son
   módulos. Se arma el objeto a mano con lo que ya está en el ámbito. */
const recompensasMod = { morralla, recompensaDuelo, abrirPack, FAMILIAS };
import { recetasDisponibles, ofertaMercader, pagarMercader, cartasQuePaga, opcionesCampamento,
         acampar, elegirEvento, aplicarEvento, lpDelDuelo, gastarBuff } from "./utilidad.js";
import { elegirRival, mazoDeRival, mazoDePegasus, apuntarDerrota,
         pasivosDe, proximoPasivo, cartasDeMaestro,
         asignarRivales, jugablesDisponibles } from "./personajes.js";
import { rngDeSemilla } from "./rng.js";
import { CHIPS, TORRE } from "./balance.js";
import { nivelDeIA, tierDe } from "./personajes.js";

export function crearHistoria({ datos, decks, eventos, cat, almacen, mazosDelSimulador = [] }){
  let run = null;

  const guardarYa = () => { if(run && almacen) guardar(almacen, run); };
  const rng = () => azarDe(run);

  /* ── empezar y continuar ── */
  /* `personaje` ya no está clavado a Yugi: son cinco jugables y el que
     elijas decide su starter, su maestría y —lo que más se nota— a quién
     te encuentras en la torre, porque a ti mismo no. */
  function empezar({ semilla, personaje = "yugi", starter,
                     pasivo = null, cartaDeMaestro = null, familiaDeSobre = null,
                     avatar = null } = {}){
    const meta = almacen ? cargarMeta(almacen) : { maestria:{} };
    const maestria = meta.maestria?.[personaje] ?? 0;
    if(!starter) starter = (datos.jugables ?? []).find(j=>j.id===personaje)?.starters?.[0];
    run = nuevaRun({ semilla, personaje, starter, maestria });
    /* Quién espera en cada nodo se decide AQUÍ, para que el mapa pueda
       enseñar las caras antes de que elijas camino. */
    asignarRivales(run, datos, rngDeSemilla);
    ponerStarter(run, decks[starter], cat);
    /* ══ LA CARA DE LA RUN, PARA TODOS, NO SOLO PARA EL CUSTOM ══
       Esto era `if(avatar) run.avatar = avatar`, y `avatar` solo llega
       cuando juegas el Duelista libre. Con Yugi o con Joey se quedaba
       en null, el duelo caía al respaldo —la cara de Opciones— y salías
       de Dark Magician Girl jugando con Joey. E lo reportó dos veces
       porque el primer arreglo solo cubrió al Custom.

       Ahora la run guarda SIEMPRE con qué cara se juega: la elegida si
       es el Duelista libre, y si no la del personaje. Así el duelo, el
       mapa y la pantalla final leen todos del mismo sitio. */
    run.avatar = avatar
      ?? (datos.jugables ?? []).find(j => j.id === personaje)?.avatar
      ?? null;
    globalThis.__TELE__?.runEmpieza(personaje);

    /* ══ EL PASIVO DE LA RUN ══
       SOLO UNO, aunque tengas tres desbloqueados. Apilarlos convertiría
       la quinta vuelta en un mazo regalado, y la aventura dejaría de
       serlo. Se comprueba que esté desbloqueado de verdad: la pantalla
       no es la que manda. */
    const abiertos = pasivosDe(personaje, maestria, datos);
    const elegido = abiertos.find(x => x.id === pasivo) ?? null;
    run.pasivo = elegido?.id ?? null;

    if(elegido?.id === "carta-de-maestro"){
      /* Entra al MAZO, no al binder: es un pasivo, no un premio que
         haya que colocar. Y se reordena, o la carta se queda pegada al
         final por debajo de las trampas. */
      const legales = cartasDeMaestro(personaje, datos);
      if(cartaDeMaestro != null && legales.includes(Number(cartaDeMaestro))){
        run.mazo.main.push(Number(cartaDeMaestro));
        reordenarTodo(run, cat);
        run.pasivoDatos = { carta: Number(cartaDeMaestro) };
      } else {
        /* ══ UNA VENTAJA A MEDIAS NO SE GASTA ══
           Si la pantalla manda «carta de maestro» sin decir cuál, antes
           se quedaba `run.pasivo = "carta-de-maestro"` y la carta no
           aparecía por ningún lado: habías gastado tu única ventaja en
           nada y sin un solo aviso. Ahora la run se queda SIN pasivo,
           que al menos es un estado honesto, y la pantalla no deja
           llegar hasta aquí. */
        run.pasivo = null;
      }
    }
    if(elegido?.id === "primer-sobre"){
      /* Un sobre ya abierto al empezar: diez cartas al binder, con la
         familia que hayas elegido. */
      const fam = FAMILIAS.some(f => f.id === familiaDeSobre) ? familiaDeSobre : FAMILIAS[0].id;
      const cartas = abrirPack(run, cat, rng(), { familia:fam, acto:1 });
      alBinder(run, cartas.map(c=>c.code), cat);
      run.pasivoDatos = { familia: fam };
    }
    /* "Mano firme" no hace nada al empezar: lo lee `recompensaDuelo`. */

    /* El historial permanente empieza a contar aquí. `contadaEmpezada`
       vive en la RUN para que recargar no sume otra. */
    conMeta(meta => apuntarRunEmpezada(meta, run));
    guardarYa();
    return estado();
  }
  function continuar(){
    run = almacen ? cargar(almacen) : null;
    /* Las partidas guardadas antes de que existieran los retratos no
       tienen rival en los nodos: se les asigna igual, y como el azar sale
       de la semilla, salen los mismos que habrían salido. */
    if(run && !run.mapa.actos[0].columnas[0][0].rival)
      asignarRivales(run, datos, rngDeSemilla);
    return run ? estado() : null;
  }
  function abandonar(){ run = null; if(almacen) borrarRun(almacen); }

  /* ── dónde estoy y a dónde puedo ir ── */
  function opciones(){
    if(!run || run.terminada) return [];

    /* ══ AL JEFE HAY QUE GANARLE ══
       Antes, perder el duelo del jefe te pasaba de acto igual: en
       `check-run.mjs` un tercio de las runs llegaban al castillo sin
       haber ganado ni un jefe, y perder no significaba nada. Ahora el
       nodo del jefe no se marca resuelto cuando pierdes, y mientras
       siga sin resolver la ÚNICA salida es volver a entrar. Cada
       intento cuesta una ficha, así que la run se acaba sola si no
       puedes con él: no hace falta expulsar a nadie a mano. */
    const aqui = nodoPorId(run.mapa, run.pos.id);
    /* Y EN LA TORRE, TODOS LOS PELDAÑOS SON JEFES. Cada duelista del
       castillo es obligatorio: perder contra Mai y encontrarte con Keith
       es exactamente el "al perder la run no se acaba, te deja continuar
       como si hubieses ganado" que reportó E. Los peldaños son nodos
       ELITE, así que la regla del jefe no los cubría. */
    const obligatorio = aqui?.tipo === "JEFE" || !!aqui?.torre;
    if(obligatorio && !aqui.resuelto
       && (run.historial ?? []).some(h => h.nodo === aqui.id))
      return [{ ...aqui, revancha:true }];

    /* ══════════════════════════════════════════════════════════════
       ENTRAR EN UN NODO NO ES RESOLVERLO

       `entrar()` mueve `run.pos` para saber dónde estás, y `siguientes`
       devuelve la columna de después. Con eso, ASOMARSE a un duelo y
       darle a "volver al mapa" te adelantaba una columna: el nodo se
       quedaba sin jugar pero tú ya estabas al otro lado. E lo reportó
       tal cual — "entro en un duelo, pulso Back to map y el nodo se
       considera completado".

       La regla es sencilla y vale para TODOS los tipos de nodo: mientras
       el nodo donde estás no esté RESUELTO, la única opción es ese nodo.
       Volver al mapa, recargar, cancelar una recompensa o guardar y
       salir te dejan exactamente donde estabas.
       ══════════════════════════════════════════════════════════════ */
    if(aqui && !aqui.resuelto) return [{ ...aqui, pendiente:true }];

    const nodos = siguientes(run.mapa, run.pos);

    /* ══ LA PUERTA DEL CASTILLO ESTÁ CERRADA DE VERDAD ══
       Antes solo se convertían los nodos en duelos de última oportunidad
       cuando ya era IMPOSIBLE llegar a diez; si aún era posible, se
       pasaba igual sin tenerlas. Resultado: se llegaba a Pegasus con
       cinco fichas. Ahora no se entra al acto III sin `clasificado`,
       punto; mientras falten fichas, la última columna de la isla ofrece
       duelos hasta que las juntes. Y `clasificado` no se pierde una vez
       tocado, así que perder dentro del castillo no te echa de él. */
    /* ══ LA REGLA ABSOLUTA DE LAS STAR CHIPS ══
       Mientras NO estés clasificado y te quede al menos una ficha, tiene
       que existir SIEMPRE una forma de seguir duelando hasta las diez.
       Da igual dónde estés en la isla. E llegó con nueve a los Hermanos
       Paradoja y se quedó sin ninguna forma de conseguir la décima.

       Se dispara en dos casos:
       · estás en la puerta del castillo sin clasificar;
       · o la isla se ha acabado y no hay nada más que pisar. */
    const alCastillo = nodos.some(n => n.acto === 2) && run.pos.acto === 1;
    const puedeQuedarse = !run.clasificado && run.chips > 0;
    if(puedeQuedarse && (alCastillo || !nodos.length)){
      const ultimos = ultimaOportunidad();
      if(ultimos.length) return ultimos;
    }
    return nodos;
  }

  /* ══════════════════════════════════════════════════════════════
     LOS DUELISTAS QUE QUEDAN EN LA ISLA

     No es un parche de emergencia, es la última parte del torneo: si no
     has juntado las diez fichas cuando se acaba el recorrido, todavía
     quedan duelistas dando vueltas por la isla y puedes retarlos las
     veces que haga falta. Cada victoria suma, cada derrota resta, a cero
     se acabó la run, y en cuanto tocas las diez esto desaparece y se
     abre el castillo.

     Quién puede salir: solo quien ya te podrías haber cruzado por
     cronología. NO Pegasus (es el final), NO el personaje que estás
     jugando (no te duelas contigo), NO los duelistas exclusivos de la
     torre. Se generan de dos en dos para que siga habiendo elección, y
     son DETERMINISTAS: salen de la semilla, así que recargar no cambia
     contra quién te toca.
     ══════════════════════════════════════════════════════════════ */
  function candidatosDeIsla(){
    const cronoAhora = Math.max(0, ...(run.historial ?? [])
      .map(h => h.cronologia ?? 0), 0);
    const torre = new Set(TORRE ?? []);
    return (datos.personajes ?? []).filter(p =>
         p.id !== "pegasus"
      && p.id !== run.personaje
      && !p.soloTorre
      && !torre.has(p.id)
      /* Cronología: quien ya está disponible en la isla a estas alturas.
         Si nadie encaja —una run rarísima—, se relaja a "cualquiera que
         aparezca en la isla", porque quedarse sin rival sería justo el
         bloqueo que esto viene a evitar. */
      && (p.actos ?? []).length > 0);
  }

  function ultimaOportunidad(){
    const acto = run.mapa.actos[1] ?? run.mapa.actos[0];
    if(!acto) return [];
    acto.ultimaOportunidad = acto.ultimaOportunidad ?? [];
    const hechos = new Set(run.resueltos);
    let libres = acto.ultimaOportunidad.filter(n => !hechos.has(n.id));
    if(!libres.length){
      const base = acto.ultimaOportunidad.length;
      const r = rngDeSemilla(run.semilla + ":uo" + base);
      const cand = candidatosDeIsla();
      const fuente = cand.length ? cand : (datos.personajes ?? []);
      const nuevos = [0,1].map(k => {
        const n = { id:`uo${base+k}`, acto:1, col:99, fila:k,
                    tipo:"DUELO", resuelto:false, ultimaOportunidad:true };
        const p = r.uno(fuente);
        if(p) n.rival = { id:p.id, nombre:p.nombre, avatar:p.avatar,
                          frase:p.frase, tier:2 };
        return n;
      });
      acto.ultimaOportunidad.push(...nuevos);
      libres = nuevos;
    }
    return libres;
  }

  /* Cuántas fichas quedan por ganar si ganas todo lo que queda. */
  function chipsRestantes(){
    let total = 0;
    for(const acto of run.mapa.actos){
      if(acto.indice < run.pos.acto) continue;
      for(const col of acto.columnas){
        if(acto.indice === run.pos.acto && col[0].col <= run.pos.col) continue;
        total += Math.max(...col.map(n => chipsQueDa(n.tipo)));
      }
    }
    return total;
  }

  /* ── entrar en un nodo ──
     Devuelve lo que la pantalla tiene que enseñar. No resuelve nada
     todavía: el jugador decide y luego llama a `resolver`. */
  function entrar(nodoId){
    const nodo = nodoPorId(run.mapa, nodoId);
    if(!nodo) return { error:"ese nodo no existe" };
    const actoAntes = run.pos?.acto;
    run.pos = { acto:nodo.acto, col:nodo.col, id:nodo.id };
    /* La curva de abandono: qué nodos se pisan, y cuándo se cambia de
       acto. Es lo único que dice si la dificultad está bien puesta sin
       tener que preguntárselo a la gente. */
    globalThis.__TELE__?.nodo(nodo.tipo);
    if(actoAntes !== nodo.acto) globalThis.__TELE__?.acto(nodo.acto);
    const r = rng();
    const acto = nodo.acto + 1;
    let carga = { tipo:nodo.tipo, nodo, acto };

    switch(nodo.tipo){
      /* ══ LA PREPARACIÓN DEL CASTILLO ══
         Dos paradas en toda la torre, y esta es la primera: eliges UNA
         de las tres utilidades. Es la última ventana para rematar un
         motor antes de que empiece a doler. */
      case "PREPARACION":
        carga.opciones = ["PACK", "MERCADER", "CAMPAMENTO"];
        break;
      case "DUELO": case "ELITE": case "JEFE": {
        /* El rival ya estaba decidido desde que se generó el mapa; aquí
           solo se le añade lo que depende del momento (el nivel de la IA
           y si ya le ganaste, que le sube el tier). */
        const base = nodo.rival ?? elegirRival(run, datos, r,
                       { acto:nodo.acto, tipo:nodo.tipo, suave:nodo.suave });
        const yaDerrotado = (run.derrotados ?? []).includes(base?.id);
        const rival = base?.esPegasus
          ? { ...datos.pegasus, ...base, nivel:"experto", tier:3 }
          : { ...(datos.personajes.find(p=>p.id===base?.id) ?? {}), ...base,
              nivel: nivelDeIA(nodo.acto, { suave:nodo.suave, tipo:nodo.tipo }),
              /* ══ LA ÚLTIMA OPORTUNIDAD VA A SU TIER, NO A UNO MÁS ══
                 `ultimaOportunidad()` crea los duelos de la isla a tier 2,
                 pero aquí `yaDerrotado` los subía a 3: a esas alturas ya
                 le has ganado a casi todos, así que la vuelta para juntar
                 las diez fichas era contra mazos de castillo. Medido en
                 runs completas (M9): un 30% de victorias, o sea una
                 ruina de jugador asegurada — cada derrota resta la ficha
                 que la victoria anterior sumó. */
              tier: base?.esJefe ? base.tier
                    : nodo.ultimaOportunidad ? (base?.tier ?? 2)
                    : tierDe(nodo.acto, { tipo:nodo.tipo, yaDerrotado }),
              yaDerrotado };
        /* En la torre el mazo NO sale de la tabla de tiers del personaje:
           cada duelista del castillo tiene su lista propia, mucho más
           fuerte que la de la isla y con su identidad intacta. */
        const mazo = rival?.esPegasus
          ? mazoDePegasus(datos.pegasus, decks, mazosDelSimulador, run.maestria, r)
          : rival?.mazoTorre && decks[rival.mazoTorre]
            ? { id: rival.mazoTorre, ...decks[rival.mazoTorre] }
            : mazoDeRival(rival, decks);
        /* La mano de salida del jefe viaja en la carga: la interfaz se la
           pasa a `lanzarDuelo` como `manoRival` y main.js la coloca arriba
           del mazo DESPUÉS de barajar. */
        carga = { ...carga, rival, mazoRival:mazo,
                  manoRival: rival?.manoInicial ?? null,
                  apuesta: nodo.torre ? CHIPS.torre
                         : nodo.tipo==="ELITE" ? CHIPS.elite : nodo.tipo==="JEFE" ? CHIPS.jefe : CHIPS.duelo,
                  lpIniciales: lpDelDuelo(run),
                  /* El jefe final con vida de jefe. Es el único mando de
                     dificultad honesto que queda: la IA ya juega en
                     experto y el mazo ya es meta. */
                  lpRival: (nodo.torre === "pegasus" ? (datos.pegasus?.lp ?? 8000) : 8000),
                  /* Pegasus abre con SIETE: cinco normales más Toon World y
                     Toon Summoned Skull, que salen de su propio mazo. No se
                     le cambian dos de las cinco: se le dan dos de más. */
                  manoRivalCuantas: (nodo.torre === "pegasus"
                    ? (datos.pegasus?.manoInicial?.cartasEnMano ?? 5) : 5),
                  mazoMio: mazoParaDuelo(run),
                  problemas: revisarMazo(run, cat) };
        break;
      }
      case "PACK":
        carga.familias = FAMILIAS;      // elige el jugador, nunca el juego
        break;
      case "MERCADER":
        carga.recetas = recetasDisponibles(run, cat, {});
        break;
      case "CAMPAMENTO":
        carga.opciones = opcionesCampamento(run);
        break;
      case "EVENTO":
        carga.evento = elegirEvento(run, eventos, r, { acto });
        break;
    }
    guardarYa();
    return carga;
  }

  /* ── resolver ── */
  /* Apuntar en el historial permanente. Se lee, se toca y se guarda de
     una vez: el meta es pequeño y así no hay copias a medias por ahí. */
  function conMeta(fn){
    if(!almacen) return null;
    const meta = cargarMeta(almacen);
    const r = fn(meta);
    revisarLogros(meta);
    guardarMeta(almacen, meta);
    return r;
  }

  function resolverDueloNodo({ ganado, rivalId, elite=false, altaApuesta=false }){
    const nodo = nodoPorId(run.mapa, run.pos.id);
    const tipo = nodo?.tipo ?? "DUELO";
    const res = resolverDuelo(run, { tipo, ganado, altaApuesta, torre: !!nodo?.torre });
    gastarBuff(run);
    if(ganado && rivalId) apuntarDerrota(run, rivalId);
    run.historial.push({ nodo:run.pos.id, tipo, ganado });
    conMeta(meta => { apuntarDuelo(meta, run, { ganado });
                      if(ganado) apuntarChips(meta, Math.max(0, res.ahora - res.antes)); });
    /* ══ SOLO GANAR COMPLETA UN NODO ══
       Antes solo se exigía ganar a los jefes; un duelo normal perdido se
       marcaba resuelto y te dejaba avanzar habiendo perdido, que es
       justo lo contrario de lo que significa perder. Ahora la regla es
       una y vale para todos: pierdes, pagas la ficha y el nodo sigue
       ahí. Lo que acaba la run es quedarte sin fichas, no que el mapa te
       expulse. */
    if(ganado) marcarResuelto();

    /* Ganar el jefe del acto III es ganar la run. */
    const esFinal = tipo === "JEFE" && run.pos.acto === 2;
    if(ganado && esFinal){
      run.terminada = true; run.ganada = true;
      globalThis.__TELE__?.runTermina(true, run.pos.acto, run.chips);
      /* `apuntarVictoriaFinal` marca `run.contada`, y esa marca hay que
         GUARDARLA: si no, recargar vuelve a cargar una run sin contar y
         la maestría sube otra vez. */
      if(almacen){
        apuntarVictoriaFinal(almacen, run);
        conMeta(meta => {
          apuntarRunTerminada(meta, run, { ganada:true, rendida:false });
          /* "Sin una sola derrota": se mira el historial de ESTA run, que
             es donde está la verdad, no un contador aparte. */
          if(!(run.historial ?? []).some(h => h.ganado === false))
            recordDe(meta).logros.sinPerder = true;
        });
        guardarYa();
      }
    }
    /* Perder un jefe no te expulsa mientras te queden fichas: vuelves a
       la puerta. Perder un duelo normal tampoco: el nodo queda resuelto
       y sigues. Lo que acaba la run es quedarte a cero. */
    const premio = (ganado || elite)
      ? recompensaDuelo(run, cat, rng(), { acto:run.pos.acto+1, elite })
      : null;
    const pack = (ganado && elite) ? null : null;   // el pack de Elite se pide aparte
    guardarYa();
    return { ...res, premio, pack, ganada:!!run.ganada, terminada:run.terminada };
  }

  /* Coger una de las tres cartas de la recompensa. */
  function cogerPremio(code){
    alBinder(run, [code], cat);
    guardarYa();
    return { binder:run.binder.length, extra:run.binderExtra.length };
  }

  function abrirPackDe(familia, { elite=false } = {}){
    conMeta(meta => apuntarSobre(meta));
    const cartas = abrirPack(run, cat, rng(), { familia, acto:run.pos.acto+1, elite });
    alBinder(run, cartas.map(c=>c.code), cat);
    marcarResuelto(); guardarYa();
    return cartas;
  }

  /* ══ UN NODO DE UTILIDAD ES UNA DECISIÓN, NO UNA TIENDA ══
     El mercader NO marcaba el nodo como resuelto al comerciar, así que
     podías volver al mapa, entrar otra vez y seguir cambiando cartas
     hasta vaciar el binder: barra libre. Ahora un trueque VÁLIDO
     consume el nodo. Cancelar o no poder pagar no lo consume.
     Y si el nodo ya está resuelto —Back, recargar, Continuar— no se
     puede volver a comerciar: la comprobación va aquí, en el estado, no
     en la pantalla, porque la pantalla se puede volver a abrir. */
  function yaGastado(){
    const n = nodoActual();
    return !!(n && n.resuelto);
  }
  function comerciar(recetaId, elegida, extra){
    if(yaGastado()) return { ok:false, motivo:"ya has comerciado en este nodo" };
    const receta = recetasDisponibles(run, cat, {}).find(r=>r.id===recetaId);
    if(!receta?.puede) return { ok:false, motivo:"no puedes pagar esa receta" };
    const res = pagarMercader(run, cat, receta, elegida, extra ?? {});
    if(res?.ok !== false) marcarResuelto();
    guardarYa();
    return res;
  }
  /* Qué cartas concretas te va a cobrar una receta. Es la misma cuenta
     que hace `pagarMercader`, pero sin cobrar: sirve para enseñarlo
     antes de que el jugador confirme. */
  function precioDe(recetaId, extra){
    const receta = recetasDisponibles(run, cat, {}).find(r=>r.id===recetaId);
    if(!receta?.puede) return [];
    return cartasQuePaga(run, cat, receta, extra ?? {});
  }
  function ofertaDe(recetaId, extra){
    const receta = recetasDisponibles(run, cat, {}).find(r=>r.id===recetaId);
    return receta ? ofertaMercader(run, cat, rng(), receta, extra ?? {}) : [];
  }

  function acamparCon(opcion, extra){
    /* Igual que el mercader: una sola acción por campamento. Refinar
       tiene dos pasos (qué sacrificas → qué te llevas) y el nodo se
       consume en el PRIMERO, que es el que ya te quita la carta: si se
       marcara en el segundo, volver atrás entre los dos pasos dejaba el
       nodo libre con la carta ya gastada. */
    if(yaGastado()) return { ok:false, motivo:"ya has acampado aquí" };
    const res = acampar(run, cat, rng(), opcion, extra ?? {});
    if(res.ok) marcarResuelto();
    guardarYa();
    return res;
  }

  function elegirEnEvento(opcion){
    const res = aplicarEvento(run, cat, rng(), opcion, { recompensas: recompensasMod });
    conMeta(meta => apuntarEncuentro(meta));
    run.historial.push({ nodo:run.pos.id, tipo:"EVENTO",
                         evento:nodoActual()?.evento?.id ?? null });
    marcarResuelto(); guardarYa();
    return res;
  }

  /* ══ SALTARSE UNA UTILIDAD ══
     Ahora que un nodo sin resolver bloquea el paso, cualquier utilidad
     que no se pueda usar te deja encerrado: el campamento cuyo buff ya
     tienes, el mercader sin recetas que puedas pagar, el sobre que ya
     abriste. Se quedaba dando vueltas para siempre —lo vi en el
     diagnóstico: cincuenta pasos seguidos en el mismo campamento—.

     La regla que lo ordena todo: los DUELOS son obligatorios y solo se
     pasan ganando; las UTILIDADES son opcionales y se pueden dejar
     pasar. Esto es lo segundo, y es lo que hace el botón "seguir sin
     usarlo". Un duelo NO se puede saltar. */
  function saltarNodo(){
    const nodo = nodoActual();
    if(!nodo) return { ok:false, motivo:"no estás en ningún nodo" };
    if(["DUELO","ELITE","JEFE"].includes(nodo.tipo) || nodo.torre)
      return { ok:false, motivo:"un duelo no se puede saltar" };
    marcarResuelto(); guardarYa();
    return { ok:true };
  }

  /* ══ RENDIR LA RUN ══
     Termina la aventura a propósito, borra el guardado de ESTA run y
     deja intacto el meta-progreso. No cuenta como victoria. */
  function rendirRun(){
    if(!run) return { ok:false };
    run.terminada = true; run.ganada = false; run.rendida = true;
    globalThis.__TELE__?.runTermina(false, run.pos?.acto ?? 0, run.chips);
    conMeta(meta => apuntarRunTerminada(meta, run, { ganada:false, rendida:true }));
    if(almacen) borrarRun(almacen);
    return { ok:true };
  }

  /* La maestría de cada personaje, para la pantalla de selección. */
  function maestriaDe(personaje){
    const meta = almacen ? cargarMeta(almacen) : { maestria:{} };
    const nivel = meta.maestria?.[personaje] ?? 0;
    return { nivel,
             pasivos: pasivosDe(personaje, nivel, datos),
             siguiente: proximoPasivo(nivel, datos),
             cartas: cartasDeMaestro(personaje, datos) };
  }

  function marcarResuelto(){
    if(run.pos.id && !run.resueltos.includes(run.pos.id)) run.resueltos.push(run.pos.id);
    const nodo = nodoPorId(run.mapa, run.pos.id);
    if(nodo) nodo.resuelto = true;
  }
  /* La preparación del castillo: eliges una utilidad y el nodo pasa a
     comportarse como ella. No se marca resuelto aquí — lo hará la
     utilidad elegida cuando termines con ella. */
  function elegirPreparacion(tipo){
    const nodo = nodoActual();
    if(!nodo || nodo.tipo !== "PREPARACION") return null;
    nodo.tipo = tipo;
    guardarYa();
    return entrar(nodo.id);
  }
  function nodoActual(){ return nodoPorId(run.mapa, run.pos.id); }

  /* ── lo que la pantalla necesita saber siempre ── */
  function estado(){
    if(!run) return null;
    return {
      semilla: run.semilla,
      personaje: run.personaje,
      /* ══ LA CARA ELEGIDA TIENE QUE LLEGAR AL DUELO ══
         El Duelista libre elige su cara al empezar y se guardaba en
         `run.avatar`, pero `estado()` no la sacaba: el tablero cogía
         `cfg.avatar`, que es la de Opciones. E eligió a Arkana y en la
         partida salió Dark Magician Girl. Y la comprobación daba verde
         porque miraba la RUN, no lo que le llega al duelo. */
      avatar: run.avatar ?? null,
      /* La torre empieza en el acto III y se pinta distinto: la pantalla
         necesita saberlo sin tener que mirar la forma del mapa. */
      enLaTorre: run.pos.acto === 2,
      chips: run.chips, meta: CHIPS.meta,
      clasificado: run.clasificado,
      chipsPerdidos: run.chipsPerdidos,
      acto: run.pos.acto, columna: run.pos.col,
      terminada: run.terminada, ganada: !!run.ganada,
      mazo: { main:run.mazo.main.length, extra:run.mazo.extra.length },
      binder: run.binder.length, binderExtra: run.binderExtra.length,
      buff: run.buffs.duelosBuff > 0 ? { lp:run.buffs.lpExtra, duelos:run.buffs.duelosBuff } : null,
      problemas: revisarMazo(run, cat),
      duelosJugados: run.historial.filter(h=>h.ganado!=null).length,
    };
  }

  /* Atajos para la pantalla: mover cartas entre mazo y binder, y saber si
     hay algo que continuar. La UI no toca `run` a mano ni para esto. */
  function meter(code){ const r = meterEnMazo(run, code, cat); guardarYa(); return r; }
  /* Todo el Main y el Extra al binder, de una vez y con un solo guardado
     (E, 03-10: «armar el mazo desde cero»). Devuelve cuántas se movieron. */
  function vaciarMazo(){
    let n = 0;
    for(const code of [...run.mazo.main, ...run.mazo.extra])
      if(sacarDelMazo(run, code, cat).ok) n++;
    guardarYa();
    return n;
  }
  function sacar(code){ const r = sacarDelMazo(run, code, cat); guardarYa(); return r; }
  function hayGuardado(){ return !!(almacen && cargar(almacen)); }

  return { empezar, continuar, abandonar, opciones, entrar,
           meterEnMazo: meter, sacarDelMazo: sacar, vaciarMazo, hayGuardado,
           guardarYa,
           resolverDuelo: resolverDueloNodo, cogerPremio, abrirPack:abrirPackDe,
           ofertaDe, precioDe, comerciar, acampar:acamparCon, elegirEnEvento,
           elegirPreparacion, saltarNodo, rendirRun,
           estado, nodoActual, chipsRestantes,
           cartasDeMaestro: p => cartasDeMaestro(p ?? run?.personaje ?? 'yugi', datos),
           pasivosDe: (p, m) => pasivosDe(p, m, datos),
           proximoPasivo: m => proximoPasivo(m, datos),
           maestriaDe, familias: FAMILIAS,
           /* Para la guía de sobres y su comprobación: sale del catálogo,
              que es el mismo que reparte los packs. */
           dondeSale: c => cat.dondeSale?.(c) ?? [],
           /* El historial del duelista, para su pantalla. */
           record: () => almacen ? recordDe(cargarMeta(almacen)) : null,
           completado: () => almacen ? completado(cargarMeta(almacen), datos) : null,
           logros: LOGROS,
           /* Lo llama la interfaz del duelo cuando juegas una carta. */
           apuntarCartaJugada: cat2 => conMeta(meta => apuntarCarta(meta, cat2)),
           contenidoDe: f => cat.contenidoDe?.(f) ?? null,
           /* El elenco elegible, con el Custom dentro solo si ya has
              ganado el torneo una vez. */
           jugables: () => jugablesDisponibles(datos,
                       almacen ? cargarMeta(almacen) : {}),
           /* Llevarse el progreso a otro navegador: es la única forma,
              porque no hay servidor donde guardarlo. */
           exportar: () => almacen ? exportarProgreso(almacen) : null,
           importar: texto => {
             if(!almacen) return { ok:false, error:"no hay dónde guardar" };
             const r = importarProgreso(almacen, texto);
             if(r.ok) run = null;      // se olvida lo cargado: manda el archivo
             return r;
           },
           get run(){ return run; }, set run(r){ run = r; } };
}
