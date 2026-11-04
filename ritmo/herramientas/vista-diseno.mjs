// Vista local sin red ni claves: reutiliza el HTML/CSS y las interacciones de la app.
import {readFile,writeFile} from 'node:fs/promises';
import {chromium} from '../servidor/node_modules/playwright/index.mjs';
const salida=process.argv[2];if(!salida)throw new Error('Indica la ruta del fragmento de vista previa.');
const src=new URL('../belleza/',import.meta.url);
const index=await readFile(new URL('index.html',src),'utf8');
let css=index.split('<style>')[1].split('</style>')[0];
css=css.replace(/(?:html)?:root((?:\[[^\]]+\]|:not\([^)]*\))*)/g,(_,s)=>s?`:host(${s})`:':host')
 .replace(/html(\[[^\]]+\])/g,':host($1)').replace(/\bbody\b/g,':host').replace(/(:host(?:\([^)]*\))?)\s+:host/g,'$1');
const html=index.split('</style>')[1].replace(/<script[\s\S]*?<\/script>/g,'');
let app=await readFile(new URL('belleza.js',src),'utf8');
app=app.replace('fetcher: (...args) => fetch(...args)','fetcher: undefined');
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
try {
 const page=await browser.newPage();
 for(const name of ['extensiones-1','extensiones-2','extensiones-3','lifting-cejas','logo-ab-beauty']) {
  const original=(await readFile(new URL(`trabajos/${name}.jpg`,src))).toString('base64');
  const foto=await page.evaluate(async b64=>{const img=new Image();img.src='data:image/jpeg;base64,'+b64;await img.decode();const c=document.createElement('canvas');const f=Math.min(1,420/Math.max(img.width,img.height));c.width=Math.round(img.width*f);c.height=Math.round(img.height*f);c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.62);},original);
  app=app.replaceAll(`./trabajos/${name}.jpg`,foto);
 }
} finally {await browser.close();}
let fragment=await readFile(new URL('vista-diseno.template.html',import.meta.url),'utf8');
const core=await readFile(new URL('../prototipo/core.js',import.meta.url),'utf8');
for(const [key,value] of Object.entries({PRODUCT_CSS:css,PRODUCT_HTML:html,PRODUCT_CORE:core,PRODUCT_APP:app}))fragment=fragment.replace(`__${key}__`,()=>value);
if(/__PRODUCT_|\bfetch\s*\(|XMLHttpRequest|WebSocket/.test(fragment))throw new Error('La vista previa debe estar completa y sin acceso a red.');
if(Buffer.byteLength(fragment)>1000000)throw new Error('La vista excede 1 MB.');
await writeFile(salida,fragment);console.log('Vista previa generada sin conexiones externas: '+Math.round(Buffer.byteLength(fragment)/1024)+' KB.');
