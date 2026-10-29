// Icono vectorial local aprobado: calendario blanco sobre negro. No usa red.
import {chromium} from '../servidor/node_modules/playwright/index.mjs';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const svg=await readFile(new URL('./icono-neutro.svg',import.meta.url),'utf8');
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
try{for(const size of [180,192,512]){const page=await browser.newPage({viewport:{width:size,height:size},deviceScaleFactor:1});await page.setContent(`<style>html,body{margin:0;background:#000}svg{display:block;width:100vw;height:100vh}</style>${svg}`);await page.screenshot({path:fileURLToPath(new URL('../belleza/iconos/icono-'+size+'.png',import.meta.url))});await page.close();}}finally{await browser.close();}
console.log('Iconos Neutro iOS generados en 180/192/512px.');
