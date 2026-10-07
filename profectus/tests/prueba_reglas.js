const { chromium } = require('playwright');
const P='demo-profectus';
const reesc = u => u.replace('https://identitytoolkit.googleapis.com/','http://127.0.0.1:9099/identitytoolkit.googleapis.com/')
  .replace('https://securetoken.googleapis.com/','http://127.0.0.1:9099/securetoken.googleapis.com/')
  .replace('https://firestore.googleapis.com/','http://127.0.0.1:8080/');
const FS='http://127.0.0.1:8080/v1/projects/'+P+'/databases/(default)/documents';
async function auth(m, body){ const r=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:'+m+'?key=k',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({returnSecureToken:true},body))}); return r.json(); }
async function fs(tok, metodo, ruta, cuerpo){ const r=await fetch(FS+ruta,{method:metodo,headers:{Authorization:'Bearer '+tok,'Content-Type':'application/json'},body:cuerpo?JSON.stringify(cuerpo):undefined}); return r.status; }
const campos = o => { const f={}; for(const k in o){ const v=o[k]; f[k]= typeof v==='boolean'?{booleanValue:v}:{stringValue:String(v)}; } return {fields:f}; };
let fallas=0; const esperar=(n,real,esp)=>{ const ok=real===esp; if(!ok) fallas++; console.log((ok?'OK  ':'FALLA ')+n+' → '+real+' (esperado '+esp+')'); };
(async()=>{
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/'+P+'/databases/(default)/documents',{method:'DELETE'});
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/'+P+'/accounts',{method:'DELETE'});
  const b = await chromium.launch();
  const nuevo = async ()=>{ const ctx = await b.newContext();
    await ctx.route(/googleapis\.com/, async r=>{ if(/fonts/.test(r.request().url())) return r.abort(); const resp = await r.fetch({url:reesc(r.request().url())}); r.fulfill({response:resp}); });
    await ctx.route(/js\/config\.js/, r=>r.fulfill({contentType:'application/javascript', body:"window.CONFIG_NUBE={apiKey:'k',projectId:'"+P+"'};window.EMPRESA_DEFAULT={nombre:'PROFECTUS',subtitulo:'Servicios Especializados',ivaPct:16,margenPct:30,vigenciaDias:15,condiciones:'x'};"}));
    const p = await ctx.newPage(); p.on('pageerror', e=>console.log('ERR', e.message)); await p.goto((process.env.BASE||'http://localhost:8765')+'/index.html'); return p; };
  let p = await nuevo();
  await p.click('#lnkRegistro'); await p.fill('#loginNombre','Victor'); await p.fill('#loginCorreo','victor@profectus.mx'); await p.fill('#loginClave','clave-segura-1'); await p.click('#loginBoton');
  await p.waitForSelector('#app:not(.oculto)', {timeout:10000}).catch(async()=>console.log('login err:', await p.textContent('#loginError')));
  esperar('primera cuenta es Owner', await p.textContent('#usuarioRol'), 'Owner');
  await p.click('[data-accion=nuevo-cliente]'); await p.fill('#cNombre','Cliente Emu'); await p.click('[data-modal=guardar]'); await p.waitForSelector('[data-accion=nueva-cotizacion]');
  await p.click('[data-accion=nueva-cotizacion]'); await p.fill('#qPartidas tr [data-k=concepto]','Servicio'); await p.fill('#qPartidas tr [data-k=precioCosto]','100'); await p.click('[data-modal=guardar]');
  await p.waitForSelector('[data-accion=estatus-cotizacion]'); await p.click('[data-accion=estatus-cotizacion][data-estatus=enviada]'); await p.waitForTimeout(400);
  await p.click('[data-accion=ir][data-modulo=admin]'); await p.click('[data-pestana=parametros]'); await p.fill('[data-param=telefono]','81 1234 5678'); await p.click('[data-accion=guardar-parametros]'); await p.waitForTimeout(400);
  await p.click('[data-pestana=bitacora]'); await p.waitForSelector('.bitacora-item'); esperar('bitácora visible para owner', (await p.locator('.bitacora-item').count())>=4, true);
  const toastErr = await p.evaluate(()=>document.getElementById('toast').classList.contains('error')); esperar('sin errores de permiso como owner', toastErr, false);

  // usuario que se auto-registra
  const ana = await auth('signUp',{email:'ana@profectus.mx',password:'clave-segura-2'});
  esperar('auto-registro no puede nacer owner', await fs(ana.idToken,'PATCH','/usuarios/'+ana.localId, campos({correo:'ana@profectus.mx',rol:'owner',activo:true})), 403);
  esperar('auto-registro no puede nacer activo', await fs(ana.idToken,'PATCH','/usuarios/'+ana.localId, campos({correo:'ana@profectus.mx',rol:'viewer',activo:true})), 403);
  esperar('auto-registro viewer bloqueado OK', await fs(ana.idToken,'PATCH','/usuarios/'+ana.localId, campos({correo:'ana@profectus.mx',rol:'viewer',activo:false})), 200);
  esperar('pendiente no lee clientes', await fs(ana.idToken,'GET','/clientes'), 403);
  esperar('pendiente no se auto-activa', await fs(ana.idToken,'PATCH','/usuarios/'+ana.localId, campos({correo:'ana@profectus.mx',rol:'viewer',activo:true})), 403);
  esperar('nadie más crea arranque', await fs(ana.idToken,'PATCH','/sistema/arranque', campos({uid:ana.localId})), 403);
  // owner la aprueba como viewer desde la app
  await p.click('[data-pestana=usuarios]'); await p.waitForSelector('[data-accion=activar-usuario]'); await p.click('[data-accion=activar-usuario]'); await p.waitForTimeout(500);
  esperar('viewer lee clientes', await fs(ana.idToken,'GET','/clientes'), 200);
  esperar('viewer no escribe clientes', await fs(ana.idToken,'PATCH','/clientes/x', campos({nombre:'x'})), 403);
  esperar('viewer no lee usuarios ajenos', await fs(ana.idToken,'GET','/usuarios'), 403);
  esperar('viewer no lee bitácora', await fs(ana.idToken,'GET','/bitacora'), 403);
  esperar('viewer actualiza su ultimoAcceso', await fs(ana.idToken,'PATCH','/usuarios/'+ana.localId+'?updateMask.fieldPaths=ultimoAcceso', campos({ultimoAcceso:'hoy'})), 200);
  esperar('viewer no se sube de rol', await fs(ana.idToken,'PATCH','/usuarios/'+ana.localId+'?updateMask.fieldPaths=rol', campos({rol:'admin'})), 403);
  // owner la sube a analyst
  await p.selectOption('select[data-accion-cambio=rol-usuario]','analyst'); await p.waitForTimeout(500);
  esperar('analyst escribe clientes', await fs(ana.idToken,'PATCH','/clientes/x', campos({nombre:'x'})), 200);
  esperar('analyst no borra clientes', await fs(ana.idToken,'DELETE','/clientes/x'), 403);
  esperar('analyst no cambia parámetros', await fs(ana.idToken,'PATCH','/sistema/parametros', campos({ivaPct:'0'})), 403);
  esperar('analyst no falsifica bitácora', await fs(ana.idToken,'POST','/bitacora', campos({uid:'otro',accion:'x'})), 403);
  // admin creado por owner, que intenta tocar al owner
  await p.click('[data-accion=nueva-cuenta]'); await p.fill('#uNombre','Admin'); await p.fill('#uCorreo','admin@profectus.mx'); await p.fill('#uClave','clave-admin-123'); await p.selectOption('#uRol','admin'); await p.click('[data-modal=guardar]'); await p.waitForTimeout(600);
  const adm = await auth('signInWithPassword',{email:'admin@profectus.mx',password:'clave-admin-123'});
  const ownerUid = (await auth('signInWithPassword',{email:'victor@profectus.mx',password:'clave-segura-1'})).localId;
  esperar('admin entra y lee usuarios', await fs(adm.idToken,'GET','/usuarios'), 200);
  esperar('admin no bloquea al owner', await fs(adm.idToken,'PATCH','/usuarios/'+ownerUid+'?updateMask.fieldPaths=activo', campos({activo:false})), 403);
  esperar('admin no nombra owners', await fs(adm.idToken,'PATCH','/usuarios/'+ana.localId+'?updateMask.fieldPaths=rol', campos({rol:'owner'})), 403);
  esperar('admin borra clientes', await fs(adm.idToken,'DELETE','/clientes/x'), 200);
  // la app como admin
  let p3 = await nuevo(); await p3.fill('#loginCorreo','admin@profectus.mx'); await p3.fill('#loginClave','clave-admin-123'); await p3.click('#loginBoton'); await p3.waitForSelector('#app:not(.oculto)');
  esperar('admin ve la cotización', await p3.evaluate(()=>Profectus.estado.datos.cotizaciones.length), 1);
  esperar('admin ve teléfono de parámetros', await p3.evaluate(()=>Profectus.estado.params.telefono), '81 1234 5678');
  await p3.click('[data-accion=ir][data-modulo=admin]'); await p3.waitForSelector('table.tabla');
  esperar('admin no ve controles sobre el owner', await p3.locator('tr:has-text("victor@profectus.mx") button').count(), 0);
  console.log(fallas ? fallas+' FALLAS' : 'TODO OK');
  await b.close();
})();
