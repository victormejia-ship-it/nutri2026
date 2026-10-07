/* =========================================================================
   PROFECTUS · Tablero (Clientes + Cotizaciones + Admin)

   Basado en la funcionalidad del tablero de Forguard: mismas fórmulas de
   cotización (costo interno vs. cotización cliente, margen, instalación /
   mano de obra opcional, IVA), mismos roles y el mismo modo local/nube.

   Modelo de datos
   ---------------
   clientes:     { id, nombre, razonSocial, rfc, segmento, contacto, telefono,
                   correo, direccion, notas, logo,
                   sitios:[{id, nombre, direccion, notas}],
                   contactos:[{id, nombre, puesto, correo, telefono}],
                   creado, actualizado }
   cotizaciones: { id, folio, fecha, realizo, clienteId, sitioId, tipoTrabajo,
                   solicitud, vigenciaDias, equipoNombre, equipoModelo,
                   equipoSerie, margen, instalacion:{incluir, porcentaje, fijo},
                   ordenCompra, tipoPago, tiempoEntrega, notas, estatus,
                   partidas:[{id, seccion, numeroParte, cantidad, um, concepto,
                              precioCosto, precioClienteManual}],
                   creado, actualizado }
   usuarios:     { id(uid), correo, nombre, rol, activo, creado, creadoPor,
                   ultimoAcceso, tema }
   bitacora:     { cuando, quien, uid, accion, que, nombre, detalle }
   sistema/parametros: datos de la empresa, IVA, margen y vigencia por omisión
   ========================================================================= */
(function(){
'use strict';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const HAY_NUBE = Nube.HAY_NUBE;
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const num = (v, def) => { const n = parseFloat(String(v ?? '').replace(/[$,\s]/g, '')); return isFinite(n) ? n : (def ?? 0); };
const fmtMXN = new Intl.NumberFormat('es-MX', { style:'currency', currency:'MXN' });
const dinero = n => fmtMXN.format(r2(n));
const hoyISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
function fechaCorta(iso){
  if(!iso) return '—';
  const d = new Date(String(iso).length <= 10 ? iso + 'T12:00:00' : iso);
  if(isNaN(d)) return esc(iso);
  return d.toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' });
}
function fechaHora(iso){
  if(!iso) return '—';
  const d = new Date(iso);
  return isNaN(d) ? '—' : d.toLocaleString('es-MX', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function sumarDias(iso, dias){
  const d = new Date((iso || hoyISO()) + 'T12:00:00');
  d.setDate(d.getDate() + (parseInt(dias, 10) || 0));
  return d.toISOString().slice(0, 10);
}
function diasEntre(desdeISO, hastaISO){
  const a = new Date(desdeISO + 'T12:00:00'), b = new Date(hastaISO + 'T12:00:00');
  return Math.round((b - a) / 86400000);
}
const normTxt = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const iniciales = s => String(s || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
/* "MANTENIMIENTO DE BOMBA" → "Mantenimiento de bomba" (igual que Forguard). */
function oracion(s){
  s = String(s || '').trim();
  if(!s) return '';
  if(s === s.toUpperCase() && /[A-ZÁÉÍÓÚÑ]{3}/.test(s)){ s = s.toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); }
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ================================ ESTADO ================================ */
const estado = {
  datos: { clientes:[], cotizaciones:[] },
  params: Object.assign({}, window.EMPRESA_DEFAULT),
  perfil: null,           // { uid, correo, nombre, rol, activo }
  modulo: 'clientes',
  vista: 'lista',          // lista | detalle
  clienteId: null,
  cotizacionId: null,
  busquedaClientes: '',
  busquedaCot: '',
  filtroEstatus: 'todas',
  lado: 'cliente',         // lado visible de la cotización: cliente | costo
  pestanaAdmin: 'usuarios',
  ultimaActividad: Date.now()
};

/* ============================ ROLES Y PERMISOS ============================ */
const ROLES = {
  owner:   { nombre:'Owner',   desc:'Dueño del tablero: todo, y nadie lo puede bloquear ni degradar.' },
  admin:   { nombre:'Admin',   desc:'Todo, incluido el panel de administración y las cuentas.' },
  analyst: { nombre:'Analyst', desc:'Agrega y modifica clientes y cotizaciones.' },
  viewer:  { nombre:'Viewer',  desc:'Solo puede ver la información; no modifica nada.' }
};
const rol = () => HAY_NUBE ? ((estado.perfil && ROLES[estado.perfil.rol]) ? estado.perfil.rol : 'viewer') : 'owner';
const esOwner = () => rol() === 'owner';
const esAdmin = () => ['owner', 'admin'].includes(rol());
const puedeEditar = () => ['owner', 'admin', 'analyst'].includes(rol());
function exigir(cond, que){
  if(cond) return true;
  aviso('No tienes permiso para ' + que + '.', true);
  return false;
}

/* ================================ AVISOS ================================ */
let relojToast = null;
function aviso(texto, esError){
  const t = $('toast');
  t.textContent = texto;
  t.classList.toggle('error', !!esError);
  t.classList.add('visible');
  clearTimeout(relojToast);
  relojToast = setTimeout(()=> t.classList.remove('visible'), esError ? 5000 : 3400);
}
function mensajeError(e){
  const m = (e && e.message) || String(e);
  if(m === 'SIN_PERMISO') return 'El servidor rechazó el cambio: tu cuenta no tiene permiso.';
  if(m === 'SIN_SESION') return 'Tu sesión terminó. Vuelve a entrar.';
  if(/abort|Failed to fetch|NetworkError/i.test(m)) return 'Sin conexión con el servidor. Inténtalo de nuevo.';
  return m;
}

/* ================================ MODAL ================================ */
let alGuardarModal = null;
function abrirModal(titulo, cuerpo, pie, opciones){
  opciones = opciones || {};
  $('modalTitulo').textContent = titulo;
  $('modalCuerpo').innerHTML = cuerpo;
  $('modalPie').innerHTML = pie ?? '<button class="btn" data-modal="cancelar">Cancelar</button><button class="btn primario" data-modal="guardar">Guardar</button>';
  $('modal').classList.toggle('ancho', !!opciones.ancho);
  alGuardarModal = opciones.alGuardar || null;
  $('telon').classList.add('abierto');
  const primero = $('modalCuerpo').querySelector('input:not([type=hidden]):not([type=checkbox]),select,textarea');
  if(primero && !opciones.sinFoco) primero.focus();
}
function cerrarModal(){
  $('telon').classList.remove('abierto');
  $('modalCuerpo').innerHTML = '';
  alGuardarModal = null;
}
const modalAbierto = () => $('telon').classList.contains('abierto');
$('modalCerrar').addEventListener('click', cerrarModal);
/* El resumen en vivo del editor de cotización (solo existe mientras está abierto). */
$('modalCuerpo').addEventListener('input', ()=>{ if($('qResumen')) refrescarResumen(); });
$('telon').addEventListener('mousedown', e=>{ if(e.target === $('telon')) cerrarModal(); });
document.addEventListener('keydown', e=>{ if(e.key === 'Escape' && modalAbierto()) cerrarModal(); });
$('modalPie').addEventListener('click', async e=>{
  const b = e.target.closest('[data-modal]');
  if(!b) return;
  if(b.dataset.modal === 'cancelar'){ cerrarModal(); return; }
  if(b.dataset.modal === 'guardar' && alGuardarModal){
    b.disabled = true;
    try{
      const ok = await alGuardarModal();
      if(ok !== false) cerrarModal();
    }catch(err){ console.error(err); aviso(mensajeError(err), true); }
    finally{ b.disabled = false; }
  }
});
function confirmar(titulo, texto, boton, fn){
  abrirModal(titulo, '<p>' + texto + '</p>',
    '<button class="btn" data-modal="cancelar">Cancelar</button><button class="btn primario" data-modal="guardar">' + esc(boton) + '</button>',
    { alGuardar:fn, sinFoco:true });
}
/* Para lo irreversible: el botón no se habilita hasta escribir el nombre exacto. */
function confirmarEscribiendoNombre(titulo, textoHTML, nombre, fn){
  abrirModal(titulo,
    textoHTML + '<label class="campo" style="margin-top:14px">Escribe <b>' + esc(nombre) + '</b> para confirmar<input id="confNombre" autocomplete="off"></label>',
    '<button class="btn" data-modal="cancelar">Cancelar</button><button class="btn peligro" data-modal="guardar" id="confBoton" disabled>Eliminar definitivamente</button>',
    { alGuardar:fn });
  $('confNombre').addEventListener('input', ()=>{ $('confBoton').disabled = $('confNombre').value.trim() !== String(nombre).trim(); });
}

/* =============================== BITÁCORA =============================== */
function anotar(accion, que, nombre, detalle){
  const p = estado.perfil || {};
  const reg = { cuando:new Date().toISOString(), quien:p.correo || 'local', uid:p.uid || '', accion, que, nombre:nombre || '', detalle:detalle || '' };
  Nube.guardar('bitacora', null, reg).catch(e => console.warn('bitácora', e));
}

/* ================================= TEMA ================================= */
const ICONO_SOL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const ICONO_LUNA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
function aplicarTema(t){
  document.documentElement.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light');
  $('btnTema').innerHTML = t === 'dark' ? ICONO_LUNA : ICONO_SOL;
}
$('btnTema').addEventListener('click', ()=>{
  const t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  try{ localStorage.setItem('profectus.tema', t); }catch(e){}
  aplicarTema(t);
});
aplicarTema(document.documentElement.getAttribute('data-theme'));

/* ============================ NORMALIZADORES ============================ */
function normalizarCliente(c){
  c = c || {};
  return {
    id: c.id,
    nombre: String(c.nombre || '').trim() || 'Cliente',
    razonSocial: c.razonSocial || '', rfc: (c.rfc || '').toUpperCase(),
    segmento: c.segmento || '',
    contacto: c.contacto || '', telefono: c.telefono || '', correo: c.correo || '',
    direccion: c.direccion || '', notas: c.notas || '',
    logo: (typeof c.logo === 'string' && c.logo.startsWith('data:image/')) ? c.logo : '',
    sitios: (Array.isArray(c.sitios) ? c.sitios : []).filter(s => s && String(s.nombre || '').trim())
      .map(s => ({ id:s.id || Nube.nuevoId(), nombre:String(s.nombre).trim(), direccion:s.direccion || '', notas:s.notas || '' })),
    contactos: (Array.isArray(c.contactos) ? c.contactos : []).filter(k => k && (k.nombre || k.correo || k.telefono))
      .map(k => ({ id:k.id || Nube.nuevoId(), nombre:k.nombre || '', puesto:k.puesto || '', correo:k.correo || '', telefono:k.telefono || '' })),
    creado: c.creado || '', actualizado: c.actualizado || ''
  };
}

/* Estatus de una cotización. "Abierta" = todavía corre su vigencia. */
const ESTATUS = {
  borrador:  { nombre:'Borrador',  clase:'est-borrador' },
  enviada:   { nombre:'Enviada',   clase:'est-enviada' },
  aprobada:  { nombre:'Aprobada',  clase:'est-aceptada' },
  facturada: { nombre:'Facturada', clase:'est-aceptada' },
  rechazada: { nombre:'Rechazada', clase:'est-rechazada' },
  cancelada: { nombre:'Cancelada', clase:'est-rechazada' }
};
const ABIERTAS = ['borrador', 'enviada'];
const PERDIDAS = ['rechazada', 'cancelada'];
const INGRESO  = ['aprobada', 'facturada'];
const TIPOS_TRABAJO = ['Correctivo', 'Preventivo', 'Revisión / diagnóstico', 'Instalación', 'Suministro', 'Obra civil', 'Proyecto especial'];
const UNIDADES = ['PZA', 'SERV', 'JGO', 'LOTE', 'M', 'M2', 'M3', 'KG', 'LT', 'HR', 'DÍA'];

/* Respeta un 0 escrito a propósito; solo vacío/inválido usa el default. */
const numDef = (v, def) => (v === '' || v === null || v === undefined || !isFinite(Number(v))) ? def : Number(v);

function normalizarPartida(p){
  p = p || {};
  const manual = p.precioClienteManual;
  return {
    id: p.id || Nube.nuevoId(),
    seccion: String(p.seccion || '').trim(),
    numeroParte: String(p.numeroParte || '').trim(),
    cantidad: numDef(p.cantidad, 1),
    um: String(p.um || 'PZA').trim(),
    concepto: oracion(p.concepto),
    precioCosto: r2(numDef(p.precioCosto, 0)),
    precioClienteManual: (manual === '' || manual === null || manual === undefined || !isFinite(Number(manual))) ? null : r2(manual)
  };
}
function normalizarCotizacion(q){
  q = q || {};
  const P = estado.params;
  const inst = q.instalacion || {};
  return {
    id: q.id,
    folio: String(q.folio || '').trim(),
    fecha: q.fecha || hoyISO(),
    realizo: q.realizo || '',
    clienteId: q.clienteId || '',
    sitioId: q.sitioId || '',
    tipoTrabajo: q.tipoTrabajo || '',
    solicitud: q.solicitud || '',
    vigenciaDias: numDef(q.vigenciaDias, P.vigenciaDias),
    equipoNombre: q.equipoNombre || '', equipoModelo: q.equipoModelo || '', equipoSerie: q.equipoSerie || '',
    margen: numDef(q.margen, P.margenPct),
    instalacion: { incluir: !!inst.incluir, porcentaje: numDef(inst.porcentaje, 20), fijo: numDef(inst.fijo, 0) },
    ordenCompra: q.ordenCompra ?? 'PENDIENTE',
    tipoPago: q.tipoPago ?? 'Crédito',
    tiempoEntrega: q.tiempoEntrega || '',
    notas: q.notas ?? P.condiciones,
    estatus: ESTATUS[q.estatus] ? q.estatus : 'borrador',
    partidas: (Array.isArray(q.partidas) ? q.partidas : []).map(normalizarPartida).filter(p => p.concepto),
    creado: q.creado || '', actualizado: q.actualizado || ''
  };
}

/* ======================== CÁLCULO DE COTIZACIÓN ========================
   La ÚNICA función que hace cuentas de dinero; todo lo demás (pantalla y
   documento impreso) la consulta. Mismas fórmulas que Forguard:
     importeCosto   = cant × precioCosto
     precioCliente  = precioClienteManual ?? precioCosto × (1 + margen/100)
     instalaciónC   = subtotalPartidasCosto × % / 100 + fijo
     instalaciónCli = instalaciónC × (1 + margen/100)
     subtotal       = partidas + (incluir ? instalación : 0)
     IVA            = subtotal × iva%    total = subtotal + IVA
   ======================================================================= */
function numerarPartidas(partidas){
  let g = 0, sub = 0, prev = null;
  return partidas.map(p=>{
    const sec = p.seccion || '';
    let n;
    if(sec && sec === prev){ sub++; n = g + '.' + sub; }
    else if(sec){ g++; sub = 1; n = g + '.1'; }
    else { g++; sub = 0; n = String(g); }
    const nuevoGrupo = !!sec && sec !== prev;
    prev = sec || null;
    return { numPart:n, nuevoGrupo, grupo:g };
  });
}
function calcularCotizacion(q){
  const m = num(q.margen) / 100;
  const ivaPct = num(estado.params.ivaPct, 16) / 100;
  const nums = numerarPartidas(q.partidas);
  const renglones = q.partidas.map((p, i)=>{
    const cant = num(p.cantidad);
    const precioCliente = p.precioClienteManual !== null && p.precioClienteManual !== undefined
      ? r2(p.precioClienteManual) : r2(num(p.precioCosto) * (1 + m));
    return Object.assign({}, p, nums[i], {
      importeCosto: r2(cant * num(p.precioCosto)),
      precioCliente,
      importeCliente: r2(cant * precioCliente)
    });
  });
  const subPartCosto = r2(renglones.reduce((a, x) => a + x.importeCosto, 0));
  const subPartCliente = r2(renglones.reduce((a, x) => a + x.importeCliente, 0));
  const inst = q.instalacion || {};
  const instCosto = r2(subPartCosto * num(inst.porcentaje) / 100 + num(inst.fijo));
  const instCliente = r2(instCosto * (1 + m));
  const ultimoGrupo = nums.length ? nums[nums.length - 1].grupo : 0;
  const lado = (sp, ins)=>{
    const subtotal = r2(sp + (inst.incluir ? ins : 0));
    const iva = r2(subtotal * ivaPct);
    return { subtotalPartidas:sp, instalacion:ins, subtotal, iva, total:r2(subtotal + iva) };
  };
  const costo = lado(subPartCosto, instCosto);
  const cliente = lado(subPartCliente, instCliente);
  const fechaVence = sumarDias(q.fecha, q.vigenciaDias);
  const diasVigencia = diasEntre(hoyISO(), fechaVence);
  return {
    renglones, costo, cliente,
    instalacionNumPart: String(ultimoGrupo + 1),
    utilidad: r2(cliente.subtotal - costo.subtotal),
    margenReal: cliente.subtotal ? r2((cliente.subtotal - costo.subtotal) / cliente.subtotal * 100) : 0,
    fechaVence, diasVigencia,
    vencida: ABIERTAS.includes(q.estatus) && diasVigencia < 0
  };
}

/* ============================== CONSULTAS ============================== */
const clientePorId = id => estado.datos.clientes.find(c => c.id === id);
const cotizacionPorId = id => estado.datos.cotizaciones.find(q => q.id === id);
function sitioDe(q){
  const c = clientePorId(q.clienteId);
  return c ? (c.sitios.find(s => s.id === q.sitioId) || null) : null;
}
const cotizacionesDeCliente = id => estado.datos.cotizaciones.filter(q => q.clienteId === id);
function resumirCotizaciones(lista){
  let monto = 0, ingreso = 0, borradores = 0, vencidas = 0, abiertas = 0;
  lista.forEach(q=>{
    const c = calcularCotizacion(q);
    if(!PERDIDAS.includes(q.estatus)) monto += c.cliente.total;
    if(INGRESO.includes(q.estatus)) ingreso += c.cliente.total;
    if(q.estatus === 'borrador') borradores++;
    if(ABIERTAS.includes(q.estatus)) abiertas++;
    if(c.vencida) vencidas++;
  });
  const cerradas = lista.filter(q => INGRESO.includes(q.estatus) || PERDIDAS.includes(q.estatus)).length;
  const ganadas = lista.filter(q => INGRESO.includes(q.estatus)).length;
  return { total:lista.length, monto, ingreso, borradores, vencidas, abiertas, conversion: cerradas ? Math.round(ganadas / cerradas * 100) : 0 };
}
/* Folio sugerido: PRO-DDMMAA-NN, NN consecutivo por día. */
function generarFolio(fechaISO){
  const [a, m, d] = (fechaISO || hoyISO()).split('-');
  const prefijo = 'PRO-' + d + m + a.slice(2) + '-';
  let max = 0;
  estado.datos.cotizaciones.forEach(q=>{
    if(String(q.folio).startsWith(prefijo)){ const n = parseInt(q.folio.slice(prefijo.length), 10); if(n > max) max = n; }
  });
  return prefijo + String(max + 1).padStart(2, '0');
}
/* Catálogo de partes derivado de cotizaciones anteriores: el precio más
   reciente gana y se ordena por uso (igual que Forguard). */
function catalogoPartes(){
  const mapa = new Map();
  const ordenadas = estado.datos.cotizaciones.slice().sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  ordenadas.forEach(q => q.partidas.forEach(p=>{
    const llave = p.numeroParte ? 'np:' + normTxt(p.numeroParte) : 'tx:' + normTxt(p.concepto);
    const prev = mapa.get(llave);
    mapa.set(llave, { concepto:p.concepto, numeroParte:p.numeroParte, um:p.um, precioCosto:p.precioCosto, usos:(prev ? prev.usos : 0) + 1 });
  }));
  return Array.from(mapa.values()).sort((a, b) => b.usos - a.usos);
}

/* ============================ CARGA DE DATOS ============================ */
async function cargarDatos(){
  const [clientes, cotizaciones, params] = await Promise.all([
    Nube.listar('clientes'),
    Nube.listar('cotizaciones'),
    Nube.leer('sistema', 'parametros').catch(()=> null)
  ]);
  estado.datos.clientes = clientes.map(normalizarCliente).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  estado.params = Object.assign({}, window.EMPRESA_DEFAULT, params || {});
  estado.datos.cotizaciones = cotizaciones.map(normalizarCotizacion);
}
function reemplazarEnLista(lista, reg){
  const i = lista.findIndex(x => x.id === reg.id);
  if(i >= 0) lista[i] = reg; else lista.push(reg);
}
async function guardarCliente(c, accion){
  const ahora = new Date().toISOString();
  c = normalizarCliente(c);
  if(!c.creado) c.creado = ahora;
  c.actualizado = ahora;
  c.id = await Nube.guardar('clientes', c.id, c);
  reemplazarEnLista(estado.datos.clientes, c);
  estado.datos.clientes.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  anotar(accion, 'cliente', c.nombre);
  return c;
}
async function guardarCotizacion(q, accion, detalle){
  const ahora = new Date().toISOString();
  q = normalizarCotizacion(q);
  if(!q.creado) q.creado = ahora;
  q.actualizado = ahora;
  q.id = await Nube.guardar('cotizaciones', q.id, q);
  reemplazarEnLista(estado.datos.cotizaciones, q);
  anotar(accion, 'cotización', q.folio, detalle);
  return q;
}

/* ============================== NAVEGACIÓN ============================== */
function modulosPermitidos(){
  const m = [{ id:'clientes', nombre:'Clientes' }, { id:'cotizaciones', nombre:'Cotizaciones' }];
  if(esAdmin()) m.push({ id:'admin', nombre:'Admin' });
  return m;
}
function pintarCabecera(){
  $('nav').innerHTML = modulosPermitidos().map(m =>
    '<button data-accion="ir" data-modulo="' + m.id + '" class="' + (estado.modulo === m.id ? 'activo' : '') + '">' + m.nombre + '</button>').join('');
  const p = estado.perfil;
  $('usuarioNombre').textContent = p ? (p.nombre || p.correo) : 'Modo local';
  $('usuarioRol').textContent = ROLES[rol()].nombre;
  $('btnSalir').classList.toggle('oculto', !HAY_NUBE);
  $('avisoLocal').classList.toggle('oculto', HAY_NUBE);
}
function render(){
  pintarCabecera();
  const v = $('vista');
  if(estado.modulo === 'clientes') v.innerHTML = estado.vista === 'detalle' && clientePorId(estado.clienteId) ? vistaCliente() : vistaClientes();
  else if(estado.modulo === 'cotizaciones') v.innerHTML = estado.vista === 'detalle' && cotizacionPorId(estado.cotizacionId) ? vistaCotizacion() : vistaCotizaciones();
  else if(estado.modulo === 'admin' && esAdmin()){ v.innerHTML = vistaAdmin(); montarAdmin(); }
  else { estado.modulo = 'clientes'; estado.vista = 'lista'; return render(); }
  const b = v.querySelector('[data-autofoco]');
  if(b){ const largo = b.value.length; b.focus(); b.setSelectionRange(largo, largo); }
}
function irA(modulo, vista, id){
  estado.modulo = modulo;
  estado.vista = vista || 'lista';
  if(modulo === 'clientes') estado.clienteId = id || null;
  if(modulo === 'cotizaciones') estado.cotizacionId = id || null;
  render();
  window.scrollTo(0, 0);
}

/* ================================ CLIENTES ================================ */
function avatarCliente(c, tam){
  const st = tam ? ' style="width:' + tam + 'px;height:' + tam + 'px"' : '';
  return '<div class="avatar"' + st + '>' + (c.logo ? '<img src="' + c.logo + '" alt="">' : esc(iniciales(c.nombre))) + '</div>';
}
function vistaClientes(){
  const todos = estado.datos.clientes;
  const q = normTxt(estado.busquedaClientes);
  const lista = q ? todos.filter(c => normTxt([c.nombre, c.razonSocial, c.rfc, c.contacto, c.segmento].join(' ')).includes(q)) : todos;
  const r = resumirCotizaciones(estado.datos.cotizaciones);
  const sitios = todos.reduce((a, c) => a + c.sitios.length, 0);
  let h = '<div class="cabeza-vista"><div><div class="eyebrow">Módulo</div><h1>Clientes</h1></div><div class="acciones">'
    + '<input class="buscador" id="buscaCliente" data-autofoco placeholder="Buscar cliente, RFC, contacto…" value="' + esc(estado.busquedaClientes) + '">'
    + '<button class="btn" data-accion="exportar-clientes">Exportar CSV</button>'
    + (puedeEditar() ? '<button class="btn primario" data-accion="nuevo-cliente">+ Agregar cliente</button>' : '')
    + '</div></div>';
  h += '<div class="kpis">'
    + kpi('Clientes', todos.length, sitios + ' sitio' + (sitios === 1 ? '' : 's') + ' registrados')
    + kpi('Cotizaciones abiertas', r.abiertas, r.vencidas ? r.vencidas + ' vencida' + (r.vencidas === 1 ? '' : 's') : 'ninguna vencida')
    + kpi('Monto cotizado', dinero(r.monto), 'sin rechazadas ni canceladas')
    + kpi('Ingreso aprobado', dinero(r.ingreso), 'conversión ' + r.conversion + '%')
    + '</div>';
  if(!lista.length){
    h += '<div class="tarjeta vacio"><img src="assets/simbolo.png" alt=""><p>' + (q ? 'Ningún cliente coincide con la búsqueda.' : 'Aún no hay clientes. ' + (puedeEditar() ? 'Agrega el primero.' : '')) + '</p></div>';
    return h;
  }
  h += '<div class="cuadricula">' + lista.map(c=>{
    const qs = cotizacionesDeCliente(c.id);
    const rr = resumirCotizaciones(qs);
    return '<div class="cliente-card" data-accion="ver-cliente" data-id="' + c.id + '">'
      + '<div style="display:flex;gap:12px;align-items:center">' + avatarCliente(c) + '<div><div class="nom">' + esc(c.nombre) + '</div>'
      + '<div class="muted" style="font-size:12px">' + esc(c.contacto || c.razonSocial || '—') + '</div></div></div>'
      + (c.segmento ? '<div><span class="estatus est-borrador">' + esc(c.segmento) + '</span></div>' : '')
      + '<div class="datos"><div><b>' + c.sitios.length + '</b>Sitios</div><div><b>' + qs.length + '</b>Cotizaciones</div><div><b class="num">' + dinero(rr.monto) + '</b>Cotizado</div></div>'
      + '</div>';
  }).join('') + '</div>';
  return h;
}
function kpi(k, v, s){
  return '<div class="kpi"><div class="k">' + esc(k) + '</div><div class="v num">' + esc(v) + '</div><div class="s">' + esc(s || '') + '</div></div>';
}
function vistaCliente(){
  const c = clientePorId(estado.clienteId);
  const qs = cotizacionesDeCliente(c.id).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  const r = resumirCotizaciones(qs);
  let h = '<div class="cabeza-vista"><div style="display:flex;gap:14px;align-items:center">'
    + '<button class="btn fantasma" data-accion="ir" data-modulo="clientes">← Clientes</button>'
    + avatarCliente(c, 56) + '<div><div class="eyebrow">Cliente</div><h1>' + esc(c.nombre) + '</h1></div></div><div class="acciones">'
    + (puedeEditar() ? '<button class="btn primario" data-accion="nueva-cotizacion" data-cliente="' + c.id + '">+ Nueva cotización</button><button class="btn" data-accion="editar-cliente" data-id="' + c.id + '">Editar</button>' : '')
    + (esAdmin() ? '<button class="btn peligro" data-accion="eliminar-cliente" data-id="' + c.id + '">Eliminar</button>' : '')
    + '</div></div>';
  h += '<div class="kpis">' + kpi('Sitios', c.sitios.length) + kpi('Cotizaciones', qs.length, r.abiertas + ' abiertas')
    + kpi('Monto cotizado', dinero(r.monto)) + kpi('Ingreso aprobado', dinero(r.ingreso), 'conversión ' + r.conversion + '%') + '</div>';
  const dato = (k, v) => '<div><div class="etiqueta">' + k + '</div><div class="dato">' + (v ? esc(v) : '<span class="muted">—</span>') + '</div></div>';
  h += '<div class="tarjeta"><div class="tit"><h3>Datos generales</h3></div><div class="ficha">'
    + dato('Razón social', c.razonSocial) + dato('RFC', c.rfc) + dato('Segmento', c.segmento) + dato('Contacto principal', c.contacto)
    + dato('Teléfono', c.telefono) + dato('Correo', c.correo) + dato('Dirección', c.direccion) + dato('Notas', c.notas) + '</div></div>';

  h += '<div class="tarjeta"><div class="tit"><h3>Sitios / ubicaciones</h3>' + (puedeEditar() ? '<button class="btn chico" data-accion="nuevo-sitio" data-id="' + c.id + '">+ Agregar sitio</button>' : '') + '</div>';
  h += c.sitios.length ? '<div class="tabla-wrap"><table class="tabla"><thead><tr><th>Sitio</th><th>Dirección</th><th>Notas</th><th class="n">Cotizaciones</th><th></th></tr></thead><tbody>'
    + c.sitios.map(s => '<tr><td><b>' + esc(s.nombre) + '</b></td><td>' + esc(s.direccion) + '</td><td class="muted">' + esc(s.notas) + '</td><td class="n">' + qs.filter(q => q.sitioId === s.id).length + '</td><td class="derecha">'
      + (puedeEditar() ? '<button class="btn chico" data-accion="editar-sitio" data-id="' + c.id + '" data-sitio="' + s.id + '">Editar</button> ' : '')
      + (esAdmin() ? '<button class="btn chico peligro" data-accion="eliminar-sitio" data-id="' + c.id + '" data-sitio="' + s.id + '">Quitar</button>' : '') + '</td></tr>').join('')
    + '</tbody></table></div>' : '<p class="muted">Sin sitios registrados. Los sitios son las ubicaciones del cliente donde se presta el servicio.</p>';
  h += '</div>';

  h += '<div class="tarjeta"><div class="tit"><h3>Contactos</h3>' + (puedeEditar() ? '<button class="btn chico" data-accion="nuevo-contacto" data-id="' + c.id + '">+ Agregar contacto</button>' : '') + '</div>';
  h += c.contactos.length ? '<div class="lista-contactos">' + c.contactos.map(k => '<div class="contacto"><div><b>' + esc(k.nombre || '—') + '</b>' + (k.puesto ? ' · <span class="muted">' + esc(k.puesto) + '</span>' : '')
      + '<div class="muted">' + [k.correo, k.telefono].filter(Boolean).map(esc).join(' · ') + '</div></div><div>'
      + (puedeEditar() ? '<button class="btn chico" data-accion="editar-contacto" data-id="' + c.id + '" data-contacto="' + k.id + '">Editar</button> <button class="btn chico peligro" data-accion="eliminar-contacto" data-id="' + c.id + '" data-contacto="' + k.id + '">Quitar</button>' : '')
      + '</div></div>').join('') + '</div>' : '<p class="muted">Sin contactos adicionales.</p>';
  h += '</div>';

  h += '<div class="tarjeta"><div class="tit"><h3>Cotizaciones</h3></div>' + (qs.length ? tablaCotizaciones(qs) : '<p class="muted">Este cliente aún no tiene cotizaciones.</p>') + '</div>';
  return h;
}

/* --- Alta / edición de cliente --- */
let logoTmp = '';
function modalCliente(id){
  if(!exigir(puedeEditar(), 'editar clientes')) return;
  const c = id ? clientePorId(id) : normalizarCliente({ nombre:'' });
  if(!id) c.nombre = '';
  logoTmp = c.logo || '';
  const segmentos = Array.from(new Set(estado.datos.clientes.map(x => x.segmento).filter(Boolean))).sort();
  const campo = (lbl, idc, val, extra) => '<label class="campo">' + lbl + '<input id="' + idc + '" value="' + esc(val) + '" ' + (extra || '') + '></label>';
  abrirModal(id ? 'Editar cliente' : 'Agregar cliente',
    '<div style="display:flex;gap:14px;align-items:center;margin-bottom:14px"><div id="cLogoPrev">' + avatarCliente({ nombre:c.nombre, logo:logoTmp }, 64) + '</div>'
    + '<div class="acciones"><button class="btn chico" type="button" id="cLogoSubir">Subir logo</button><button class="btn chico fantasma" type="button" id="cLogoQuitar">Quitar</button></div></div>'
    + '<div class="rejilla">'
    + campo('Nombre comercial *', 'cNombre', c.nombre, 'required')
    + campo('Razón social', 'cRazon', c.razonSocial)
    + campo('RFC', 'cRfc', c.rfc, 'maxlength="13" style="text-transform:uppercase"')
    + campo('Segmento / giro', 'cSegmento', c.segmento, 'list="dlSegmentos"')
    + campo('Contacto principal', 'cContacto', c.contacto)
    + campo('Teléfono', 'cTelefono', c.telefono, 'type="tel"')
    + campo('Correo', 'cCorreo', c.correo, 'type="email"')
    + '<label class="campo ancho">Dirección fiscal<input id="cDireccion" value="' + esc(c.direccion) + '"></label>'
    + '<label class="campo ancho">Notas<textarea id="cNotas">' + esc(c.notas) + '</textarea></label>'
    + '</div><datalist id="dlSegmentos">' + segmentos.map(s => '<option value="' + esc(s) + '">').join('') + '</datalist>'
    + (id ? '' : '<p class="muted" style="font-size:12px;margin-top:12px">Después de guardarlo podrás agregar sus sitios y contactos.</p>'),
    null,
    { alGuardar: async ()=>{
      const nombre = $('cNombre').value.trim();
      if(!nombre){ aviso('Escribe el nombre del cliente.', true); $('cNombre').focus(); return false; }
      const dup = estado.datos.clientes.find(x => x.id !== id && normTxt(x.nombre) === normTxt(nombre));
      if(dup){ aviso('Ya existe un cliente con ese nombre.', true); return false; }
      const reg = Object.assign({}, c, {
        nombre, razonSocial:$('cRazon').value.trim(), rfc:$('cRfc').value.trim(), segmento:$('cSegmento').value.trim(),
        contacto:$('cContacto').value.trim(), telefono:$('cTelefono').value.trim(), correo:$('cCorreo').value.trim(),
        direccion:$('cDireccion').value.trim(), notas:$('cNotas').value.trim(), logo:logoTmp
      });
      const g = await guardarCliente(reg, id ? 'editó' : 'creó');
      aviso(id ? 'Cliente actualizado.' : 'Cliente agregado.');
      irA('clientes', 'detalle', g.id);
    } });
  $('cLogoSubir').onclick = ()=> $('archivoLogo').click();
  $('cLogoQuitar').onclick = ()=>{ logoTmp = ''; $('cLogoPrev').innerHTML = avatarCliente({ nombre:$('cNombre').value, logo:'' }, 64); };
}
/* El logo se reduce a 256 px para que el documento no crezca de más. */
$('archivoLogo').addEventListener('change', e=>{
  const f = e.target.files[0];
  e.target.value = '';
  if(!f) return;
  const lector = new FileReader();
  lector.onload = ()=>{
    const img = new Image();
    img.onload = ()=>{
      const LADO = 256, k = Math.min(1, LADO / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      logoTmp = cv.toDataURL('image/png');
      if(logoTmp.length > 180000) logoTmp = cv.toDataURL('image/jpeg', 0.85);
      const prev = $('cLogoPrev');
      if(prev) prev.innerHTML = avatarCliente({ nombre:'', logo:logoTmp }, 64);
    };
    img.onerror = ()=> aviso('No se pudo leer la imagen.', true);
    img.src = lector.result;
  };
  lector.readAsDataURL(f);
});

function modalSitio(clienteId, sitioId){
  if(!exigir(puedeEditar(), 'editar sitios')) return;
  const c = clientePorId(clienteId);
  const s = c.sitios.find(x => x.id === sitioId) || { nombre:'', direccion:'', notas:'' };
  abrirModal(sitioId ? 'Editar sitio' : 'Agregar sitio a ' + c.nombre,
    '<div class="rejilla"><label class="campo ancho">Nombre del sitio *<input id="sNombre" value="' + esc(s.nombre) + '" placeholder="Ej. Planta Apodaca"></label>'
    + '<label class="campo ancho">Dirección<input id="sDireccion" value="' + esc(s.direccion) + '"></label>'
    + '<label class="campo ancho">Notas<textarea id="sNotas">' + esc(s.notas) + '</textarea></label></div>',
    null,
    { alGuardar: async ()=>{
      const nombre = $('sNombre').value.trim();
      if(!nombre){ aviso('Escribe el nombre del sitio.', true); return false; }
      const nuevo = { id:sitioId || Nube.nuevoId(), nombre, direccion:$('sDireccion').value.trim(), notas:$('sNotas').value.trim() };
      const reg = Object.assign({}, c, { sitios: sitioId ? c.sitios.map(x => x.id === sitioId ? nuevo : x) : c.sitios.concat(nuevo) });
      await guardarCliente(reg, sitioId ? 'editó sitio de' : 'agregó sitio a');
      aviso('Sitio guardado.');
      render();
    } });
}
function modalContacto(clienteId, contactoId){
  if(!exigir(puedeEditar(), 'editar contactos')) return;
  const c = clientePorId(clienteId);
  const k = c.contactos.find(x => x.id === contactoId) || {};
  const campo = (lbl, idc, val, t) => '<label class="campo">' + lbl + '<input id="' + idc + '" type="' + (t || 'text') + '" value="' + esc(val || '') + '"></label>';
  abrirModal(contactoId ? 'Editar contacto' : 'Agregar contacto',
    '<div class="rejilla">' + campo('Nombre', 'kNombre', k.nombre) + campo('Puesto', 'kPuesto', k.puesto) + campo('Correo', 'kCorreo', k.correo, 'email') + campo('Teléfono', 'kTelefono', k.telefono, 'tel') + '</div>',
    null,
    { alGuardar: async ()=>{
      const nuevo = { id:contactoId || Nube.nuevoId(), nombre:$('kNombre').value.trim(), puesto:$('kPuesto').value.trim(), correo:$('kCorreo').value.trim(), telefono:$('kTelefono').value.trim() };
      if(!nuevo.nombre && !nuevo.correo && !nuevo.telefono){ aviso('Escribe al menos nombre, correo o teléfono.', true); return false; }
      const reg = Object.assign({}, c, { contactos: contactoId ? c.contactos.map(x => x.id === contactoId ? nuevo : x) : c.contactos.concat(nuevo) });
      await guardarCliente(reg, 'editó contactos de');
      aviso('Contacto guardado.');
      render();
    } });
}
function eliminarCliente(id){
  if(!exigir(esAdmin(), 'eliminar clientes')) return;
  const c = clientePorId(id);
  const n = cotizacionesDeCliente(id).length;
  confirmarEscribiendoNombre('Eliminar cliente',
    '<p>Se eliminará <b>' + esc(c.nombre) + '</b> junto con sus ' + c.sitios.length + ' sitio(s) y contactos.</p>'
    + (n ? '<p class="muted">Sus <b>' + n + '</b> cotización(es) NO se borran: quedan en el módulo de Cotizaciones como "cliente eliminado".</p>' : ''),
    c.nombre,
    async ()=>{
      await Nube.borrar('clientes', id);
      estado.datos.clientes = estado.datos.clientes.filter(x => x.id !== id);
      anotar('eliminó', 'cliente', c.nombre);
      aviso('Cliente eliminado.');
      irA('clientes');
    });
}

/* ============================== COTIZACIONES ============================== */
function chipEstatus(q, calc){
  calc = calc || calcularCotizacion(q);
  const e = ESTATUS[q.estatus];
  return '<span class="estatus ' + e.clase + '">' + e.nombre + '</span>' + (calc.vencida ? ' <span class="estatus est-vencida">Vencida</span>' : '');
}
function tablaCotizaciones(lista){
  return '<div class="tabla-wrap"><table class="tabla"><thead><tr><th>Folio</th><th>Fecha</th><th>Cliente / sitio</th><th>Trabajo</th><th>Estatus</th><th class="n">Costo</th><th class="n">Total cliente</th></tr></thead><tbody>'
    + lista.map(q=>{
      const c = clientePorId(q.clienteId), s = sitioDe(q), k = calcularCotizacion(q);
      return '<tr class="click" data-accion="ver-cotizacion" data-id="' + q.id + '"><td><b>' + esc(q.folio || '(sin folio)') + '</b></td><td class="num">' + fechaCorta(q.fecha) + '</td>'
        + '<td>' + (c ? esc(c.nombre) : '<span class="muted">Cliente eliminado</span>') + (s ? '<div class="muted" style="font-size:12px">' + esc(s.nombre) + '</div>' : '') + '</td>'
        + '<td>' + esc(q.tipoTrabajo || '—') + '<div class="muted" style="font-size:12px">' + q.partidas.length + ' partida(s)</div></td>'
        + '<td>' + chipEstatus(q, k) + '</td><td class="n">' + dinero(k.costo.total) + '</td><td class="n"><b>' + dinero(k.cliente.total) + '</b></td></tr>';
    }).join('') + '</tbody></table></div>';
}
function vistaCotizaciones(){
  const todas = estado.datos.cotizaciones.slice().sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || String(b.folio).localeCompare(String(a.folio)));
  const r = resumirCotizaciones(todas);
  const q = normTxt(estado.busquedaCot);
  const f = estado.filtroEstatus;
  const lista = todas.filter(x=>{
    if(f === 'vencidas'){ if(!calcularCotizacion(x).vencida) return false; }
    else if(f !== 'todas' && x.estatus !== f) return false;
    if(!q) return true;
    const c = clientePorId(x.clienteId), s = sitioDe(x);
    return normTxt([x.folio, c && c.nombre, s && s.nombre, x.tipoTrabajo, x.equipoNombre, x.realizo].join(' ')).includes(q);
  });
  let h = '<div class="cabeza-vista"><div><div class="eyebrow">Módulo</div><h1>Cotizaciones</h1></div><div class="acciones">'
    + '<input class="buscador" id="buscaCot" data-autofoco placeholder="Folio, cliente, sitio, trabajo…" value="' + esc(estado.busquedaCot) + '">'
    + '<select id="filtroEstatus" style="width:auto"><option value="todas">Todas</option>'
    + Object.keys(ESTATUS).map(k => '<option value="' + k + '"' + (f === k ? ' selected' : '') + '>' + ESTATUS[k].nombre + '</option>').join('')
    + '<option value="vencidas"' + (f === 'vencidas' ? ' selected' : '') + '>Vencidas</option></select>'
    + '<button class="btn" data-accion="exportar-cotizaciones">Exportar CSV</button>'
    + (puedeEditar() ? '<button class="btn primario" data-accion="nueva-cotizacion">+ Nueva cotización</button>' : '')
    + '</div></div>';
  h += '<div class="kpis">' + kpi('Cotizaciones', r.total, r.borradores + ' en borrador') + kpi('Monto cotizado', dinero(r.monto), 'sin rechazadas ni canceladas')
    + kpi('Ingreso aprobado', dinero(r.ingreso), 'conversión ' + r.conversion + '%') + kpi('Vencidas', r.vencidas, 'abiertas con vigencia agotada') + '</div>';
  /* Resumen por persona que cotizó. */
  const porPersona = {};
  todas.forEach(x=>{ const k = x.realizo || 'Sin asignar'; (porPersona[k] = porPersona[k] || []).push(x); });
  const personas = Object.keys(porPersona);
  if(personas.length > 1){
    h += '<div class="tarjeta"><div class="tit"><h3>Por persona</h3></div><div class="tabla-wrap"><table class="tabla"><thead><tr><th>Realizó</th><th class="n">Cotizaciones</th><th class="n">Cotizado</th><th class="n">Ingreso</th><th class="n">Conversión</th></tr></thead><tbody>'
      + personas.sort().map(p => { const rr = resumirCotizaciones(porPersona[p]); return '<tr><td>' + esc(p) + '</td><td class="n">' + rr.total + '</td><td class="n">' + dinero(rr.monto) + '</td><td class="n">' + dinero(rr.ingreso) + '</td><td class="n">' + rr.conversion + '%</td></tr>'; }).join('')
      + '</tbody></table></div></div>';
  }
  h += '<div class="tarjeta">' + (lista.length ? tablaCotizaciones(lista) : '<div class="vacio"><img src="assets/simbolo.png" alt=""><p>' + (todas.length ? 'Ninguna cotización coincide con el filtro.' : 'Aún no hay cotizaciones.') + '</p></div>') + '</div>';
  return h;
}

function vistaCotizacion(){
  const q = cotizacionPorId(estado.cotizacionId);
  const c = clientePorId(q.clienteId), s = sitioDe(q);
  const k = calcularCotizacion(q);
  const lado = estado.lado === 'costo' ? 'costo' : 'cliente';
  const T = k[lado];
  let h = '<div class="cabeza-vista"><div style="display:flex;gap:14px;align-items:center">'
    + '<button class="btn fantasma" data-accion="ir" data-modulo="cotizaciones">← Cotizaciones</button>'
    + '<div><div class="eyebrow">Cotización</div><h1>' + esc(q.folio || '(sin folio)') + '</h1></div><div>' + chipEstatus(q, k) + '</div></div><div class="acciones">'
    + '<button class="btn" data-accion="previa-cotizacion" data-id="' + q.id + '">Vista previa / PDF</button>'
    + (puedeEditar() ? '<button class="btn" data-accion="duplicar-cotizacion" data-id="' + q.id + '">Duplicar</button><button class="btn primario" data-accion="editar-cotizacion" data-id="' + q.id + '">Editar</button>' : '')
    + (esAdmin() ? '<button class="btn peligro" data-accion="eliminar-cotizacion" data-id="' + q.id + '">Eliminar</button>' : '')
    + '</div></div>';
  if(puedeEditar()){
    h += '<div class="tarjeta" style="padding:12px 18px"><div class="acciones"><span class="etiqueta">Cambiar estatus:</span>'
      + Object.keys(ESTATUS).map(e => '<button class="btn chico' + (q.estatus === e ? ' primario' : '') + '" data-accion="estatus-cotizacion" data-id="' + q.id + '" data-estatus="' + e + '">' + ESTATUS[e].nombre + '</button>').join('')
      + '</div></div>';
  }
  const dato = (lbl, v) => '<div><div class="etiqueta">' + lbl + '</div><div class="dato">' + (v ? esc(v) : '<span class="muted">—</span>') + '</div></div>';
  h += '<div class="tarjeta"><div class="ficha">'
    + '<div><div class="etiqueta">Cliente</div><div class="dato">' + (c ? '<a data-accion="ver-cliente" data-id="' + c.id + '" style="cursor:pointer">' + esc(c.nombre) + '</a>' : '<span class="muted">Cliente eliminado</span>') + '</div></div>'
    + dato('Sitio', s && s.nombre) + dato('Fecha', fechaCorta(q.fecha))
    + dato('Vigencia', q.vigenciaDias + ' días · vence ' + fechaCorta(k.fechaVence) + (ABIERTAS.includes(q.estatus) ? (k.vencida ? ' (vencida)' : ' (' + k.diasVigencia + ' días restantes)') : ''))
    + dato('Tipo de trabajo', q.tipoTrabajo) + dato('Solicitud', q.solicitud) + dato('Realizó', q.realizo)
    + dato('Equipo', [q.equipoNombre, q.equipoModelo && 'Mod. ' + q.equipoModelo, q.equipoSerie && 'S/N ' + q.equipoSerie].filter(Boolean).join(' · '))
    + dato('Orden de compra', q.ordenCompra) + dato('Forma de pago', q.tipoPago) + dato('Tiempo de entrega', q.tiempoEntrega)
    + dato('Margen', q.margen + '%')
    + '</div></div>';

  h += '<div class="tarjeta"><div class="pestanas">'
    + '<button data-accion="lado" data-lado="cliente" class="' + (lado === 'cliente' ? 'activo' : '') + '">Cotización cliente</button>'
    + '<button data-accion="lado" data-lado="costo" class="' + (lado === 'costo' ? 'activo' : '') + '">Costo interno</button></div>';
  h += '<div class="tabla-wrap"><table class="tabla"><thead><tr><th>#</th><th>N° parte</th><th>Concepto</th><th class="n">Cant.</th><th>U.M.</th><th class="n">' + (lado === 'costo' ? 'Costo unit.' : 'Precio unit.') + '</th><th class="n">Importe</th></tr></thead><tbody>';
  k.renglones.forEach(rg=>{
    if(rg.nuevoGrupo) h += '<tr><td colspan="7" style="background:var(--surface-2);font-weight:700;text-transform:uppercase;font-size:12px">' + esc(rg.seccion) + '</td></tr>';
    h += '<tr><td class="num">' + rg.numPart + '</td><td class="muted">' + esc(rg.numeroParte) + '</td><td>' + esc(rg.concepto)
      + (lado === 'cliente' && rg.precioClienteManual !== null ? ' <span class="muted" title="Precio capturado a mano">✎</span>' : '') + '</td>'
      + '<td class="n">' + rg.cantidad + '</td><td>' + esc(rg.um) + '</td><td class="n">' + dinero(lado === 'costo' ? rg.precioCosto : rg.precioCliente) + '</td><td class="n">' + dinero(lado === 'costo' ? rg.importeCosto : rg.importeCliente) + '</td></tr>';
  });
  if(q.instalacion.incluir){
    h += '<tr><td class="num">' + k.instalacionNumPart + '</td><td></td><td><b>Instalación / mano de obra</b>'
      + (lado === 'costo' ? '<div class="muted" style="font-size:12px">' + q.instalacion.porcentaje + '% de partidas + ' + dinero(q.instalacion.fijo) + ' fijo</div>' : '')
      + '</td><td class="n">1</td><td>SERV</td><td class="n">' + dinero(T.instalacion) + '</td><td class="n">' + dinero(T.instalacion) + '</td></tr>';
  }
  if(!k.renglones.length) h += '<tr><td colspan="7" class="muted">Sin partidas.</td></tr>';
  h += '</tbody></table></div>';
  const fila = (a, b, cls) => '<div class="fila ' + (cls || '') + '"><span>' + a + '</span><span class="num">' + b + '</span></div>';
  h += '<div class="totales" style="margin-top:16px">'
    + '<div class="caja"><h3>Costo interno</h3>' + fila('Subtotal', dinero(k.costo.subtotal)) + fila('IVA ' + estado.params.ivaPct + '%', dinero(k.costo.iva)) + fila('Total', dinero(k.costo.total), 'gran') + '</div>'
    + '<div class="caja"><h3>Cotización cliente</h3>' + fila('Subtotal', dinero(k.cliente.subtotal)) + fila('IVA ' + estado.params.ivaPct + '%', dinero(k.cliente.iva)) + fila('Total', dinero(k.cliente.total), 'gran')
    + '<div class="fila"><span>Utilidad antes de IVA</span><span class="num utilidad">' + dinero(k.utilidad) + ' (' + k.margenReal + '%)</span></div></div>'
    + '</div>';
  if(q.notas) h += '<div style="margin-top:16px"><div class="etiqueta">Notas / condiciones</div><div class="dato" style="white-space:pre-wrap">' + esc(q.notas) + '</div></div>';
  h += '</div>';
  h += '<p class="muted" style="font-size:12px">Creada ' + fechaHora(q.creado) + ' · última modificación ' + fechaHora(q.actualizado) + '</p>';
  return h;
}

/* --- Editor de cotización --- */
let cotTmp = null;
function modalCotizacion(id, clienteIdInicial, base){
  if(!exigir(puedeEditar(), 'editar cotizaciones')) return;
  if(!estado.datos.clientes.length){ aviso('Primero da de alta un cliente.', true); return; }
  const nueva = !id;
  cotTmp = JSON.parse(JSON.stringify(base || (id ? cotizacionPorId(id) : normalizarCotizacion({ clienteId:clienteIdInicial || '' }))));
  if(nueva){
    delete cotTmp.id; cotTmp.creado = ''; cotTmp.actualizado = '';
    if(!base){ cotTmp.realizo = (estado.perfil && (estado.perfil.nombre || estado.perfil.correo)) || ''; }
    cotTmp.fecha = hoyISO();
    cotTmp.folio = generarFolio(cotTmp.fecha);
    cotTmp.estatus = 'borrador';
    if(!cotTmp.partidas.length) cotTmp.partidas.push(normalizarPartida({ concepto:'' }));
  }
  if(!cotTmp.partidas.length) cotTmp.partidas.push(normalizarPartida({}));
  const partes = catalogoPartes();
  const opcionesClientes = '<option value="">— Elige cliente —</option>' + estado.datos.clientes.map(c => '<option value="' + c.id + '"' + (c.id === cotTmp.clienteId ? ' selected' : '') + '>' + esc(c.nombre) + '</option>').join('');
  const campo = (lbl, idc, val, extra, cls) => '<label class="campo' + (cls ? ' ' + cls : '') + '">' + lbl + '<input id="' + idc + '" value="' + esc(val) + '" ' + (extra || '') + '></label>';
  const cuerpo = '<div class="rejilla">'
    + campo('Folio', 'qFolio', cotTmp.folio)
    + campo('Fecha', 'qFecha', cotTmp.fecha, 'type="date"')
    + '<label class="campo">Cliente *<select id="qCliente">' + opcionesClientes + '</select></label>'
    + '<label class="campo">Sitio<select id="qSitio"></select></label>'
    + campo('Tipo de trabajo', 'qTipo', cotTmp.tipoTrabajo, 'list="dlTipos"')
    + campo('Solicitud / referencia', 'qSolicitud', cotTmp.solicitud, 'placeholder="Ej. COTI. INICIAL, ticket, correo…"')
    + campo('Realizó', 'qRealizo', cotTmp.realizo)
    + campo('Vigencia (días)', 'qVigencia', cotTmp.vigenciaDias, 'type="number" min="0"')
    + campo('Equipo', 'qEquipo', cotTmp.equipoNombre)
    + campo('Modelo', 'qModelo', cotTmp.equipoModelo)
    + campo('No. de serie', 'qSerie', cotTmp.equipoSerie)
    + campo('Orden de compra', 'qOC', cotTmp.ordenCompra)
    + campo('Forma de pago', 'qPago', cotTmp.tipoPago, 'list="dlPago"')
    + campo('Tiempo de entrega', 'qEntrega', cotTmp.tiempoEntrega, 'placeholder="Ej. 5 días hábiles"')
    + '</div>'
    + '<h3 style="margin:20px 0 8px">Partidas</h3>'
    + '<p class="muted" style="font-size:12px;margin:0 0 8px">Captura el <b>costo unitario</b> (lo que le cuesta a Profectus). El precio cliente se calcula con el margen; escríbelo solo si quieres fijarlo a mano. Partidas seguidas con la misma sección se numeran 1.1, 1.2…</p>'
    + '<div class="tabla-wrap"><table class="tabla partidas"><thead><tr><th class="col-sec">Sección</th><th class="col-np">N° parte</th><th class="col-cant">Cant.</th><th class="col-unidad">U.M.</th><th>Concepto</th><th class="col-precio">Costo unit.</th><th class="col-precio">Precio cliente</th><th class="n col-imp">Importe</th><th class="col-x"></th></tr></thead><tbody id="qPartidas"></tbody></table></div>'
    + '<button class="btn chico" type="button" id="qAgregar" style="margin-top:8px">+ Agregar partida</button>'
    + '<div class="rejilla" style="margin-top:18px">'
    + campo('Margen (%)', 'qMargen', cotTmp.margen, 'type="number" step="0.1"')
    + '<label class="campo" style="justify-content:flex-end"><span><input type="checkbox" id="qInstIncluir"' + (cotTmp.instalacion.incluir ? ' checked' : '') + '> Incluir instalación / mano de obra</span></label>'
    + campo('Instalación: % sobre partidas', 'qInstPct', cotTmp.instalacion.porcentaje, 'type="number" step="0.1"')
    + campo('Instalación: monto fijo', 'qInstFijo', cotTmp.instalacion.fijo, 'type="number" step="0.01"')
    + '<label class="campo ancho">Notas / condiciones (salen en el documento)<textarea id="qNotas">' + esc(cotTmp.notas) + '</textarea></label>'
    + '</div>'
    + '<div id="qResumen" style="margin-top:14px"></div>'
    + '<datalist id="dlTipos">' + TIPOS_TRABAJO.map(t => '<option value="' + esc(t) + '">').join('') + '</datalist>'
    + '<datalist id="dlPago"><option value="Crédito"><option value="Contado"><option value="50% anticipo / 50% contra entrega"><option value="Transferencia"></datalist>'
    + '<datalist id="dlUM">' + UNIDADES.map(u => '<option value="' + u + '">').join('') + '</datalist>'
    + '<datalist id="dlPartes">' + partes.slice(0, 400).map(p => '<option value="' + esc(p.concepto) + '">' + esc((p.numeroParte ? p.numeroParte + ' · ' : '') + dinero(p.precioCosto)) + '</option>').join('') + '</datalist>';
  abrirModal(nueva ? 'Nueva cotización' : 'Editar cotización ' + cotTmp.folio, cuerpo,
    '<button class="btn" data-modal="cancelar">Cancelar</button><button class="btn primario" data-modal="guardar">Guardar cotización</button>',
    { ancho:true, alGuardar: async ()=>{
      leerFormCotizacion();
      if(!cotTmp.clienteId){ aviso('Elige el cliente.', true); return false; }
      if(!cotTmp.folio){ aviso('Escribe el folio.', true); return false; }
      const dup = estado.datos.cotizaciones.find(x => x.id !== cotTmp.id && normTxt(x.folio) === normTxt(cotTmp.folio));
      if(dup){ aviso('Ya existe otra cotización con el folio ' + cotTmp.folio + '.', true); return false; }
      cotTmp.partidas = cotTmp.partidas.filter(p => String(p.concepto || '').trim());
      if(!cotTmp.partidas.length){ aviso('Agrega al menos una partida con concepto.', true); cotTmp.partidas.push(normalizarPartida({})); pintarPartidas(); return false; }
      const g = await guardarCotizacion(cotTmp, nueva ? 'creó' : 'editó');
      aviso('Cotización guardada.');
      irA('cotizaciones', 'detalle', g.id);
    } });

  const pintarSitios = ()=>{
    const c = clientePorId($('qCliente').value);
    $('qSitio').innerHTML = '<option value="">— Sin sitio específico —</option>' + (c ? c.sitios.map(s => '<option value="' + s.id + '"' + (s.id === cotTmp.sitioId ? ' selected' : '') + '>' + esc(s.nombre) + '</option>').join('') : '');
  };
  pintarSitios();
  $('qCliente').addEventListener('change', ()=>{ cotTmp.sitioId = ''; pintarSitios(); });
  $('qFecha').addEventListener('change', ()=>{
    /* Si el folio sigue siendo el sugerido, se vuelve a sugerir con la nueva fecha. */
    if(nueva && /^PRO-\d{6}-\d+$/.test($('qFolio').value)) $('qFolio').value = generarFolio($('qFecha').value);
  });
  $('qAgregar').addEventListener('click', ()=>{
    leerFormCotizacion();
    const ult = cotTmp.partidas[cotTmp.partidas.length - 1];
    cotTmp.partidas.push(normalizarPartida({ seccion: ult ? ult.seccion : '' }));
    pintarPartidas();
    const filas = $('qPartidas').querySelectorAll('tr');
    const ultima = filas[filas.length - 1];
    if(ultima) ultima.querySelector('[data-k="concepto"]').focus();
  });
  $('qPartidas').addEventListener('click', e=>{
    const b = e.target.closest('[data-quitar]');
    if(!b) return;
    leerFormCotizacion();
    cotTmp.partidas.splice(Number(b.dataset.quitar), 1);
    if(!cotTmp.partidas.length) cotTmp.partidas.push(normalizarPartida({}));
    pintarPartidas();
  });
  $('qPartidas').addEventListener('change', e=>{
    /* Al elegir un concepto ya cotizado antes, se precargan su parte, unidad y costo. */
    if(e.target.dataset.k === 'concepto'){
      const fila = e.target.closest('tr');
      const p = partes.find(x => normTxt(x.concepto) === normTxt(e.target.value));
      if(p && !num(fila.querySelector('[data-k="precioCosto"]').value)){
        fila.querySelector('[data-k="precioCosto"]').value = p.precioCosto;
        if(!fila.querySelector('[data-k="numeroParte"]').value) fila.querySelector('[data-k="numeroParte"]').value = p.numeroParte || '';
        fila.querySelector('[data-k="um"]').value = p.um || 'PZA';
      }
    }
    refrescarResumen();
  });
  pintarPartidas();
}
function pintarPartidas(){
  $('qPartidas').innerHTML = cotTmp.partidas.map((p, i) =>
    '<tr data-i="' + i + '">'
    + '<td><input data-k="seccion" value="' + esc(p.seccion) + '" placeholder="Opcional"></td>'
    + '<td><input data-k="numeroParte" value="' + esc(p.numeroParte) + '"></td>'
    + '<td class="col-cant"><input data-k="cantidad" type="number" step="any" min="0" value="' + esc(p.cantidad) + '"></td>'
    + '<td class="col-unidad"><input data-k="um" list="dlUM" value="' + esc(p.um) + '"></td>'
    + '<td><input data-k="concepto" list="dlPartes" value="' + esc(p.concepto) + '" placeholder="Descripción del concepto"></td>'
    + '<td class="col-precio"><input data-k="precioCosto" type="number" step="0.01" min="0" value="' + esc(p.precioCosto) + '"></td>'
    + '<td class="col-precio"><input data-k="precioClienteManual" type="number" step="0.01" min="0" value="' + esc(p.precioClienteManual ?? '') + '" placeholder="Automático"></td>'
    + '<td class="n" data-importe></td>'
    + '<td><button class="btn chico fantasma" type="button" data-quitar="' + i + '" title="Quitar partida">✕</button></td></tr>').join('');
  refrescarResumen();
}
function leerFormCotizacion(){
  if(!$('qFolio')) return;
  const v = id => $(id).value;
  Object.assign(cotTmp, {
    folio: v('qFolio').trim(), fecha: v('qFecha') || hoyISO(), clienteId: v('qCliente'), sitioId: v('qSitio'),
    tipoTrabajo: v('qTipo').trim(), solicitud: v('qSolicitud').trim(), realizo: v('qRealizo').trim(),
    vigenciaDias: numDef(v('qVigencia'), estado.params.vigenciaDias),
    equipoNombre: v('qEquipo').trim(), equipoModelo: v('qModelo').trim(), equipoSerie: v('qSerie').trim(),
    ordenCompra: v('qOC').trim(), tipoPago: v('qPago').trim(), tiempoEntrega: v('qEntrega').trim(),
    margen: numDef(v('qMargen'), estado.params.margenPct),
    instalacion: { incluir: $('qInstIncluir').checked, porcentaje: numDef(v('qInstPct'), 0), fijo: numDef(v('qInstFijo'), 0) },
    notas: v('qNotas')
  });
  cotTmp.partidas = Array.from($('qPartidas').querySelectorAll('tr')).map(tr=>{
    const g = k => tr.querySelector('[data-k="' + k + '"]').value;
    const manual = g('precioClienteManual');
    return {
      id: cotTmp.partidas[Number(tr.dataset.i)] ? cotTmp.partidas[Number(tr.dataset.i)].id : Nube.nuevoId(),
      seccion: g('seccion').trim(), numeroParte: g('numeroParte').trim(), cantidad: numDef(g('cantidad'), 0),
      um: g('um').trim() || 'PZA', concepto: g('concepto'), precioCosto: numDef(g('precioCosto'), 0),
      precioClienteManual: manual === '' ? null : num(manual)
    };
  });
}
function refrescarResumen(){
  if(!$('qResumen')) return;
  leerFormCotizacion();
  const k = calcularCotizacion(Object.assign({}, cotTmp, { partidas: cotTmp.partidas.map(p => Object.assign({}, p, { concepto:p.concepto || ' ' })) }));
  $('qPartidas').querySelectorAll('tr').forEach((tr, i)=>{
    const rg = k.renglones[i];
    if(!rg) return;
    tr.querySelector('[data-importe]').textContent = dinero(rg.importeCliente);
    const auto = tr.querySelector('[data-k="precioClienteManual"]');
    auto.placeholder = dinero(r2(num(rg.precioCosto) * (1 + num(cotTmp.margen) / 100)));
  });
  const fila = (a, b, cls) => '<div class="fila ' + (cls || '') + '"><span>' + a + '</span><span class="num">' + b + '</span></div>';
  $('qResumen').innerHTML = '<div class="totales">'
    + '<div class="caja"><h3>Costo interno</h3>' + fila('Partidas', dinero(k.costo.subtotalPartidas)) + (cotTmp.instalacion.incluir ? fila('Instalación', dinero(k.costo.instalacion)) : '')
    + fila('Subtotal', dinero(k.costo.subtotal)) + fila('IVA', dinero(k.costo.iva)) + fila('Total', dinero(k.costo.total), 'gran') + '</div>'
    + '<div class="caja"><h3>Cotización cliente</h3>' + fila('Partidas', dinero(k.cliente.subtotalPartidas)) + (cotTmp.instalacion.incluir ? fila('Instalación', dinero(k.cliente.instalacion)) : '')
    + fila('Subtotal', dinero(k.cliente.subtotal)) + fila('IVA', dinero(k.cliente.iva)) + fila('Total', dinero(k.cliente.total), 'gran')
    + '<div class="fila"><span>Utilidad antes de IVA</span><span class="num utilidad">' + dinero(k.utilidad) + ' (' + k.margenReal + '%)</span></div></div></div>';
}

async function cambiarEstatus(id, est){
  if(!exigir(puedeEditar(), 'cambiar el estatus')) return;
  const q = cotizacionPorId(id);
  if(!q || q.estatus === est) return;
  const antes = ESTATUS[q.estatus].nombre;
  await guardarCotizacion(Object.assign({}, q, { estatus:est }), 'cambió estatus de', antes + ' → ' + ESTATUS[est].nombre);
  aviso('Estatus: ' + ESTATUS[est].nombre + '.');
  render();
}
function duplicarCotizacion(id){
  const q = cotizacionPorId(id);
  const copia = JSON.parse(JSON.stringify(q));
  copia.partidas.forEach(p => { p.id = Nube.nuevoId(); });
  copia.ordenCompra = 'PENDIENTE';
  modalCotizacion(null, null, copia);
}
function eliminarCotizacion(id){
  if(!exigir(esAdmin(), 'eliminar cotizaciones')) return;
  const q = cotizacionPorId(id);
  confirmar('Eliminar cotización', '¿Eliminar definitivamente la cotización <b>' + esc(q.folio) + '</b>? Esto no se puede deshacer.', 'Eliminar', async ()=>{
    await Nube.borrar('cotizaciones', id);
    estado.datos.cotizaciones = estado.datos.cotizaciones.filter(x => x.id !== id);
    anotar('eliminó', 'cotización', q.folio);
    aviso('Cotización eliminada.');
    irA('cotizaciones');
  });
}

/* --- Documento imprimible (mismo patrón que Forguard: payload resuelto en
   sessionStorage + plantilla en docs/ que solo formatea, no calcula) --- */
const LLAVE_DOC = 'profectus.documento.cotizacion';
function armarPayloadCotizacion(q, lado){
  const k = calcularCotizacion(q);
  const c = clientePorId(q.clienteId) || {}, s = sitioDe(q) || {};
  const T = k[lado];
  return {
    lado,
    empresa: estado.params,
    folio: q.folio, fecha: fechaCorta(q.fecha), vence: fechaCorta(k.fechaVence), vigenciaDias: q.vigenciaDias,
    estatus: ESTATUS[q.estatus].nombre,
    cliente: { nombre:c.nombre || '', razonSocial:c.razonSocial || '', rfc:c.rfc || '', direccion:c.direccion || '', contacto:c.contacto || '', telefono:c.telefono || '', correo:c.correo || '', logo:c.logo || '' },
    sitio: { nombre:s.nombre || '', direccion:s.direccion || '' },
    tipoTrabajo: q.tipoTrabajo, solicitud: q.solicitud, realizo: q.realizo,
    equipo: [q.equipoNombre, q.equipoModelo && 'Modelo ' + q.equipoModelo, q.equipoSerie && 'S/N ' + q.equipoSerie].filter(Boolean).join(' · '),
    ordenCompra: q.ordenCompra, tipoPago: q.tipoPago, tiempoEntrega: q.tiempoEntrega,
    renglones: k.renglones.map(rg => ({
      numPart: rg.numPart, nuevoGrupo: rg.nuevoGrupo, seccion: rg.seccion, numeroParte: rg.numeroParte,
      concepto: rg.concepto, cantidad: String(rg.cantidad), um: rg.um,
      precio: dinero(lado === 'costo' ? rg.precioCosto : rg.precioCliente),
      importe: dinero(lado === 'costo' ? rg.importeCosto : rg.importeCliente)
    })),
    instalacion: q.instalacion.incluir ? { numPart:k.instalacionNumPart, importe:dinero(T.instalacion), detalle: lado === 'costo' ? q.instalacion.porcentaje + '% de partidas + ' + dinero(q.instalacion.fijo) + ' fijo' : '' } : null,
    totales: { subtotal:dinero(T.subtotal), iva:dinero(T.iva), ivaPct:estado.params.ivaPct, total:dinero(T.total) },
    interno: lado === 'costo' ? { margen:q.margen + '%', totalCliente:dinero(k.cliente.total), utilidad:dinero(k.utilidad) + ' (' + k.margenReal + '%)' } : null,
    notas: q.notas
  };
}
function abrirDocumento(id, lado){
  const q = cotizacionPorId(id);
  try{ sessionStorage.setItem(LLAVE_DOC, JSON.stringify(armarPayloadCotizacion(q, lado))); }
  catch(e){ aviso('No se pudo preparar el documento.', true); return; }
  /* Sin noopener a propósito: la pestaña nueva hereda el sessionStorage. */
  window.open('docs/plantilla_cotizacion.html?v=' + Date.now(), '_blank');
}
function modalPrevia(id){
  const q = cotizacionPorId(id);
  abrirModal('Documento ' + q.folio,
    '<p>Elige qué documento generar. Se abre en una pestaña nueva lista para <b>Guardar como PDF</b> o imprimir.</p>'
    + '<div class="acciones" style="margin-top:12px"><button class="btn primario" data-accion="doc" data-id="' + id + '" data-lado="cliente">Cotización para el cliente</button>'
    + (puedeEditar() ? '<button class="btn" data-accion="doc" data-id="' + id + '" data-lado="costo">Costo interno (uso interno)</button>' : '') + '</div>',
    '<button class="btn" data-modal="cancelar">Cerrar</button>', { sinFoco:true });
}

/* ================================ EXPORTAR ================================ */
function descargar(nombre, contenido, tipo){
  const blob = new Blob([contenido], { type:tipo });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=> URL.revokeObjectURL(a.href), 2000);
}
const csvCelda = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const aCSV = filas => '﻿' + filas.map(f => f.map(csvCelda).join(',')).join('\r\n');
function exportarClientes(){
  const filas = [['Nombre', 'Razón social', 'RFC', 'Segmento', 'Contacto', 'Teléfono', 'Correo', 'Dirección', 'Sitios', 'Cotizaciones', 'Monto cotizado']];
  estado.datos.clientes.forEach(c=>{
    const qs = cotizacionesDeCliente(c.id);
    filas.push([c.nombre, c.razonSocial, c.rfc, c.segmento, c.contacto, c.telefono, c.correo, c.direccion, c.sitios.map(s => s.nombre).join(' | '), qs.length, resumirCotizaciones(qs).monto.toFixed(2)]);
  });
  descargar('profectus-clientes-' + hoyISO() + '.csv', aCSV(filas), 'text/csv;charset=utf-8');
}
function exportarCotizaciones(){
  const filas = [['Folio', 'Fecha', 'Vence', 'Cliente', 'Sitio', 'Tipo de trabajo', 'Realizó', 'Estatus', 'Vencida', 'Margen %', 'Subtotal costo', 'Total costo', 'Subtotal cliente', 'IVA cliente', 'Total cliente', 'Utilidad', 'Orden de compra']];
  estado.datos.cotizaciones.forEach(q=>{
    const k = calcularCotizacion(q), c = clientePorId(q.clienteId), s = sitioDe(q);
    filas.push([q.folio, q.fecha, k.fechaVence, c ? c.nombre : '(eliminado)', s ? s.nombre : '', q.tipoTrabajo, q.realizo, ESTATUS[q.estatus].nombre, k.vencida ? 'Sí' : 'No', q.margen,
      k.costo.subtotal.toFixed(2), k.costo.total.toFixed(2), k.cliente.subtotal.toFixed(2), k.cliente.iva.toFixed(2), k.cliente.total.toFixed(2), k.utilidad.toFixed(2), q.ordenCompra]);
  });
  descargar('profectus-cotizaciones-' + hoyISO() + '.csv', aCSV(filas), 'text/csv;charset=utf-8');
}

/* ================================= ADMIN ================================= */
let usuariosCache = [];
let bitacoraCache = [];
function vistaAdmin(){
  const p = estado.pestanaAdmin;
  const tab = (id, n) => '<button data-accion="pestana-admin" data-pestana="' + id + '" class="' + (p === id ? 'activo' : '') + '">' + n + '</button>';
  return '<div class="cabeza-vista"><div><div class="eyebrow">Administración</div><h1>Admin</h1></div></div>'
    + '<div class="pestanas">' + tab('usuarios', 'Usuarios') + tab('parametros', 'Empresa y parámetros') + tab('bitacora', 'Bitácora') + tab('respaldo', 'Respaldo') + '</div>'
    + '<div id="adminCuerpo"><p class="muted">Cargando…</p></div>';
}
async function montarAdmin(){
  const cont = $('adminCuerpo');
  const p = estado.pestanaAdmin;
  if(p === 'parametros'){ cont.innerHTML = htmlParametros(); return; }
  if(p === 'respaldo'){ cont.innerHTML = htmlRespaldo(); return; }
  if(p === 'usuarios'){
    if(!HAY_NUBE){ cont.innerHTML = '<div class="tarjeta"><p>Las cuentas de usuario existen solo cuando la app está conectada a Firebase. En modo local no hay inicio de sesión ni permisos.</p></div>'; return; }
    try{ usuariosCache = await Nube.listar('usuarios'); }
    catch(e){ cont.innerHTML = '<div class="tarjeta"><p class="muted">' + esc(mensajeError(e)) + '</p></div>'; return; }
    if(estado.pestanaAdmin === 'usuarios' && $('adminCuerpo')) $('adminCuerpo').innerHTML = htmlUsuarios();
    return;
  }
  if(p === 'bitacora'){
    try{ bitacoraCache = (await Nube.listar('bitacora')).sort((a, b) => String(b.cuando).localeCompare(String(a.cuando))).slice(0, 300); }
    catch(e){ cont.innerHTML = '<div class="tarjeta"><p class="muted">' + esc(mensajeError(e)) + '</p></div>'; return; }
    if(estado.pestanaAdmin === 'bitacora' && $('adminCuerpo')) $('adminCuerpo').innerHTML = htmlBitacora();
  }
}
function htmlUsuarios(){
  const yo = estado.perfil.uid;
  const ordenRol = { owner:0, admin:1, analyst:2, viewer:3 };
  const lista = usuariosCache.slice().sort((a, b) => (a.activo === b.activo ? 0 : a.activo ? 1 : -1) || (ordenRol[a.rol] ?? 9) - (ordenRol[b.rol] ?? 9) || String(a.nombre || a.correo).localeCompare(String(b.nombre || b.correo), 'es'));
  const pendientes = lista.filter(u => !u.activo && !u.creadoPor).length;
  let h = '<div class="tarjeta"><div class="tit"><h3>Cuentas</h3><button class="btn primario" data-accion="nueva-cuenta">+ Crear cuenta</button></div>';
  if(pendientes) h += '<p class="estatus est-pendiente" style="margin-bottom:10px">' + pendientes + ' solicitud(es) de cuenta por aprobar</p>';
  h += '<div class="tabla-wrap"><table class="tabla"><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Último acceso</th><th></th></tr></thead><tbody>';
  h += lista.map(u=>{
    const esYo = u.id === yo;
    const intocable = esYo || (u.rol === 'owner' && !esOwner());
    const opciones = Object.keys(ROLES).filter(r => r !== 'owner' || esOwner()).map(r => '<option value="' + r + '"' + (u.rol === r ? ' selected' : '') + '>' + ROLES[r].nombre + '</option>').join('');
    return '<tr><td><b>' + esc(u.nombre || '—') + '</b>' + (esYo ? ' <span class="muted">(tú)</span>' : '') + '</td><td>' + esc(u.correo) + '</td>'
      + '<td>' + (intocable ? esc((ROLES[u.rol] || {}).nombre || u.rol) : '<select data-accion-cambio="rol-usuario" data-id="' + u.id + '" style="width:auto;padding:5px 8px">' + opciones + '</select>') + '</td>'
      + '<td><span class="estatus ' + (u.activo ? 'est-activo' : (u.creadoPor ? 'est-bloqueado' : 'est-pendiente')) + '">' + (u.activo ? 'Activo' : (u.creadoPor ? 'Bloqueado' : 'Pendiente')) + '</span></td>'
      + '<td class="num">' + fechaHora(u.ultimoAcceso) + '</td><td class="derecha" style="white-space:nowrap">'
      + (intocable ? '' :
        (u.activo ? '<button class="btn chico" data-accion="bloquear-usuario" data-id="' + u.id + '">Bloquear</button> ' : '<button class="btn chico primario" data-accion="activar-usuario" data-id="' + u.id + '">' + (u.creadoPor ? 'Reactivar' : 'Aprobar') + '</button> ')
        + '<button class="btn chico" data-accion="reset-usuario" data-id="' + u.id + '">Restablecer contraseña</button> '
        + '<button class="btn chico peligro" data-accion="borrar-usuario" data-id="' + u.id + '">Borrar</button>')
      + '</td></tr>';
  }).join('');
  h += '</tbody></table></div></div>';
  h += '<div class="tarjeta"><h3 style="margin-bottom:8px">Roles</h3>' + Object.keys(ROLES).map(r => '<p style="margin:4px 0"><b>' + ROLES[r].nombre + ':</b> <span class="muted">' + ROLES[r].desc + '</span></p>').join('') + '</div>';
  return h;
}
const claveSugerida = ()=>{
  const sil = ['ka', 'ro', 'mi', 'tu', 'pe', 'la', 'so', 'ni', 've', 'du', 'ga', 'zo', 'fi', 'be'];
  const s = () => sil[Math.floor(Math.random() * sil.length)] + sil[Math.floor(Math.random() * sil.length)] + sil[Math.floor(Math.random() * sil.length)];
  return s() + '-' + s() + '-' + s() + '-' + String(Math.floor(1000 + Math.random() * 9000));
};
function modalNuevaCuenta(){
  const opciones = Object.keys(ROLES).filter(r => r !== 'owner' || esOwner()).map(r => '<option value="' + r + '"' + (r === 'analyst' ? ' selected' : '') + '>' + ROLES[r].nombre + '</option>').join('');
  abrirModal('Crear cuenta',
    '<div class="rejilla"><label class="campo ancho">Nombre<input id="uNombre"></label><label class="campo ancho">Correo<input id="uCorreo" type="email"></label>'
    + '<label class="campo ancho">Rol<select id="uRol">' + opciones + '</select></label>'
    + '<label class="campo ancho">Contraseña inicial<input id="uClave" value="' + claveSugerida() + '"></label></div>'
    + '<p class="muted" style="font-size:12px">Comparte la contraseña inicial por un medio seguro. Además se le enviará un correo para que ponga la suya.</p>',
    null,
    { alGuardar: async ()=>{
      const nombre = $('uNombre').value.trim(), correo = $('uCorreo').value.trim().toLowerCase(), rolN = $('uRol').value, clave = $('uClave').value;
      if(!correo){ aviso('Escribe el correo.', true); return false; }
      if(clave.length < 8){ aviso('La contraseña debe tener al menos 8 caracteres.', true); return false; }
      const uid = await Nube.crearCuentaAjena(correo, clave);
      const ahora = new Date().toISOString();
      await Nube.guardar('usuarios', uid, { correo, nombre, rol:rolN, activo:true, creado:ahora, creadoPor:estado.perfil.correo, ultimoAcceso:'' });
      Nube.enviarRestablecer(correo).catch(()=>{});
      anotar('creó', 'cuenta', correo, ROLES[rolN].nombre);
      aviso('Cuenta creada para ' + correo + '.');
      montarAdmin();
    } });
}
async function actualizarUsuario(id, cambios, accion, detalle){
  const u = usuariosCache.find(x => x.id === id);
  if(!u) return;
  if(u.rol === 'owner' && !esOwner()){ aviso('Solo un Owner puede modificar a otro Owner.', true); return; }
  const nuevo = Object.assign({}, u, cambios);
  if(cambios.activo === true && !nuevo.creadoPor) nuevo.creadoPor = estado.perfil.correo; // aprobado
  try{
    await Nube.guardar('usuarios', id, nuevo);
    Object.assign(u, nuevo);
    anotar(accion, 'cuenta', u.correo, detalle);
    aviso('Cuenta actualizada.');
  }catch(e){ aviso(mensajeError(e), true); }
  if($('adminCuerpo')) $('adminCuerpo').innerHTML = htmlUsuarios();
}
function htmlParametros(){
  const P = estado.params;
  const campo = (lbl, k, t, extra) => '<label class="campo">' + lbl + '<input data-param="' + k + '" type="' + (t || 'text') + '" value="' + esc(P[k] ?? '') + '" ' + (extra || '') + '></label>';
  return '<div class="tarjeta"><div class="tit"><h3>Datos de la empresa (salen en los documentos)</h3></div><div class="rejilla">'
    + campo('Nombre', 'nombre') + campo('Subtítulo', 'subtitulo') + campo('Razón social', 'razonSocial') + campo('RFC', 'rfc')
    + campo('Teléfono', 'telefono') + campo('Correo', 'correo', 'email') + campo('Sitio web', 'web')
    + '<label class="campo ancho">Dirección<input data-param="direccion" value="' + esc(P.direccion || '') + '"></label>'
    + '</div></div>'
    + '<div class="tarjeta"><div class="tit"><h3>Valores por omisión de cotizaciones</h3></div><div class="rejilla">'
    + campo('IVA (%)', 'ivaPct', 'number', 'step="0.01"') + campo('Margen por omisión (%)', 'margenPct', 'number', 'step="0.1"') + campo('Vigencia por omisión (días)', 'vigenciaDias', 'number')
    + '<label class="campo ancho">Condiciones / notas por omisión<textarea data-param="condiciones">' + esc(P.condiciones || '') + '</textarea></label>'
    + '</div><p class="muted" style="font-size:12px">El IVA se aplica a todas las cotizaciones (también a las ya guardadas, porque los totales se recalculan siempre). Margen, vigencia y condiciones solo cambian las cotizaciones nuevas.</p>'
    + '<div class="acciones" style="margin-top:12px"><button class="btn primario" data-accion="guardar-parametros">Guardar parámetros</button></div></div>';
}
async function guardarParametros(){
  if(!exigir(esAdmin(), 'cambiar parámetros')) return;
  const nuevo = Object.assign({}, estado.params);
  document.querySelectorAll('[data-param]').forEach(el=>{
    const k = el.dataset.param;
    nuevo[k] = el.type === 'number' ? numDef(el.value, window.EMPRESA_DEFAULT[k]) : el.value.trim();
  });
  try{
    await Nube.guardar('sistema', 'parametros', nuevo);
    estado.params = nuevo;
    anotar('editó', 'parámetros', 'Empresa y parámetros');
    aviso('Parámetros guardados.');
  }catch(e){ aviso(mensajeError(e), true); }
}
function htmlBitacora(){
  if(!bitacoraCache.length) return '<div class="tarjeta"><p class="muted">Sin movimientos registrados.</p></div>';
  return '<div class="tarjeta"><div class="tit"><h3>Últimos movimientos</h3></div>'
    + bitacoraCache.map(b => '<div class="bitacora-item"><div class="cuando">' + fechaHora(b.cuando) + '</div><div><b>' + esc(b.quien) + '</b> ' + esc(b.accion) + ' ' + esc(b.que) + ' <b>' + esc(b.nombre) + '</b>' + (b.detalle ? ' <span class="muted">· ' + esc(b.detalle) + '</span>' : '') + '</div></div>').join('')
    + '</div>';
}
function htmlRespaldo(){
  return '<div class="tarjeta"><div class="tit"><h3>Respaldo</h3></div>'
    + '<p>Descarga toda la información (clientes, cotizaciones y parámetros) en un archivo JSON. Guárdalo en un lugar seguro.</p>'
    + '<div class="acciones"><button class="btn primario" data-accion="descargar-respaldo">Descargar respaldo JSON</button>'
    + '<button class="btn" data-accion="restaurar-respaldo">Restaurar desde archivo…</button></div>'
    + '<p class="muted" style="font-size:12px;margin-top:10px">Restaurar agrega o reemplaza los registros del archivo; no borra los que no vengan en él.</p></div>';
}
function descargarRespaldo(){
  const r = { app:'profectus', version:1, exportado:new Date().toISOString(), parametros:estado.params, clientes:estado.datos.clientes, cotizaciones:estado.datos.cotizaciones };
  descargar('profectus-respaldo-' + hoyISO() + '.json', JSON.stringify(r, null, 1), 'application/json');
  anotar('descargó', 'respaldo', hoyISO());
}
$('archivoRestaurar').addEventListener('change', e=>{
  const f = e.target.files[0];
  e.target.value = '';
  if(!f || !esAdmin()) return;
  const lector = new FileReader();
  lector.onload = ()=>{
    let r;
    try{ r = JSON.parse(lector.result); }catch(err){ aviso('El archivo no es un JSON válido.', true); return; }
    if(!r || r.app !== 'profectus' || !Array.isArray(r.clientes) || !Array.isArray(r.cotizaciones)){ aviso('El archivo no es un respaldo de Profectus.', true); return; }
    confirmar('Restaurar respaldo', 'Se cargarán <b>' + r.clientes.length + '</b> cliente(s) y <b>' + r.cotizaciones.length + '</b> cotización(es) del ' + fechaHora(r.exportado) + '. Los registros con el mismo id se reemplazan.', 'Restaurar', async ()=>{
      const ops = [];
      r.clientes.forEach(c => ops.push({ col:'clientes', id:c.id || Nube.nuevoId(), datos:normalizarCliente(c) }));
      r.cotizaciones.forEach(q => ops.push({ col:'cotizaciones', id:q.id || Nube.nuevoId(), datos:normalizarCotizacion(q) }));
      if(r.parametros) ops.push({ col:'sistema', id:'parametros', datos:r.parametros });
      for(let i = 0; i < ops.length; i += 400) await Nube.lote(ops.slice(i, i + 400));
      await cargarDatos();
      anotar('restauró', 'respaldo', r.exportado);
      aviso('Respaldo restaurado.');
      render();
    });
  };
  lector.readAsText(f);
});

/* ======================= CLICS (un solo listener) ======================= */
document.addEventListener('click', e=>{
  const el = e.target.closest('[data-accion]');
  if(!el) return;
  const a = el.dataset.accion, id = el.dataset.id;
  const t = {
    'ir': ()=> irA(el.dataset.modulo),
    'nuevo-cliente': ()=> modalCliente(null),
    'editar-cliente': ()=> modalCliente(id),
    'ver-cliente': ()=>{ cerrarModal(); irA('clientes', 'detalle', id); },
    'eliminar-cliente': ()=> eliminarCliente(id),
    'nuevo-sitio': ()=> modalSitio(id),
    'editar-sitio': ()=> modalSitio(id, el.dataset.sitio),
    'eliminar-sitio': ()=>{
      if(!exigir(esAdmin(), 'quitar sitios')) return;
      const c = clientePorId(id), s = c.sitios.find(x => x.id === el.dataset.sitio);
      const n = estado.datos.cotizaciones.filter(q => q.sitioId === s.id).length;
      confirmar('Quitar sitio', '¿Quitar el sitio <b>' + esc(s.nombre) + '</b> de ' + esc(c.nombre) + '?' + (n ? ' Sus ' + n + ' cotización(es) se conservan, pero sin sitio.' : ''), 'Quitar', async ()=>{
        await guardarCliente(Object.assign({}, c, { sitios:c.sitios.filter(x => x.id !== s.id) }), 'quitó sitio de');
        render();
      });
    },
    'nuevo-contacto': ()=> modalContacto(id),
    'editar-contacto': ()=> modalContacto(id, el.dataset.contacto),
    'eliminar-contacto': async ()=>{
      if(!exigir(puedeEditar(), 'quitar contactos')) return;
      const c = clientePorId(id);
      await guardarCliente(Object.assign({}, c, { contactos:c.contactos.filter(x => x.id !== el.dataset.contacto) }), 'quitó contacto de');
      render();
    },
    'exportar-clientes': exportarClientes,
    'exportar-cotizaciones': exportarCotizaciones,
    'nueva-cotizacion': ()=> modalCotizacion(null, el.dataset.cliente),
    'ver-cotizacion': ()=>{ estado.lado = 'cliente'; irA('cotizaciones', 'detalle', id); },
    'editar-cotizacion': ()=> modalCotizacion(id),
    'duplicar-cotizacion': ()=> duplicarCotizacion(id),
    'eliminar-cotizacion': ()=> eliminarCotizacion(id),
    'estatus-cotizacion': ()=> cambiarEstatus(id, el.dataset.estatus).catch(err => aviso(mensajeError(err), true)),
    'lado': ()=>{ estado.lado = el.dataset.lado; render(); },
    'previa-cotizacion': ()=> modalPrevia(id),
    'doc': ()=>{ abrirDocumento(id, el.dataset.lado); cerrarModal(); },
    'pestana-admin': ()=>{ estado.pestanaAdmin = el.dataset.pestana; render(); },
    'nueva-cuenta': modalNuevaCuenta,
    'bloquear-usuario': ()=> actualizarUsuario(id, { activo:false }, 'bloqueó'),
    'activar-usuario': ()=> actualizarUsuario(id, { activo:true }, 'activó'),
    'reset-usuario': async ()=>{
      const u = usuariosCache.find(x => x.id === id);
      try{ await Nube.enviarRestablecer(u.correo); aviso('Se envió el correo para restablecer la contraseña a ' + u.correo + '.'); anotar('envió restablecer contraseña a', 'cuenta', u.correo); }
      catch(err){ aviso(mensajeError(err), true); }
    },
    'borrar-usuario': ()=>{
      const u = usuariosCache.find(x => x.id === id);
      confirmar('Borrar cuenta', '¿Borrar la cuenta de <b>' + esc(u.correo) + '</b>? Ya no podrá entrar al tablero.', 'Borrar', async ()=>{
        await Nube.borrar('usuarios', id);
        usuariosCache = usuariosCache.filter(x => x.id !== id);
        anotar('borró', 'cuenta', u.correo);
        $('adminCuerpo').innerHTML = htmlUsuarios();
      });
    },
    'guardar-parametros': guardarParametros,
    'descargar-respaldo': descargarRespaldo,
    'restaurar-respaldo': ()=>{ if(exigir(esAdmin(), 'restaurar respaldos')) $('archivoRestaurar').click(); }
  }[a];
  if(t){ e.preventDefault(); Promise.resolve(t()).catch(err => { console.error(err); aviso(mensajeError(err), true); }); }
});
document.addEventListener('change', e=>{
  const el = e.target;
  if(el.id === 'filtroEstatus'){ estado.filtroEstatus = el.value; render(); }
  if(el.dataset && el.dataset.accionCambio === 'rol-usuario'){
    const u = usuariosCache.find(x => x.id === el.dataset.id);
    actualizarUsuario(el.dataset.id, { rol:el.value }, 'cambió rol de', (ROLES[u.rol] || {}).nombre + ' → ' + ROLES[el.value].nombre);
  }
});
document.addEventListener('input', e=>{
  if(e.target.id === 'buscaCliente'){ estado.busquedaClientes = e.target.value; render(); }
  if(e.target.id === 'buscaCot'){ estado.busquedaCot = e.target.value; render(); }
});

/* ============================ SESIÓN Y ACCESO ============================ */
const LIMITE_INACTIVIDAD_MS = 8 * 60 * 60 * 1000;
const LLAVE_ACTIVIDAD = 'profectus.actividad';
let modoLogin = 'entrar'; // entrar | registro | olvide
function pintarLogin(){
  $('loginTitulo').textContent = { entrar:'Iniciar sesión', registro:'Solicitar una cuenta', olvide:'Restablecer contraseña' }[modoLogin];
  $('campoNombre').classList.toggle('oculto', modoLogin !== 'registro');
  $('campoClave').classList.toggle('oculto', modoLogin === 'olvide');
  $('loginBoton').textContent = { entrar:'Entrar', registro:'Enviar solicitud', olvide:'Enviar correo' }[modoLogin];
  $('lnkRegistro').textContent = modoLogin === 'entrar' ? 'Solicitar una cuenta' : 'Volver a iniciar sesión';
  $('lnkOlvide').classList.toggle('oculto', modoLogin !== 'entrar');
  $('loginClave').autocomplete = modoLogin === 'registro' ? 'new-password' : 'current-password';
  $('loginError').textContent = '';
}
function mostrarLogin(mensaje){
  $('app').classList.add('oculto');
  $('pantallaLogin').classList.remove('oculto');
  modoLogin = 'entrar';
  pintarLogin();
  if(mensaje){ $('loginError').textContent = mensaje; }
}
$('lnkOlvide').addEventListener('click', ()=>{ modoLogin = 'olvide'; pintarLogin(); });
$('lnkRegistro').addEventListener('click', ()=>{ modoLogin = modoLogin === 'entrar' ? 'registro' : 'entrar'; pintarLogin(); });
$('formLogin').addEventListener('submit', async e=>{
  e.preventDefault();
  const correo = $('loginCorreo').value.trim().toLowerCase(), clave = $('loginClave').value;
  const boton = $('loginBoton');
  $('loginError').textContent = '';
  boton.disabled = true;
  try{
    if(modoLogin === 'olvide'){
      await Nube.enviarRestablecer(correo);
      modoLogin = 'entrar'; pintarLogin();
      $('loginError').textContent = 'Listo: revisa tu correo para poner una contraseña nueva.';
      return;
    }
    if(modoLogin === 'registro'){
      if(clave.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
      const s = await Nube.registrarme(correo, clave);
      const nombre = $('loginNombre').value.trim();
      const ahora = new Date().toISOString();
      /* La primera cuenta de un proyecto vacío se vuelve Owner. */
      const arranque = await Nube.leer('sistema', 'arranque');
      if(!arranque){
        await Nube.lote([
          { col:'usuarios', id:s.uid, datos:{ correo, nombre, rol:'owner', activo:true, creado:ahora, creadoPor:'arranque', ultimoAcceso:ahora } },
          { col:'sistema', id:'arranque', datos:{ uid:s.uid, correo, cuando:ahora }, debeNoExistir:true }
        ]);
      }else{
        await Nube.guardar('usuarios', s.uid, { correo, nombre, rol:'viewer', activo:false, creado:ahora, creadoPor:'', ultimoAcceso:'' });
      }
    }else{
      await Nube.entrar(correo, clave);
    }
    marcarActividad(true);
    await iniciarConSesion();
  }catch(err){
    $('loginError').textContent = mensajeError(err);
  }finally{ boton.disabled = false; }
});
async function cargarPerfil(){
  const s = Nube.sesion();
  const p = await Nube.leer('usuarios', s.uid);
  if(!p) throw new Error('Tu cuenta no tiene acceso a este tablero. Pide a un administrador que te dé de alta.');
  if(p.activo !== true) throw new Error(p.creadoPor ? 'Tu cuenta está bloqueada. Habla con un administrador.' : 'Tu solicitud está pendiente: un administrador debe aprobarla.');
  estado.perfil = Object.assign({ uid:s.uid }, p, { uid:s.uid });
  return p;
}
async function iniciarConSesion(){
  try{
    const p = await cargarPerfil();
    Nube.guardar('usuarios', estado.perfil.uid, Object.assign({}, p, { id:undefined, ultimoAcceso:new Date().toISOString() })).catch(()=>{});
    await cargarDatos();
  }catch(err){
    const msj = mensajeError(err);
    Nube.salir();
    estado.perfil = null;
    mostrarLogin(msj);
    return;
  }
  anotar('inició sesión', 'sesión', estado.perfil.correo);
  mostrarApp();
}
function mostrarApp(){
  $('pantallaLogin').classList.add('oculto');
  $('app').classList.remove('oculto');
  render();
}
function salir(motivo){
  if(estado.perfil) anotar('cerró sesión', 'sesión', estado.perfil.correo);
  Nube.salir();
  estado.perfil = null;
  estado.datos = { clientes:[], cotizaciones:[] };
  cerrarModal();
  mostrarLogin(motivo || '');
}
$('btnSalir').addEventListener('click', ()=> salir());

let ultimoGuardadoActividad = 0;
function marcarActividad(forzar){
  estado.ultimaActividad = Date.now();
  if(forzar || Date.now() - ultimoGuardadoActividad > 60000){
    ultimoGuardadoActividad = Date.now();
    try{ localStorage.setItem(LLAVE_ACTIVIDAD, String(estado.ultimaActividad)); }catch(e){}
  }
}
['click', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, ()=> marcarActividad(), { passive:true }));
function inactivoDemasiado(){
  let ult = estado.ultimaActividad;
  try{ ult = Math.max(ult, parseInt(localStorage.getItem(LLAVE_ACTIVIDAD), 10) || 0); }catch(e){}
  return Date.now() - ult > LIMITE_INACTIVIDAD_MS;
}
/* Cada 2 minutos: vuelve a leer el perfil (para aplicar al momento un
   bloqueo o cambio de rol) y refresca los datos si no hay nada abierto. */
async function revisarCuenta(){
  if(!HAY_NUBE || !estado.perfil || document.hidden) return;
  if(inactivoDemasiado()){ salir('La sesión se cerró por inactividad.'); return; }
  try{
    const rolAntes = estado.perfil.rol;
    await cargarPerfil();
    if(!modalAbierto()){
      await cargarDatos();
      if(rolAntes !== estado.perfil.rol) aviso('Tu rol cambió a ' + ROLES[rol()].nombre + '.');
      const activo = document.activeElement;
      if(!(activo && (activo.id === 'buscaCliente' || activo.id === 'buscaCot'))) render();
    }
  }catch(err){
    if(err.message === 'SIN_SESION' || err.message === 'SIN_PERMISO' || /bloqueada|pendiente|no tiene acceso/.test(err.message)) salir(mensajeError(err));
  }
}
setInterval(revisarCuenta, 120000);
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) revisarCuenta(); });

/* ================================ ARRANQUE ================================ */
async function arrancar(){
  if(!HAY_NUBE){
    try{ await cargarDatos(); }catch(e){ console.error(e); }
    mostrarApp();
    return;
  }
  if(Nube.sesion()){
    if(inactivoDemasiado()){ salir('La sesión se cerró por inactividad.'); return; }
    await iniciarConSesion();
  }else{
    mostrarLogin();
  }
}
arrancar();

/* Para pruebas automatizadas. */
window.Profectus = { calcularCotizacion, normalizarCotizacion, numerarPartidas, generarFolio, estado };
})();
