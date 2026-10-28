import {createServer} from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {PLATAFORMA,NUMERO_CODIGOS} from './plataforma.mjs';
export function operacionCodigos(plataforma,db,{vincular=false,key}={}){
 if(!vincular)return null;
 if(!/^[A-Za-z0-9+/]{43}=$/.test(key||''))throw new Error('Falta la llave de operación.');
 const server=createServer(async(req,res)=>{try{
  const auth=String(req.headers.authorization||'').replace(/^Bearer /,'');if(auth.length!==key.length||!timingSafeEqual(Buffer.from(auth),Buffer.from(key)))throw new Error();
  if(req.method==='GET'&&req.url==='/estado'){const e=await plataforma.estado(PLATAFORMA);res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({estado:e.estado,verificado:e.verificado,numero:'86 •••• 1483'}));return;}
  if(req.method!=='POST'||req.url!=='/codigo')throw new Error();
  await db.tx(async c=>{const f=await db.prepararConexion(PLATAFORMA,c),now=db.ahora();if(f.freno||f.manual)throw new Error();if(f.ultima_solicitud&&now-new Date(f.ultima_solicitud).getTime()<60000)throw new Error();const nueva=!f.ventana_codigo||now-new Date(f.ventana_codigo).getTime()>=900000;if(!nueva&&f.codigos>=3)throw new Error();await c.query("UPDATE ritmo.plataforma_conexiones SET ultima_solicitud=$1,ventana_codigo=$2,codigos=$3 WHERE negocio_id='codigos'",[new Date(now),nueva?new Date(now):f.ventana_codigo,nueva?1:f.codigos+1]);});
  const codigo=await plataforma.codigo(PLATAFORMA,NUMERO_CODIGOS);res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({codigo}));
 }catch{res.writeHead(409,{'Content-Type':'application/json','Cache-Control':'no-store'}).end('{"error":"Operación no autorizada, pendiente de conexión o limitada. No se cambió FiNeCi."}');}});
 server.listen(8081,'127.0.0.1');return server;
}
