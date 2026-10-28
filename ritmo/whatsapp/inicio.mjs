import pg from 'pg';
import {operacionCodigos} from './operacion-codigos.mjs';
import {BasePlataforma} from './plataforma.mjs';
import {CodigosWhatsApp} from './codigos.mjs';
import {configurar} from './config.mjs';
import {BaileysSoloEnvios} from './baileys.mjs';
import {VerificadorJWT} from '../servidor/build/cuentas/jwt.js';
import {crearAplicacion,verificarRol} from './servicio.mjs';
let pool,app,operacion;
try{
 const config=configurar(process.env);
 pool=new pg.Pool({connectionString:config.db,ssl:config.ssl,max:2,idleTimeoutMillis:30000,connectionTimeoutMillis:10000,query_timeout:15000,application_name:'agendappx_whatsapp'});
 pool.on('error',()=>console.warn('WhatsApp: conexión de datos pendiente.'));
 await verificarRol(pool);
 const remitente=new BaileysSoloEnvios(new (await import('../servidor/build/whatsapp-vinculado/db.js')).BaseWhatsApp(pool),config.key,{vincular:config.politica.vincular});
 const basePlataforma=new BasePlataforma(pool);
 const plataforma=(config.codigos.habilitado||config.codigos.vincular)?new BaileysSoloEnvios(basePlataforma,config.key,{vincular:config.codigos.vincular}):undefined;
 const codigos=plataforma?new CodigosWhatsApp(basePlataforma,plataforma,config.codigos):undefined;
 app=crearAplicacion({pool,remitente,codigos,plataforma,jwt:new VerificadorJWT(config.supabase),config});
 operacion=plataforma?operacionCodigos(plataforma,basePlataforma,{vincular:config.codigos.vincular,key:process.env.WA_CODIGOS_OPERACION_KEY}):null;
 app.server.listen(config.port,'0.0.0.0',()=>{console.log('Agendappx: servicio de solo envíos listo.');app.iniciar();});
 let cerrando=false;const salir=async()=>{if(cerrando)return;cerrando=true;operacion?.close();await app.cerrar();await pool.end();};
 process.on('SIGTERM',()=>void salir());process.on('SIGINT',()=>void salir());
}catch{operacion?.close();console.error('No se inició WhatsApp. Revisa autorizaciones, conexión cifrada y permisos mínimos.');await pool?.end();process.exitCode=1;}
