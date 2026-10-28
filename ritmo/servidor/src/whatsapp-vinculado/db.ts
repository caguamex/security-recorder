import { randomUUID } from 'node:crypto';
import type {ConexionSQL,ClienteSQL} from '../repositorio.js';
import type {IdentidadFirmada} from '../cuentas/jwt.js';
import {enTransaccion,miembroVigente} from '../cuentas/contexto.js';
import {ErrorAPI} from '../modelo.js';
import {configuracion,PREDETERMINADOS,type Ajustes} from './reglas.js';
export class BaseWhatsApp {
 readonly plataforma:boolean=false;
 readonly tablaConexion:string='ritmo.whatsapp_conexiones';
 constructor(readonly pool:ConexionSQL,readonly ahora=()=>Date.now()){}
 async usar<T>(fn:(c:ClienteSQL)=>Promise<T>){const c=await this.pool.connect();try{return await fn(c);}finally{c.release();}}
 async tx<T>(fn:(c:ClienteSQL)=>Promise<T>){return this.usar(async c=>{try{await c.query('BEGIN');const r=await fn(c);await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK');throw e;}});}
 async miembro<T>(ident:IdentidadFirmada,n:string,admin:boolean,fn:(c:ClienteSQL,m:any)=>Promise<T>){return enTransaccion(this.pool,ident,n,async c=>{const m=await miembroVigente(c,n,ident.usuarioId);if(m.rol==='admin'&&ident.aal!=='aal2')throw new ErrorAPI(403,'Completa la verificación en dos pasos.');if(admin&&m.rol!=='admin')throw new ErrorAPI(403,'Solo Admin puede administrar el WhatsApp.');return fn(c,m);});}
 async config(n:string,c?:ClienteSQL):Promise<Ajustes>{const f=async(x:ClienteSQL)=>{const d=(await x.query('SELECT data FROM ritmo.whatsapp_config WHERE negocio_id=$1',[n])).rows[0]?.data;return d?configuracion(d):{...PREDETERMINADOS};};return c?f(c):this.usar(f);}
 async fuente(n:string,id:string,c?:ClienteSQL){const f=async(x:ClienteSQL)=>(await x.query('SELECT data,version,actualizado_en FROM ritmo.belleza_objetos WHERE negocio_id=$1 AND id=$2',[n,id])).rows[0];return c?f(c):this.usar(f);}
 async prepararConexion(n:string,c:ClienteSQL){await c.query(`INSERT INTO ${this.tablaConexion}(negocio_id) VALUES ($1) ON CONFLICT DO NOTHING`,[n]);return(await c.query(`SELECT * FROM ${this.tablaConexion} WHERE negocio_id=$1 FOR UPDATE`,[n])).rows[0];}
 async alerta(n:string,cita:string|null,tipo:string,c?:ClienteSQL){const id=n+':'+tipo+':'+(cita||'conexion');const f=(x:ClienteSQL)=>x.query('INSERT INTO ritmo.whatsapp_alertas(id,negocio_id,cita_id,tipo) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET resuelta=false,creado_en=now() WHERE whatsapp_alertas.resuelta',[id,n,cita,tipo]);return c?f(c):this.usar(f);}
 async reservar(n:string,propietario:string){return this.tx(async c=>{const f=await this.prepararConexion(n,c);if(f.propietario&&f.propietario!==propietario&&new Date(f.reserva_hasta).getTime()>this.ahora())throw new ErrorAPI(409,'La conexión ya está en otro proceso.');const cerca=Number(f.cerca)+(f.propietario===propietario?0:1);await c.query(`UPDATE ${this.tablaConexion} SET propietario=$2,cerca=$3,reserva_hasta=$4,latido=$5 WHERE negocio_id=$1`,[n,propietario,cerca,new Date(this.ahora()+45000),new Date(this.ahora())]);return cerca;});}
 async renovar(n:string,propietario:string,cerca:number){return this.usar(async c=>!!(await c.query(`UPDATE ${this.tablaConexion} SET reserva_hasta=$4,latido=$5 WHERE negocio_id=$1 AND propietario=$2 AND cerca=$3 AND reserva_hasta>$5 RETURNING negocio_id`,[n,propietario,cerca,new Date(this.ahora()+45000),new Date(this.ahora())])).rows[0]);}
 async soltar(n:string,propietario:string,cerca:number){await this.usar(c=>c.query(`UPDATE ${this.tablaConexion} SET propietario=NULL,reserva_hasta=NULL WHERE negocio_id=$1 AND propietario=$2 AND cerca=$3`,[n,propietario,cerca]));}
 async cercar(n:string,propietario:string,cerca:number,c:ClienteSQL){const r=(await c.query(`SELECT negocio_id FROM ${this.tablaConexion} WHERE negocio_id=$1 AND propietario=$2 AND cerca=$3 AND reserva_hasta>$4 FOR UPDATE`,[n,propietario,cerca,new Date(this.ahora())])).rows[0];if(!r)throw new Error('La custodia de la sesión terminó.');}
}
