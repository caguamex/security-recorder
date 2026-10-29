import {cp,mkdir} from 'node:fs/promises';
const fuente=new URL('../comunidad/',import.meta.url),destino=new URL('../dist/comunidad/',import.meta.url);
await mkdir(destino,{recursive:true});await cp(fuente,destino,{recursive:true});
console.log('Recursos de Comunidad preparados; el paquete público selecciona solo la interfaz real.');
