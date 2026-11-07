# Modular Studio

Plataforma web para diseñar, documentar, presupuestar y fabricar muebles modulares en México (milímetros, MXN, es-MX).
Construida a partir del paquete de transferencia *MODULAR_STUDIO_PAQUETE_CLAUDE* y de su prototipo HTML (ver `docs/fuente/`).

> **Estado:** V1 funcional. Gabinete de cocina, clóset y escritorio son implementaciones constructivas cubiertas por pruebas.
> El resto de las 18 familias son plantillas parametrizables con advertencias explícitas. Nada se presenta como listo para CNC,
> como estructura certificada ni como cotización vigente sin aprobación y evidencia documentadas.

## Qué hace

| Área | Implementado |
|---|---|
| Catálogo | 18 familias (cocina, recámara, oficina, sala, baño, servicios, comercial, a medida) con estrategia geométrica y estado de validación; materiales, acabados, cantos, perfiles PTR, herrajes y patrones de mecanizado. |
| Motor | Puro y determinista (`packages/domain`): costados, tapa/piso (2 estrategias), respaldo sobrepuesto, divisores por luz libre, entrepaños, maletero + tubo (clóset), puertas y frentes de cajón con holguras, cajas de cajón **sólo** con corredera que declare sus parámetros, zoclo, patas niveladoras, bastidor PTR, escritorio de panel o de PTR. IDs estables, posición 3D de cada pieza, detección de colisiones, verificación de formato de tablero. |
| Herrajes / mecanizado | BOM por tipo con la regla aplicada y estado `verified` / `pending_validation` / `blocked`. Las operaciones de mecanizado no tienen coordenadas hasta que el patrón se capture desde una ficha técnica; con ficha, el motor valida salida de broca y traslape de barrenos. |
| Corte | Acomodo guillotina 2D (kerf, escuadrado, veta, rotación) → `layout_factible`; la estimación por área siempre se rotula `estimacion_area_no_validada`. Barras 1D (FFD) para PTR. |
| Visual | SVG paramétrico (isométrico, frente, lateral, planta, despiece separado, IDs, selección de pieza) generado **desde las posiciones del BOM**; mapas de corte SVG. |
| Proveedores / precios | Sarotech, TYM Forest y El Pájaro Carpintero (sin afiliación). Ofertas con SKU, presentación, IVA incluido/excluido, estado, fecha, vigencia, URL, folio y confiabilidad. Captura manual e importación CSV con de-duplicación e histórico. Sin scraping. |
| Presupuesto | Centavos enteros; IVA desglosado sin duplicar; compra por presentación completa; servicios manuales; **margen sobre venta** (`costo/(1−m)`) distinto de **markup** (`costo×(1+k)`); estados `COMPLETO` / `INCOMPLETO` / `SIMULACION`. Un precio faltante nunca se convierte en $0. |
| Calidad | Errores, bloqueos de validación, advertencias; checklist de inspección; diagonales medidas vs. tolerancia; aprobación documentada con evidencia; estado de liberación. |
| Publicación | **Firebase Hosting + Auth + Firestore** (sitio estático, igual que Nutripulso; ver `docs/PUBLICAR_FIREBASE.md`) o servidor Node con API. |
| Persistencia | Proyecto versionado (`schemaVersion`), revisiones congeladas con `calcVersion`, duplicar, importar JSON (con migración explícita del esquema mínimo del paquete). Firestore por usuario (modo Firebase), archivo JSON (modo demo) o PostgreSQL (Prisma). |
| Exportación | JSON versionado, CSV UTF-8 con BOM (`,` o `;` con coma decimal), SVG, mapa de corte SVG, Mermaid, **PDF de fabricación**. DXF/DWG no implementados. |
| API | `GET /api/templates`, `/api/materials`, `/api/suppliers`, `/api/offers`; `POST /api/offers`, `/api/offers/import`; `GET/POST /api/projects`; `GET/PATCH/DELETE /api/projects/:id`; `GET/POST /api/projects/:id/revisions`; `GET /api/projects/:id/revisions/:revId`; `POST /api/calculate`, `/api/quotes`, `/api/exports/:format`, `/api/render`; `GET /api/health`. |

## Estructura

```text
modular-studio/
  apps/web/                 Next.js 15 (App Router) + React 19 + Tailwind 4
    src/app/                páginas (proyectos, catálogo, proveedores, /editor?id=) y rutas /api (sólo modo servidor)
    src/lib/data/           acceso a datos: API (modo servidor) o Firestore + Auth (modo Firebase); exportación en navegador
    src/components/         UI: Dashboard, Suppliers, editor/* (Editor, ModulePanel, Viewer, pestañas)
    src/server/             repositorio (archivo demo / Prisma), sesión y autorización, manejo de errores
  packages/domain/          tipos, catálogo, motor de piezas, herrajes, nesting, presupuesto, validación, Zod, migración
  packages/geometry/        proyección SVG (iso/orto), orden del pintor, cotas, mapas de corte
  packages/cut-optimizer/   guillotina 2D + barras 1D
  packages/export/          JSON, CSV, SVG, Mermaid, PDF (pdf-lib)
  packages/db/              Prisma schema, migraciones, repositorio PostgreSQL, seed
  data/seed/                fixtures y ejemplo del paquete; supplier_offers.json (vacío por política)
  firebase.json, .firebaserc, firestore.rules   publicación en Firebase Hosting
  docs/                     auditoría, reglas, supuestos/riesgos, despliegue, verificación; docs/fuente = paquete original
  tests/unit, tests/e2e     Vitest y Playwright
```

## Publicar en Firebase

Resumen (detalle en `docs/PUBLICAR_FIREBASE.md`): crear un proyecto de Firebase **distinto** al de Nutripulso, habilitar correo/contraseña y Firestore, pegar la configuración web en `apps/web/.env.production.local` y ejecutar:

```bash
npm run deploy:firebase
```

## Instalación

Requisitos: Node.js ≥ 20.10 (probado con 22), npm 10. PostgreSQL 16 sólo para el modo Prisma.

```bash
cd modular-studio
npm install
cp .env.example .env
```

### Modo demo (sin base de datos)

```bash
npm run dev
```

Abre http://localhost:3000 (el editor está en `/editor?id=…`). Los datos se guardan en `apps/web/.data/modular-studio.json` y la UI muestra **«MODO DEMO · persistencia local»**. El primer acceso crea un proyecto demo y carga las ofertas del prototipo marcadas `ESTIMADO`.

### Modo PostgreSQL (Prisma)

```bash
docker compose up -d
```

```bash
cp .env.example packages/db/.env
```

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

```bash
DATA_BACKEND=prisma npm run dev
```

`db:migrate` aplica `packages/db/prisma/migrations` (en producción use `npm run db:deploy`). `db:seed` registra proveedores y ofertas demo `ESTIMADO`; también importa `data/seed/supplier_offers.json` si contiene ofertas verificables.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo (puerto 3000). |
| `npm run build` | `tsc` estricto de paquetes y app + `next build`. |
| `npm start` | Sirve la compilación. |
| `npm test` | Pruebas unitarias (Vitest). Con `DATABASE_URL` también corre el contrato del repositorio contra PostgreSQL. |
| `npm run lint` | ESLint (TypeScript, Next, React Hooks). |
| `npm run e2e` | Playwright: levanta la app en el puerto 3100 con datos temporales (compila si no hay `.next`). |
| `npm run verify` | lint + test + build + e2e. |
| `npm run build:firebase` | Sitio estático para Firebase Hosting (`apps/web/out`). |
| `npm run deploy:firebase` | Compila y ejecuta `firebase deploy --only hosting,firestore`. |
| `npm run build:firebase:emulator` / `firebase:emulators` / `e2e:firebase` | Prueba local del modo Firebase con emuladores. |
| `npm run db:generate / db:migrate / db:deploy / db:seed` | Prisma. |

## Variables de entorno

Ver `.env.example`. Ningún secreto vive en el cliente; el servidor resuelve el workspace y nunca confía en costos enviados por el navegador (cotizaciones y exportaciones se recalculan desde lo guardado).

- `DATA_BACKEND` = `file` (demo) | `prisma`
- `DATABASE_URL`
- `AUTH_MODE` = `demo` | `token` (API con `Authorization: Bearer`, `API_TOKENS="token:workspace:ROL"`; el rol `VIEWER` no puede escribir)
- `DEMO_WORKSPACE_ID`, `DATA_DIR`

## Documentación

- `docs/AUDITORIA_PROTOTIPO.md` — tabla existente / pendiente / corregido respecto al HTML original.
- `docs/REGLAS_MOTOR.md` — reglas constructivas, convenciones y valores configurables.
- `docs/SUPUESTOS_Y_RIESGOS.md` — supuestos, datos que requieren medición/ficha/cotización, riesgos y siguientes pasos.
- `docs/PUBLICAR_FIREBASE.md` — publicación en Firebase Hosting (como Nutripulso).
- `docs/DESPLIEGUE.md` — despliegue del modo servidor (Node + PostgreSQL).
- `docs/VERIFICACION.md` — comandos ejecutados y resultados reales.
- `docs/fuente/` — documentos del paquete original y el prototipo HTML.

## Avisos

Las listas son preliminares y no sustituyen cálculo estructural, planos de instalación, fichas técnicas de herrajes ni la revisión en taller. Los precios del prototipo se conservan sólo como `ESTIMADO` (simulación). Sin afiliación, certificación ni colaboración comercial con Sarotech, TYM Forest o El Pájaro Carpintero.
