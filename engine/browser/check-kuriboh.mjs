/* ¿Funciona Kuriboh? Es un bug abierto en REINO-PENDIENTE desde hace
   sesiones, con la sospecha de que en realidad fue el bug de
   SHUFFLE_SET_CARD que mataba el duelo sin avisar.

   Kuriboh: se descarta desde la mano cuando el rival te va a hacer daño
   de batalla, y ese daño pasa a ser 0. Se monta el tablero exacto: el
   rival ataca directo con un 1800 y tú tienes Kuriboh en la mano. */
import { montar, X, L, P, nombre } from "./escenario.mjs";

const e = await montar(
  { mano:["Kuriboh"], monstruos:[] },                 // tú: solo Kuriboh en mano
  { monstruos:[{carta:"Archfiend Soldier", pos:P.FACEUP_ATTACK}] },
  { roboInicial:0, tamañoDeck:20, seed:[5n,7n,13n,29n] });

const MT = X.OcgMessageType, R = X.OcgResponseType;
let ofrecido = false, usado = false, atacado = false, ventanas = 0;
/* ══ Y AHORA LO QUE DE VERDAD FALLÓ ══
   La primera versión de esta comprobación se quedaba en "¿se puede
   activar?" y decía que SÍ — y tenía razón. E lo reportó igualmente:
   «he descartado Kuriboh y aun así me he comido el daño y mi monstruo
   se ha destruido». El fallo estaba DESPUÉS de activarla: el script
   moría con «Passed invalid CHAININFO flag» al registrar su efecto, así
   que la carta se descartaba y no pasaba nada.
   Un test de una carta tiene que mirar el EFECTO, no el permiso. */
const errores = [];
let dañoRecibido = 0; 

const vistos = new Map();
await e.correr((m, ctx) => {
  const nom = Object.keys(MT).find(k => MT[k] === m.type) ?? m.type;
  vistos.set(nom, (vistos.get(nom) ?? 0) + 1);

  /* Un error de Lua no rompe el duelo: se traga la resolución y sigue.
     Por eso no lo vio nadie durante meses. */
  if(/ERROR/i.test(String(nom))) errores.push(String(m.text ?? m.message ?? nom).split("\n")[0]);
  if(m.type === MT.DAMAGE && m.player === 0) dañoRecibido += m.amount ?? 0;

  if(nom === "SELECT_CHAIN")
    if((m.selects ?? []).length) console.log("   SELECT_CHAIN →", JSON.stringify((m.selects ?? []).map(c => nombre(c.code))), "· player:", m.player);

  /* El motor pregunta si quieres encadenar: si Kuriboh está entre las
     opciones, es que la carta FUNCIONA. */
  /* ══ Y SIN KURIBOH EN LA MANO, TAMPOCO ══
     El piloto automático juega TAMBIÉN mi lado, y en la primera Main
     Phase invocaba el Kuriboh al campo: cuando llegaba el ataque ya no
     estaba en la mano. Mi lado no hace nada: pasa de fase y ya. */
  if(m.type === MT.SELECT_IDLECMD && m.player === 0)
    return { type:R.SELECT_IDLECMD,
             action: m.to_bp ? X.SelectIdleCMDAction.TO_BP
                             : X.SelectIdleCMDAction.TO_EP, index:null };

  /* ══ SIN ATAQUE NO HAY KURIBOH ══
     El resolutor por defecto pasa de fase en vez de atacar, así que el
     primer intento de este test tuvo 1047 ventanas de cadena y ninguna
     con nada dentro: no porque Kuriboh fallara, sino porque nadie
     atacaba nunca. El ataque se declara aquí a mano. */
  if(m.type === MT.SELECT_BATTLECMD && (m.attacks ?? []).length){
    if(!atacado){
      const mano = (ctx.mano(0) ?? []).map(c => nombre(c.code ?? c));
      console.log("   mano al declarar el ataque:", JSON.stringify(mano));
    }
    atacado = true;
    return { type:R.SELECT_BATTLECMD, action:X.SelectBattleCMDAction.SELECT_BATTLE, index:0 };
  }
  if(m.type === MT.SELECT_CHAIN){
    const opciones = (m.selects ?? []).map(c => nombre(c.code));
    if(opciones.some(n => /Kuriboh/.test(n))){
      ofrecido = true; ventanas++;
      const i = (m.selects ?? []).findIndex(c => /Kuriboh/.test(nombre(c.code)));
      usado = true;
      return { type:R.SELECT_CHAIN, index:i };
    }
  }
  return null;
}, 3000);

console.log("\n═══ KURIBOH ═══\n");
console.log("  ¿alguien llegó a atacar?             ", atacado ? "SÍ" : "NO");
console.log("  ¿el motor ofrece Kuriboh?            ", ofrecido ? "SÍ" : "NO");
console.log("  ¿se pudo activar?                    ", usado ? "SÍ" : "NO");
console.log("  ventanas de cadena con Kuriboh:      ", ventanas);
console.log("  duelo vivo al acabar:                ", e.finished ? "no, terminó" : "sí");
console.log("  daño de batalla recibido:            ", dañoRecibido);
console.log("  errores de Lua:                      ", errores.length ? errores.join(" · ") : "ninguno");
console.log("\n  mensajes vistos:", [...vistos].map(([k,v])=>k+"×"+v).join(" · "));

let fallos = 0;
const ok  = t => console.log("  ✓ " + t);
const mal = (t,d="") => { fallos++; console.log("  ✗ " + t + (d ? "   " + d : "")); };
console.log("");
atacado ? ok("alguien declaró el ataque") : mal("alguien declaró el ataque");
usado   ? ok("Kuriboh se pudo activar")   : mal("Kuriboh se pudo activar");
/* ── LO QUE IMPORTA ── */
if(errores.length)
  mal("y su resolución no lanza ningún error de Lua", errores[0]);
else ok("y su resolución no lanza ningún error de Lua");
if(dañoRecibido > 0)
  mal("y el daño de batalla queda en 0", `te comiste ${dañoRecibido}`);
else ok("y el daño de batalla queda en 0");

console.log(`\n${fallos ? "FALLA: " + fallos : "Todo correcto"}`);
process.exit(fallos ? 1 : 0);
