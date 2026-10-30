// Auth simulado fiel al rechazo real: cuenta preparada pero teléfono sin confirmar, altas cerradas.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {entornoLogin,ids,sesiones} from './login-whatsapp-entorno.mjs';
import {rutasAcceso} from '../build/cuentas/acceso.js';
const origen='https://agendappx.test',destino='525511111111';
async function entorno(t,{registro=true,otpError='signup_disabled',otpStatus=422,incierto=false,resendStatus=200}={}){
 const e=await entornoLogin();t.after(()=>e.cerrar());const llamadas=[];
 const config={registro,habilitado:true,correo:true,key:e.key,origen,supabaseURL:'https://zkqwephmuflbuagevvxj.supabase.co',llavePublica:'sb_publishable_solo_prueba',salones:new Set([ids.salon]),ip:()=> 'ip-local',fetch:async(url,init)=>{
  const path=new URL(url).pathname,d=JSON.parse(init.body);llamadas.push({path,d});
  if(path.endsWith('/otp')||path.endsWith('/user')){if(incierto)throw new Error('Respuesta perdida');return Response.json({code:otpStatus,error_code:otpError},{status:otpStatus});}
  if(path.endsWith('/resend')){
   assert.deepEqual(d,{type:'sms',phone:'+'+destino});
   if(resendStatus!==200)return Response.json({code:resendStatus,error_code:'over_sms_send_rate_limit'},{status:resendStatus});
   const v=e.evento(destino,'482913');await e.codigos.entregar(v.raw,v.headers);return Response.json({});
  }
  throw new Error('Ruta inesperada');
 }};
 const rutas=rutasAcceso(e.poolAPI,{verificar:async()=>({usuarioId:ids.admin,sesionId:sesiones.admin,aal:'aal2'})},config);
 const pedir=async(datos={canal:'whatsapp',destino})=>{
  const req=Readable.from([Buffer.from(JSON.stringify(datos))]);req.method='POST';req.headers={origin:origen,'content-type':'application/json'};
  let status,body;const res={writeHead(s){status=s;return this;},end(b){body=JSON.parse(b);}};
  await rutas(req,res,new URL(origen+'/api/acceso/solicitar'));return {status,body};
 };
 return {...e,llamadas,pedir};
}
test('cuenta preparada: confirma por resend tras signup_disabled, mismo ticket y un único envío',async t=>{
 const e=await entorno(t),r=await e.pedir();assert.equal(r.status,200);
 assert.deepEqual(e.llamadas.map(x=>x.path),['/auth/v1/otp','/auth/v1/resend']);
 assert.equal(e.llamadas[0].d.create_user,false);assert.equal(e.envios.length,1);
 const filas=await e.solicitudes.usar(c=>c.query('SELECT id,estado,usuario_id,codigo_hash FROM ritmo.acceso_solicitudes'));
 assert.equal(filas.rows.length,1);assert.equal(filas.rows[0].id,r.body.id);assert.equal(filas.rows[0].estado,'enviado');assert.equal(filas.rows[0].usuario_id,ids.admin);
 await e.solicitudes.intento(r.body.id,r.body.prueba,'482913');
});
test('confirmación: no reintenta resultados inciertos, bloqueos ni errores de cuentas inexistentes',async t=>{
 for(const opciones of [{incierto:true},{otpError:'over_sms_send_rate_limit',otpStatus:429},{otpError:'otp_disabled'},{otpError:'signup_disabled',otpStatus:500}]){
  await t.test(JSON.stringify(opciones),async sub=>{const e=await entorno(sub,opciones);try{await e.pedir();}catch{}assert.equal(e.llamadas.length,1);assert.equal(e.envios.length,0);});
 }
});
test('confirmación: no usa resend para correo, phone_change ni registro deshabilitado',async t=>{
 for(const modo of ['correo','vincular','cerrado'])await t.test(modo,async sub=>{
  const e=await entorno(sub,{registro:modo!=='cerrado'});const datos=modo==='correo'?{canal:'correo',destino:'prueba@example.test'}:{canal:'whatsapp',destino,...(modo==='vincular'?{vincular:true}:{})};
  const r=await e.pedir(datos);assert.equal(r.status,200);assert.equal(e.llamadas.length,1);assert.equal(e.envios.length,0);
 });
});
test('confirmación: un fallo de resend queda fallido y no oculta el límite de Supabase',async t=>{
 const e=await entorno(t,{resendStatus:429});await assert.rejects(()=>e.pedir(),x=>x.status===429);
 assert.equal(e.llamadas.length,2);assert.equal(e.envios.length,0);
 assert.equal((await e.solicitudes.usar(c=>c.query('SELECT estado FROM ritmo.acceso_solicitudes'))).rows[0].estado,'fallido');
});
