import {entornoLogin,ids,sesiones} from './login-whatsapp-entorno.mjs';
import {readFile} from 'node:fs/promises';
export {ids,sesiones};
export async function entornoSocial(){
 const e=await entornoLogin();const c=await e.pool.connect();try{
 await c.query("ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS phone text, ADD COLUMN IF NOT EXISTS phone_confirmed_at timestamptz;");
 await c.query(await readFile(new URL('../../supabase/migrations/20261029174619_registro_whatsapp.sql',import.meta.url),'utf8'));
 await c.query("SELECT set_config('ritmo.migracion_etapa4','aprobada',false),set_config('ritmo.moderador_aprobado',$1,false)",[ids.admin]);
 await c.query(await readFile(new URL('../../supabase/migrations/20261029223451_explorar_social_etapa4.sql',import.meta.url),'utf8'));
 await c.query("UPDATE auth.users SET phone='525511111111',phone_confirmed_at=now() WHERE id=$1",[ids.nueva]);
 }finally{c.release();}return e;
}
