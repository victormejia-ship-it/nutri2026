/* =========================================================================
   PROFECTUS · Capa de datos
   Habla con Firebase (Auth + Firestore) por REST, sin librerías, igual que
   el tablero de Forguard. Si CONFIG_NUBE está vacío, todo se guarda en
   localStorage (modo local) con la MISMA interfaz, para que el resto de la
   app no tenga que saber dónde vive la información.
   ========================================================================= */
(function(){
  const CFG = window.CONFIG_NUBE || {};
  const HAY_NUBE = !!(CFG.apiKey && CFG.projectId);
  const LLAVE_SESION = 'profectus.sesion.v1';
  const LLAVE_LOCAL  = 'profectus.datos.v1';
  const TIMEOUT_MS = 20000;

  function fetchConTimeout(url, op, ms){
    const c = new AbortController();
    const t = setTimeout(()=> c.abort(), ms || TIMEOUT_MS);
    return fetch(url, Object.assign({}, op, { signal:c.signal })).finally(()=> clearTimeout(t));
  }

  /* ----------------------------- AUTH (REST) ----------------------------- */
  const urlAuth = m => 'https://identitytoolkit.googleapis.com/v1/accounts:' + m + '?key=' + encodeURIComponent(CFG.apiKey);
  const MENSAJES_AUTH = {
    EMAIL_NOT_FOUND:'No existe una cuenta con ese correo.',
    INVALID_PASSWORD:'Contraseña incorrecta.',
    INVALID_LOGIN_CREDENTIALS:'Correo o contraseña incorrectos.',
    USER_DISABLED:'Esta cuenta está deshabilitada.',
    EMAIL_EXISTS:'Ya existe una cuenta con ese correo.',
    INVALID_EMAIL:'El correo no es válido.',
    TOO_MANY_ATTEMPTS_TRY_LATER:'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
    WEAK_PASSWORD:'La contraseña es muy débil (mínimo 8 caracteres).',
    MISSING_PASSWORD:'Escribe la contraseña.'
  };
  async function llamarAuth(metodo, cuerpo){
    const r = await fetchConTimeout(urlAuth(metodo), {
      method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(cuerpo)
    });
    const d = await r.json().catch(()=> ({}));
    if(!r.ok){
      const cod = ((d.error && d.error.message) || 'ERROR').split(' ')[0].split(':')[0];
      const e = new Error(MENSAJES_AUTH[cod] || ('No se pudo completar (' + cod + ').'));
      e.codigo = cod;
      throw e;
    }
    return d;
  }

  let sesion = null;
  try{ sesion = JSON.parse(localStorage.getItem(LLAVE_SESION) || 'null'); }catch(e){ sesion = null; }
  function guardarSesion(){
    try{
      if(sesion) localStorage.setItem(LLAVE_SESION, JSON.stringify(sesion));
      else localStorage.removeItem(LLAVE_SESION);
    }catch(e){}
  }
  function fijarTokens(d){
    sesion = {
      uid: d.localId || d.user_id,
      correo: d.email || (sesion && sesion.correo) || '',
      idToken: d.idToken || d.id_token,
      refreshToken: d.refreshToken || d.refresh_token,
      vence: Date.now() + (parseInt(d.expiresIn || d.expires_in, 10) || 3600) * 1000 - 60000
    };
    guardarSesion();
  }
  async function renovarToken(){
    if(!sesion || !sesion.refreshToken) throw new Error('SIN_SESION');
    const r = await fetchConTimeout('https://securetoken.googleapis.com/v1/token?key=' + encodeURIComponent(CFG.apiKey), {
      method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
      body:'grant_type=refresh_token&refresh_token=' + encodeURIComponent(sesion.refreshToken)
    });
    const d = await r.json().catch(()=> ({}));
    if(!r.ok){ sesion = null; guardarSesion(); throw new Error('SIN_SESION'); }
    fijarTokens(d);
  }
  async function tokenVigente(){
    if(!sesion) throw new Error('SIN_SESION');
    if(Date.now() >= sesion.vence) await renovarToken();
    return sesion.idToken;
  }

  /* --------------------------- FIRESTORE (REST) --------------------------- */
  const raiz = () => 'https://firestore.googleapis.com/v1/projects/' + CFG.projectId + '/databases/(default)/documents';
  const nombreDoc = ruta => 'projects/' + CFG.projectId + '/databases/(default)/documents/' + ruta;

  function aValor(v){
    if(v === null || v === undefined) return { nullValue:null };
    if(typeof v === 'boolean') return { booleanValue:v };
    if(typeof v === 'number') return Number.isInteger(v) ? { integerValue:String(v) } : { doubleValue:v };
    if(Array.isArray(v)) return { arrayValue:{ values:v.map(aValor) } };
    if(typeof v === 'object') return { mapValue:{ fields:aCampos(v) } };
    return { stringValue:String(v) };
  }
  function aCampos(o){ const f = {}; Object.keys(o).forEach(k=>{ if(k !== 'id' && o[k] !== undefined) f[k] = aValor(o[k]); }); return f; }
  function deValor(v){
    if(!v || typeof v !== 'object') return null;
    if('booleanValue' in v) return v.booleanValue;
    if('integerValue' in v) return Number(v.integerValue);
    if('doubleValue' in v) return Number(v.doubleValue);
    if('stringValue' in v) return v.stringValue;
    if('timestampValue' in v) return v.timestampValue;
    if('nullValue' in v) return null;
    if('arrayValue' in v) return (v.arrayValue.values || []).map(deValor);
    if('mapValue' in v) return deCampos(v.mapValue.fields || {});
    return null;
  }
  function deCampos(f){ const o = {}; Object.keys(f).forEach(k=>{ o[k] = deValor(f[k]); }); return o; }

  async function pedir(ruta, op, permitirVacio, reintento){
    const t = await tokenVigente();
    const o = Object.assign({}, op);
    o.headers = Object.assign({ Authorization:'Bearer ' + t, 'Content-Type':'application/json' }, o.headers || {});
    const r = await fetchConTimeout(raiz() + ruta, o);
    if(r.status === 401 && !reintento){ await renovarToken(); return pedir(ruta, op, permitirVacio, true); }
    if(r.status === 404 && permitirVacio) return null;
    if(r.status === 403) throw new Error('SIN_PERMISO');
    if(!r.ok){
      const txt = await r.text().catch(()=> '');
      const e = new Error('HTTP ' + r.status + ' ' + txt.slice(0, 300));
      e.status = r.status;
      throw e;
    }
    if(r.status === 204) return null;
    return r.json().catch(()=> null);
  }

  /* ----------------------------- MODO LOCAL ------------------------------ */
  let local = null;
  function datosLocales(){
    if(local) return local;
    try{ local = JSON.parse(localStorage.getItem(LLAVE_LOCAL) || 'null'); }catch(e){ local = null; }
    if(!local || typeof local !== 'object') local = {};
    return local;
  }
  function guardarLocal(){
    try{ localStorage.setItem(LLAVE_LOCAL, JSON.stringify(local)); }
    catch(e){ console.error(e); throw new Error('No se pudo guardar en este navegador (¿sin espacio?).'); }
  }
  const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  /* ------------------------------ API PÚBLICA ----------------------------- */
  const Nube = {
    HAY_NUBE,
    sesion: () => sesion,
    nuevoId,

    async entrar(correo, clave){
      const d = await llamarAuth('signInWithPassword', { email:correo, password:clave, returnSecureToken:true });
      fijarTokens(d);
      return sesion;
    },
    async registrarme(correo, clave){
      const d = await llamarAuth('signUp', { email:correo, password:clave, returnSecureToken:true });
      fijarTokens(d);
      return sesion;
    },
    /* Crea la cuenta de OTRA persona sin tocar la sesión actual: la API REST
       devuelve tokens del nuevo usuario, pero no los usamos — solo el uid. */
    async crearCuentaAjena(correo, claveTemporal){
      const d = await llamarAuth('signUp', { email:correo, password:claveTemporal, returnSecureToken:false });
      return d.localId;
    },
    async enviarRestablecer(correo){
      await llamarAuth('sendOobCode', { requestType:'PASSWORD_RESET', email:correo });
    },
    salir(){ sesion = null; guardarSesion(); },

    /* Lee una colección completa (paginada). */
    async listar(col){
      if(!HAY_NUBE){
        const d = datosLocales();
        return Object.values(d[col] || {}).map(x => Object.assign({}, x));
      }
      const salida = [];
      let token = '';
      do{
        const d = await pedir('/' + col + '?pageSize=300' + (token ? '&pageToken=' + encodeURIComponent(token) : ''), { method:'GET' });
        ((d && d.documents) || []).forEach(doc=>{
          const o = deCampos(doc.fields || {});
          o.id = doc.name.split('/').pop();
          salida.push(o);
        });
        token = (d && d.nextPageToken) || '';
      }while(token);
      return salida;
    },
    async leer(col, id){
      if(!HAY_NUBE){
        const d = datosLocales();
        const x = d[col] && d[col][id];
        return x ? Object.assign({}, x) : null;
      }
      const d = await pedir('/' + col + '/' + encodeURIComponent(id), { method:'GET' }, true);
      if(!d) return null;
      const o = deCampos(d.fields || {});
      o.id = id;
      return o;
    },
    /* Escribe el documento completo (crea o reemplaza). */
    async guardar(col, id, obj){
      id = id || nuevoId();
      const limpio = JSON.parse(JSON.stringify(Object.assign({}, obj, { id:undefined })));
      if(!HAY_NUBE){
        const d = datosLocales();
        d[col] = d[col] || {};
        d[col][id] = Object.assign(limpio, { id });
        guardarLocal();
        return id;
      }
      await pedir('/' + col + '/' + encodeURIComponent(id), { method:'PATCH', body:JSON.stringify({ fields:aCampos(limpio) }) });
      return id;
    },
    async borrar(col, id){
      if(!HAY_NUBE){
        const d = datosLocales();
        if(d[col]) delete d[col][id];
        guardarLocal();
        return;
      }
      await pedir('/' + col + '/' + encodeURIComponent(id), { method:'DELETE' });
    },
    /* Varias escrituras atómicas (todas o ninguna). ops: [{col,id,datos}|{col,id,borrar:true}] */
    async lote(ops){
      if(!HAY_NUBE){
        const d = datosLocales();
        ops.forEach(o=>{
          d[o.col] = d[o.col] || {};
          if(o.borrar) delete d[o.col][o.id];
          else d[o.col][o.id] = Object.assign(JSON.parse(JSON.stringify(o.datos)), { id:o.id });
        });
        guardarLocal();
        return;
      }
      const writes = ops.map(o => o.borrar
        ? { delete:nombreDoc(o.col + '/' + o.id) }
        : Object.assign(
            { update:{ name:nombreDoc(o.col + '/' + o.id), fields:aCampos(JSON.parse(JSON.stringify(o.datos))) } },
            o.debeNoExistir ? { currentDocument:{ exists:false } } : {},
            o.versionEsperada ? { currentDocument:{ updateTime:o.versionEsperada } } : {}
          ));
      await pedir(':commit', { method:'POST', body:JSON.stringify({ writes }) });
    },
    /* Lee un documento junto con su versión (updateTime) para escrituras con
       precondición — se usa en el contador de folios. */
    async leerConVersion(col, id){
      if(!HAY_NUBE) return { datos:await Nube.leer(col, id), version:null };
      const d = await pedir('/' + col + '/' + encodeURIComponent(id), { method:'GET' }, true);
      if(!d) return { datos:null, version:null };
      return { datos:deCampos(d.fields || {}), version:d.updateTime };
    },

    /* Respaldo completo (solo modo local lo restaura tal cual). */
    exportarLocal(){ return JSON.parse(JSON.stringify(datosLocales())); },
    importarLocal(obj){ local = obj || {}; guardarLocal(); }
  };

  window.Nube = Nube;
})();
