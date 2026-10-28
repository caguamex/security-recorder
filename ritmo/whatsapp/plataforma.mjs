import {BaseWhatsApp} from '../servidor/build/whatsapp-vinculado/db.js';
export const PLATAFORMA='codigos';
export const NUMERO_CODIGOS='528661241483';
// No representa un salón ni hereda sus permisos o su configuración.
export class BasePlataforma extends BaseWhatsApp {
 plataforma=true;
 tablaConexion='ritmo.plataforma_conexiones';
 async prepararConexion(n,c){if(n!==PLATAFORMA)throw new Error('Instancia de plataforma inválida.');await c.query("INSERT INTO ritmo.plataforma_conexiones(negocio_id,esperado) VALUES('codigos',$1) ON CONFLICT DO NOTHING",[NUMERO_CODIGOS]);return (await c.query("SELECT * FROM ritmo.plataforma_conexiones WHERE negocio_id='codigos' FOR UPDATE")).rows[0];}
 async alerta(n,_cita,tipo,c){if(n!==PLATAFORMA)throw new Error('Instancia inválida.');const f=x=>x.query("INSERT INTO ritmo.plataforma_alertas(id,negocio_id,tipo) VALUES($1,'codigos',$2) ON CONFLICT(id) DO UPDATE SET resuelta=false,creado_en=now()",[tipo,tipo]);return c?f(c):this.usar(f);}
}
