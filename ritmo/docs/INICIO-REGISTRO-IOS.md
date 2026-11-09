# Inicio público y registro iOS — 30 de octubre de 2026

Encargo vigente de Antonio: el modelo `ios/inicio.html` sustituye la bienvenida anterior. Referencia de Claude consultada: d8a9e27c650ff0732a209c2e323ad19fce18a5f8. Fuente `ios/inicio.html` blob 877328a2c70b587fb0864cc7ec79a3e6a9b5940a. Conservar las correcciones ya publicadas de 24 h, carrusel en Nueva cita, Apariencia y Agenda.

## Vista previa primero

Rama `codex/agendappx-bienvenida-registro-ios`, desde 3105f52 de la etapa 4 y la reparación de Safari. Vista separada `vista-neutro-ios/`, sin acceso a datos reales, sin service worker, códigos, API o contratos. La entrada predeterminada muestra publicaciones de AB’ Beauty Room con sus fotos proporcionadas por Antonio. Búsqueda por nombre/categoría normalizada, local y trabajos, reserva ilustrativa, registro en tres pasos, lista inicial y barra A con cuatro acciones. Los datos de formularios de la propuesta viven solo en memoria. Tema en la clave exclusiva de la vista.

La barra de visitantes tiene Inicio de 62 px y la invitación a registrar un salón; el perfil directo mantiene esa barra. La barra del negocio tiene cinco posiciones con + de 50 px dentro, sin elevación ni círculo aparte. El menú queda encima y el + gira a ×. La barra de clientas se conserva.

Verificación `node ritmo/herramientas/verificar-inicio-ios.mjs`: once vistas en White y Dark a 390 × 844, cero errores ni solicitudes externas; también 320/768/1440, formularios, búsqueda CEJAS/ceja, reserva, tipo de negocio, tamaños del +, columnas simultáneas y semana lunes–domingo. Capturas en `imagenes/inicio-ios-preview/`, galería incluida. Solo fotos originales, sin Pexels ni personas de producción. No hay teclado, reloj, marco de iPhone ni código de seguridad ficticios del sistema; el teclado numérico lo aporta el dispositivo al enfocar.

## Publicación y siguiente etapa

Antonio pide expresamente actualizar primero `neutro-ios` en GitHub Pages. Destino gratuito existente, repositorio público, fuente `gh-pages`, sin dominio ni recursos nuevos. Se cambia únicamente `neutro-ios/`, conservando el resto del árbol. La app de Cloudflare conserva la versión de reparación e9b7ed9b-5e1f-43b0-a444-b015a8a1daf0 mientras se prepara y revisa el nuevo alcance real.

Después se adaptará la app real al mismo diseño reutilizando el registro publicado, consentimiento, CAPTCHA, OTP y MFA obligatorio para Admin, RLS, aislamiento, fotografías, sincronización y modo sin conexión. No activar envíos/vinculaciones de WhatsApp, no alterar cuentas existentes ni tocar FiNeCi/Railway. No sustituir datos reales por los ejemplos del prototipo. Publicación de la app real requiere la confirmación del nuevo conjunto conforme a la skill de despliegue; no pedir otra para la vista expresamente autorizada.
