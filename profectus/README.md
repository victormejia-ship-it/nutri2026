# PROFECTUS · Servicios Especializados

Tablero interno de PROFECTUS con dos módulos y el panel de administración:

- **Clientes**: alta, edición y eliminación de clientes (nombre, razón social,
  RFC, segmento, contacto, logo), sus **sitios / ubicaciones** y sus
  **contactos**. Tiene buscador, indicadores y exportación a CSV.
- **Cotizaciones**: cotización de servicio sobre un cliente (y uno de sus
  sitios si aplica). Cada cotización tiene dos documentos:
  - **Costo interno**: lo que le cuesta a Profectus.
  - **Cotización cliente**: el costo más el margen, con instalación / mano de
    obra opcional e IVA.

  Lleva un folio automático `PRO-DDMMAA-NN`, la vigencia (marca las
  vencidas), el estatus (borrador, enviada, aprobada, facturada, rechazada o
  cancelada) y el resumen por persona. Se puede duplicar, exportar a CSV o
  sacar en PDF con la marca Profectus.
- **Admin**: incluye
  - cuentas de usuario: crear, aprobar solicitudes, cambiar rol, bloquear,
    restablecer contraseña;
  - datos de la empresa y parámetros (IVA, margen, vigencia y condiciones por
    omisión);
  - **bitácora** de quién cambió qué;
  - **respaldo / restauración** en JSON.

La base es la funcionalidad del tablero de Forguard (forguardfacilities.com.mx).
Se conservan sus fórmulas de cotización, sus roles, el modo local/nube y la
forma de hablar con Firebase por REST, sin librerías.

## Fórmulas de cotización

| Concepto | Cálculo |
|---|---|
| Importe costo | cantidad × costo unitario |
| Precio cliente | precio manual, o costo × (1 + margen %) |
| Instalación (costo) | subtotal de partidas costo × % + monto fijo |
| Instalación (cliente) | instalación costo × (1 + margen %) |
| Subtotal | partidas + instalación (si se incluye) |
| IVA | subtotal × IVA % (por omisión 16 %) |
| Total | subtotal + IVA |

Las partidas seguidas que comparten la misma sección se numeran como 1.1, 1.2…

## Roles

| Rol | Puede |
|---|---|
| Owner | Todo. Nadie lo puede bloquear ni degradar. |
| Admin | Todo, incluidas las cuentas, los parámetros y borrar registros, pero no puede tocar a un Owner. |
| Analyst | Crear y editar clientes y cotizaciones. |
| Viewer | Solo consulta. |

La **primera cuenta** que se registra en un proyecto vacío queda como
**Owner**. Las siguientes nacen bloqueadas hasta que un Owner o Admin las
aprueba en Admin → Usuarios. También se pueden crear desde ahí directamente.
La sesión se cierra sola después de 8 horas sin actividad. Si se bloquea a
alguien o se le cambia el rol, el cambio se aplica en menos de 2 minutos.

## Modo local y modo nube

- **Modo local** (cuando `js/config.js` está vacío): todo se guarda en el
  navegador y no hay inicio de sesión. Sirve para probar la app.
- **Modo nube**: se pegan `apiKey` y `projectId` del proyecto de Firebase en
  `js/config.js`.

## Puesta en marcha con Firebase

1. Crear el proyecto `profectus` en la [consola de Firebase](https://console.firebase.google.com).
2. **Authentication** → Sign-in method → activar **Correo electrónico/contraseña**.
3. **Firestore Database** → Crear base de datos en modo producción, en la región `nam5` o `us-central`.
4. Publicar las reglas:
   ```bash
   firebase deploy --only firestore:rules --project profectus
   ```
   También se pueden publicar desde la consola: Firestore → Reglas → pegar el
   contenido de `config/firestore.rules` → Publicar.
5. Configuración del proyecto → Tus apps → agregar una **app web** → copiar
   `apiKey` y `projectId` a `js/config.js`.
6. Abrir la app, elegir **Solicitar una cuenta** y registrarse. Esa primera
   cuenta queda como Owner.

## Publicar

Es un sitio estático, así que funciona con **Firebase Hosting** o con
**GitHub Pages**:

```bash
firebase deploy --only hosting --project profectus
```

Para un dominio propio (por ejemplo `profectus.com.mx`), se agrega en
Hosting → Agregar dominio personalizado.

## Pruebas

```bash
npx serve -l 8765 .   # o: python3 -m http.server 8765
node tests/prueba_local.js            # flujo completo en modo local + PDF

# Reglas de seguridad contra el emulador de Firebase (requiere Java):
cd tests && npx firebase-tools emulators:start --only auth,firestore --project demo-profectus
node tests/prueba_reglas.js           # 26 casos de permisos por rol
```

## Estructura

```
index.html                 tablero (una sola página)
css/profectus.css          estilos con la paleta oficial (modo claro/oscuro)
js/config.js               datos de Firebase y de la empresa
js/nube.js                 Auth + Firestore por REST / modo local
js/app.js                  clientes, cotizaciones, admin
docs/plantilla_cotizacion.html   documento imprimible / PDF
config/firestore.rules     reglas de seguridad
assets/                    logos y favicons del branding
```
