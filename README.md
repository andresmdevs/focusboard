# Focusboard

Tablero personal de tareas, diseñado para trabajo operativo y estudio. Es una PWA estática: funciona en móvil y escritorio, puede instalarse y conserva los datos en el navegador aun sin conexión. Las tareas se mueven entre columnas arrastrándolas; en móvil, con un gesto de arrastre.

## Ejecutar localmente

```bash
python3 -m http.server 4173
```

Abrir `http://localhost:4173`.

## Despliegue inicial

Se puede publicar directamente en GitHub Pages porque no requiere un servidor. La primera versión guarda los datos en `localStorage`, por lo que las tareas quedan privadas en cada dispositivo.

## Evolución recomendada

Para sincronización entre dispositivos y un login real, usar Supabase (Auth + Postgres con Row Level Security) y conservar GitHub Pages para el frontend. Esto permitirá después añadir roles, proyectos, entregables y una conexión segura con Notion.
# focusboard
