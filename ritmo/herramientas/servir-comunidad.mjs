// Vista local aislada: no API, secretos, registros de clientes ni operaciones de producción.
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
const root=fileURLToPath(new URL('../comunidad/',import.meta.url));
const tipos={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.ttf':'font/ttf'};
const server=createServer(async(req,res)=>{try{if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}const u=new URL(req.url,'http://localhost'),p=resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(!p.startsWith(root.endsWith(sep)?root:root+sep)){res.writeHead(403).end();return;}if(!(await stat(p)).isFile())throw new Error();res.writeHead(200,{'Content-Type':tipos[extname(p)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(req.method==='HEAD'?undefined:await readFile(p));}catch{res.writeHead(404).end('No disponible.');}});
server.listen(Number(process.env.COMUNIDAD_PORT||4178),'127.0.0.1',()=>console.log('Vista previa de Agendappx: http://127.0.0.1:'+server.address().port));
