# Focusboard

Tablero personal de tareas, diseñado para trabajo operativo y estudio. Es una **PWA** (instalable) construida con **[Astro](https://astro.build/)** y desplegada en **Firebase Hosting**. Las tareas se mueven entre columnas arrastrándolas; en móvil, con un gesto de arrastre.

**Acceso privado:** el tablero y el radar de empleo (`/empleo`) están detrás del mismo login (cuenta de Google autorizada o teléfono). Las tareas se guardan en **Firebase Realtime Database** bajo el nodo `tasks`, protegido del lado servidor por `database.rules.json` — sin la sesión autorizada, Firebase deniega la lectura y la escritura. (Antes `tasks` estaba abierto a todo internet; ya no.)

## Stack

- **Astro** — estructura por componentes, build estático, assets optimizados.
- **JS + Firebase Realtime Database** — la lógica del tablero vive en `src/scripts/app.js`; las tareas se sincronizan en tiempo real por RTDB (nodo `tasks`).
- **Auth** — Google / teléfono (`src/scripts/auth.js` + `src/scripts/gate.js`); `database.rules.json` repite la comprobación del lado servidor.
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
npm run deploy     # = astro build && firebase deploy --only hosting
```

## Evolución recomendada

Para sincronización entre dispositivos y login real, añadir **Supabase** (Auth + Postgres con Row Level Security) manteniendo Firebase Hosting para el frontend. Esto permitirá después roles, proyectos, entregables y una conexión segura con Notion.
