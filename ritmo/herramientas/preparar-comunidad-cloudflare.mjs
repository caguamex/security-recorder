// Combina archivos para una publicación autorizada, sin reconstruir ni alterar la agenda.
import {cp,mkdir,readFile} from 'node:fs/promises';
const pwa=new URL('../dist/pwa/',import.meta.url),destino=new URL('../nube/build/comunidad-publicacion/assets/',import.meta.url);
for(const n of ['index.html','sw.js','belleza.js','cuentas.js'])await readFile(new URL(n,pwa));
await mkdir(destino,{recursive:true});await cp(pwa,destino,{recursive:true});
await cp(new URL('../comunidad/',import.meta.url),new URL('comunidad/',destino),{recursive:true});
console.log('Publicación preparada: agenda existente + /comunidad/. Sin modificar API, base de datos o caché de la agenda.');
