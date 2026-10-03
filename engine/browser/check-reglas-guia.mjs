/* ════════════════════════════════════════════════════════════════
   LAS REGLAS DE LA GUÍA, PREGUNTADAS AL MOTOR

   La guía de E (`Casos_validacion_GOAT.json`) trae casos de REGLAS: no los
   decide la IA —ella solo ve acciones legales— sino el motor. Pero si el
   motor estuviera mal configurado, la IA aprendería a jugar un juego que
   no es Goat, y eso no lo cazaría ningún banco de posiciones. Así que se
   montan con `escenario.mjs` y se le pregunta AL MOTOR qué ofrece.

   Cada caso lleva su contrafactual (el de la propia guía): la misma mesa
   con el detalle que cambia la respuesta. Si los dos dijeran lo mismo, la
   comprobación no probaría nada.

   Uso: node check-reglas-guia.mjs
   ════════════════════════════════════════════════════════════════ */
import { montar, codigo, X, T } from "./escenario.mjs";

let fallos = 0;
const ok  = t => console.log("  ✓ " + t);
const mal = (t,d="") => { fallos++; console.log("  ✗ " + t + (d?"   "+d:"")); };
const es  = (c,t,d) => c ? ok(t) : mal(t,d);
console.log("\n═══ REGLAS DE LA GUÍA, PREGUNTADAS AL MOTOR ═══\n");

/* La primera pregunta de Main Phase del jugador 0: qué le ofrece el motor. */
async function primeraIdle(lado0, lado1 = {}, opciones = {}){
  const e = await montar(lado0, lado1, { roboInicial:0, ...opciones });
  let idle = null;
  await e.correr(m => {
    if(m.type === T.SELECT_IDLECMD && m.player === 0){ idle = m; return "PARAR"; }
    return null;
  }, 600);
  return idle;
}
const ofrece = (m, campo, nombre) => (m?.[campo] ?? []).some(l => l.code === codigo(nombre));

/* C07 · Scapegoat necesita cuatro zonas libres. */
{
  const tres = await primeraIdle({ mano:["Scapegoat"],
    monstruos:["Mystical Elf","Mystical Elf"] });
  const cuatro = await primeraIdle({ mano:["Scapegoat"], monstruos:["Mystical Elf"] });
  es(!ofrece(tres, "activates", "Scapegoat"), "C07 · con tres zonas libres, Scapegoat no se ofrece");
  es(ofrece(cuatro, "activates", "Scapegoat"), "C07 · con cuatro, sí");
}

/* C10 · Chaos requiere el combustible ANTES. */
{
  const sinLuz = await primeraIdle({ mano:["Black Luster Soldier - Envoy of the Beginning"],
    gy:["Archfiend Soldier"] });
  const conLuz = await primeraIdle({ mano:["Black Luster Soldier - Envoy of the Beginning"],
    gy:["Archfiend Soldier","Blade Knight"] });
  es(!ofrece(sinLuz, "special_summons", "Black Luster Soldier - Envoy of the Beginning"),
     "C10 · sin LIGHT en el cementerio, BLS no se ofrece");
  es(ofrece(conLuz, "special_summons", "Black Luster Soldier - Envoy of the Beginning"),
     "C10 · con un LIGHT y un DARK, sí");
}

/* C11 · Chaos Sorcerer no destierra boca abajo; BLS sí.
   OJO: la activación de Sorcerer SÍ es legal aquí —puede elegirse a sí
   mismo, que está boca arriba—; lo que la guía dice es que la Faith tapada
   no es OBJETIVO. Así que se activa y se mira la lista de objetivos. */
async function objetivosDe(carta){
  const e = await montar({ monstruos:[carta] },
    { monstruos:[{ carta:"Magician of Faith", pos:X.OcgPosition.FACEDOWN_DEFENSE }] }, { roboInicial:0 });
  let lista = null, activado = false;
  await e.correr(m => {
    if(!activado && m.type === T.SELECT_IDLECMD && m.player === 0){
      const i = (m.activates ?? []).findIndex(l => l.code === codigo(carta));
      if(i < 0) return "PARAR";
      activado = true;
      return { type:X.OcgResponseType.SELECT_IDLECMD, action:X.SelectIdleCMDAction.SELECT_ACTIVATE, index:i };
    }
    if(activado && m.type === T.SELECT_CARD && m.player === 0){ lista = m.selects; return "PARAR"; }
    return null;
  }, 600);
  return lista ?? [];
}
{
  const deSorcerer = await objetivosDe("Chaos Sorcerer");
  const deBLS = await objetivosDe("Black Luster Soldier - Envoy of the Beginning");
  const faith = codigo("Magician of Faith");
  const apuntaATapada = l => l.controller === 1 && (l.position & 0x0a);
  es(!deSorcerer.some(apuntaATapada),
     "C11 · Chaos Sorcerer no puede elegir a la Faith boca abajo",
     JSON.stringify(deSorcerer.map(l=>[l.controller,l.position])));
  es(deBLS.some(apuntaATapada),
     "C11 · Black Luster Soldier sí puede", JSON.stringify(deBLS.map(l=>[l.controller,l.position])));
}

/* C35 · Un BLS que nunca se invocó bien no se puede revivir. */
{
  const bls = await primeraIdle({ mano:["Premature Burial"],
    gy:["Black Luster Soldier - Envoy of the Beginning"] });
  const normal = await primeraIdle({ mano:["Premature Burial"], gy:["Archfiend Soldier"] });
  es(!ofrece(bls, "activates", "Premature Burial"),
     "C35 · Premature Burial no ofrece revivir un BLS que no se invocó bien");
  es(ofrece(normal, "activates", "Premature Burial"),
     "C35 · con un monstruo normal en el cementerio, sí");
}

console.log(`\n${fallos ? "FALLA: " + fallos : "Todo correcto"}`);
process.exit(fallos ? 1 : 0);
