// Revisión de entrega: un fallo temporal del proveedor push no debe consumir el aviso.
// PostgreSQL local y red simulada; no se envían códigos ni avisos reales.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createECDH,randomBytes} from 'node:crypto';
import webpush from 'web-push';
import {entornoSocial,ids,sesiones} from './social-entorno.mjs';
import {avisarCodigos,cifrarCodigo} from '../build/plataforma/codigos.js';

test('revisión: el siguiente envío reintenta un aviso manual si el proveedor push respondió 503',async t=>{
 const e=await entornoSocial();t.after(()=>e.cerrar());
 const sql=async(q,a)=>{const c=await e.pool.connect();try{return await c.query(q,a);}finally{c.release();}};
 await sql("SELECT set_config('ritmo.plataforma_admin',$1,false)",[ids.admin]);
 for(const nombre of ['20261030180000_panel_plataforma.sql','20261030190000_codigos_manuales.sql']){
  await sql(await readFile(new URL('../../supabase/migrations/'+nombre,import.meta.url),'utf8'));
 }
 const a=await e.solicitudes.crear('whatsapp','525511111111','red-prueba-local');
 await sql("UPDATE ritmo.acceso_solicitudes SET estado='manual' WHERE id=$1",[a.id]);
 await sql("INSERT INTO ritmo.codigos_manuales(solicitud_id,cifrado,motivo,vence_en) VALUES($1,$2,'desconectado',now()+interval '10 minutes')",[a.id,cifrarCodigo(e.key,{telefono:'525511111111',codigo:'482913'})]);
 const claves=webpush.generateVAPIDKeys(),ecdh=createECDH('prime256v1');ecdh.generateKeys();
 const sub={endpoint:'https://web.push.apple.com/prueba-reintento-local',keys:{p256dh:ecdh.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}};
 await sql("INSERT INTO ritmo.push_suscripciones(usuario_id,sesion_id,ambito,negocio_id,endpoint,suscripcion) VALUES($1,$2,'negocio',$3,$4,$5)",[ids.admin,sesiones.admin,ids.salon,sub.endpoint,JSON.stringify(sub)]);
 let llamadas=0;
 const push={origen:'https://agendappx.test',publica:claves.publicKey,privada:claves.privateKey,fetch:async()=>new Response(null,{status:++llamadas===1?503:201})};
 assert.deepEqual(await avisarCodigos(e.poolAPI,push),{codigos:1,enviados:0});
 // Representa la siguiente ejecución de la tarea que debe volver a enviar lo pendiente.
 const reintento=await avisarCodigos(e.poolAPI,push);
 assert.equal(reintento.enviados,1,'El aviso se perdió después del 503: la tarea siguiente debe volver a enviarlo.');
 assert.equal(llamadas,2);
});
