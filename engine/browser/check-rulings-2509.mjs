/* ════════════════════════════════════════════════════════════════
   LO QUE LA IA DA POR HECHO DESDE EL TORNEO DEL 25-09, PREGUNTADO AL MOTOR

     1. Book of Moon a MI Night Assailant que la Giant Rat está atacando:
        el ataque sigue, el Assailant se voltea y su efecto destruye a la
        Rata POR EFECTO, así que la Rata no saca nada del mazo (lo que
        propuso E en el match 5, partida 1, turno 5).
     2. Threatening Roar encadenado a un ataque YA declarado no lo para:
        solo impide declarar los siguientes (E, PACMAN, turno 4).
     3. Book of Life no se puede activar si el rival tiene a Kycoo boca
        arriba: Book of Life destierra y Kycoo lo prohíbe (la duda de E
        en el match 5, partida 2, turno 5).
   ════════════════════════════════════════════════════════════════ */
import { montar, nombre, X, P, T, L } from "./escenario.mjs";

const R = X.OcgResponseType, IA = X.SelectIdleCMDAction, BA = X.SelectBattleCMDAction;
const pruebas = [];
const comprobar = (t, v, detalle) => { pruebas.push([t, !!v]); console.log(v ? "  ✓" : "  ✗", t, detalle ? `— ${detalle}` : ""); };
const raiz = n => String(n).replace(/\s*\((GOAT|Pre-Errata|Anime)\)\s*$/i, "").trim();
const idx = (lista, nom, jugador) => (lista ?? []).findIndex(a => raiz(nombre(a.code)) === nom && (jugador == null || a.controller === jugador));
const pasarIdle = m => ({ type:R.SELECT_IDLECMD, action: m.to_ep ? IA.TO_EP : IA.TO_BP, index:null });
const pasarBatalla = m => ({ type:R.SELECT_BATTLECMD, action: m.to_ep ? BA.TO_EP : BA.TO_M2, index:null });
const noResponder = () => ({ type:R.SELECT_CHAIN, index:null });
const elegir = (m, nom, jugador) => ({ type:R.SELECT_CARD, indicies:[Math.max(0, idx(m.selects, nom, jugador))] });

console.log("═══ RULINGS DEL TORNEO DEL 25-09 EN EL MOTOR ═══\n");

/* 1 · Book of Moon a mi Night Assailant atacado por la Giant Rat */
{
  const e = await montar(
    { monstruos:[{ carta:"Night Assailant", pos:P.FACEUP_ATTACK }], mt:[{ carta:"Book of Moon", pos:P.FACEDOWN_DEFENSE }] },
    { monstruos:[{ carta:"Giant Rat", pos:P.FACEUP_ATTACK }], deck:["Giant Rat","Giant Rat","Giant Rat"] });
  let atacó = false, bom = false, sacoDelMazo = false;
  await e.correr((m) => {
    const yo = m.player;
    if(m.type === T.SELECT_IDLECMD){
      if(e.turnPlayer === 1 && yo === 1 && !atacó) return { type:R.SELECT_IDLECMD, action:IA.TO_BP, index:null };
      if(e.turnPlayer === 1 && atacó) return "PARAR";
      return pasarIdle(m);
    }
    if(m.type === T.SELECT_BATTLECMD){
      if(!atacó){ const i = idx(m.attacks, "Giant Rat"); if(i >= 0){ atacó = true; return { type:R.SELECT_BATTLECMD, action:BA.SELECT_BATTLE, index:i }; } }
      return pasarBatalla(m);
    }
    if(m.type === T.SELECT_CHAIN){
      if(yo === 0 && atacó && !bom){ const i = idx(m.selects, "Book of Moon"); if(i >= 0){ bom = true; return { type:R.SELECT_CHAIN, index:i }; } }
      return noResponder();
    }
    if(m.type === T.SELECT_CARD){
      if(yo === 1 && !bom) return elegir(m, "Night Assailant", 0);     // el objetivo del ataque
      if(yo === 0 && bom && idx(m.selects, "Night Assailant", 0) >= 0 && idx(m.selects, "Giant Rat", 1) >= 0 && !e._bomObjetivo){
        e._bomObjetivo = true; return elegir(m, "Night Assailant", 0); // Book of Moon a lo mío
      }
      if(yo === 0) return elegir(m, "Giant Rat", 1);                    // el volteo del Assailant
      sacoDelMazo = true; return null;                                  // la Rata buscando (no debería)
    }
    if(m.type === T.SELECT_EFFECTYN || m.type === T.SELECT_YESNO){ if(yo === 1) sacoDelMazo = true; return null; }
    return null;
  }, 1500);
  const campo1 = e.campo(1).map(c => raiz(c.nombre));
  comprobar("el ataque sigue y el Assailant volteado destruye a la Giant Rat", !campo1.includes("Giant Rat") && e.gy(1).some(c => raiz(c.nombre) === "Giant Rat"),
            `campo rival: ${campo1.join(", ") || "vacío"}`);
  comprobar("la Rata muere por efecto: no saca nada del mazo", !sacoDelMazo && campo1.length === 0);
  comprobar("el Assailant va al cementerio (combate)", e.gy(0).some(c => raiz(c.nombre) === "Night Assailant"),
            `mi cementerio: ${e.gy(0).map(c=>c.nombre).join(", ")}`);
}

/* 2 · Threatening Roar después de declarar el ataque */
{
  const e = await montar(
    { mt:[{ carta:"Threatening Roar", pos:P.FACEDOWN_DEFENSE }] },
    { monstruos:[{ carta:"Giant Rat", pos:P.FACEUP_ATTACK }, { carta:"Mystic Tomato", pos:P.FACEUP_ATTACK }] });
  let ataques = 0, rugido = false;
  await e.correr((m) => {
    const yo = m.player;
    if(m.type === T.SELECT_IDLECMD){
      if(e.turnPlayer === 1 && ataques === 0) return { type:R.SELECT_IDLECMD, action:IA.TO_BP, index:null };
      if(e.turnPlayer === 1) return "PARAR";
      return pasarIdle(m);
    }
    if(m.type === T.SELECT_BATTLECMD){
      if(ataques < 2 && (m.attacks?.length ?? 0) > 0){ ataques++; return { type:R.SELECT_BATTLECMD, action:BA.SELECT_BATTLE, index:0 }; }
      return pasarBatalla(m);
    }
    if(m.type === T.SELECT_CHAIN){
      if(yo === 0 && ataques === 1 && !rugido){ const i = idx(m.selects, "Threatening Roar"); if(i >= 0){ rugido = true; return { type:R.SELECT_CHAIN, index:i }; } }
      return noResponder();
    }
    return null;
  }, 1500);
  comprobar("Threatening Roar encadenado al ataque NO lo para: entra el golpe", e.lp[0] < 8000, `LP: ${e.lp[0]}`);
  comprobar("…y el segundo monstruo ya no puede declarar", ataques === 1 && e.lp[0] >= 8000 - 1500, `ataques declarados: ${ataques}, LP ${e.lp[0]}`);
}

/* 3 · Book of Life con Kycoo boca arriba enfrente */
{
  const e = await montar({ mano:["Book of Life"], gy:["Pyramid Turtle"] },
                         { monstruos:[{ carta:"Kycoo the Ghost Destroyer", pos:P.FACEUP_ATTACK }], gy:["Thunder Dragon"] });
  let activable = null;
  await e.correr((m) => {
    if(m.type === T.SELECT_IDLECMD && e.turnPlayer === 0){ activable = idx(m.activates, "Book of Life") >= 0; return "PARAR"; }
    return null;
  }, 400);
  comprobar("con Kycoo del rival boca arriba, Book of Life no se puede activar", activable === false);
  const e2 = await montar({ mano:["Book of Life"], gy:["Pyramid Turtle"] }, { gy:["Thunder Dragon"] });
  let activable2 = null;
  await e2.correr((m) => {
    if(m.type === T.SELECT_IDLECMD && e2.turnPlayer === 0){ activable2 = idx(m.activates, "Book of Life") >= 0; return "PARAR"; }
    return null;
  }, 400);
  comprobar("sin Kycoo, sí (zombi en mi cementerio y monstruo en el suyo)", activable2 === true);
}

const mal = pruebas.filter(([, ok]) => !ok);
console.log(`\n${pruebas.length - mal.length}/${pruebas.length} rulings`);
process.exit(mal.length ? 1 : 0);
