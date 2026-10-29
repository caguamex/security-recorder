// Sin SDK ni dependencias remotas. Exclusivo de la función aislada en Supabase.
export function intermediario({key,url,adminKey,fetch:red=fetch,ahora=Date.now}){
 const respuesta=(status)=>Response.json(status===200?{preparada:true}:{error:'No se pudo preparar el registro.'},{status,headers:{'Cache-Control':'no-store'}});
 return async req=>{try{
  if(req.method!=='POST'||new URL(req.url).search||!/^application\/json(?:;|$)/i.test(req.headers.get('content-type')||''))return respuesta(405);
  if(url!=='https://zkqwephmuflbuagevvxj.supabase.co'||!/^[A-Za-z0-9+/]{43}=$/.test(key||'')||!adminKey)return respuesta(503);
  const reader=req.body?.getReader();if(!reader)return respuesta(400);const chunks=[];let size=0;for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1024){await reader.cancel();return respuesta(413);}chunks.push(value);}const raw=new TextDecoder().decode(Uint8Array.from(chunks.flatMap(x=>Array.from(x))));
  const ts=req.headers.get('x-registro-fecha'),firma=req.headers.get('x-registro-firma');
  if(!/^\d{10}$/.test(ts||'')||Math.abs(ahora()/1000-Number(ts))>60||!/^[a-f0-9]{64}$/.test(firma||''))return respuesta(401);
  const clave=await crypto.subtle.importKey('raw',Uint8Array.from(atob(key),c=>c.charCodeAt(0)),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  const firmaBytes=Uint8Array.from(firma.match(/../g),s=>parseInt(s,16));
  if(!await crypto.subtle.verify('HMAC',clave,firmaBytes,new TextEncoder().encode('alta-whatsapp-v1\0'+ts+'\0'+raw)))return respuesta(401);
  const d=JSON.parse(raw);if(Object.keys(d).sort().join(',')!=='id,phone'||!/^[a-f0-9-]{36}$/i.test(d.id||'')||!/^\+52\d{10}$/.test(d.phone||''))return respuesta(400);
  // API oficial: no confirma teléfonos, no envía correo y no modifica usuarios existentes.
  const r=await red(url+'/auth/v1/admin/users',{method:'POST',headers:{apikey:adminKey,Authorization:'Bearer '+adminKey,'Content-Type':'application/json'},body:JSON.stringify({phone:d.phone,phone_confirm:false}),signal:AbortSignal.timeout(8000)});
  if(r.ok)return respuesta(200);const e=await r.json();return respuesta(['phone_exists','user_already_exists'].includes(e.code||e.error_code)?200:503);
 }catch{return respuesta(503);}};
}
