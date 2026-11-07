# Publicar en Firebase (igual que Nutripulso)

Modular Studio se publica como **sitio estático en Firebase Hosting**, con **Firebase Auth** (correo y contraseña) y **Firestore** para los datos, igual que Nutripulso. Funciona con el plan gratuito **Spark**: no usa Cloud Functions ni servidor.

> Usa un **proyecto de Firebase distinto** al de Nutripulso. Si se publicara en el mismo proyecto, `firebase deploy` reemplazaría las reglas de Firestore de Nutripulso. Además, el `firebase.json` de Nutripulso (raíz del repositorio) ya excluye la carpeta `modular-studio/`, para que su código no se publique junto con Nutripulso.

## 1. Crear el proyecto en la consola de Firebase (una sola vez)

1. Entra a https://console.firebase.google.com y crea un proyecto. El ID sugerido es `modular-studio-mx`; si eliges otro, cámbialo en `modular-studio/.firebaserc`.
2. **Authentication → Sign-in method → Correo electrónico/contraseña → Habilitar.**
3. **Firestore Database → Crear base de datos → modo producción.** Elige la ubicación más cercana (por ejemplo `northamerica-south1`, Querétaro). Las reglas se suben con el deploy.
4. **Configuración del proyecto → Tus apps → Web (`</>`)**: registra la app (sin marcar Hosting en este paso) y copia el objeto `firebaseConfig`.

## 2. Configuración web

Ya está en el repositorio: `apps/web/.env.production` contiene la configuración del proyecto `modular-studio-mx` (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`). Son claves públicas por diseño, igual que en `js/firebase-config.js` de Nutripulso; la seguridad la dan Firebase Auth y `firestore.rules`.

Si algún día cambias de proyecto, actualiza ese archivo y `.firebaserc`. Para pruebas puntuales puedes sobrescribirla sin tocar git con `apps/web/.env.production.local` (ver `apps/web/.env.firebase.example`).

## 3. Publicar

```bash
npm install
```

```bash
npx -y firebase-tools@15.35.0 login
```

```bash
npm run deploy:firebase
```

`deploy:firebase` compila el sitio estático (`apps/web/out`) y ejecuta `firebase deploy --only hosting,firestore`, que sube el sitio, `firestore.rules` y `firestore.indexes.json`. Al terminar, la CLI muestra la URL pública, por ejemplo `https://modular-studio-mx.web.app`.

Para publicar cambios posteriores sólo repite `npm run deploy:firebase`.

## Qué cambia en modo Firebase

| Aspecto | Modo Firebase (Hosting) | Modo servidor (Next.js + API) |
|---|---|---|
| Acceso | Cuenta con correo y contraseña; cada usuario ve sólo sus datos | Workspace demo o tokens de API |
| Datos | Firestore: `ms_users/{uid}/projects`, `…/revisions`, `ms_users/{uid}/offers` | Archivo JSON (demo) o PostgreSQL |
| Cálculo y exportaciones | En el navegador, con el mismo motor | En el servidor |
| Validar cotización en servidor / render | No disponible (no hay servidor) | Disponible |
| Costo | Plan Spark gratuito (dentro de sus cuotas) | Hosting de Node + PostgreSQL |

Al crear la cuenta se cargan las ofertas demo del prototipo, marcadas `ESTIMADO` o `PENDIENTE`, para que puedas probar el presupuesto. Ninguna es un precio vigente.

## Reglas de seguridad

`firestore.rules` permite a cada usuario leer y escribir sólo `ms_users/{su uid}/…`, limita el tamaño de los documentos, impide editar revisiones congeladas y ofertas registradas (histórico) y niega todo lo demás. Verificado contra el emulador: acceso propio 200; acceso de otro usuario, sin sesión o fuera de `ms_users`, 403.

## Probar localmente con los emuladores (sin tocar tu proyecto real)

```bash
npm run build:firebase:emulator
```

```bash
npm run firebase:emulators
```

Abre http://127.0.0.1:5000. Para correr las pruebas E2E del modo Firebase, en otra terminal:

```bash
npm run e2e:firebase
```

Los emuladores requieren Java 11 o superior.
