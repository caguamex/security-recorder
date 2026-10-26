import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { VerificadorJWT } from '../build/cuentas/jwt.js';
const origen='https://proyecto-local.supabase.co';
const usuario='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const sesion='11111111-1111-4111-8111-111111111111';
const ahora=new Date('2026-10-26T18:00:00Z');
const iat=ahora.getTime()/1000;
let ec,rsa,keys;
before(async()=>{
  ec=await generateKeyPair('ES256',{extractable:true});rsa=await generateKeyPair('RS256',{extractable:true});
  keys=[{...await exportJWK(ec.publicKey),kid:'ec',alg:'ES256',use:'sig'},
    {...await exportJWK(rsa.publicKey),kid:'rsa',alg:'RS256',use:'sig'}];
});
function verificador(){
  let llamadas=0;
  const v=new VerificadorJWT(origen,{ahora:()=>ahora,fetch:async(url,opciones)=>{
    llamadas++; assert.equal(url,origen+'/auth/v1/.well-known/jwks.json');assert.equal(opciones.redirect,'manual');
    return new Response(JSON.stringify({keys}),{status:200,headers:{'Content-Type':'application/json'}});
  }});
  return {v,llamadas:()=>llamadas};
}
async function firmar(cambios={},cabecera={alg:'ES256',kid:'ec'},clave=ec.privateKey){
  return new SignJWT({sub:usuario,session_id:sesion,role:'authenticated',aal:'aal1',is_anonymous:false,
    iss:origen+'/auth/v1',aud:'authenticated',iat,exp:iat+3600,...cambios}).setProtectedHeader(cabecera).sign(clave);
}
const rechaza=p=>assert.rejects(p,e=>e.status===401);

test('JWT: verifica ES256 y RS256, conserva el nivel firmado y cachea las llaves',async()=>{
  const {v,llamadas}=verificador();
  assert.deepEqual(await v.verificar(await firmar()),{usuarioId:usuario,sesionId:sesion,aal:'aal1'});
  assert.equal((await v.verificar(await firmar({aal:'aal2'},{alg:'RS256',kid:'rsa'},rsa.privateKey))).aal,'aal2');
  assert.equal(llamadas(),1);
});
test('JWT: rechaza payload alterado y firma de otra llave aunque coincida kid',async()=>{
  const {v}=verificador(),t=await firmar();
  const partes=t.split('.');partes[1]=Buffer.from(JSON.stringify({sub:usuario,role:'admin',aal:'aal2'})).toString('base64url');
  await rechaza(v.verificar(partes.join('.')));
  const falsa=await generateKeyPair('ES256');
  await rechaza(v.verificar(await firmar({},{alg:'ES256',kid:'ec'},falsa.privateKey)));
});
test('JWT: rechaza vencidos, vigencias mayores a una hora, emisor y audiencia ajenos',async()=>{
  const {v}=verificador();
  for(const cambios of [{iat:iat-3700,exp:iat-100},{exp:iat+7200},{iss:'https://otro.supabase.co/auth/v1'},
    {aud:'service_role'},{iat:iat+120,exp:iat+3600},{exp:undefined},{session_id:undefined},{sub:'otra-persona'}]){
    await rechaza(v.verificar(await firmar(cambios)));
  }
});
test('JWT: no acepta claves API, usuarios anónimos, nivel MFA inventado ni confía en metadatos editables',async()=>{
  const {v}=verificador();
  for(const cambios of [{role:'service_role'},{is_anonymous:true},{aal:'admin'},{session_id:'cualquier-cosa'}]){
    await rechaza(v.verificar(await firmar(cambios)));
  }
  const r=await v.verificar(await firmar({user_metadata:{rol:'admin',aal:'aal2',negocio:'otro'}}));
  assert.deepEqual(r,{usuarioId:usuario,sesionId:sesion,aal:'aal1'});
});
test('JWT: ignora URL de llaves en cabecera y no vuelve a consultar por cada kid inventado',async()=>{
  const {v,llamadas}=verificador();
  await v.verificar(await firmar({},{alg:'ES256',kid:'ec',jku:'https://atacante.invalid/llaves'}));
  for(let n=0;n<4;n++) await rechaza(v.verificar(await firmar({},{alg:'ES256',kid:'inexistente-'+n})));
  assert.equal(llamadas(),1);
});
test('JWT: descarta algoritmos sin firma y HMAC, tokens malformados y enormes antes de consultar llaves',async()=>{
  const {v,llamadas}=verificador();
  const inseguro=alg=>Buffer.from(JSON.stringify({alg,kid:'ec'})).toString('base64url')+'.'+Buffer.from('{}').toString('base64url')+'.';
  for(const t of [inseguro('none'),inseguro('HS256'),'incorrecto','x'.repeat(17000)]) await rechaza(v.verificar(t));
  assert.equal(llamadas(),0);
  assert.throws(()=>new VerificadorJWT('http://inseguro.invalid'));
  assert.throws(()=>new VerificadorJWT(origen+'/ruta'));
});
