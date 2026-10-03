/* ══════════════════════════════════════════════════════════════════
   SALAS: LA CONEXIÓN (src/red.js) SIN NAVEGADOR

   Con el transporte local (BroadcastChannel, que node también tiene):
   crear sala, unirse con el código, mensajes en los dos sentidos (con
   BigInt), una sala que no existe, un tercero que intenta colarse, y un
   corte: el invitado vuelve solo, saluda con su token y lo que mandó sin
   conexión llega al volver.
   Lo que NO prueba: PeerJS y WebRTC de verdad (eso necesita dos
   navegadores con internet).

   Uso: node check-red.mjs
   ══════════════════════════════════════════════════════════════════ */
import * as R from "./src/red.js";

let fallos = 0;
const ok  = t => console.log("  ✓ " + t);
const mal = (t, d = "") => { fallos++; console.log("  ✗ " + t + (d ? "   " + d : "")); };
const es = (c, t, d) => c ? ok(t) : mal(t, d);
const espera = ms => new Promise(r => setTimeout(r, ms));
const hasta = async (f, ms = 8000) => { const t = Date.now(); while(Date.now() - t < ms){ if(f()) return true; await espera(50); } return false; };
console.log("\n═══ SALAS · la conexión ═══\n");

const host = await R.crearSala({ transporte: R.transporteLocal("prueba-red") });
es(/^[A-Z2-9]{5}$/.test(host.codigo), "la sala tiene un código de 5 letras sin 0/O ni 1/I/L", host.codigo);
const recibidosHost = [], recibidosInv = [];
host.on("*", m => recibidosHost.push(m));

let noExiste = null;
try{ await R.unirseSala("ZZZZZ", { transporte: R.transporteLocal("prueba-red") }); }catch(e){ noExiste = e; }
es(noExiste?.tipo === "no-existe", "un código que no existe dice que no existe", JSON.stringify(noExiste));
es(!!R.MOTIVOS_RED["no-existe"], "y hay una frase para contarlo");

const inv = await R.unirseSala(host.codigo.toLowerCase(), { transporte: R.transporteLocal("prueba-red") });
inv.on("*", m => recibidosInv.push(m));
const token = "tk-" + Math.random().toString(36).slice(2);
let reconexiones = 0, yaConectado = false;
inv.alCambiar(e => { if(e === "conectado"){ if(yaConectado) reconexiones++; inv.enviar({ t:"hola", token, reanudar: yaConectado }); yaConectado = true; } });
inv.enviar({ t:"hola", token }); yaConectado = true;
await hasta(() => recibidosHost.some(m => m.t === "hola"));
es(recibidosHost.some(m => m.t === "hola" && m.token === token), "el invitado entra con el código (en minúsculas también) y saluda");
host.tokenInvitado = token;
es(host.estado === "conectado" && inv.estado === "conectado", "los dos quedan conectados");

host.enviar({ t:"pregunta", id:1, q:{ description: 123456789012345678n, selects:[{ code:0 }] } });
await hasta(() => recibidosInv.some(m => m.t === "pregunta"));
const q = recibidosInv.find(m => m.t === "pregunta")?.q;
es(q?.description === 123456789012345678n, "los mensajes llegan, BigInt incluido");
inv.enviar({ t:"respuesta", id:1, r:{ type:5, indicies:[0] } });
await hasta(() => recibidosHost.some(m => m.t === "respuesta"));
es(recibidosHost.find(m => m.t === "respuesta")?.r?.indicies?.[0] === 0, "y las respuestas vuelven");

/* un tercero */
const intruso = R.transporteLocal("prueba-red");
let respuestaIntruso = null;
try{
  const c = await intruso.conectar(R.PREFIJO_SALA + host.codigo);
  c.alRecibir(t => { respuestaIntruso = t; });
  c.enviar(JSON.stringify({ t:"hola", token:"otro" }));
  await hasta(() => respuestaIntruso);
}catch(e){}
es(/llena/.test(respuestaIntruso ?? ""), "un tercero que intenta entrar recibe «sala llena»", String(respuestaIntruso));
es(host.estado === "conectado", "y la partida sigue con el invitado de verdad");

/* corte: el invitado pierde la conexión */
const estadosHost = [];
host.alCambiar(e => estadosHost.push(e));
inv.enviar({ t:"ping-prueba" });
const transInv = inv._transporte;
/* Se corta por el lado del invitado como si se le cayera la red. */
transInv.cerrar();
await hasta(() => estadosHost.includes("cortado"), 3000);
es(estadosHost.includes("cortado"), "el anfitrión se entera del corte");
inv.enviar({ t:"respuesta", id:2, r:{ type:5, indicies:[1] } });     // sin conexión: se guarda
await hasta(() => reconexiones > 0 && host.estado === "conectado", 12000);
es(reconexiones > 0 && inv.estado === "conectado" && host.estado === "conectado", "el invitado vuelve solo y el anfitrión le deja entrar");
await hasta(() => recibidosHost.some(m => m.t === "hola" && m.reanudar));
es(recibidosHost.some(m => m.t === "hola" && m.reanudar && m.token === token), "saludando con su token y «reanudar»");
await hasta(() => recibidosHost.some(m => m.t === "respuesta" && m.id === 2));
es(recibidosHost.some(m => m.t === "respuesta" && m.id === 2), "lo que mandó sin conexión llega al volver");

host.cerrar(); inv.cerrar();
console.log(`\n${fallos ? "FALLA: " + fallos : "Todo correcto"}`);
process.exit(fallos ? 1 : 0);
