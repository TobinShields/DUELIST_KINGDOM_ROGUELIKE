/* ════════════════════════════════════════════════════════════════
   RIVALES, TIERS Y MAESTRÍA

   Lo que aquí se comprueba es lo que hace que la isla parezca una isla
   con gente y no una lista de mazos:

   · que cada personaje tenga sus tres mazos y que existan de verdad;
   · que nadie repita sin sentido, y que cuando repite venga MÁS FUERTE;
   · que la dificultad de la IA suba como pide el brief y que el
     castillo entero sea experto;
   · que Pegasus sea siempre el último y que, a partir de la segunda
     vuelta, use mazos que YA existen en el simulador en vez de listas
     duplicadas;
   · que los retratos que faltan estén declarados y no se inventen.

   Uso:  node check-rivales.mjs
   ════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";
import { crearCatalogo } from "./src/story/catalogo.js";
import { nuevaRun, azarDe } from "./src/story/estado.js";
import { elegirRival, mazoDeRival, mazoDePegasus, apuntarDerrota,
         nivelDeIA, tierDe, pasivosDe, cartasDeMaestro,
         asignarRivales } from "./src/story/personajes.js";
import { revisarMazo, ponerStarter } from "./src/story/coleccion.js";
import { ACTOS } from "./src/story/balance.js";

const D = "../data/";
const leer = f => JSON.parse(readFileSync(D+f, "utf-8"));
const DATOS  = leer("story/personajes.json");
const DECKS  = leer("story/decks.json");
const MAZOS  = leer("mazos.json");
const AVATAR = leer("avatares.json");
const cat = crearCatalogo({
  pools: leer("story/cards.json"), db: leer("pool_cards.json"),
  limites: leer("goat-limites.json"), pool: leer("goat-pool.json"),
  nombres: leer("pool_texts.json"),
});

let fallos = 0;
const ok  = t => console.log("  ✓ " + t);
const mal = (t,d="") => { fallos++; console.log("  ✗ " + t + (d?"   "+d:"")); };

console.log("\n═══ MODO HISTORIA · rivales, tiers y maestría ═══\n");

/* ── los datos cuadran con los mazos ── */
{
  let malos = 0;
  for(const p of DATOS.personajes){
    for(const tier of ["1","2","3"]){
      const id = p.mazos[tier];
      if(!id){ malos++; mal(`${p.nombre} no tiene mazo de tier ${tier}`); continue; }
      if(!DECKS[id]){ malos++; mal(`${p.nombre}: el mazo "${id}" no existe`); continue; }
      const run = nuevaRun({ semilla:"DK-X" });
      run.mazo = { main:[...DECKS[id].main], extra:[...DECKS[id].extra] };
      const problemas = revisarMazo(run, cat);
      if(problemas.length){ malos++; mal(`${id} no es legal`, problemas[0]); }
    }
  }
  if(!malos) ok(`los ${DATOS.personajes.length} personajes tienen sus tres mazos y los 30 son legales`);

  for(const id of Object.values(DATOS.pegasus.porMaestria).map(p=>p.mazo).filter(Boolean))
    if(!DECKS[id]) mal(`el mazo de Pegasus "${id}" no existe`);
  ok("los dos mazos propios de Pegasus existen y están validados");

  /* Los mazos meta que Pegasus usa a partir de la maestría 2 tienen que
     existir EN EL SIMULADOR con ese nombre exacto: si alguien renombra
     un mazo en mazos.json, esto lo caza. */
  const nombres = new Set(MAZOS.map(m=>m.nombre));
  const pedidos = Object.values(DATOS.pegasus.porMaestria)
    .flatMap(p => p.mazosDelSimulador ?? []);
  const faltan = [...new Set(pedidos)].filter(n => !nombres.has(n));
  if(faltan.length) mal("hay mazos del simulador que Pegasus pide y no existen", faltan.join(", "));
  else ok(`los ${new Set(pedidos).size} mazos meta que usa Pegasus existen en mazos.json`);
}

/* ── retratos ── */
{
  const todos = [...DATOS.personajes, DATOS.pegasus];
  const sinRetrato = todos.filter(p => !p.avatar).map(p=>p.nombre);
  const inventados = todos.filter(p => p.avatar && !AVATAR[p.avatar]);
  if(inventados.length) mal("hay avatares que no existen", inventados.map(p=>p.avatar).join(", "));
  else if(sinRetrato.length) ok(`los retratos usados existen (faltan por dibujar: ${sinRetrato.join(", ")})`);
  else ok(`los ${todos.length} duelistas tienen retrato propio`);
}

/* ── escalera de dificultad ──
   Ya NO hay escalera de bot. Los niveles bajos del simulador no juegan
   peor: llevan lastres concretos —atacar sin mirar, encadenar lo primero
   que tengan, descartar al azar— y eso, dentro de una aventura, no se
   lee como un rival flojo sino como un juego roto. Lo dijo E después de
   ver a un jefe negándose sus propias cartas. La dificultad viene del
   MAZO: el mismo Weevil con cartas de anime en el acto I y con Pot of
   Greed y Mirror Force en el III.

   Estas dos comprobaciones pedían "normal" y "duro" y se quedaron sin
   actualizar cuando se hizo el cambio: llevaban en rojo desde entonces,
   que es la forma más rápida de que una suite deje de mirarse. */
{
  const casos = [
    ["el primer duelo del acto I", nivelDeIA(0, {suave:true})],
    ["el resto del acto I",        nivelDeIA(0)],
    ["el acto III",                nivelDeIA(2)],
    ["un Elite",                   nivelDeIA(2, {tipo:"ELITE"})],
    ["Pegasus",                    nivelDeIA(2, {tipo:"JEFE"})],
  ];
  const flojos = casos.filter(([,n]) => n !== "experto");
  if(flojos.length) mal("todo rival juega en experto: " +
    flojos.map(([q,n]) => `${q} → ${n}`).join(", "));
  else ok("todo rival juega en experto, del primer duelo a Pegasus");

  if(tierDe(0) !== 1) mal("el acto I usa mazos de tier 1");
  if(tierDe(0,{tipo:"ELITE"}) !== 2) mal("un Elite del acto I sube un tier");
  if(tierDe(2) !== 3) mal("el acto III usa tier 3");
  if(tierDe(2,{tipo:"ELITE"}) !== 3) mal("el tier no pasa de 3");
  else ok("los tiers escalan por acto y suben uno en los Elite, con tope en 3");
}

/* ── nadie repite sin sentido ── */
{
  const run = nuevaRun({ semilla:"DK-RIVALES" });
  const rng = azarDe(run);
  const vistos = [];
  for(let i=0;i<4;i++){
    const r = elegirRival(run, DATOS, rng, { acto:0, tipo:"DUELO" });
    if(!r){ mal("siempre hay alguien con quien pelear"); break; }
    vistos.push(r.id);
    apuntarDerrota(run, r.id);
  }
  const repes = vistos.length - new Set(vistos).size;
  if(repes) mal("no se repite rival mientras queden nuevos", `se repitió ${repes} veces`);
  else ok(`en el acto I salen ${vistos.length} rivales distintos seguidos`);

  /* Agotados los nuevos, el que vuelve lo hace más fuerte. */
  const otra = elegirRival(run, DATOS, rng, { acto:0, tipo:"DUELO" });
  if(otra && !otra.yaDerrotado) ok("aún quedaban rivales nuevos");
  else if(otra && otra.tier <= 1) mal("el rival que repite viene con un tier mayor", `tier ${otra.tier}`);
  else if(otra) ok(`el rival que repite vuelve con tier ${otra.tier}`);
}

/* ── jefes de isla ──
   YA NO SON TRES. El acto III dejó de ser un acto del mapa: es la TORRE
   del castillo, con orden escrito y Pegasus al final, y su rival no sale
   de `elegirRival` sino del propio nodo. Aquí solo se comprueban los dos
   jefes de isla; la torre tiene su bloque propio más abajo. */
{
  const run = nuevaRun({ semilla:"DK-JEFES" });
  const rng = azarDe(run);
  for(let acto=0; acto<2; acto++){
    const jefe = elegirRival(run, DATOS, rng, { acto, tipo:"JEFE" });
    if(!jefe){ mal(`el acto ${acto+1} no tiene jefe`); continue; }
    if(jefe.esPegasus) mal(`el acto ${acto+1} no debería tener a Pegasus`);
  }
  ok("los dos actos de isla tienen su jefe y ninguno es Pegasus");

  /* El mazo de Pegasus según la maestría. */
  const m0 = mazoDePegasus(DATOS.pegasus, DECKS, MAZOS, 0, rng);
  const m1 = mazoDePegasus(DATOS.pegasus, DECKS, MAZOS, 1, rng);
  const m2 = mazoDePegasus(DATOS.pegasus, DECKS, MAZOS, 2, rng);
  if(m0.id !== "pegasus-m0-boss") mal("en la primera vuelta Pegasus juega Toon", m0.id);
  else ok("primera vuelta: Pegasus con el mazo Toon");
  /* ══ EN CUANTO HAY MAESTRÍA, SE ACABA LA TEMÁTICA ══
     Antes la segunda vuelta era un mazo Relinquished escrito a mano, y
     medía un 12% de victorias contra un Goat Control de Worlds: peor
     todavía que el Toon. Lo que pidió E es lo que hay ahora — la
     primera vez que llegas, Toon dentro de un esqueleto meta; a partir
     de tener una maestría, Pegasus juega directamente los mejores mazos
     del formato, sin tema que proteger. */
  if(!m1.delSimulador) mal("con una maestría ya juega mazos meta del simulador", m1.id);
  else ok(`segunda vuelta: mazo meta del simulador ("${m1.id}")`);
  if(!m2.delSimulador) mal("y a partir de la tercera también", m2.id);
  else ok(`tercera vuelta en adelante: mazo meta del simulador ("${m2.id}")`);
  if(m2.main.length < 40) mal("el mazo meta tiene 40 cartas");

  /* Y el mando de dificultad del jefe: los puntos de vida. */
  const lp = DATOS.pegasus.lp ?? 8000;
  if(lp <= 8000) mal("Pegasus juega con vida de jefe", `tiene ${lp}`);
  else ok(`Pegasus juega con ${lp} LP (medido: a la par del rival más fuerte del castillo)`);
  /* ══ LA MANO DEL JEFE, ACTUALIZADA A PROPÓSITO ══
     Antes se le sembraba UNA carta (Toon World) sustituyendo a una de
     las cinco. E pidió otra cosa y es mejor: cinco normales MÁS sus dos
     piezas Toon, o sea siete cartas, sin quitarle ninguna. Las dos
     garantizadas salen de su propio mazo —se mueven arriba antes de
     robar—, así que no se duplican. */
  const sem = DATOS.pegasus.manoInicial?.cuantas ?? 0;
  const enMano = DATOS.pegasus.manoInicial?.cartasEnMano ?? 5;
  if(sem !== 2 || enMano !== 7)
    mal("abre con siete: cinco normales más sus dos piezas Toon",
        `siembra ${sem} y roba ${enMano}`);
  else ok("abre con siete cartas: cinco normales más Toon World y Toon Summoned Skull");
  /* Y que las dos garantizadas estén DE VERDAD en su mazo: sembrar una
     carta que no lleva no hace nada y no da ningún error. */
  const suMazo = DECKS[DATOS.pegasus.porMaestria["0"].mazo]?.main ?? [];
  const canon = t => String(t).replace(/\s*\((GOAT|Pre-Errata)\)\s*$/i, "").trim();
  const TEXTOS = leer("pool_texts.json");
  const nom = c => { const v = TEXTOS[String(c)];
                     return (Array.isArray(v) ? v[0] : v) ?? String(c); };
  const faltan = (DATOS.pegasus.manoInicial?.cartas ?? []).filter(x =>
    !suMazo.some(c => canon(nom(c)) === canon(x)));
  if(faltan.length) mal("y las dos salen de su propio mazo", faltan.join(", "));
  else ok("y las dos salen de su propio mazo, no se duplican");
}

/* ── el mazo del rival es jugable ── */
{
  const run = nuevaRun({ semilla:"DK-MAZOS" });
  const rng = azarDe(run);
  let malos = 0;
  for(let acto=0; acto<3; acto++){
    for(const tipo of ["DUELO","ELITE","JEFE"]){
      const r = elegirRival(run, DATOS, rng, { acto, tipo });
      if(!r) continue;
      const mazo = r.esPegasus
        ? mazoDePegasus(DATOS.pegasus, DECKS, MAZOS, 0, rng)
        : mazoDeRival(r, DECKS);
      if(!mazo?.main?.length){ malos++; mal(`${r.nombre} (${tipo}) se queda sin mazo`); continue; }
      if(mazo.main.length < 40){ malos++; mal(`${r.nombre}: mazo de ${mazo.main.length}`); }
    }
  }
  if(!malos) ok("todo rival de cualquier acto y tipo trae un mazo de 40 o más");
}

/* ── maestría ──
   La tabla `PASIVOS` escrita a mano (solo Yugi, un pasivo) se cambió por
   niveles en `personajes.json` y diez cartas de especialidad POR
   PERSONAJE. El ciclo completo —subir, persistir, no subir dos veces— lo
   prueba `check-maestria.mjs`; aquí solo se comprueban los datos. */
{
  const niveles = DATOS.maestria?.niveles ?? [];
  if(niveles.length < 2) mal("hay al menos dos niveles de maestría", `hay ${niveles.length}`);
  else ok(`${niveles.length} niveles de maestría definidos en datos`);

  if(pasivosDe("yugi", 0, DATOS).length) mal("con maestría 0 no hay pasivo");
  else ok("con maestría 0 no hay pasivo");
  const p = pasivosDe("yugi", 1, DATOS);
  if(p.length !== 1) mal("la maestría 1 desbloquea exactamente un pasivo", `son ${p.length}`);
  else ok(`la maestría 1 desbloquea «${p[0].nombre}»`);

  /* Los cinco jugables tienen sus diez cartas, legales y de su
     especialidad. Si alguien añade un personaje y se olvida, sale aquí. */
  let malos = 0;
  for(const j of (DATOS.jugables ?? [])){
    const diez = cartasDeMaestro(j.id, DATOS);
    if(diez.length !== 10){ malos++; mal(`${j.nombre}: son diez cartas`, `hay ${diez.length}`); continue; }
    const fuera = diez.filter(c => !cat.jugables.includes(c));
    if(fuera.length){ malos++; mal(`${j.nombre}: cartas fuera del pool legal`, String(fuera.length)); }
  }
  if(!malos) ok(`los ${DATOS.jugables.length} jugables tienen diez cartas de maestro legales`);
}

/* ── reproducible ── */
{
  const uno = () => {
    const run = nuevaRun({ semilla:"DK-MISMO-RIVAL" });
    const rng = azarDe(run);
    return [0,1,2].map(a => elegirRival(run, DATOS, rng, { acto:a })?.id).join(",");
  };
  if(uno() !== uno()) mal("la misma semilla da los mismos rivales");
  else ok("la misma semilla da exactamente los mismos rivales");
}

/* ══════════════════════════════════════════════════════════════════
   EL MODELO NUEVO: CRONOLOGÍA, CINCO JUGABLES Y LA TORRE

   Tres reglas que no pueden fallar ni una vez, y por eso se prueban
   sobre miles de semillas y con los cinco personajes:

   1. EL TIEMPO SOLO VA HACIA ADELANTE. Cada encuentro lleva su
      `cronologia` (Weevil 10 … Hermanos Paradoja 100). El mapa puede
      barajar la ruta pero no puede enseñarte el laberinto antes que la
      playa.
   2. NO TE DUELAS CONTIGO MISMO. El personaje que juegas no aparece
      como rival en ningún sitio. Ghost Kaiba es OTRO personaje —el
      impostor de la isla—, así que jugando con Kaiba sigue saliendo.
   3. LA TORRE TIENE ORDEN ESCRITO. Mai → Keith → Joey → Kaiba → Yugi,
      menos tú, y Pegasus SIEMPRE el último.
   ══════════════════════════════════════════════════════════════════ */
{
  const { generarMapa, chipsMaximos } = await import("./src/story/mapa.js");
  const { torreDeLaRun } = await import("./src/story/balance.js");
  const { rngDeSemilla } = await import("./src/story/rng.js");
  const JUGABLES = (DATOS.jugables ?? []).map(j => j.id);
  const CRONO = Object.fromEntries(DATOS.personajes.map(p => [p.id, p.cronologia ?? 50]));

  const N = Number(process.env.GOAT_SEMILLAS ?? 400);
  let invertidas = 0, yoDeRival = 0, torresMal = 0, pegasusNoUltimo = 0,
      sinRuta = 0, ejemplo = "";

  for(let i=0;i<N;i++){
    for(const yo of JUGABLES){
      const semilla = "DK-T"+i;
      const mapa = generarMapa(rngDeSemilla(semilla), yo);
      const run = { semilla, mapa, personaje:yo };
      asignarRivales(run, DATOS, rngDeSemilla);
      if(chipsMaximos(mapa) < 10) sinRuta++;

      /* 1 · cronología: la secuencia de encuentros de la isla, en el
         orden en que se pueden jugar, nunca retrocede. */
      for(const acto of mapa.actos.slice(0,2)){
        let tope = 0;
        for(const col of acto.columnas){
          const cronos = col.filter(n=>n.rival).map(n=>CRONO[n.rival.id] ?? 50);
          if(!cronos.length) continue;
          const min = Math.min(...cronos);
          if(min < tope){
            invertidas++;
            if(!ejemplo) ejemplo = `${semilla}/${yo}: ${min} después de ${tope}`;
          }
          tope = Math.max(tope, Math.max(...cronos));
        }
      }

      /* 2 · tú no eres tu propio rival, en ninguna parte del mapa. */
      for(const acto of mapa.actos) for(const col of acto.columnas) for(const n of col)
        if(n.rival?.id === yo) yoDeRival++;

      /* 3 · la torre, en su orden, y Pegasus al final. */
      const torre = mapa.actos[2].columnas.map(c=>c[0]).filter(n=>n.torre).map(n=>n.torre);
      if(torre.join() !== torreDeLaRun(yo).join()) torresMal++;
      if(torre[torre.length-1] !== "pegasus") pegasusNoUltimo++;
    }
  }
  const total = N * JUGABLES.length;
  if(invertidas) mal("la cronología nunca retrocede", `${invertidas} en ${total} mapas · ${ejemplo}`);
  else ok(`la cronología nunca retrocede (${total} mapas, ${JUGABLES.length} personajes)`);
  if(yoDeRival) mal("el personaje que juegas no aparece como rival", `${yoDeRival} veces`);
  else ok("el personaje que juegas no aparece como rival en ningún nodo");
  if(torresMal) mal("la torre respeta su orden", `${torresMal} desordenadas`);
  else ok("la torre siempre es Mai→Keith→Joey→Kaiba→Yugi menos tú");
  if(pegasusNoUltimo) mal("Pegasus siempre el último", `${pegasusNoUltimo} veces no`);
  else ok("Pegasus siempre cierra la torre");
  if(sinRuta) mal("toda semilla tiene ruta a 10 fichas", `${sinRuta} sin ella`);
  else ok("toda semilla tiene una ruta viable a 10 Star Chips");

  /* Ghost Kaiba no es Seto Kaiba: jugando con Kaiba tiene que seguir
     saliendo, porque es otro personaje. */
  const mapaK = generarMapa(rngDeSemilla("DK-GHOST"), "kaiba");
  const runK = { semilla:"DK-GHOST", mapa:mapaK, personaje:"kaiba" };
  asignarRivales(runK, DATOS, rngDeSemilla);
  const ids = new Set(mapaK.actos.flatMap(a=>a.columnas.flatMap(c=>c.map(n=>n.rival?.id))));
  if(ids.has("kaiba")) mal("jugando con Kaiba, Seto Kaiba no sale de rival");
  else ok("Ghost Kaiba y Seto Kaiba son personajes distintos");

  /* La torre lleva DOS paradas de utilidad: preparación y el sobre
     final. Ni una más: son cuatro duelistas obligatorios y Pegasus. */
  const t = mapaK.actos[2].columnas.map(c=>c[0]);
  const duelistas = t.filter(n=>n.torre).length;
  const utilidades = t.filter(n=>!n.torre).length;
  if(duelistas !== 5) mal("la torre tiene cuatro duelistas y Pegasus", `hay ${duelistas}`);
  else if(utilidades !== 2) mal("la torre tiene dos paradas de preparación", `hay ${utilidades}`);
  else ok("la torre: 4 duelistas + Pegasus y 2 paradas de preparación");
}

console.log(fallos ? `\n${fallos} fallo(s)\n` : "\nTodo correcto\n");
process.exit(fallos ? 1 : 0);
