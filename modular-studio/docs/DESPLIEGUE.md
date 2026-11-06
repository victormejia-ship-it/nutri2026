# Despliegue

## Requisitos

- Node.js 20.10+ (probado con 22) y PostgreSQL 16.
- Variables: `DATA_BACKEND=prisma`, `DATABASE_URL`, `AUTH_MODE`, `API_TOKENS` (si `token`), `NEXT_TELEMETRY_DISABLED=1`.

## Pasos (servidor Node)

```bash
npm ci
```

```bash
npm run db:generate
```

```bash
npm run db:deploy
```

```bash
npm run db:seed
```

```bash
npm run build
```

```bash
DATA_BACKEND=prisma npm start
```

`db:deploy` aplica las migraciones versionadas de `packages/db/prisma/migrations` sin generar nuevas. `db:seed` es idempotente: los proveedores se actualizan y las ofertas duplicadas se omiten.

## Notas

- Ejecute detrás de un proxy con HTTPS. La app envía `X-Content-Type-Options`, `Referrer-Policy` y `X-Frame-Options`.
- **No** use el modo demo (archivo JSON) en producción: no soporta varios procesos ni respaldos. La UI lo indica con «MODO DEMO».
- `GET /api/health` devuelve el backend activo y las versiones de esquema y cálculo, útil como health check.
- Respaldos: `pg_dump` de la base; las revisiones guardan snapshots completos.
- Vercel u otra plataforma serverless: funciona con `DATA_BACKEND=prisma` y una base gestionada; el modo demo no es apto (sistema de archivos efímero).
- La UI todavía no tiene proveedor de identidad: en un despliegue abierto a internet proteja el acceso (VPN, proxy con autenticación) hasta integrar OIDC.
