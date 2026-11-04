---
name: ritmo-confirmar-deploy
description: "Preparar y verificar cambios de Ritmo Belleza y solicitar confirmación de Antonio antes de publicarlos en la página. Aplicar al modificar la aplicación o preparar un despliegue de caguamex/security-recorder; no afecta otros proyectos."
---

# Confirmar la publicación de Ritmo Belleza

Instrucción de Antonio del 26 de octubre de 2026: después de generar cambios, preguntar si quiere hacer deploy para subirlos a la página. Esta regla sustituye las autorizaciones generales anteriores de publicación automática o autonomía para cambios futuros de Ritmo.

## Preparar antes de preguntar

Completar la implementación autorizada, ejecutar las verificaciones pertinentes, regenerar los archivos publicados cuando corresponda y mostrar el resultado revisable. Conservar los datos del salón y no dejar registros de prueba activos. No detener el trabajo en una propuesta sin implementar para pedir permiso de publicación.

Guardar código en GitHub y publicar la página son acciones distintas. El destino actual es Cloudflare Workers, con Supabase para los datos; consultar `ritmo/docs/CLOUDFLARE.md` en el repositorio. Las claves se mantienen fuera de Git. Antes de un push autorizado, comprobar si hay un mecanismo que publique al subirlo; si existe, esa acción también requiere autorización de despliegue. No habilitar despliegues automáticos para eludir la pregunta.

## Preguntar al terminar

**Solicitar confirmación de Antonio antes de publicar cada conjunto nuevo de cambios en la página.** Presentar brevemente qué cambió, qué se verificó y el destino. Preguntar, por ejemplo: «Los cambios están listos y verificados. ¿Quieres que los publique ahora en Ritmo Belleza?».

Explicar que la confirmación procede de esta instrucción de Antonio. Cuando la skill motive la pregunta, enlazar el `SKILL.md` leído y citar la regla destacada anterior. Mantener la explicación breve.

Esperar una respuesta explícita. «Hazlo» al aprobar una función autoriza implementarla; no equivale por sí solo a publicar. Una respuesta afirmativa a la pregunta de deploy, o una instrucción inequívoca como «publica estos cambios», autoriza ese conjunto y destino: no pedir la misma confirmación otra vez. Si se añaden cambios fuera del conjunto aprobado, solicitar aprobación para el nuevo conjunto. Las aprobaciones de despliegues anteriores no se trasladan automáticamente a cambios nuevos.

Si Antonio dice que no o lo deja pendiente, conservar el trabajo y señalar que la página mantiene su versión publicada. No ejecutar Wrangler deploy, una promoción, una acción de CI ni otra operación que actualice el sitio. No afirmar que está publicado hasta verificarlo.

La confirmación técnica no autoriza gastos: respetar `cost-authorization` y las autorizaciones concretas vigentes, sin activar planes o recursos facturables nuevos.

## Después de la aprobación

Publicar únicamente el alcance aprobado y comprobar que la URL responde y que el cambio funciona. Informar la dirección y cualquier pendiente real. Cerrar y volver a abrir la página puede ser necesario para que una pestaña con caché anterior muestre la actualización; conservar los datos y cambios pendientes del dispositivo.

No se necesita deploy al capturar citas, servicios o fotos desde la app. Una consulta sin cambios, o editar únicamente esta skill y documentos internos que no se publican, tampoco requiere proponer un despliegue.
