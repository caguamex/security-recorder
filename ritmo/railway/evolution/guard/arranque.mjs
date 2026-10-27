import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { CustodioSesion } from './sesion.mjs';

if(process.env.AGENDAPPX_ACTIVAR_EVO!=='true')throw new Error('El proveedor permanece apagado hasta autorizar su despliegue.');
let u;try{u=new URL(process.env.DATABASE_CONNECTION_URI||'');}catch{throw new Error('Configura la dirección privada de la base sin compartirla en los logs.');}
const usuario=decodeURIComponent(u.username);
if(!['postgres:','postgresql:'].includes(u.protocol)||u.searchParams.get('schema')!=='agendappx_evolution'||
  !/^agendappx_evolution(?:\.zkqwephmuflbuagevvxj)?$/.test(usuario)||
  !((u.hostname==='db.zkqwephmuflbuagevvxj.supabase.co'&&usuario==='agendappx_evolution')||(u.hostname.endsWith('.pooler.supabase.com')&&usuario==='agendappx_evolution.zkqwephmuflbuagevvxj'))||
  u.searchParams.get('sslmode')!=='require'||u.searchParams.get('sslaccept')!=='strict'||
  !process.env.AUTHENTICATION_API_KEY||process.env.AUTHENTICATION_API_KEY.length<32) {
  throw new Error('Configura exclusivamente el rol y esquema de Agendappx con TLS verificado.');
}
const baileys=JSON.parse(await readFile('/evolution/node_modules/baileys/package.json','utf8'));
if(baileys.version!=='7.0.0-rc13')throw new Error('La dependencia no coincide con la compilación corregida revisada.');
for(const [k,v] of Object.entries({DATABASE_PROVIDER:'postgresql',DATABASE_ENABLED:'true',
  DATABASE_SAVE_DATA_INSTANCE:'true',DEL_INSTANCE:'false',CACHE_REDIS_SAVE_INSTANCES:'false',
  CACHE_REDIS_ENABLED:'false',CACHE_LOCAL_ENABLED:'true',SERVER_DISABLE_MANAGER:'true',SERVER_DISABLE_DOCS:'true',
  AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES:'false',DATABASE_SAVE_DATA_NEW_MESSAGE:'false',
  DATABASE_SAVE_MESSAGE_UPDATE:'false',DATABASE_SAVE_DATA_CONTACTS:'false',DATABASE_SAVE_DATA_CHATS:'false',
  DATABASE_SAVE_DATA_HISTORIC:'false',DATABASE_SAVE_DATA_LABELS:'false',LOG_LEVEL:'ERROR,WARN',
  TELEMETRY_ENABLED:'false',SERVER_TYPE:'http',SERVER_PORT:process.env.PORT||'8080'}))process.env[k]=v;
const limpio=new URL(u);
for(const k of ['schema','sslmode','sslaccept','connection_limit','pgbouncer'])limpio.searchParams.delete(k);
const pool=new pg.Pool({connectionString:limpio.href,max:1,connectionTimeoutMillis:8000,
  query_timeout:8000,ssl:{rejectUnauthorized:true},application_name:'agendappx_custodio'});
const custodio=new CustodioSesion(pool,{propietario:randomUUID(),despliegue:process.env.RAILWAY_DEPLOYMENT_ID||'local'});
let hijo=null,deteniendo=false,pulso,latidoEnCurso=Promise.resolve(),motivo='normal';
async function detener(razon) {
  if(deteniendo)return;deteniendo=true;motivo=razon;clearTimeout(pulso);
  if(hijo&&hijo.exitCode===null) {
    const terminado=once(hijo,'exit');hijo.kill('SIGTERM');
    const limite=setTimeout(()=>{hijo?.kill('SIGKILL');},25000);limite.unref();
    await terminado.catch(()=>{});clearTimeout(limite);
  }
}
async function latir() {
  if(deteniendo)return;
  latidoEnCurso=(async()=>{
    try{if(!await custodio.renovar())await detener('relevo');}
    catch{await detener('base_no_disponible');}
  })();
  await latidoEnCurso;if(!deteniendo)pulso=setTimeout(latir,5000);
}
process.on('SIGTERM',()=>{void detener('senal');});process.on('SIGINT',()=>{void detener('senal');});
async function ejecutar(args) {
  if(deteniendo)return 0;
  hijo=spawn(process.execPath,args,{cwd:'/evolution',env:process.env,stdio:['ignore','pipe','pipe']});
  // No trasladar cuerpos de mensajes, teléfonos, códigos o claves de librerías a los logs.
  hijo.stdout.resume();let aviso=false;
  hijo.stderr.on('data',()=>{if(!aviso){aviso=true;console.error('El proceso emitió un diagnóstico; consulta su estado antes de reintentar.');}});
  const [codigo]=await once(hijo,'exit');hijo=null;return codigo;
}
try {
  await custodio.preparar();const inicio=Date.now();
  while(!deteniendo&&!await custodio.adquirir()) {
    if(Date.now()-inicio>150000)throw new Error('Hay otro motor activo. No se abrirá una conexión duplicada.');
    await new Promise(r=>setTimeout(r,1000));
  }
  if(!deteniendo){
    pulso=setTimeout(latir,5000);
    // Solo este esquema privado recibe las migraciones del proveedor; nunca el esquema ritmo.
    const migrado=await ejecutar(['runWithProvider.js','npx prisma migrate deploy --schema ./prisma/DATABASE_PROVIDER-schema.prisma']);
    if(migrado!==0&&!deteniendo)throw new Error('El esquema del proveedor no quedó listo.');
    if(!deteniendo) {const codigo=await ejecutar(['--network-family-autoselection-attempt-timeout=1000','dist/main.js']);if(codigo!==0&&!deteniendo)throw new Error('El motor necesita reiniciarse.');}
  }
} catch { await detener('fallo');process.exitCode=1; }
finally {
  clearTimeout(pulso);await latidoEnCurso.catch(()=>{});
  await custodio.liberar().catch(()=>{});await pool.end();
  if(['relevo','senal'].includes(motivo))process.exitCode=0;
}
