/* ══════════════════════════════════════════════════════════════════
   QUE EL JUEGO DE VERDAD PIENSE

   `check-pensar` prueba el módulo; esto prueba el HTML construido: se
   juega una partida como humano sobre el DOM simulado y se mira el log
   del duelo, que es donde el bot apunta lo que ha pensado.

   Tiene que aparecer:
     · `lectura:` — la lectura del tablero (reloj, cartas, amenaza, postura)
     · `ia_simula` — al menos una decisión simulada en su Main Phase
   Y si en tu turno le atacas, también la ventana de cadena. Como eso
   depende de la partida, solo se exige cuando ha habido un ataque tuyo.

   Uso: node check-pensar-juego.mjs
   ══════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync } from "node:fs";
import { installDOM } from "./domstub.mjs";
globalThis.GOAT_SEED = 20050401;
installDOM();
global.localStorage = { getItem:k => k==="goatConfig" ? '{"idioma":"es"}' : null, setItem(){}, removeItem(){} };
const html = readFileSync("./out/goat.html","utf-8");
writeFileSync("./out/_pj.mjs", html.match(/<script type="module">([\s\S]*?)<\/script>/)[1]);
console.warn = () => {};
await import("./out/_pj.mjs");
const sleep = ms => new Promise(r=>setTimeout(r,ms));
await sleep(300);

let fallos = 0;
const ok  = t => console.log("  ✓ " + t);
const mal = (t,d="") => { fallos++; console.log("  ✗ " + t + (d?"   "+d:"")); };
console.log("\n═══ EL BOT PIENSA EN EL JUEGO ═══\n");

document.getElementById("mJugar").onclick?.();
const p = document.getElementById("prompt"), ctl = document.getElementById("controles");
/* Mismo guion que `jugar.mjs`: abrir "todas las acciones" y elegir la
   primera jugada de verdad; terminar el turno en cuanto se puede. Lo que
   importa aquí no es jugar bien sino que le llegue el turno al bot. */
let acciones = 0, ataques = 0;
for(let i=0;i<1200 && acciones<40;i++){
  await sleep(60);
  if(p.style.display === "block"){
    const t = String(p.innerHTML).replace(/<[^>]+>/g," ").trim();
    const btns = p.children[p.children.length-1]?.children ?? [];
    const L = [...btns].map(b=>b.textContent);
    let k = L.findIndex(x=>/Ver todas/.test(x));
    if(/Todas las acciones/.test(t)) k = L.findIndex(x=>/^Invocar |^Colocar |Terminar turno/.test(x));
    if(k < 0) k = L.length - 1;
    if(L.length){ p.style.display="none"; btns[k].onclick?.(); acciones++; }
    continue;
  }
  /* Si se puede atacar, se ataca: es lo que abre la ventana de cadena del
     bot, que es justo lo que hay que probar. */
  if(String(document.getElementById("turnInfo").innerHTML).includes("Battle")){
    const d = globalThis.__DUELO_DE_PRUEBA__?.();
    const mios = (d?.duel?.zones?.[d?.me]?.[4] ?? []).filter(Boolean);
    for(const c of mios){ globalThis.__VIEW_DE_PRUEBA__?.clic?.(c.uid); ataques++; }
  }
  if(ctl.style.display === "flex"){
    const bf = document.getElementById("btnFase"), bt = document.getElementById("btnFin");
    if(bf.style.display === "flex" && acciones % 3 === 2){ bf.onclick?.(); acciones++; continue; }
    if(bt.style.display === "flex"){ bt.onclick?.(); acciones++; continue; }
  }
}
const LOG = globalThis.__REGISTRO_DE_PRUEBA__?.() ?? [];
const texto = LOG.map(e => `${e.kind} ${JSON.stringify(e.data)}`).join("\n");
const lecturas = LOG.filter(e => e.kind === "ia_piensa" && /lectura:/.test(JSON.stringify(e.data ?? ""))).length;
const simuladas = LOG.filter(e => e.kind === "ia_simula").length;
const cadenas   = LOG.filter(e => e.kind === "ia_simula" && /"cadena"/.test(JSON.stringify(e.data ?? ""))).length;
const errores   = LOG.filter(e => e.kind === "ia_simula_error");

console.log(`  jugadas mías: ${acciones} · intentos de ataque: ${ataques} · entradas de log: ${LOG.length}`);
if(process.env.DET) console.log(LOG.map(e=>`${e.kind} ${JSON.stringify(e.data).slice(0,120)}`).join("\n"));
lecturas ? ok(`el bot lee el tablero (${lecturas} lecturas apuntadas)`) : mal("el bot apunta su lectura del tablero");
/* ══ EL PLAN ES EL DE SU MAZO ══
   E, 26-09: en los siete duelos del torneo el log decía «plan: Beatdown»
   con cualquier mazo. main.js crea el cerebro antes de `duel.create` y el
   plan se leía de una decklist vacía. Se compara con lo que `planDe` dice
   de la decklist real del bot. */
{
  const { planDe } = await import("./src/ai/plan.js");
  const N = JSON.parse(readFileSync("./out/names.subset.json","utf-8"));
  const d = globalThis.__DUELO_DE_PRUEBA__?.();
  const lista = d?.duel?.decklist?.[1 - d?.me] ?? [];
  const esperado = planDe(lista, N).nombre;
  const planes = LOG.filter(e => e.kind === "ia_piensa" && /^plan: /.test(e.data?.msg ?? ""))
                    .map(e => e.data.msg.replace(/^plan: /, "").split(" — ")[0]);
  (lista.length && planes.at(-1) === esperado)
    ? ok(`el bot juega con el plan de SU mazo (${esperado}, ${lista.length} cartas)`)
    : mal("el bot juega con el plan de su mazo", `esperado ${esperado}, log: ${planes.join(" → ") || "nada"}`);
}
simuladas ? ok(`simula antes de jugar (${simuladas} decisiones, ${cadenas} en ventana de cadena)`)
          : mal("simula al menos una decisión");
/* La ventana de cadena depende de que el bot TENGA una trampa de las que
   sabe pensar justo cuando le atacas, así que no se puede exigir en una
   partida cualquiera. Lo que sí se exige es que el juego la llame: sin
   esta línea, el módulo podría estar perfecto y no usarse nunca. */
/^[\s\S]*$/.test(html) && (/PENSADOR\.pensarCadena\(/.test(html)
  ? ok("el juego pregunta a la simulación en la ventana de cadena")
  : mal("el juego llama a `pensarCadena` en la ventana de cadena"));
errores.length ? mal(`la simulación falló ${errores.length} veces`, JSON.stringify(errores[0]?.data).slice(0,160))
               : ok("ninguna simulación se rompió");
if(/Error/.test(String(document.getElementById("boot").innerHTML))) mal("el duelo arrancó sin errores ocultos");
else ok("el duelo arrancó sin errores ocultos");
/* El registro en texto: es lo que el torneo guarda de cada partida para
   que E pueda mandar el match entero y no solo sus notas. */
{
  const txt = globalThis.__LOG_TEXTO_DE_PRUEBA__?.() ?? "";
  if(/GOAT FORMAT/.test(txt) && txt.length > 500 && /semilla:/.test(txt))
    ok(`el registro de la partida sale en texto (${txt.length} caracteres)`);
  else mal("el registro de la partida sale en texto", `${txt.length} caracteres`);
}

/* ══ EL RESUMEN DEL MATCH NO PUEDE CANTAR LAS TAPADAS ══
   E: «puedo ver en los comentarios de arriba las cartas que pone boca
   abajo la IA». El registro crudo las lleva a propósito —sin el código no
   se reconstruye una jugada— pero el resumen que abre el archivo es lo
   que él lee para escribir sus notas, y ahí solo puede salir lo que se
   vio en la mesa.

   Se mira la LÍNEA, no el nombre suelto: que el bot active un Scapegoat
   y más tarde coloque el otro es información pública la primera vez, así
   que buscar el nombre a pelo daría un falso positivo. Lo que no puede
   pasar es que una línea de «coloca» diga QUÉ colocó. */
{
  const resumen = globalThis.__RESUMEN_DE_PRUEBA__?.() ?? "";
  const crudo = globalThis.__LOG_TEXTO_DE_PRUEBA__?.() ?? "";
  const lineas = resumen.split("\n");
  const suyas = lineas.filter(l => /IA · coloca/.test(l));
  const cantadas = suyas.filter(l => !/coloca una carta\s*$/.test(l));
  if(!suyas.length) mal("el bot colocó algo en la partida (si no, esto no comprueba nada)");
  else if(!cantadas.length) ok(`las ${suyas.length} cartas que coloca el bot salen sin nombre`);
  else mal("las cartas que coloca el bot salen sin nombre", cantadas[0]);
  /* Lo mío sí se nombra: es mi carta, ya sé lo que es. */
  const mias = lineas.filter(l => /tú · coloca/.test(l));
  if(!mias.length || mias.some(l => !/coloca una carta\s*$/.test(l)))
    ok("y las mías sí se nombran");
  else mal("y las mías sí se nombran", mias[0]);
  /* Que la comprobación tenga dientes: en el CRUDO tienen que estar. */
  if(/"t":"set"/.test(crudo) && /"code"/.test(crudo))
    ok("…y el registro crudo sí las lleva (hace falta para depurar)");
  else mal("el registro crudo lleva las colocadas");
  if(/AVISO/.test(crudo)) ok("el crudo va detrás de su aviso de spoiler");
  else mal("el crudo va detrás de su aviso de spoiler");
}

/* ══ LA MARCA DE «TE ESTÁN SEÑALANDO ESTA CARTA» ══
   E: «cuando se hace algo como Mystical Space Typhoon, tiene que marcar
   de alguna manera qué carta está seleccionando». Aquí se comprueba sobre
   el tablero de verdad: se marca un uid y el elemento tiene que llevarlo. */
{
  const d = globalThis.__DUELO_DE_PRUEBA__?.();
  const V = globalThis.__VIEW_DE_PRUEBA__;
  const alguna = [...(d?.duel?.cards?.values?.() ?? [])].find(c => [4,8].includes(c.location));
  if(!V?.marcar || !alguna) mal("se puede marcar una carta señalada");
  else {
    V.marcar(new Set([alguna.uid]));
    const con = String(V.claseDe(alguna.uid) ?? "");
    V.marcar(new Set());
    const sin = String(V.claseDe(alguna.uid) ?? "");
    if(/senalada/.test(con) && !/senalada/.test(sin))
      ok("la carta señalada por un efecto se marca, y se desmarca al acabar la cadena");
    else mal("la carta señalada por un efecto se marca", `con="${con}" sin="${sin}"`);
  }
}

/* ══ LO QUE NO PUEDES VER NO LLEGA A LA PÁGINA ══
   E: «sigo viendo cuando setea cartas». Cada carta se pintaba con su cara
   de verdad aunque estuviera boca abajo, y solo se tapaba girándola: en la
   animación asomaba y en el inspector se leía. Aquí se recorren TODAS las
   cartas del bot que no deberías ver (mano, mazo, extra y tapadas) y
   ninguna puede llevar su código en la página. Y para que tenga dientes,
   las tuyas boca arriba sí tienen que llevarlo. */
{
  const d = globalThis.__DUELO_DE_PRUEBA__?.();
  const V = globalThis.__VIEW_DE_PRUEBA__;
  const bot = d ? 1 - d.me : 1;
  let ocultas = 0, cantadas = [], visibles = 0, mudas = 0;
  for(const c of (d?.duel?.cards?.values?.() ?? [])){
    const enPagina = V?.codigoEnPagina?.(c.uid);
    if(enPagina == null) continue;                 // no pintada (p. ej. su mazo)
    const fd = !!(c.position & 0x0a);
    const oculta = c.location === 1
      || (c.controller === bot && ([2,64].includes(c.location) || ([4,8].includes(c.location) && fd)));
    if(oculta){ ocultas++; if(enPagina) cantadas.push(`${c.code}@${c.location}`); }
    else if(c.controller === d.me && [4,8].includes(c.location) && !fd){ visibles++; if(!enPagina) mudas++; }
  }
  if(!ocultas) mal("había cartas ocultas del bot pintadas (si no, esto no comprueba nada)");
  else if(!cantadas.length) ok(`ninguna de las ${ocultas} cartas ocultas del bot lleva su código en la página`);
  else mal("ninguna carta oculta del bot lleva su código en la página", cantadas.slice(0,5).join(", "));
  if(visibles && !mudas) ok(`y tus ${visibles} cartas boca arriba sí lo llevan`);
  else if(visibles) mal("tus cartas boca arriba llevan su código", `${mudas} sin él`);
}

console.log(`\n${fallos ? "FALLA: " + fallos : "Todo correcto"}`);
process.exit(fallos ? 1 : 0);
