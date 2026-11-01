import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const fuente=await readFile(new URL('../../belleza/colores-clientas.js',import.meta.url),'utf8');
const cargar=()=>{const entorno={};runInNewContext(fuente,entorno);return entorno.AgendappxColoresClientas.color;};
test('El ID de la clienta conserva el acento entre dispositivos y no depende del orden',()=>{
 const a=cargar(),b=cargar();const ids=['clienta-ana','clienta-lucia','clienta-elena'];
 const antes=ids.map(a);ids.toReversed().forEach(id=>assert.equal(b(id),a(id)));
 assert.deepEqual(ids.map(a),antes);assert.ok(new Set(antes).size>1);
 for(const id of ids)assert.match(a(id),/^#[0-9A-F]{6}$/i);
});
test('Sin ID hay un tono neutro estable; no se usan nombres, teléfonos ni números aleatorios',()=>{
 const c=cargar();assert.equal(c(undefined),c(null));assert.equal(c(''),c('  '));
 assert.equal(c('clienta-ana'),cargar()('clienta-ana'));
 for(let i=0;i<64;i++){const rgb=c('clienta-'+i).slice(1).match(/../g).map(n=>parseInt(n,16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);const l=rgb.reduce((s,n,j)=>s+n*[.2126,.7152,.0722][j],0);assert.ok(1.05/(l+.05)>=4.5,'Las iniciales blancas tienen contraste suficiente');}
});
