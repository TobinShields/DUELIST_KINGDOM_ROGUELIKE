/* ══════════════════════════════════════════════════════════════════
   EL DUELISTA LIBRE

   El sexto jugable no es un personaje: es una plantilla. Eso trae tres
   cosas que ningún otro tiene y que hay que vigilar:

   1. SE DESBLOQUEA. No está hasta que ganas el torneo una vez con
      cualquiera de los cinco. Un desbloqueo que se comprueba en la
      pantalla es un desbloqueo que se pierde al repintar, así que vive
      en la API y aquí se prueba desde los botones.
   2. ELIGE CARA. Y esa cara tiene que aguantar la run entera, incluido
      recargar, y salir en el duelo.
   3. SU TORRE LLEVA A LOS CINCO. Los protagonistas se quitan a sí
      mismos del castillo; el Custom no representa a ninguno, así que
      pelea contra los cinco y luego con Pegasus. Seis combates.

   Uso:  node check-custom.mjs
   ══════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync } from "node:fs";
import { installDOM } from "./domstub.mjs";
globalThis.GOAT_SEED = 20050401;
installDOM();
globalThis.matchMedia = q => ({ matches:false, media:q, addListener(){}, removeListener(){} });
globalThis.innerWidth = 1280;

const mem = new Map();
global.localStorage = {
  getItem: k => k === "goatConfig" ? '{"idioma":"es"}' : (mem.get(k) ?? null),
  setItem: (k,v) => mem.set(k,v), removeItem: k => mem.delete(k),
};
const html = readFileSync("./out/goat.html","utf-8");
writeFileSync("./out/_cus.mjs", html.match(/<script type="module">([\s\S]*?)<\/script>/)[1]);
console.warn = () => {};
await import("./out/_cus.mjs");
await new Promise(r => setTimeout(r, 400));

let fallos = 0;
const ok  = t => console.log("  ✓ " + t);
const mal = (t,d="") => { fallos++; console.log("  ✗ " + t + (d ? "   " + d : "")); };
console.log("\n═══ EL DUELISTA LIBRE ═══\n");

const $ = id => document.getElementById(id);
function todos(n, out=[]){ if(!n) return out; out.push(n);
  for(const h of (n.children ?? [])) todos(h, out); return out; }
const conClase = (r,c) => todos(r).filter(x => x.classList?.contains?.(c));
const botones = r => todos(r).filter(x => x.tagName === "button");
const texto = n => {
  if(!n) return "";
  const h = n.children ?? [];
  if(!h.length) return String(n.textContent ?? "").trim();
  return h.map(texto).filter(Boolean).join(" ").trim() || String(n.textContent ?? "").trim();
};
const pulsar = (raiz, t) => {
  const b = botones(raiz).find(x => texto(x) === t || texto(x).startsWith(t));
  b?.onclick?.(); return !!b;
};

$("irReino").onclick?.();
const reino = $("reino");
const R = globalThis.__REINO_PRUEBA__;
if(!R){ mal("el gancho de prueba del Reino existe"); process.exit(1); }
const H = R.H;

/* OJO: con una run empezada, `irReino` abre el MAPA, no la pantalla de
   inicio. Para volver a elegir duelista hay que borrar el guardado
   primero — si no, los tramos siguientes del test miden la run anterior
   y parece que el pasivo no se aplica. */
const abrirInicio = ({ desdeCero = true, meta = null } = {}) => {
  if(desdeCero){
    mem.clear();
    H.importar(JSON.stringify(meta ?? { esquema:1, meta:{ runsGanadas:1 } }));
  }
  $("irReino").onclick?.();
};
const duelistas = () => conClase(reino,"rDuelista").map(texto);
const botonCustom = () => conClase(reino,"rDuelista")
  .find(b => /libre|custom/i.test(texto(b)));

/* ── 1 · NO ESTÁ HASTA QUE GANAS UNA VEZ ── */
{
  abrirInicio({ meta:{ esquema:1, meta:{} } });
  if(botonCustom()) mal("de salida el Duelista libre NO está", duelistas().join(" | "));
  else ok(`de salida solo están los cinco protagonistas (${conClase(reino,"rDuelista").length})`);

  abrirInicio({ meta:{ esquema:1, meta:{ runsGanadas:1, maestria:{ joey:1 } } } });
  if(!botonCustom()) mal("tras ganar el torneo una vez, aparece", duelistas().join(" | "));
  else ok("tras ganar el torneo una vez aparece el Duelista libre");
}

/* ── 2 · ELIGE CARA, Y SIN CARA NO EMPIEZA ── */
let avatarUsado = null;
{
  botonCustom()?.onclick?.();
  const caras = conClase(reino,"rAvatarPick");
  if(caras.length < 10){ mal("sale el elenco de caras para elegir", `salen ${caras.length}`); }
  else {
    /* Ni los cinco protagonistas ni Pegasus: serían dos iguales en la torre. */
    const ids = caras.map(b => b.dataset?.id);
    const prohibidos = ids.filter(id =>
      ["yugimuto","yamiyugi","joeywheeler","maikujaku","banditkeith","setokaiba","pegasus"]
      .includes(id));
    if(prohibidos.length) mal("no se ofrecen los cinco protagonistas ni Pegasus", prohibidos.join(", "));
    else ok(`hay ${caras.length} caras y ninguna es de los cinco ni de Pegasus`);

    /* Sin elegir cara no se empieza. */
    const antes = H.run;
    pulsar(reino, "Empezar");
    if(H.run && H.run !== antes && H.run.personaje === "custom")
      mal("sin elegir cara no se empieza la aventura");
    else ok("sin elegir cara no se empieza la aventura");

    avatarUsado = ids[3];
    caras[3].onclick?.();
    pulsar(reino, "Empezar");
    const run = H.run;
    if(!run || run.personaje !== "custom")
      mal("con cara elegida sí empieza", `personaje «${run?.personaje}»`);
    else if(run.avatar !== avatarUsado)
      mal("la run guarda la cara elegida", `guardó «${run.avatar}»`);
    else ok(`la run arranca como Duelista libre con la cara «${run.avatar}»`);
  }
}

/* ── 3 · LA CARA SOBREVIVE A RECARGAR ── */
{
  H.continuar?.();
  if(H.run?.avatar !== avatarUsado)
    mal("la cara sobrevive a recargar", `${avatarUsado} → ${H.run?.avatar}`);
  else ok("la cara sobrevive a recargar la página");
  /* ══ Y LA MANDA AL DUELO — A LOS DOS DUELOS ══
     Esto buscaba la expresión en TODO el bundle. Hay dos funciones que
     lanzan un duelo —`empezarDuelo` (el libre) y `lanzarDueloDelReino`
     (el del mapa)— y la expresión solo estaba en la primera: el test la
     encontraba, daba verde, y en el Reino salías con la cara de
     Opciones. Lo reportó E: eligió a Arkana y jugó de Dark Magician
     Girl. Ahora se mira DENTRO de cada función, no en el montón. */
  const js = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  const cuerpoDe = nombre => {
    const i = js.indexOf(`function ${nombre}(`);
    if(i < 0) return null;
    /* Hasta la SIGUIENTE función, no un número de caracteres: una
       ventana fija caduca en cuanto la función crece. */
    const j = js.indexOf("\nfunction ", i + 10);
    return js.slice(i, j < 0 ? js.length : j);
  };
  /* ══ Y LA CARA LA GUARDA LA RUN PARA TODOS ══
     La comprobación anterior solo miraba al Duelista libre, así que el
     arreglo se escribió solo para él: con Yugi o con Joey `run.avatar`
     se quedaba en null, el duelo caía al respaldo —la cara de
     Opciones— y E jugaba de Dark Magician Girl con quien fuera. Aquí se
     empieza una run con CADA jugable y se exige que la cara viaje. */
  for(const quien of ["yugi", "joey", "mai", "keith", "kaiba"]){
    H.empezar({ semilla:"CARA", personaje:quien });
    const cara = H.run?.avatar;
    if(!cara)
      mal(`la run de ${quien} guarda su cara`,
          "sin ella el duelo cae a la de Opciones");
    else ok(`la run de ${quien} guarda su cara («${cara}»)`);
  }

  for(const fn of ["lanzarDuelo", "lanzarDueloDelReino"]){
    const cuerpo = cuerpoDe(fn);
    if(!cuerpo) mal(`existe ${fn}()`);
    else if(!/REINO\?\.run\?\.avatar \?\? cfg\.avatar/.test(cuerpo))
      mal(`${fn}() usa la cara de la run, no la de Opciones`,
          "pon `REINO?.run?.avatar ?? cfg.avatar`");
    else ok(`${fn}() usa la cara de la run, no la de Opciones`);
  }
}

/* ── 4 · SU TORRE SON LOS CINCO Y PEGASUS ── */
{
  const torreDe = quien => {
    mem.clear();
    H.importar(JSON.stringify({ esquema:1, meta:{ runsGanadas:1 } }));
    H.empezar({ semilla:"TORRE-"+quien, personaje:quien, avatar:"bonz" });
    return (H.run.mapa.actos[2].columnas.flat()
             .filter(n => n.torre).map(n => n.torre));
  };
  const custom = torreDe("custom"), yugi = torreDe("yugi");
  const esperado = ["mai","keith","joey","kaiba","yugi","pegasus"];
  if(JSON.stringify(custom) !== JSON.stringify(esperado))
    mal("la torre del Custom son los CINCO y Pegasus", custom.join(" → "));
  else ok(`la torre del Custom: ${custom.join(" → ")}`);
  if(yugi.length !== 5 || yugi.includes("yugi"))
    mal("y la de un protagonista sigue quitándose a sí mismo", yugi.join(" → "));
  else ok(`y la de Yugi sigue siendo cinco sin él: ${yugi.join(" → ")}`);
}

/* ── 5 · SUS TRES VENTAJAS, PULSANDO BOTONES ── */
{
  const VAL = { C:0, R:1, SR:2, UR:3 };
  abrirInicio({ meta:{ esquema:1, meta:{ runsGanadas:1, maestria:{ custom:3 } } } });
  botonCustom()?.onclick?.();
  const caras = conClase(reino,"rAvatarPick");
  caras[2]?.onclick?.();
  const ventajas = conClase(reino,"rVentaja");
  if(ventajas.length !== 3){ mal("con maestría 3 el Custom tiene sus tres ventajas",
                                 `tiene ${ventajas.length}`); }
  else {
    /* Carta de maestro: diez genéricas, ninguna que gane sola. */
    ventajas.find(b => /maestro/i.test(texto(b)))?.onclick?.();
    const cartas = conClase(reino,"rCarta");
    if(cartas.length < 10) mal("sus diez cartas genéricas", `salen ${cartas.length}`);
    else {
      cartas[1].onclick?.();
      conClase(reino,"rAvatarPick")[2]?.onclick?.();
      pulsar(reino, "Empezar");
      if(H.run?.mazo.main.length !== 41 || H.run?.pasivo !== "carta-de-maestro")
        mal("la carta genérica entra al mazo",
            `pasivo=${H.run?.pasivo} mazo=${H.run?.mazo.main.length}`);
      else ok(`la carta genérica entra al mazo del Custom (${H.run.mazo.main.length})`);
    }

    /* Sobre de contactos. */
    abrirInicio({ meta:{ esquema:1, meta:{ runsGanadas:1, maestria:{ custom:3 } } } }); botonCustom()?.onclick?.();
    conClase(reino,"rAvatarPick")[2]?.onclick?.();
    conClase(reino,"rVentaja").find(b => /contactos|sobre/i.test(texto(b)))?.onclick?.();
    conClase(reino,"rFamilia")[0]?.onclick?.();
    pulsar(reino, "Empezar");
    const enBinder = (H.run?.binder?.length ?? 0) + (H.run?.binderExtra?.length ?? 0);
    if(H.run?.pasivo !== "primer-sobre" || enBinder < 10)
      mal("el sobre del Custom se abre", `pasivo=${H.run?.pasivo} binder=${enBinder}`);
    else ok(`el sobre del Custom se abre (${enBinder} al binder)`);

    /* Mano firme, con tres semillas: sube pesos, no garantiza cartas. */
    const rarezas = (conPasivo, k) => {
      abrirInicio({ meta:{ esquema:1, meta:{ runsGanadas:1, maestria:{ custom:3 } } } }); botonCustom()?.onclick?.();
      conClase(reino,"rAvatarPick")[2]?.onclick?.();
      if(conPasivo) conClase(reino,"rVentaja").find(b => /firme/i.test(texto(b)))?.onclick?.();
      const inp = todos(reino).find(x => x.tagName === "input");
      if(inp) inp.value = "CUS-MF-" + k;
      pulsar(reino, "Empezar");
      let suma = 0;
      for(let i = 0; i < 22; i++){
        const ops = H.opciones(); if(!ops.length) break;
        const c = H.entrar(ops[0].id);
        if(["DUELO","ELITE","JEFE"].includes(c.tipo)){
          const r = H.resolverDuelo({ ganado:true, rivalId:c.rival?.id, elite:c.tipo==="ELITE" });
          for(const p of (r.premio ?? [])) suma += VAL[p.rareza] ?? 0;
          if(r.premio?.length) H.cogerPremio(r.premio[0].code);
        }
        else if(c.tipo === "PREPARACION"){ H.elegirPreparacion("PACK"); H.abrirPack("ARCANE"); }
        else if(c.tipo === "PACK") H.abrirPack("ARCANE");
        else if(c.tipo === "CAMPAMENTO"){ if(!H.acampar("lp")?.ok) H.saltarNodo(); }
        else if(c.tipo === "EVENTO") H.elegirEnEvento(c.evento.opciones[0]);
        else H.saltarNodo();
      }
      return suma;
    };
    let sin = 0, con = 0;
    for(const k of [1,2,3]){ sin += rarezas(false, k); con += rarezas(true, k); }
    if(!(con > sin)) mal("«mano firme» del Custom sube la rareza", `sin ${sin}, con ${con}`);
    else ok(`«mano firme» del Custom sube la rareza (${sin} → ${con} en tres semillas)`);
  }
}

/* ══════════════════════════════════════════════════════════════════
   Y SUS MAZOS INICIALES NO PUEDEN SER MEJORES QUE LOS DE LOS CINCO

   La primera versión de los starters del Custom puntuaba 86,3 contra
   46,7 de media de los protagonistas: llevaba el paquete de staples
   entero de salida —Pot of Greed, Graceful Charity, Heavy Storm, Snatch
   Steal, Premature, Mirror Force, Torrential, Metamorphosis…—. Con eso
   no queda nada que ganar durante la run: la progresión del roguelike se
   viene abajo antes de empezar.

   Se puntúa por lo que una carta CAMBIA una partida de Goat, no por su
   rareza de imprenta.
   ══════════════════════════════════════════════════════════════════ */
{
  const DECKS = JSON.parse(readFileSync("../data/story/decks.json","utf-8"));
  const POOLS = JSON.parse(readFileSync("../data/story/cards.json","utf-8"));
  const TEXTOS = JSON.parse(readFileSync("../data/pool_texts.json","utf-8"));
  const nom = c => { const v = TEXTOS[String(c)];
                     return (Array.isArray(v) ? v[0] : v) ?? String(c); };
  const UR = new Set(["Pot of Greed","Graceful Charity","Delinquent Duo","Snatch Steal",
    "Premature Burial","Heavy Storm","Mirror Force","Ring of Destruction (Pre-Errata)",
    "Torrential Tribute","Call of the Haunted","Metamorphosis","Scapegoat (GOAT)",
    "Black Luster Soldier - Envoy of the Beginning (GOAT)","Chaos Sorcerer",
    "Thousand-Eyes Restrict (GOAT)","Tribe-Infecting Virus","Sinister Serpent (Pre-Errata)",
    "Confiscation","Mystical Space Typhoon","Painful Choice","Dark Hole","Raigeki",
    "Change of Heart","Monster Reborn","Harpie's Feather Duster","Exchange of the Spirit"]);
  const SR = new Set(["Breaker the Magical Warrior","D.D. Warrior Lady","Magician of Faith",
    "Sangan (GOAT)","Book of Moon","Nobleman of Crossout (GOAT)","Sakuretsu Armor",
    "Trap Dustshoot","Dust Tornado","Solemn Judgment","Tsukuyomi","Airknight Parshath",
    "Asura Priest","Dekoichi the Battlechanted Locomotive","Spirit Reaper (GOAT)",
    "Exiled Force","Mystic Tomato (GOAT)","Gravekeeper's Spy (GOAT)",
    "Reinforcement of the Army (GOAT)","Enemy Controller","Compulsory Evacuation Device",
    "Nobleman of Extermination","Mother Grizzly (GOAT)","Wall of Revealing Light",
    "Smashing Ground","Creature Swap","Emergency Provisions","Dark Mimic LV1 (GOAT)",
    "Night Assailant","Magic Cylinder","Waboku","Mirage of Nightmare",
    "Skilled Dark Magician (GOAT)"]);
  const VAL = { UR:3, SR:2, R:1 };
  const potencia = main => main.reduce((a,c) =>
    a + VAL[UR.has(nom(c)) ? "UR" : SR.has(nom(c)) ? "SR" : "R"], 0);

  const custom = Object.entries(DECKS)
    .filter(([id,d]) => id.startsWith("custom-starter") && d.main?.length === 40);
  const cinco = Object.entries(DECKS)
    .filter(([id,d]) => /^(yugi|joey|mai|keith|kaiba)-starter/.test(id) && d.main?.length === 40);

  /* Cinco desde que E pidió una identidad por cada arquetipo: Flip
     Control, Ritual, Fusión, Necrovalley y Zombis. */
  if(custom.length !== 5) mal("hay cinco starters del Custom de 40 cartas", `hay ${custom.length}`);
  else {
    const pc = custom.map(([,d]) => potencia(d.main));
    const pn = cinco.map(([,d]) => potencia(d.main));
    const mediaC = pc.reduce((a,b)=>a+b,0) / pc.length;
    const mediaN = pn.reduce((a,b)=>a+b,0) / pn.length;
    const max = Math.max(...pn), min = Math.min(...pn);
    if(mediaC > max)
      mal("los starters del Custom no superan al más fuerte de los cinco",
          `custom ${mediaC.toFixed(1)}, el mejor de los cinco ${max}`);
    else if(mediaC < min - 4)
      mal("ni se quedan muy por debajo del más flojo",
          `custom ${mediaC.toFixed(1)}, el más flojo ${min}`);
    else ok(`potencia de los starters Custom ${mediaC.toFixed(1)} contra ${mediaN.toFixed(1)}`
            + ` de los cinco (rango ${min}-${max}): al mismo nivel`);

    /* Y lo concreto: nada del paquete de staples salvo el MST que
       llevan también los demás. */
    const conStaples = custom.filter(([,d]) =>
      [...new Set(d.main)].map(nom)
        .some(n => UR.has(n) && n !== "Mystical Space Typhoon"));
    if(conStaples.length)
      mal("ningún starter del Custom empieza con staples",
          conStaples.map(([id,d]) => `${id}: ` +
            [...new Set(d.main)].map(nom)
              .filter(n => UR.has(n) && n !== "Mystical Space Typhoon").join(", ")).join(" · "));
    else ok("y ninguno empieza con Pot, Graceful, Heavy Storm, Snatch, Premature ni Metamorphosis");

    /* ══ EXTRA DECK: SOLO EL DE FUSIÓN, Y SIN PREMIOS ══
       Un Thousand-Eyes Restrict de salida es medio motor de Goat
       regalado. Pero el starter de Fusión sin fusiones no es un starter
       de Fusión, así que la regla no es "sin extra deck": es que ninguna
       de las que lleve esté en las listas PREMIUM del generador, que son
       las que se ganan jugando. */
    const PREMIUM = new Set([...(POOLS.fusion ?? []), ...(POOLS.fusionTematica ?? [])]);
    const conPremio = custom.filter(([,d]) =>
      (d.extra ?? []).some(c => PREMIUM.has(c)));
    if(conPremio.length)
      mal("ningún starter lleva de salida una fusión de las que se ganan",
          conPremio.map(([id,d]) => `${id}: ` +
            [...new Set(d.extra)].filter(c=>PREMIUM.has(c)).map(nom).join(", ")).join(" · "));
    else {
      const conExtra = custom.filter(([,d]) => (d.extra ?? []).length);
      ok(conExtra.length
        ? `solo ${conExtra.map(([id])=>id.replace("custom-starter-","")).join(", ")} lleva extra deck, y sin fusiones premium`
        : "ninguno lleva extra deck de salida");
    }
  }
}

console.log(`\n${fallos ? "FALLA: " + fallos : "Todo correcto"}`);
process.exit(fallos ? 1 : 0);
