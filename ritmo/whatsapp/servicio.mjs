import {createServer} from 'node:http';
import {BaseWhatsApp} from '../servidor/build/whatsapp-vinculado/db.js';
import {Mensajero} from '../servidor/build/whatsapp-vinculado/cola.js';
import {ControlWhatsApp,rutasSoloEnvios} from '../servidor/build/whatsapp-vinculado/api.js';
export async function verificarRol(pool){const c=await pool.connect();try{
 const f=(await c.query(`SELECT current_user AS usuario,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolreplication,
 has_table_privilege(current_user,'ritmo.belleza_objetos','INSERT') AS inserta,
 has_table_privilege(current_user,'ritmo.belleza_objetos','UPDATE') AS actualiza,
 has_table_privilege(current_user,'ritmo.belleza_objetos','DELETE') AS borra
 FROM pg_roles WHERE rolname=current_user`)).rows[0];
 if(!f||f.usuario!=='agendappx_whatsapp'||['rolsuper','rolbypassrls','rolcreaterole','rolcreatedb','rolreplication','inserta','actualiza','borra'].some(k=>f[k]))throw new Error('Permisos excesivos: el proceso no arrancó.');
 }finally{c.release();}}
export function crearAplicacion({pool,remitente,jwt,config,ahora,dormir,azar}){
 const db=new BaseWhatsApp(pool,ahora),cola=new Mensajero(db,remitente,config.politica,dormir,azar);
 const control=new ControlWhatsApp(db,remitente,cola,config.politica,config.salones),rutas=rutasSoloEnvios(control,jwt,config.origen);
 const server=createServer(async(req,res)=>{try{
 const u=new URL(req.url||'/','http://localhost');
 if(u.pathname==='/salud'&&req.method==='GET'){await db.usar(c=>c.query('SELECT 1'));res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end('{"estado":"listo"}');return;}
 if(await rutas(req,res,u))return;
 res.writeHead(404,{'Content-Type':'application/json','Cache-Control':'no-store'}).end('{"error":"Ruta no encontrada."}');
 }catch(e){const status=Number(e?.status);res.writeHead([400,401,403,404,405,409,413,415,429,503].includes(status)?status:503,{'Content-Type':'application/json','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}).end(JSON.stringify({error:[400,401,403,404,405,409,413,415,429].includes(status)?e.message:'No se pudo completar la operación. La sesión se conserva.'}));}});
 server.requestTimeout=30000;server.headersTimeout=10000;server.maxHeadersCount=40;
 const activos=new Map();let cerrado=false,timer;
 async function paso(n){if(cerrado||activos.has(n))return;const p=(async()=>{try{
 await remitente.recuperar(n);await cola.reconciliar(n);
 // Una sola tarea por salón. Las pausas ya están reservadas en PostgreSQL antes de la red.
 for(let i=0;i<30&&!cerrado;i++){if(!await cola.enviarUno(n))break;
 const f=await db.usar(async c=>(await c.query('SELECT proximo_envio FROM ritmo.whatsapp_conexiones WHERE negocio_id=$1',[n])).rows[0]);
 const ms=new Date(f?.proximo_envio||0).getTime()-db.ahora();if(ms>0)await new Promise(r=>{const t=setTimeout(r,Math.min(60000,ms));t.unref?.();});
 }
 }catch{console.warn('WhatsApp: operación pospuesta; no se borró la sesión.');}})().finally(()=>activos.delete(n));activos.set(n,p);return p;}
 function iniciar(){if(timer)return;for(const n of config.salones)void paso(n);timer=setInterval(()=>{for(const n of config.salones)void paso(n);},60000);timer.unref?.();}
 async function cerrar(){cerrado=true;clearInterval(timer);await remitente.cerrar?.();await new Promise(resolve=>server.close(resolve));await Promise.race([Promise.allSettled([...activos.values()]),new Promise(r=>{const t=setTimeout(r,5000);t.unref?.();})]);}
 return {server,db,cola,control,iniciar,cerrar};
}
