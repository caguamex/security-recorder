// Combina archivos para una publicación autorizada, sin reconstruir ni alterar la agenda.
import {cp,mkdir,readFile,rm} from 'node:fs/promises';
const pwa=new URL('../dist/pwa/',import.meta.url),destino=new URL('../nube/build/comunidad-publicacion/assets/',import.meta.url);
for(const n of ['index.html','sw.js','belleza.js','cuentas.js'])await readFile(new URL(n,pwa));
await mkdir(destino,{recursive:true});await cp(pwa,destino,{recursive:true});
const comunidad=new URL('comunidad/',destino);
// Solo el subdirectorio generado de este build; nunca los archivos del usuario ni las fotos de ejemplo.
if(!comunidad.pathname.endsWith('/nube/build/comunidad-publicacion/assets/comunidad/'))throw new Error('Destino de publicación inválido');
await rm(comunidad,{recursive:true,force:true});await mkdir(comunidad,{recursive:true});
for(const nombre of ['index.html','real.css','real.mjs','actualizacion.mjs','cuentas-cliente.js','manifest.webmanifest'])await cp(new URL('comunidad/'+nombre,pwa),new URL(nombre,comunidad));
console.log('Publicación preparada: agenda existente + /comunidad/. Sin modificar API, base de datos o caché de la agenda.');
