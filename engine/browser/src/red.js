/* ════════════════════════════════════════════════════════════════
   SALAS: LA RED

   Dos navegadores hablando directamente (WebRTC) sin servidor propio y
   sin pagar nada: para ENCONTRARSE se usa el servidor público y gratuito
   de PeerJS (0.peerjs.com), y una vez conectados los datos van de un
   navegador al otro. PeerJS trae además STUN de Google y un TURN público
   suyo de cortesía, que es lo que salva muchas redes móviles; aun así,
   en alguna red muy cerrada (wifi de empresa o de universidad) la
   conexión directa puede no salir, y entonces se dice en pantalla.

   La sala es la del ANFITRIÓN: su id en PeerJS es `goatsim-v1-<código>`.
   El invitado se conecta a ese id. Por encima va un protocolo de
   mensajes en JSON (con BigInt, ver sala.js) y un latido: si en 12 s no
   llega nada, la conexión se da por cortada y el invitado reintenta solo
   durante minuto y medio.

   El transporte se puede cambiar: con `GOAT_SALA_LOCAL` las dos pestañas
   se hablan por BroadcastChannel, sin red. Es lo que usan las pruebas
   en Chromium (y sirve para jugar dos pestañas del mismo navegador).
   ════════════════════════════════════════════════════════════════ */
import { codificar, decodificar, nuevoCodigo, limpiarCodigo } from "./sala.js";

export const PREFIJO_SALA = "goatsim-v1-";
const LATIDO_MS = 4000, CORTE_MS = 12000, REINTENTO_MS = 3000, REINTENTAR_DURANTE_MS = 90000;

/* ── Los errores, en una frase que se entienda ── */
export const MOTIVOS_RED = {
  "id-ocupado": "Ese código de sala ya está en uso.",
  "no-existe": "No hay ninguna sala con ese código. ¿Está bien escrito y tu amigo sigue en la pantalla de la sala?",
  "servidor": "No se puede contactar con el servidor de salas. Revisa la conexión a internet.",
  "directa": "No se ha podido conectar directamente con tu amigo. Pasa en algunas redes muy cerradas (wifi de empresa o de universidad): probad con otra red, por ejemplo los datos del móvil.",
  "tiempo": "La sala no responde. Comprobad los dos la conexión y volved a intentarlo.",
  "navegador": "Este navegador no permite conexiones directas (WebRTC). Prueba con Chrome, Firefox, Edge o Safari actualizados.",
  "llena": "Esa sala ya tiene dos jugadores.",
};

/* ══ TRANSPORTE: PEERJS ══ */
function errorPeer(e){
  const t = e?.type ?? "";
  const tipo = t === "unavailable-id" ? "id-ocupado"
             : t === "peer-unavailable" ? "no-existe"
             : t === "browser-incompatible" ? "navegador"
             : t === "webrtc" || t === "negotiation-failed" ? "directa"
             : "servidor";
  return { tipo, detalle: t || String(e?.message ?? e) };
}
function envolverDC(dc){
  const alRecibir = [], alCerrar = [];
  let cerrada = false;
  const cerrar = () => { if(cerrada) return; cerrada = true; for(const f of alCerrar) try{ f(); }catch(e){} };
  dc.on("data", d => { for(const f of alRecibir) f(typeof d === "string" ? d : String(d)); });
  dc.on("close", cerrar);
  dc.on("error", cerrar);
  dc.on?.("iceStateChanged", s => { if(s === "failed" || s === "closed") cerrar(); });
  return {
    enviar: txt => { try{ if(dc.open) dc.send(txt); }catch(e){} },
    alRecibir: f => alRecibir.push(f),
    alCerrar: f => alCerrar.push(f),
    cerrar: () => { try{ dc.close(); }catch(e){} cerrar(); },
  };
}
export function transportePeer(){
  let peer = null, erroresPeer = [];
  const nuevoPeer = id => new Promise((res, rej) => {
    const P = globalThis.Peer;
    if(typeof P !== "function") return rej({ tipo:"navegador" });
    let p;
    /* `GOAT_PEER_OPCIONES` (solo pruebas): un servidor de PeerJS local en
       vez del público, para probar la conexión de verdad sin internet. */
    const op = { debug:0, ...(globalThis.GOAT_PEER_OPCIONES ?? {}) };
    try{ p = id ? new P(id, op) : new P(op); }
    catch(e){ return rej(errorPeer(e)); }
    const t = setTimeout(() => { try{ p.destroy(); }catch(e){} rej({ tipo:"servidor" }); }, 15000);
    p.on("open", () => { clearTimeout(t); res(p); });
    p.on("error", e => { clearTimeout(t); const x = errorPeer(e); for(const f of erroresPeer) f(x); rej(x); });
    /* Si se cae la conexión con el servidor de salas, la que ya hay
       entre los dos navegadores sigue viva; se reengancha para poder
       aceptar una reconexión. */
    p.on("disconnected", () => { setTimeout(() => { try{ if(!p.destroyed) p.reconnect(); }catch(e){} }, 1500); });
  });
  return {
    async escuchar(id, alConectar){
      peer = await nuevoPeer(id);
      peer.on("connection", dc => {
        const listo = () => alConectar(envolverDC(dc));
        if(dc.open) listo(); else dc.on("open", listo);
      });
    },
    async conectar(id){
      /* El invitado se pone su propio id en vez de pedírselo al servidor
         de PeerJS: así no hace ninguna petición HTTP (solo el WebSocket),
         que es lo que menos problemas da abriendo el HTML con doble clic
         (origen «null») o detrás de una red quisquillosa. */
      peer ??= await nuevoPeer(PREFIJO_SALA + "inv-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36));
      return await new Promise((res, rej) => {
        let hecho = false;
        const fin = (f, x) => { if(hecho) return; hecho = true; clearTimeout(t);
                                erroresPeer = erroresPeer.filter(g => g !== alError); f(x); };
        const alError = x => fin(rej, x);
        erroresPeer.push(alError);
        const t = setTimeout(() => fin(rej, { tipo:"tiempo" }), 20000);
        let dc;
        try{ dc = peer.connect(id, { reliable:true, serialization:"raw" }); }
        catch(e){ return fin(rej, errorPeer(e)); }
        dc.on("open", () => fin(res, envolverDC(dc)));
        dc.on("error", e => fin(rej, errorPeer(e)));
        dc.on?.("iceStateChanged", s => { if(s === "failed") fin(rej, { tipo:"directa" }); });
      });
    },
    cerrar(){ try{ peer?.destroy(); }catch(e){} peer = null; },
  };
}

/* ══ TRANSPORTE: DOS PESTAÑAS DEL MISMO NAVEGADOR ══
   Sin red. Lo usan las pruebas y sirve para probar una sala uno solo. */
export function transporteLocal(nombreCanal = "goatsim-local"){
  let bc = null, miId = null;
  const conexiones = new Map();          // id del otro -> {recibir, cerrar}
  const abrirCanal = () => {
    if(bc) return;
    bc = new BroadcastChannel(nombreCanal);
    bc.onmessage = ev => {
      const m = ev.data;
      if(!m || m.para !== miId) return;
      if(m.tipo === "datos") conexiones.get(m.de)?.recibir(m.txt);
      else if(m.tipo === "cerrar") conexiones.get(m.de)?.cerrarLocal();
      else if(m.tipo === "conectar") alEntrante?.(m.de);
      else if(m.tipo === "aceptado") esperando.get(m.de)?.(m.de);
    };
  };
  let alEntrante = null;
  const esperando = new Map();
  const crearConexion = otro => {
    const alRecibir = [], alCerrar = [];
    let cerrada = false;
    const c = {
      enviar: txt => { if(!cerrada) bc.postMessage({ para:otro, de:miId, tipo:"datos", txt }); },
      alRecibir: f => alRecibir.push(f),
      alCerrar: f => alCerrar.push(f),
      cerrar: () => { if(cerrada) return; bc.postMessage({ para:otro, de:miId, tipo:"cerrar" }); c.cerrarLocal(); },
      recibir: txt => { if(!cerrada) for(const f of alRecibir) f(txt); },
      cerrarLocal: () => { if(cerrada) return; cerrada = true; conexiones.delete(otro); for(const f of alCerrar) try{ f(); }catch(e){} },
    };
    conexiones.set(otro, c);
    return c;
  };
  return {
    async escuchar(id, alConectar){
      miId = id; abrirCanal();
      alEntrante = otro => { const c = crearConexion(otro); bc.postMessage({ para:otro, de:miId, tipo:"aceptado" }); alConectar(c); };
    },
    async conectar(id){
      miId ??= "inv-" + Math.random().toString(36).slice(2, 9); abrirCanal();
      return await new Promise((res, rej) => {
        const t = setTimeout(() => { esperando.delete(id); rej({ tipo:"no-existe" }); }, 4000);
        esperando.set(id, () => { clearTimeout(t); esperando.delete(id); res(crearConexion(id)); });
        bc.postMessage({ para:id, de:miId, tipo:"conectar" });
      });
    },
    cerrar(){ for(const c of [...conexiones.values()]) c.cerrar(); try{ bc?.close(); }catch(e){} bc = null; },
  };
}

export function transportePorDefecto(){
  return globalThis.GOAT_SALA_LOCAL ? transporteLocal() : transportePeer();
}

/* ══ LA SALA ══
   Una conexión con latido y reconexión, y mensajes por tipo:
     sala.on("pregunta", m => …)   sala.enviar({ t:"respuesta", … })
     sala.alCambiar(estado => …)   "conectado" | "cortado" | "cerrada"
   El anfitrión acepta UNA conexión; si se corta, acepta la siguiente
   (la del mismo invitado que vuelve: lo comprueba la aplicación con el
   token del saludo). El invitado, si se corta, reintenta solo. */
function nuevaSala(rol, transporte){
  const oyentes = new Map(), alCambio = [];
  let conn = null, ultimo = 0, latido = null, estado = "esperando", cerrada = false;
  let reintentando = false, pendientes = [];
  const sala = {
    rol, codigo:null, get estado(){ return estado; },
    on(t, f){ (oyentes.get(t) ?? oyentes.set(t, []).get(t)).push(f); return sala; },
    off(t){ oyentes.delete(t); },
    alCambiar(f){ alCambio.push(f); return sala; },
    /* Lo que se manda sin conexión se guarda y sale al reconectar (solo
       el invitado: el anfitrión reenvía la foto entera, que manda más). */
    enviar(obj){
      if(conn && estado === "conectado") conn.enviar(codificar(obj));
      else if(rol === "invitado" && obj?.t !== "ping") pendientes.push(obj);
    },
    cerrar(){
      cerrada = true; clearInterval(latido);
      try{ if(conn && estado === "conectado") conn.enviar(codificar({ t:"adios" })); }catch(e){}
      try{ conn?.cerrar(); }catch(e){}
      transporte.cerrar(); cambiar("cerrada");
    },
    _adoptar: null, _transporte: transporte,
  };
  const cambiar = e => { if(estado === e) return; estado = e; for(const f of alCambio) try{ f(e); }catch(x){} };
  const despachar = obj => {
    if(!obj || typeof obj !== "object") return;
    if(obj.t === "ping"){ conn?.enviar(codificar({ t:"pong" })); return; }
    if(obj.t === "pong") return;
    for(const f of (oyentes.get(obj.t) ?? [])) try{ f(obj); }catch(e){ console.error(e); }
    for(const f of (oyentes.get("*") ?? [])) try{ f(obj); }catch(e){ console.error(e); }
  };
  sala._despachar = obj => despachar(obj);
  sala._adoptar = c => {
    if(conn && conn !== c) try{ conn.cerrar(); }catch(e){}
    conn = c; ultimo = Date.now();
    c.alRecibir(txt => {
      if(conn !== c) return;
      ultimo = Date.now();
      let obj; try{ obj = decodificar(txt); }catch(e){ return; }
      /* El otro se va. Para el invitado la sala se acaba; el anfitrión
         la deja abierta para que pueda entrar otro amigo. */
      if(obj?.t === "adios"){ conn = null; cambiar(rol === "anfitrion" ? "esperando" : "cerrada"); return despachar(obj); }
      despachar(obj);
    });
    c.alCerrar(() => { if(conn === c) cortado(); });
    cambiar("conectado");
    const cola = pendientes; pendientes = [];
    for(const o of cola) c.enviar(codificar(o));
    clearInterval(latido);
    latido = setInterval(() => {
      if(cerrada || conn !== c) return;
      c.enviar(codificar({ t:"ping" }));
      if(Date.now() - ultimo > CORTE_MS){ try{ c.cerrar(); }catch(e){} cortado(); }
    }, LATIDO_MS);
  };
  const cortado = () => {
    if(cerrada || estado === "cerrada") return;
    conn = null; cambiar("cortado");
    if(rol === "invitado") reconectar();
  };
  /* El invitado vuelve a llamar a la puerta él solo. La aplicación, al
     ver "conectado" otra vez, saluda con su token para que el anfitrión
     le reenvíe el estado del duelo. */
  const reconectar = async () => {
    if(reintentando) return; reintentando = true;
    const hasta = Date.now() + REINTENTAR_DURANTE_MS;
    while(!cerrada && estado !== "conectado" && Date.now() < hasta){
      await new Promise(r => setTimeout(r, REINTENTO_MS));
      if(cerrada || estado === "conectado") break;
      try{ const c = await transporte.conectar(PREFIJO_SALA + sala.codigo); sala._adoptar(c); }
      catch(e){ /* sigue intentando */ }
    }
    reintentando = false;
    if(!cerrada && estado !== "conectado") cambiar("perdida");
  };
  return sala;
}

/* Abre una sala nueva y espera al invitado. */
export async function crearSala({ transporte = transportePorDefecto(), codigo = null } = {}){
  const sala = nuevaSala("anfitrion", transporte);
  for(let intento = 0; intento < 5; intento++){
    sala.codigo = codigo ?? nuevoCodigo();
    try{
      await transporte.escuchar(PREFIJO_SALA + sala.codigo, c => {
        if(sala.estado !== "conectado" && !sala.tokenInvitado) return sala._adoptar(c);
        /* Con la sala ya ocupada solo se deja pasar al MISMO invitado que
           vuelve (su conexión vieja puede estar muerta sin que se sepa
           aún): lo dice el token de su saludo. A cualquier otro, «llena». */
        let visto = false;
        c.alRecibir(txt => {
          if(visto) return; visto = true;
          let m = null; try{ m = decodificar(txt); }catch(e){}
          if(m?.t === "hola" && m.token && m.token === sala.tokenInvitado){
            sala._adoptar(c);
            sala._despachar(m);
          } else { c.enviar(codificar({ t:"llena" })); setTimeout(() => c.cerrar(), 400); }
        });
      });
      return sala;
    }catch(e){
      if(e?.tipo !== "id-ocupado" || codigo) throw e;
    }
  }
  throw { tipo:"id-ocupado" };
}
/* Entra en la sala de un amigo. */
export async function unirseSala(codigo, { transporte = transportePorDefecto() } = {}){
  const sala = nuevaSala("invitado", transporte);
  sala.codigo = limpiarCodigo(codigo);
  if(sala.codigo.length < 4) throw { tipo:"no-existe" };
  const c = await transporte.conectar(PREFIJO_SALA + sala.codigo);
  sala._adoptar(c);
  return sala;
}
