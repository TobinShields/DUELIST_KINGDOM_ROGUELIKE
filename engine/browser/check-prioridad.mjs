/* ════════════════════════════════════════════════════════════════
   LA PRIORIDAD DE 2005, PREGUNTADA AL MOTOR

   goatformat.com, «6 Facts That You Should Know About Priority» y
   «Basic Mechanics»: tras una invocación, el jugador del turno puede
   activar un efecto de IGNICIÓN antes de que el rival responda («Player A
   Summons Tribe-Infecting Virus. Player A can activate the effect of
   Tribe-Infecting Virus before Player B can activate Book of Moon»), y
   solo hay una ventana para responder a la invocación.

   La IA (cadena() en brain.js, flags `prioridad` y `prioridadRival`) y la
   interfaz (main.js, `esVentanaDePrioridad`) dan por hecho que el motor lo
   hace así. Aquí se comprueba:
     1. tras invocar BLS, la primera ventana con su efecto es del jugador
        del turno, y la del rival (Ring) llega solo si la pasa;
     2. si la usa y el rival le encadena Ring a BLS, el destierro se
        resuelve igual;
     3. lo mismo con Tribe-Infecting Virus y Book of Moon: el Virus queda
        boca abajo pero su efecto destruye igual;
     4. si la pasa y el rival le tumba el BLS con Book of Moon, BLS ya no
        puede usar el efecto ese turno.
   ════════════════════════════════════════════════════════════════ */
import { montar, nombre, X, P, T, L } from "./escenario.mjs";

const R = X.OcgResponseType, IA = X.SelectIdleCMDAction;
const raiz = n => String(n).replace(/\s*\((GOAT|Pre-Errata|Anime)\)\s*$/i, "").trim();
const idx = (l, nom) => (l ?? []).findIndex(a => raiz(nombre(a.code)) === nom);
const pruebas = [];
const comprobar = (t, v, detalle) => { pruebas.push(!!v); console.log(v ? "  ✓" : "  ✗", t, detalle ? `— ${detalle}` : ""); };
const BLS = "Black Luster Soldier - Envoy of the Beginning", TIV = "Tribe-Infecting Virus";

async function jugar({ mano, gy = [], suyos, mt, carta, especial, usar, respuesta, objetivoP0, objetivoP1, tipo }){
  const e = await montar({ mano, gy }, { monstruos: suyos, mt });
  const orden = []; let paso = 0, efectoTrasTumbar = null;
  await e.correr(m => {
    if(e.turnPlayer !== 0) return "PARAR";
    const p = m.player;
    if(m.type === T.SELECT_IDLECMD && p === 0){
      if(paso === 0){ const lista = especial ? m.special_summons : m.summons; paso = 1;
        return { type:R.SELECT_IDLECMD, action: especial ? IA.SELECT_SPECIAL_SUMMON : IA.SELECT_SUMMON, index: idx(lista, carta) }; }
      efectoTrasTumbar = idx(m.activates, carta) >= 0; return "PARAR";
    }
    if(m.type === T.SELECT_CHAIN){
      if(paso >= 1 && idx(m.selects, carta) >= 0 && p === 0 && !orden.includes("p0:efecto")) orden.push("p0:efecto");
      if(paso >= 1 && respuesta && idx(m.selects, respuesta) >= 0 && p === 1 && !orden.includes("p1:" + respuesta)) orden.push("p1:" + respuesta);
      if(p === 0 && usar && paso === 1 && idx(m.selects, carta) >= 0){ paso = 2; return { type:R.SELECT_CHAIN, index: idx(m.selects, carta) }; }
      if(p === 1 && respuesta && paso >= 1 && idx(m.selects, respuesta) >= 0 && !orden.includes("p1:usó")){ orden.push("p1:usó"); return { type:R.SELECT_CHAIN, index: idx(m.selects, respuesta) }; }
      return { type:R.SELECT_CHAIN, index:null };
    }
    if(m.type === T.SELECT_CARD){
      const quiere = p === 0 ? objetivoP0 : objetivoP1;
      const i = (m.selects ?? []).findIndex(s => raiz(nombre(s.code)) === quiere);
      if(i >= 0) return { type:R.SELECT_CARD, indicies:[i] };
    }
    if(m.type === T.ANNOUNCE_RACE && tipo) return { type:R.ANNOUNCE_RACE, races:[tipo] };
    return null;
  }, 400);
  return { e, orden, efectoTrasTumbar };
}

console.log("═══ PRIORIDAD EN EL MOTOR ═══\n");
const gyChaos = ["Sangan", "Mystical Elf"];   // un DARK y un LIGHT para pagar el BLS

{ const { orden } = await jugar({ mano:[BLS], gy:gyChaos, suyos:["Airknight Parshath"], mt:["Ring of Destruction"],
                                  carta:BLS, especial:true, usar:false, respuesta:"Ring of Destruction", objetivoP1:BLS });
  comprobar("tras invocar BLS, el efecto se le ofrece primero al jugador del turno; el Ring del rival, después",
    orden.indexOf("p0:efecto") >= 0 && orden.indexOf("p1:Ring of Destruction") > orden.indexOf("p0:efecto"), orden.join(" → ")); }

{ const { e, orden } = await jugar({ mano:[BLS], gy:gyChaos, suyos:["Airknight Parshath"], mt:["Ring of Destruction"],
                                     carta:BLS, especial:true, usar:true, respuesta:"Ring of Destruction", objetivoP0:"Airknight Parshath", objetivoP1:BLS });
  const desterrado = e.zona(1, L.REMOVED).some(c => raiz(c.nombre) === "Airknight Parshath");
  comprobar("BLS usa la prioridad, le encadenan Ring a él… y el destierro se resuelve igual",
    orden.includes("p1:usó") && desterrado && !e.campo(0).some(c => raiz(c.nombre) === BLS), `${orden.join(" → ")} · desterradas del rival: ${e.zona(1, L.REMOVED).map(c => c.nombre).join(", ") || "ninguna"}`); }

{ const { e, orden } = await jugar({ mano:[TIV, "Sangan"], suyos:["Airknight Parshath"], mt:["Book of Moon"],
                                     carta:TIV, usar:true, respuesta:"Book of Moon", objetivoP0:"Sangan", objetivoP1:TIV, tipo:0x4n });
  const virus = e.campo(0).find(c => raiz(c.nombre) === TIV);
  comprobar("TIV usa la prioridad, le encadenan Book of Moon… y el Airknight (Hada) se destruye igual",
    orden.includes("p1:usó") && !e.campo(1).some(c => raiz(c.nombre) === "Airknight Parshath"),
    `${orden.join(" → ")} · Virus ${virus ? ((virus.pos & 0x0a) ? "boca abajo" : "boca arriba") : "no está"}`); }

{ const { efectoTrasTumbar, orden } = await jugar({ mano:[BLS], gy:gyChaos, suyos:["Airknight Parshath"], mt:["Book of Moon"],
                                                   carta:BLS, especial:true, usar:false, respuesta:"Book of Moon", objetivoP1:BLS });
  comprobar("si pasa la prioridad y le tumban el BLS con Book of Moon, ese turno ya no puede usar el efecto",
    orden.includes("p1:usó") && efectoTrasTumbar === false, `${orden.join(" → ")} · efecto ofrecido después: ${efectoTrasTumbar}`); }

/* ══ Y EL JUGADOR HUMANO TAMBIÉN LA TIENE ══
   El modo de cadenas «auto» se saltaba cualquier ventana propia sin
   cadena, y la de prioridad es justo eso: el humano no podía usarla nunca.
   `esVentanaDePrioridad` (src/prioridad.js) decide cuál se pregunta. */
console.log("\n═══ LA VENTANA EN LA INTERFAZ ═══\n");
const { esVentanaDePrioridad } = await import("./src/prioridad.js");
const { readFileSync } = await import("node:fs");
const CH = T.SELECT_CHAIN;
const base = { tipoCadena:CH, yo:0, turnPlayer:0, turnCount:5, ultimaInvocada:{ uid:42, turno:5 }, cadenaActiva:false, uidEn: s => s.uid };
const q = (sel, extra = {}) => ({ type:CH, forced:false, selects:sel, ...extra });
comprobar("el efecto del monstruo que acabo de invocar es la ventana de prioridad",
  esVentanaDePrioridad(q([{ location:4, controller:0, uid:42 }]), base));
comprobar("una mágica rápida de la mano en mi turno no lo es (esa ventana la sigue saltando «auto»)",
  !esVentanaDePrioridad(q([{ location:2, controller:0, uid:7 }]), base));
comprobar("el efecto de otro monstruo mío que no acabo de invocar, tampoco (Breaker de hace dos turnos)",
  !esVentanaDePrioridad(q([{ location:4, controller:0, uid:9 }]), base));
comprobar("con una cadena en curso no es prioridad: es responder",
  !esVentanaDePrioridad(q([{ location:4, controller:0, uid:42 }]), { ...base, cadenaActiva:true }));
comprobar("en el turno del rival no hay prioridad mía",
  !esVentanaDePrioridad(q([{ location:4, controller:0, uid:42 }]), { ...base, turnPlayer:1 }));
comprobar("lo invocado otro turno no cuenta",
  !esVentanaDePrioridad(q([{ location:4, controller:0, uid:42 }]), { ...base, ultimaInvocada:{ uid:42, turno:4 } }));
const html = readFileSync("./out/goat.html", "utf-8");
comprobar("el HTML construido no se salta esa ventana en modo «auto»",
  /!ventanaPrioridad\s*\n?\s*&& chainMode==="auto"/.test(html) && /ventanaDePrioridad\(q\)/.test(html));
comprobar("y la pregunta dice que es la prioridad, con «Pasar la prioridad»",
  html.includes('T("Pasar la prioridad")') && html.includes('T("Prioridad")'));
/* E, 03-10 (Reino, T45-46): dos Little-Winguard a la vez = un SELECT_CHAIN
   con `spe_count`, y «auto» lo saltaba. */
const { hayDisparadoresPendientes } = await import("./src/prioridad.js");
comprobar("dos disparadores a la vez (spe_count 2) son una ventana que se pregunta",
  hayDisparadoresPendientes(q([{ location:4, controller:0, uid:16 }, { location:4, controller:0, uid:17 }], { spe_count:2 }))
  && !hayDisparadoresPendientes(q([{ location:2, controller:0, uid:7 }], { spe_count:0 })));
comprobar("y el HTML no los salta ni en «auto» ni en «sin cadenas»",
  (html.match(/hayDisparadoresPendientes\(q\)/g) ?? []).length >= 2);

const ok = pruebas.filter(Boolean).length;
console.log(`\n${ok}/${pruebas.length}${ok === pruebas.length ? " · Todo correcto" : " · FALLA"}`);
process.exit(ok === pruebas.length ? 0 : 1);
