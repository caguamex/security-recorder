# Liquid Glass y colores por clienta · 1 de noviembre de 2026

Antonio aprobó trasladar la vista Liquid Glass White/Black a la app real y corrigió expresamente que los colores de agenda son **por clienta**, no por especialista. Rama `codex/agendappx-liquid-glass-app`, desde `6e0645e` del PR #24. Revisión: [PR #25](https://github.com/caguamex/security-recorder/pull/25), implementación `c6395e2`. Antonio confirmó la publicación de este conjunto. **Publicado y comprobado**, versión final `191c09ee-040a-4795-98a2-9d47032f7089` con `--keep-vars`.

## Resultado

- Material común `belleza/estilo-liquid-glass.css`: White claro, Black grafito, superficies translúcidas, bordes de vidrio y sombras discretas, sin perspectiva ni relieve 3D. Conserva la composición, navegación, controles de horarios de 24 h y preferencias existentes.
- Se carga en negocio, Comunidad/perfiles/clientas, registro/acceso, panel del dueño, planes y recuperación. Las ventanas de captura son casi opacas para que la agenda detrás no interfiera con la lectura. Alternativas sólidas para reducir transparencia o navegadores sin soporte; movimiento reducido conservado.
- La barra mantiene Hoy · Agenda · ＋ · Clientas · Negocio. Los filtros de especialistas son neutros. White/Dark sigue en Apariencia; los temas opcionales matizan solo el fondo White, sin reasignar el color de las citas.
- `colores-clientas.js` obtiene el acento del ID de la clienta. No depende del servicio, especialista, nombre, orden, fecha, red o números aleatorios. La misma identidad sincronizada produce el mismo tono en otros dispositivos. No se guarda ningún campo nuevo ni se cambia la base.
- El acento se usa en Agenda, Clientas, el detalle, las visitas y las filas de citas de Hoy. Estados como Confirmada y Cancelada siguen escritos y conservan sus señales. Servicios y promociones mantienen sus colores propios fuera de la agenda.
- La paleta es finita: distintas clientas pueden compartir tono; no es un identificador exclusivo. Citas antiguas sin ID válido reciben un neutro, sin intentar identificar a la persona por su teléfono o nombre.
- Empaquetado HTML y PWA regenerado desde fuentes; los dos recursos nuevos entran en la caché versionada por contenido. No se alteran las reglas de actualización ni la cola de sincronización.

## Verificación local

- `npm test`: **289/289**, sin omisiones. La primera ejecución sin acceso a conexiones localhost falló por EACCES; la ejecución con permisos de prueba pasó completa. No se cambió código de permisos para conseguirlo.
- `colores-clientas.test.mjs`: determinismo entre contextos, ID ausente y contraste de iniciales blancas de al menos 4.5:1. Reejecutada tras ajustar dos tonos para alcanzar ese contraste.
- `liquid-glass-navegador.mjs`: Edge y WebKit, White/Black; 320/390/768/1440 px, mismo color para una clienta con distintos servicios/especialistas, distinto acento en las clientas de la muestra con el mismo servicio, filtros, citas simultáneas lado a lado, avatares y Hoy, recarga/sin conexión, citas/clientas/servicios/pendientes intactos. Cápsula con ＋ dentro, Nueva cita con fotos y sin `input type=time`, superficies compartidas y transparencia reducida. Cero errores JavaScript y cero peticiones externas.
- Recorridos existentes de contraseñas/registro/equipo, fotos (incluida sincronización entre dos dispositivos y recarga sin internet), Social con PostgreSQL local y actualización del dueño con cliente controlado por SW anterior en Edge/WebKit: aprobados.
- `diseno-navegador.mjs`: temas opcionales, White/Dark, navegación, apertura de Nueva cita, recarga y sincronización de apariencia comprobados.
- Compilación de Cloudflare con `--dry-run`: aprobada (91 recursos). Solo preparación local, sin publicación.
- Capturas a 390 px en `imagenes/liquid-glass/`. Solo muestran datos ficticios locales. No representan salones registrados ni cifras reales de la plataforma.

## Publicación comprobada

Antonio confirmó «sí, publícalo, que no se pase ninguna página, hoja con este tema». Worker existente `ritmo-belleza`, versión final **191c09ee-040a-4795-98a2-9d47032f7089**, conservando variables con `--keep-vars`. Destino: https://ritmo-belleza.antonio-t-22.workers.dev/.

Antes de publicar se enumeraron los cinco HTML de producción (agenda, Comunidad, panel, planes y recuperación): todos cargan el material compartido; los enlaces CSS resuelven y los recursos nuevos están en el precache. Los perfiles por slug usan Comunidad y las hojas heredan el tema. No se publican los prototipos como sustituto de la aplicación.

La comprobación pública compara **16 archivos byte por byte** contra el paquete; revisa seis entradas (incluidos login y registro) en **Edge y WebKit, White/Black, 390 px**, sin desbordamiento ni errores JavaScript. Salud200, API de panel sin sesión401 y WhatsApp de acceso habilitado. No se envían formularios ni códigos: cero escrituras de aplicación; las lecturas públicas y las validaciones antibots de Cloudflare se distinguen expresamente. El borde sobrante de registro se corrigió y se exige ancho de borde0 en ambos motores. Evidencia en `LIQUID-GLASS-PUBLICACION.json`; capturas en `imagenes/liquid-glass/publicado/`.

No se migraron datos, modificaron cuentas o configuraciones de Auth, vincularon números ni cambiaron recursos, servicios o costos. Railway y FiNeCi no se tocaron. Las comprobaciones de pantallas privadas con datos se hicieron localmente; no se usa la cuenta real de Antonio para probar. Falta la confirmación visual en su iPhone físico.

En pestañas abiertas usar «Actualizar ahora», conservando sesión y pendientes. No limpiar almacenamiento, borrar cuentas ni repetir migraciones para obtener el tema nuevo. No hay publicación automática al subir Git; cambios futuros requieren su confirmación específica.
