# Focusboard

Tablero personal de tareas, diseñado para trabajo operativo y estudio. Es una **PWA** (instalable) construida con **[Astro](https://astro.build/)** y desplegada en **Firebase Hosting**. Las tareas se mueven entre columnas arrastrándolas; en móvil, con un gesto de arrastre.

**Acceso privado:**

- **Tablero** — login **solo por número de teléfono** (SMS). Entran los números registrados en el nodo `boardMembers` de Realtime Database (y siempre el dueño). La app revisa el número **antes** de mandar el SMS: a uno que no esté en la lista no le envía código.
- **Radar de empleo** (`/empleo`) — solo el dueño (su cuenta de Google o su teléfono), igual que antes.

Las tareas se guardan en **Firebase Realtime Database** bajo el nodo `tasks`, protegido del lado servidor por `database.rules.json`: sin una sesión autorizada, Firebase deniega la lectura y la escritura, y cada tarea escrita tiene que respetar la forma esperada (campos, estados, largos).

### Agregar o quitar personas del tablero

En la [consola de Firebase](https://console.firebase.google.com/project/focusboard-dev/database) → Realtime Database → nodo `boardMembers`, agrega una llave con el número en formato internacional y valor `true`:

```json
{ "boardMembers": { "+573001234567": true } }
```

El valor tiene que ser el booleano `true` (no el texto `"true"`). Para quitar a alguien, borra su llave: si tenía el tablero abierto, se le cierra en ese momento. No hace falta desplegar nada. (Solo el dueño puede editar esta lista; los demás no pueden ni leerla completa.)

> **Recomendado:** en Firebase → Authentication → Settings → *SMS region policy*, permite solo Colombia. El filtro de números vive en la app; esa política es la que impide del lado de Firebase que alguien use la API para mandar SMS (cobrados al proyecto) a otros países.

## Stack

- **Astro** — estructura por componentes, build estático, assets optimizados.
- **JS + Firebase Realtime Database** — la lógica del tablero vive en `src/scripts/app.js`; las tareas se sincronizan en tiempo real por RTDB (nodo `tasks`).
- **Auth** — tablero: teléfono con lista de números autorizados (`src/scripts/gate.js`); radar: Google / teléfono del dueño (`src/scripts/auth.js`). `database.rules.json` repite las comprobaciones del lado servidor.
- **PWA** — `public/manifest.webmanifest` + `public/service-worker.js` (caché en tiempo de ejecución).
- **Firebase Hosting** — hosting estático gratuito con HTTPS y CDN.

## Estructura

```
public/            # assets servidos tal cual (manifest, service worker, íconos)
src/
  layouts/         # AppLayout.astro (head, PWA, tema)
  components/      # TopBar, Hero, Dashboard, BoardControls, Board, Column, TaskDialog
  pages/           # index.astro
  scripts/         # app.js (lógica del tablero)
  styles/          # global.css
astro.config.mjs
firebase.json      # config de Firebase Hosting (public: dist)
.firebaserc        # id del proyecto de Firebase
```

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:4321
```

Otros comandos:

```bash
npm run build      # genera dist/
npm run preview    # sirve el build de producción
```

## Despliegue (Firebase Hosting)

Requiere haber iniciado sesión y seleccionado un proyecto de Firebase una sola vez:

```bash
npx -y firebase-tools login
npx -y firebase-tools use --add    # elige tu proyecto y ponlo como "default"
```

Luego, para publicar:

```bash
npm run deploy     # = astro build && firebase deploy --only hosting,database (hosting + reglas)
```

## Evolución recomendada

Para sincronización entre dispositivos y login real, añadir **Supabase** (Auth + Postgres con Row Level Security) manteniendo Firebase Hosting para el frontend. Esto permitirá después roles, proyectos, entregables y una conexión segura con Notion.
