// Sin SDK ni dependencias remotas. Exclusivo de la función aislada en Supabase.
// Propósitos firmados (la firma incluye el propósito, así que no se pueden intercambiar):
// - alta-whatsapp-v1: prepara un teléfono sin confirmarlo (registro con código).
// - alta-miembro-v1: crea una cuenta del equipo sin WhatsApp, con correo interno y contraseña temporal.
// - contrasena-miembro-v1: da una contraseña temporal nueva SOLO a cuentas internas del equipo.
const correoMiembro=/^miembro-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}@agendappx\.invalid$/;
const temporal=p=>typeof p==='string'&&p.length>=14&&p.length<=72;
export function intermediario({key,url,adminKey,fetch:red=fetch,ahora=Date.now}){
 const respuesta=(status,extra={})=>Response.json(status===200?{preparada:true,...extra}:{error:'No se pudo preparar el registro.'},{status,headers:{'Cache-Control':'no-store'}});
 const admin=(path,metodo,cuerpo)=>red(url+'/auth/v1/admin/'+path,{method:metodo,headers:{apikey:adminKey,Authorization:'Bearer '+adminKey,'Content-Type':'application/json'},...(cuerpo?{body:JSON.stringify(cuerpo)}:{}),signal:AbortSignal.timeout(8000)});
 return async req=>{try{
  if(req.method!=='POST'||new URL(req.url).search||!/^application\/json(?:;|$)/i.test(req.headers.get('content-type')||''))return respuesta(405);
  if(url!=='https://zkqwephmuflbuagevvxj.supabase.co'||!/^[A-Za-z0-9+/]{43}=$/.test(key||'')||!adminKey)return respuesta(503);
  const reader=req.body?.getReader();if(!reader)return respuesta(400);const chunks=[];let size=0;for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1024){await reader.cancel();return respuesta(413);}chunks.push(value);}const raw=new TextDecoder().decode(Uint8Array.from(chunks.flatMap(x=>Array.from(x))));
  const ts=req.headers.get('x-registro-fecha'),firma=req.headers.get('x-registro-firma'),proposito=req.headers.get('x-registro-proposito')||'alta-whatsapp-v1';
  if(!['alta-whatsapp-v1','alta-miembro-v1','contrasena-miembro-v1'].includes(proposito))return respuesta(400);
  if(!/^\d{10}$/.test(ts||'')||Math.abs(ahora()/1000-Number(ts))>60||!/^[a-f0-9]{64}$/.test(firma||''))return respuesta(401);
  const clave=await crypto.subtle.importKey('raw',Uint8Array.from(atob(key),c=>c.charCodeAt(0)),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  const firmaBytes=Uint8Array.from(firma.match(/../g),s=>parseInt(s,16));
  if(!await crypto.subtle.verify('HMAC',clave,firmaBytes,new TextEncoder().encode(proposito+'\0'+ts+'\0'+raw)))return respuesta(401);
  const d=JSON.parse(raw);
  if(proposito==='alta-whatsapp-v1'){
   if(Object.keys(d).sort().join(',')!=='id,phone'||!/^[a-f0-9-]{36}$/i.test(d.id||'')||!/^\+52\d{10}$/.test(d.phone||''))return respuesta(400);
   // API oficial: no confirma teléfonos, no envía correo y no modifica usuarios existentes.
   const r=await admin('users','POST',{phone:d.phone,phone_confirm:false});
   if(r.ok)return respuesta(200);const e=await r.json();const tipo=e.error_code||(typeof e.code==='string'?e.code:'');return respuesta(['phone_exists','user_already_exists'].includes(tipo)?200:503);
  }
  if(proposito==='alta-miembro-v1'){
   if(Object.keys(d).sort().join(',')!=='email,password'||!correoMiembro.test(d.email||'')||!temporal(d.password))return respuesta(400);
   // Correo interno no entregable: no se manda ningún correo y la cuenta no tiene teléfono.
   const r=await admin('users','POST',{email:d.email,password:d.password,email_confirm:true});
   if(!r.ok)return respuesta(409);const u=await r.json();const id=u.id||u.user?.id;
   return /^[a-f0-9-]{36}$/i.test(id||'')?respuesta(200,{usuario:id}):respuesta(503);
  }
  // contrasena-miembro-v1: nunca toca cuentas con WhatsApp ni correos reales.
  if(Object.keys(d).sort().join(',')!=='password,usuario'||!/^[a-f0-9-]{36}$/i.test(d.usuario||'')||!temporal(d.password))return respuesta(400);
  const actual=await admin('users/'+d.usuario,'GET');if(!actual.ok)return respuesta(404);const u=await actual.json();
  if(!correoMiembro.test(u.email||'')||u.phone)return respuesta(403);
  const r=await admin('users/'+d.usuario,'PUT',{password:d.password});return respuesta(r.ok?200:503);
 }catch{return respuesta(503);}};
}
