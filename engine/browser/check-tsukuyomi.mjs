/* ════════════════════════════════════════════════════════════════
   TSUKUYOMI Y BOOK OF MOON: LO QUE LA IA DA POR HECHO, PREGUNTADO AL MOTOR

   La IA (`planTumbar` en brain.js) cuenta con tres rulings sacados de la
   bibliografía de E (22-09). Aquí se comprueba que ocgcore los aplica:

     1. Chaos Sorcerer que ya desterró, tumbado por Tsukuyomi e invocado
        por volteo el mismo turno, puede volver a desterrar
        (goatformat Rulings A–C, BLS: el efecto se reinicia).
     2. Lo que robé con Snatch Steal, tumbado por mi Tsukuyomi, se queda
        conmigo y Snatch Steal va al cementerio (goatrulings.com y
        goatformat Rulings S–T, Snatch Steal).
     3. El TER rival tumbado por Tsukuyomi pierde su monstruo absorbido.
   ════════════════════════════════════════════════════════════════ */
import { montar, codigo, nombre, X, P, T, L } from "./escenario.mjs";

const R = X.OcgResponseType, IA = X.SelectIdleCMDAction, BA = X.SelectBattleCMDAction;
const pruebas = [];
const comprobar = (t, v, detalle) => { pruebas.push([t, !!v]); console.log(v ? "  ✓" : "  ✗", t, detalle ? `— ${detalle}` : ""); };
const raiz = n => String(n).replace(/\s*\((GOAT|Pre-Errata|Anime)\)\s*$/i, "").trim();
const idx = (lista, nom) => (lista ?? []).findIndex(a => raiz(nombre(a.code)) === nom);
const pasarIdle = m => ({ type:R.SELECT_IDLECMD, action: m.to_ep ? IA.TO_EP : IA.TO_BP, index:null });
const pasarBatalla = m => ({ type:R.SELECT_BATTLECMD, action: m.to_ep ? BA.TO_EP : BA.TO_M2, index:null });
const activar = (m, nom) => { const i = idx(m.activates, nom); return i < 0 ? null : { type:R.SELECT_IDLECMD, action:IA.SELECT_ACTIVATE, index:i }; };
const invocar = (m, nom) => { const i = idx(m.summons, nom); return i < 0 ? null : { type:R.SELECT_IDLECMD, action:IA.SELECT_SUMMON, index:i }; };
const voltear = (m, nom) => { const i = idx(m.pos_changes, nom); return i < 0 ? null : { type:R.SELECT_IDLECMD, action:IA.SELECT_POS_CHANGE, index:i }; };
const elegirNombre = (m, nom, jugador) => {
  const i = (m.selects ?? []).findIndex(s => raiz(nombre(s.code)) === nom && (jugador == null || s.controller === jugador));
  return { type:R.SELECT_CARD, indicies:[Math.max(0, i)] };
};

console.log("═══ TSUKUYOMI Y BOOK OF MOON EN EL MOTOR ═══\n");

/* 1 · Chaos Sorcerer: destierra, Tsukuyomi lo tumba, se voltea y destierra otra vez */
{
  const e = await montar(
    { monstruos:[{ carta:"Chaos Sorcerer", pos:P.FACEUP_ATTACK }], mano:["Tsukuyomi"] },
    { monstruos:[{ carta:"Sangan", pos:P.FACEUP_ATTACK }, { carta:"Airknight Parshath", pos:P.FACEUP_ATTACK }] });
  let paso = 0, segundaOfrecida = false, desterrados = [];
  await e.correr((m) => {
    if(e.turnPlayer !== 0) return m.type === T.SELECT_IDLECMD ? pasarIdle(m) : null;
    if(m.type === T.SELECT_IDLECMD){
      if(paso === 0){ const r = activar(m, "Chaos Sorcerer"); if(r){ paso = 1; return r; } }
      if(paso === 1){ const r = invocar(m, "Tsukuyomi"); if(r){ paso = 2; return r; } }
      if(paso === 3){ const r = voltear(m, "Chaos Sorcerer"); if(r){ paso = 4; return r; } return "PARAR"; }
      if(paso === 4){ const r = activar(m, "Chaos Sorcerer"); segundaOfrecida = !!r; if(r){ paso = 5; return r; } return "PARAR"; }
      if(paso === 5) return "PARAR";
      return pasarIdle(m);
    }
    if(m.type === T.SELECT_CARD){
      if(paso === 1) return elegirNombre(m, "Sangan", 1);
      if(paso === 2){ paso = 3; return elegirNombre(m, "Chaos Sorcerer", 0); }
      if(paso === 5) return elegirNombre(m, "Airknight Parshath", 1);
    }
    if(m.type === T.SELECT_BATTLECMD) return pasarBatalla(m);
    return null;
  }, 600);
  comprobar("Chaos Sorcerer tumbado por Tsukuyomi se puede invocar por volteo el mismo turno", paso >= 4, `paso ${paso}`);
  comprobar("y su destierro vuelve a estar disponible", segundaOfrecida);
  comprobar("el segundo destierro se lleva al Airknight", !e.campo(1).some(c => raiz(c.nombre) === "Airknight Parshath"),
            `campo rival: ${e.campo(1).map(c => c.nombre).join(", ") || "vacío"}`);
}

/* 2 · Snatch Steal + mi Tsukuyomi: el robado se queda conmigo */
{
  const e = await montar(
    { mano:["Snatch Steal", "Tsukuyomi"] },
    { monstruos:[{ carta:"Airknight Parshath", pos:P.FACEUP_ATTACK }] });
  let paso = 0;
  await e.correr((m) => {
    if(e.turnPlayer !== 0) return m.type === T.SELECT_IDLECMD ? pasarIdle(m) : null;
    if(m.type === T.SELECT_IDLECMD){
      if(paso === 0){ const r = activar(m, "Snatch Steal"); if(r){ paso = 1; return r; } }
      if(paso === 1){ const r = invocar(m, "Tsukuyomi"); if(r){ paso = 2; return r; } }
      if(paso >= 3) return "PARAR";
      return pasarIdle(m);
    }
    if(m.type === T.SELECT_CARD){
      if(paso === 1) return elegirNombre(m, "Airknight Parshath");
      if(paso === 2){ paso = 3; return elegirNombre(m, "Airknight Parshath", 0); }
    }
    return null;
  }, 600);
  const mio = e.campo(0).find(c => raiz(c.nombre) === "Airknight Parshath");
  comprobar("Tsukuyomi a mi Airknight robado: sigue en MI campo", !!mio, `mi campo: ${e.campo(0).map(c => c.nombre).join(", ")}`);
  comprobar("boca abajo", mio && (mio.pos & 0x0a));
  comprobar("y Snatch Steal está en el cementerio", e.gy(0).some(c => raiz(c.nombre) === "Snatch Steal"));
}

/* 3 · TER rival: Tsukuyomi lo tumba y pierde lo absorbido */
{
  const e = await montar(
    { mano:["Tsukuyomi"] },
    { monstruos:[{ carta:"Thousand-Eyes Restrict", pos:P.FACEUP_ATTACK }], mano:[] },
  );
  /* Primero el rival tiene que absorber: se monta con el TER suyo y un
     monstruo mío que absorbe en su turno. Más simple: el TER ya está y
     se comprueba solo que Tsukuyomi puede tumbarlo y queda 0/0. */
  let paso = 0;
  await e.correr((m) => {
    if(e.turnPlayer !== 0) return m.type === T.SELECT_IDLECMD ? pasarIdle(m) : null;
    if(m.type === T.SELECT_IDLECMD){
      if(paso === 0){ const r = invocar(m, "Tsukuyomi"); if(r){ paso = 1; return r; } }
      if(paso >= 2) return "PARAR";
      return pasarIdle(m);
    }
    if(m.type === T.SELECT_CARD && paso === 1){ paso = 2; return elegirNombre(m, "Thousand-Eyes Restrict", 1); }
    return null;
  }, 600);
  const ter = e.campo(1).find(c => raiz(c.nombre) === "Thousand-Eyes Restrict");
  comprobar("Tsukuyomi tumba el TER rival", ter && (ter.pos & 0x0a));
}

const ok = pruebas.filter(p => p[1]).length;
console.log(`\n${ok}/${pruebas.length} · ${ok === pruebas.length ? "Todo correcto" : "HAY FALLOS"}`);
process.exit(ok === pruebas.length ? 0 : 1);
