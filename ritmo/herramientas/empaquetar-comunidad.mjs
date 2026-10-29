import {cp,mkdir} from 'node:fs/promises';
const fuente=new URL('../comunidad/',import.meta.url),destino=new URL('../dist/comunidad/',import.meta.url);
await mkdir(destino,{recursive:true});await cp(fuente,destino,{recursive:true});
console.log('Vista de comunidad preparada en ritmo/dist/comunidad/; no se publica ni se agrega a la PWA actual.');
