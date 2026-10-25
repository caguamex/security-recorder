# Ritmo — tu agenda en español

Escribe como hablas («Dentista mañana 5pm») y Ritmo lo acomoda.

![Ritmo](imagenes/tienda-1.png)

## Qué hay aquí

| Carpeta | Contenido |
|---|---|
| `prototipo/` | App web funcional (sin dependencias): `index.html`, `core.js`, `parser.js`, `app.js` |
| `dist/ritmo.html` | La misma app en un solo archivo: ábrelo con doble clic |
| `imagenes/` | Capturas de la app, imágenes de tienda, ícono 1024 y gráfico de Google Play |
| `docs/PROMPTS.md` | Prompts listos para construir la app nativa por fases y para diseño e imágenes |
| `docs/PLAN.md` | Logística: fases, costos, stack, lo que se necesita de ti, tienda y privacidad |
| `docs/ESPECIFICACION.md` | Pantallas, modelo de datos, reglas del intérprete y diseño |
| `pruebas/` | Pruebas automáticas del intérprete y del núcleo |
| `herramientas/` | Scripts para empaquetar y regenerar las imágenes |

## Comandos

```bash
node --test ritmo/pruebas/                 # pruebas
node ritmo/herramientas/empaquetar.mjs     # genera dist/ritmo.html
node ritmo/herramientas/capturas.mjs       # regenera imagenes/ (requiere Playwright)
```

## Siguiente paso

Abre Claude Code en este repositorio y pega el prompt 0 de `docs/PROMPTS.md`.
