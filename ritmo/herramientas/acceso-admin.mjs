// Herramienta privada de arranque; solo después de aprobar la migración y el acceso de Admin.
// No envía correo/SMS, no vincula WhatsApp y no imprime el enlace ni las claves.
import {readFile,open,unlink} from 'node:fs/promises';
import {resolve,relative,isAbsolute,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createClient} from '../servidor/node_modules/@supabase/supabase-js/dist/index.mjs';
const args=process.argv.slice(2),get=k=>args[args.indexOf(k)+1];
try{
 if(!args.includes('--autorizado')||!args.includes('--secretos')||!args.includes('--salida'))throw new Error();
 const entrada=get('--secretos'),salida=get('--salida'),repo=fileURLToPath(new URL('../../',import.meta.url));
 const dentro=p=>{const rel=relative(repo,resolve(p));return !rel||(!rel.startsWith('..'+sep)&&rel!=='..'&&!isAbsolute(rel));};
 if(!entrada||!salida||!isAbsolute(entrada)||!isAbsolute(salida)||dentro(entrada)||dentro(salida))throw new Error();
 const config=JSON.parse(await readFile(entrada,'utf8'));
 if(config.SUPABASE_URL!=='https://zkqwephmuflbuagevvxj.supabase.co'||!config.SUPABASE_SECRET_KEY)throw new Error();
 const cliente=createClient(config.SUPABASE_URL,config.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 // El correo está fijado al dueño aprobado; ningún argumento permite dar acceso a terceros.
 const email='antonio.t.22@hotmail.com';
 const {data,error}=await cliente.auth.admin.generateLink({type:'magiclink',email});
 if(error||!data?.properties?.hashed_token||data.user?.email?.toLowerCase()!==email)throw new Error();
 const url=new URL('https://ritmo-belleza.antonio-t-22.workers.dev/');url.hash='acceso-admin='+data.properties.hashed_token;
 const f=await open(salida,'wx',0o600);let completo=false;try{await f.writeFile(JSON.stringify({usuarioId:data.user.id,email,enlace:url.href,indicacion:'Privado, un solo uso. Abre en tu dispositivo y completa tu segundo factor. No concede roles: la membresía se comprueba en la base.'},null,2));completo=true;}finally{await f.close();if(!completo)await unlink(salida);}
 console.log('Acceso de Admin guardado en el archivo privado; no se enviaron correos ni mensajes.');
}catch{console.error('No se generó el acceso. Revisa autorización, archivo privado y configuración de Supabase. No se mostraron secretos.');process.exitCode=1;}
