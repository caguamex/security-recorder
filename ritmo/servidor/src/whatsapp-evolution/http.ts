import type { IncomingMessage, ServerResponse } from 'node:http';
import { ErrorAPI } from '../modelo.js';
import type { IdentidadFirmada } from '../cuentas/jwt.js';
import type { VinculacionWhatsApp } from './vinculacion.js';
export type RutasVinculacion = (req: IncomingMessage, res: ServerResponse, url: URL) => Promise<boolean>;
function responder(res: ServerResponse, body: unknown) {
  res.writeHead(200, { 'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store',
    'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer' });
  res.end(JSON.stringify(body));
}
async function body(req: IncomingMessage) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type']||'')) throw new ErrorAPI(415,'Usa application/json.');
  const partes: Buffer[]=[]; let bytes=0;
  for await(const p of req) { bytes+=p.length; if(bytes>16384) throw new ErrorAPI(413,'Solicitud demasiado grande.'); partes.push(p); }
  try { const v=JSON.parse(Buffer.concat(partes).toString('utf8')); if(!v||typeof v!=='object'||Array.isArray(v)) throw 0; return v as Record<string,unknown>; }
  catch { throw new ErrorAPI(400,'Solicitud inválida.'); }
}
export function rutasVinculacion(servicio: VinculacionWhatsApp,
  jwt: { verificar: (token: string)=>Promise<IdentidadFirmada> }): RutasVinculacion {
  return async (req,res,url)=>{
    const hook=/^\/webhooks\/evolution\/([a-f0-9-]{36})$/.exec(url.pathname);
    if(hook) {
      if(req.method!=='POST') throw new ErrorAPI(405,'Método no permitido.');
      responder(res,await servicio.webhook(hook[1],String(req.headers.authorization||''),await body(req)));return true;
    }
    const m=/^\/api\/negocios\/([a-f0-9-]{36})\/whatsapp(?:\/(codigo|recuperar|desvincular))?$/.exec(url.pathname);
    if(!m) return false;
    if(url.search) throw new ErrorAPI(400,'No se admiten parámetros de instancia.');
    const origin=req.headers.origin;
    if(origin) {
      let valido=false; try { const u=new URL(origin); valido=['https:','http:'].includes(u.protocol)&&u.host===req.headers.host; } catch {}
      if(!valido) throw new ErrorAPI(403,'Origen no permitido.');
    }
    const token=req.headers.authorization?.startsWith('Bearer ')?req.headers.authorization.slice(7):'';
    const ident=await jwt.verificar(token);
    if(!m[2]&&req.method==='GET') { responder(res,await servicio.estado(ident,m[1]));return true; }
    if(req.method!=='POST'||!m[2]) throw new ErrorAPI(405,'Método no permitido.');
    const datos=await body(req);
    const permitidas=m[2]==='codigo'?['telefono']:m[2]==='desvincular'?['confirmar']:[];
    if(Object.keys(datos).some(k=>!permitidas.includes(k))) throw new ErrorAPI(400,'Campo no permitido.');
    const resultado=m[2]==='codigo'?await servicio.solicitarCodigo(ident,m[1],datos.telefono)
      :m[2]==='recuperar'?await servicio.recuperar(ident,m[1]):await servicio.desvincular(ident,m[1],datos.confirmar);
    responder(res,resultado);return true;
  };
}
