const id=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export function configurar(env){
 if(env.WA_ACTIVAR_SERVICIO!=='true')throw new Error('Servicio apagado: falta autorización de despliegue.');
 const db=new URL(env.DATABASE_URL||'');
 if(!['postgres:','postgresql:'].includes(db.protocol)||!['agendappx_whatsapp','agendappx_whatsapp.zkqwephmuflbuagevvxj'].includes(decodeURIComponent(db.username)))throw new Error('Usa el rol exclusivo agendappx_whatsapp.');
 if(!((db.hostname==='db.zkqwephmuflbuagevvxj.supabase.co'&&decodeURIComponent(db.username)==='agendappx_whatsapp')||(db.hostname.endsWith('.pooler.supabase.com')&&decodeURIComponent(db.username)==='agendappx_whatsapp.zkqwephmuflbuagevvxj')))throw new Error('La base debe ser la de Supabase dedicada a Agendappx.');
 const supabase=new URL(env.SUPABASE_URL||'');
 if(supabase.origin!=='https://zkqwephmuflbuagevvxj.supabase.co')throw new Error('No se permite conectar la base de FiNeCi ni otro proyecto.');
 // Los parámetros sslmode de pg pueden reemplazar ssl: rechazarlos evita quitar verificación TLS.
 for(const k of ['sslmode','sslcert','sslkey','sslrootcert'])db.searchParams.delete(k);
 const app=new URL(env.PUBLIC_URL||'');if(app.protocol!=='https:'||app.pathname!=='/'||app.search||app.hash||app.username)throw new Error('PUBLIC_URL debe ser un origen HTTPS.');
 const salones=new Set(String(env.WHATSAPP_SALONES_HABILITADOS||'').toLowerCase().split(',').map(s=>s.trim()).filter(Boolean));
 if(!salones.size||[...salones].some(s=>!id.test(s)))throw new Error('Indica explícitamente los salones autorizados.');
 const destinatarios=new Set(String(env.WA_DESTINATARIOS_PRUEBA||'').split(',').map(s=>s.trim()).filter(Boolean));
 if([...destinatarios].some(n=>!/^52[0-9]{10}$/.test(n)))throw new Error('Número de prueba inválido.');
 const port=Number(env.PORT||8080);if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Puerto inválido.');
 if((env.WA_CODIGOS_HABILITADOS==='true'||env.WA_CODIGOS_VINCULAR==='true')&&(env.WA_NUMERO_CODIGOS!=='528661241483'||!env.WA_CODIGOS_HOOK_SECRET||!env.ACCESO_HMAC_KEY))throw new Error('Falta configurar los códigos de plataforma.');
 return {codigos:{habilitado:env.WA_CODIGOS_HABILITADOS==='true',vincular:env.WA_CODIGOS_VINCULAR==='true',hookSecret:env.WA_CODIGOS_HOOK_SECRET,key:env.ACCESO_HMAC_KEY},db:db.href,supabase:supabase.origin,origen:app.origin,salones,port,key:env.WA_SESSION_KEY,
 ssl:{rejectUnauthorized:true,...(env.DATABASE_CA_CERT?{ca:env.DATABASE_CA_CERT.replace(/\\n/g,'\n')}:{})},
 politica:{envios:env.WA_ENVIOS_HABILITADOS==='true',vincular:env.WA_VINCULACION_HABILITADA==='true',...(destinatarios.size?{destinatarios}:{})}};
}
