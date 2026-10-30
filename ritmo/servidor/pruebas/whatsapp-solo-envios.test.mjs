import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {preparar,ids,sesiones} from './whatsapp-solo-envios-entorno.mjs';
import {CifradoSesion} from '../build/whatsapp-vinculado/cifrado.js';
import {configuracion,clabeValida,plan,PREDETERMINADOS} from '../build/whatsapp-vinculado/reglas.js';
const n=ids.salon,clabe='01218000000000000';
const digito=(10-[...clabe].reduce((s,d,i)=>s+(Number(d)*[3,7,1][i%3])%10,0)%10)%10;
const pagos={anticipoActivo:true,banco:'Banco de prueba',clabe:clabe+digito,titular:'Titular de prueba'};
async function entorno(t){const e=await preparar();t.after(()=>e.cerrar());return e;}
const filas=(e)=>e.db.usar(async c=>(await c.query('SELECT * FROM ritmo.whatsapp_envios ORDER BY debido,id')).rows);
const enviados=e=>e.llamadas.filter(x=>x[0]==='envio');
test('cifrado por salón: llave correcta, integridad, nonce único y aislamiento',()=>{
 const key=randomBytes(32).toString('base64'),s=new CifradoSesion(key),id=s.id(n,'creds','principal'),a=s.sellar(n,id,'secreto'),b=s.sellar(n,id,'secreto');assert.notEqual(a.iv,b.iv);assert.equal(s.abrir(n,id,a),'secreto');assert.throws(()=>s.abrir(ids.otro,id,a));assert.throws(()=>new CifradoSesion(randomBytes(32).toString('base64')).abrir(n,id,a));assert.throws(()=>s.abrir(n,id,{...a,tag:randomBytes(16).toString('base64')}));assert.equal(JSON.stringify(a).includes('secreto'),false);
});
test('valida CLABE, configuración y límites que solo pueden bajarse',()=>{
 assert.equal(clabeValida(pagos.clabe),true);assert.equal(clabeValida(pagos.clabe.slice(0,-1)+'9'),false);assert.equal(configuracion({}).porcentaje,20);
 for(const a of [{maxHora:31},{maxDia:151},{maxMes:601},{anticipoActivo:true},{horaDia:'25:00'},{minutosAntes:90},{direccion:'x\ny'}])assert.throws(()=>configuracion(a));
});
test('solo crea avisos de citas y exige consentimiento antes de enviar',async t=>{
 const e=await entorno(t);await e.iniciar();await e.cita();await e.fuente({id:'clienta',kind:'clienta',nombre:'Sin permiso',telefono:'5511111111',whatsappOptIn:false});await e.cola.vuelta(n);assert.equal(enviados(e).length,0);assert.equal((await filas(e)).find(f=>f.tipo==='inicio').motivo,'sin_consentimiento');
 await e.fuente({id:'cita',kind:'cita',date:'2026-11-10',start:'15:00',estado:'pendiente',clienta:'inexistente',servicio:'cejas'});await e.cola.vuelta(n);assert.equal(enviados(e).length,0);
});
for(const hora of ['21:00:00','23:59:58','00:01:00','07:59:59'])test('avisos permitidos a las '+hora+' sin posponer hasta las ocho',async t=>{
 const e=await entorno(t);e.fijar('2026-11-09T'+hora+'-06:00');await e.iniciar();await e.cita();await e.cola.vuelta(n);assert.equal(enviados(e).length,1);assert.equal((await filas(e)).find(f=>f.tipo==='inicio').estado,'aceptado');assert.equal(await e.cola.enviarUno(n),false);
});

test('cruzar las 21 durante escribiendo conserva el envio sin duplicarlo',async t=>{
 const e=await entorno(t);e.fijar('2026-11-09T20:59:58-06:00');await e.iniciar();await e.cita();await e.cola.vuelta(n);assert.equal(enviados(e).length,1);assert.equal((await filas(e)).find(f=>f.tipo==='inicio').estado,'aceptado');
});

test('recordatorio de madrugada se emite al vencer y nunca despues de iniciar la cita',async t=>{
 const e=await entorno(t);e.fijar('2026-11-08T12:00:00-06:00');await e.iniciar({direccion:'Direccion de prueba'});await e.cita({date:'2026-11-10',start:'01:30'});await e.cola.vuelta(n);
 e.fijar('2026-11-09T19:00:00-06:00');await e.cola.enviarUno(n);
 e.fijar('2026-11-10T00:29:59-06:00');await e.cola.enviarUno(n);assert.equal((await filas(e)).find(f=>f.tipo==='antes').estado,'pendiente');e.avanzar(1000);assert.equal(await e.cola.enviarUno(n),true);assert.equal((await filas(e)).find(f=>f.tipo==='antes').estado,'aceptado');
 e.fijar('2026-11-11T01:30:00-06:00');const prev=enviados(e).length;await e.cola.vuelta(n);assert.equal(enviados(e).length,prev);
});

test('actualizar a 24 horas reprograma pendientes sin repetir la confirmacion',async t=>{
 const e=await entorno(t);await e.iniciar();await e.cita();await e.cola.vuelta(n);
 await e.db.usar(c=>c.query("UPDATE ritmo.whatsapp_citas SET config_huella='version-horario-anterior' WHERE negocio_id=$1",[n]));
 await e.cola.reconciliar(n);await e.cola.reconciliar(n);const f=await filas(e);
 assert.equal(f.filter(x=>x.tipo==='inicio').length,1);assert.equal(f.filter(x=>x.tipo==='inicio'&&x.estado==='aceptado').length,1);
 for(const tipo of ['dia','antes'])assert.equal(f.filter(x=>x.tipo===tipo&&x.estado==='pendiente').length,1);
});

test('pausas duraderas entre mensajes y escribiendo de dos a cinco segundos',async t=>{
 const e=await entorno(t);await e.iniciar();await e.cita();await e.cita({id:'cita2',start:'16:00'});await e.cola.vuelta(n);assert.equal(enviados(e).length,1);assert.ok(e.esperas[0]>=2000&&e.esperas[0]<=5000);assert.equal(await e.cola.enviarUno(n),false);e.avanzar(39999);assert.equal(await e.cola.enviarUno(n),false);e.avanzar(1);assert.equal(await e.cola.enviarUno(n),true);assert.equal(enviados(e).length,2);
});
for(const [nombre,cantidad,intervalo,fecha] of [['hora',30,60000,'2026-11-09T12:00:00-06:00'],['día',150,480000,'2026-11-09T20:00:00-06:00'],['mes',600,29*86400000/600,'2026-11-30T20:00:00-06:00']])test('tope por '+nombre+' y por número',async t=>{
 const e=await entorno(t);e.fijar(fecha);await e.iniciar();await e.cita({date:nombre==='mes'?'2026-12-01':'2026-11-10'});await e.cola.reconciliar(n);
 await e.db.usar(c=>c.query(`INSERT INTO ritmo.whatsapp_envios(id,negocio_id,cita_id,tipo,huella,debido,estado,intento_en,numero) SELECT md5('a'||s::text)||md5('b'||s::text),$1,'pasada','inicio','h',$2,'aceptado',$2::timestamptz - (s::double precision*$3::double precision)*interval '1 millisecond','525511111111' FROM generate_series(0,$4::integer-1) s`,[n,new Date(e.ahora()),intervalo,cantidad]));assert.equal(await e.cola.enviarUno(n),false);assert.equal(enviados(e).length,0);
});
test('reglas de día y llegada omiten reservas recientes y adelantan citas tempranas a las 19h',()=>{
 const c={id:'c',date:'2026-11-10',start:'14:00',estado:'pendiente'},a=PREDETERMINADOS;
 const nueva=Date.parse('2026-11-10T08:00:00-06:00');assert.equal(plan(c,a,nueva,true,false,nueva).some(p=>p.tipo==='dia'),false);
 const tardia=Date.parse('2026-11-10T13:00:00-06:00');assert.equal(plan(c,a,tardia,true,false,tardia).some(p=>p.tipo==='antes'),false);
 const anticipada=plan({...c,start:'10:00'},a,Date.parse('2026-11-08T12:00:00-06:00'),false,false,Date.parse('2026-11-09T12:00:00-06:00'));assert.equal(anticipada.find(p=>p.tipo==='dia').debido,Date.parse('2026-11-09T19:00:00-06:00'));
 assert.equal(plan({...c,start:'08:30'},a,Date.parse('2026-11-08T12:00:00-06:00'),false,false,Date.parse('2026-11-09T12:00:00-06:00')).some(p=>p.tipo==='antes'),true);
});
test('mover invalida pendientes, avisa del cambio y regresar a un horario no reutiliza la huella vieja',async t=>{
 const e=await entorno(t);await e.iniciar();const c=await e.cita();await e.cola.vuelta(n);await e.fuente({...c,start:'15:00'});await e.cola.reconciliar(n);const antiguos=(await filas(e)).filter(f=>f.tipo==='antes');assert.equal(antiguos.length,2);assert.equal(antiguos.filter(f=>f.estado==='cancelado').length,1);
 e.avanzar(60000);await e.cola.enviarUno(n);assert.match(enviados(e).at(-1)[2],/15:00/);
 await e.fuente(c);await e.cola.reconciliar(n);assert.equal((await filas(e)).filter(f=>f.tipo==='cambio').length,2);
 await e.fuente({...c,estado:'cancelada'});await e.cola.reconciliar(n);assert.equal((await filas(e)).filter(f=>f.estado==='pendiente').length,0);
});
test('anticipo marcado recibido por Recepción se notifica una sola vez y el comprobante no lo confirma',async t=>{
 const e=await entorno(t);await e.iniciar(pagos);await e.cita();await e.cola.reconciliar(n);
 const foto='data:image/jpeg;base64,/9j/2Q==';await e.control.cita(e.ident('recepcion'),n,'cita',{foto},'comprobante');let r=await e.control.cita(e.ident('recepcion'),n,'cita');assert.equal(r.anticipo.estado,'pendiente');assert.equal(r.anticipo.monto,100);
 await e.control.cita(e.ident('recepcion'),n,'cita',{metodo:'transferencia'},'recibido');await e.control.cita(e.ident('recepcion'),n,'cita',{metodo:'transferencia'},'recibido');assert.equal((await filas(e)).filter(f=>f.tipo==='anticipo').length,1);await e.cola.enviarUno(n);assert.equal(enviados(e).length,1);assert.match(enviados(e)[0][2],/anticipo/);e.avanzar(120000);await e.cola.enviarUno(n);assert.equal(enviados(e).length,1);
});
test('el vencimiento alerta al salón pero no libera ni cambia la cita',async t=>{
 const e=await entorno(t);await e.iniciar(pagos);const c=await e.cita();await e.cola.reconciliar(n);e.avanzar(86400001);await e.cola.reconciliar(n);assert.equal((await e.control.cita(e.ident(),n,'cita')).anticipo.estado,'vencido');assert.equal((await e.db.fuente(n,'cita')).data.estado,c.estado);assert.equal((await e.control.alertas(e.ident('recepcion'),n))[0].tipo,'anticipo_vencido');
});
test('el recordatorio del día se omite tras un anticipo reciente',async t=>{
 const e=await entorno(t);await e.iniciar(pagos);await e.cita();await e.cola.reconciliar(n);e.fijar('2026-11-10T08:30:00-06:00');await e.control.cita(e.ident('recepcion'),n,'cita',{metodo:'transferencia'},'recibido');await e.cola.enviarUno(n);e.fijar('2026-11-10T09:00:00-06:00');await e.cola.enviarUno(n);assert.equal((await filas(e)).find(f=>f.tipo==='dia').motivo,'confirmacion_reciente');assert.equal(enviados(e).length,1);
});
test('pérdida de respuesta y reinicio no repiten un resultado incierto',async t=>{
 const e=await entorno(t);await e.iniciar();await e.cita();e.fallar(500);await e.cola.vuelta(n);assert.equal((await filas(e)).find(f=>f.tipo==='inicio').estado,'incierto');e.avanzar(600000);await e.cola.vuelta(n);assert.equal(enviados(e).length,1);
});
test('un bloqueo dispara freno persistente y no lo levanta Recepción',async t=>{
 const e=await entorno(t);await e.iniciar();await e.cita();e.fallar(429);await e.cola.vuelta(n);const r=await e.control.estado(e.ident(),n);assert.equal(r.freno,true);assert.equal(r.enviosActivados,false);e.avanzar(3600000);assert.equal(await e.cola.enviarUno(n),false);await assert.rejects(()=>e.control.reanudar(e.ident('recepcion'),n,{confirmar:true}),err=>err.status===403);await assert.rejects(()=>e.control.reanudar(e.ident(),n,{}),err=>err.status===400);
});
test('sesión desconectada no produce envíos y el aviso aparece después de diez minutos',async t=>{
 const e=await entorno(t);await e.iniciar();await e.cita();e.desconectar();await e.db.usar(c=>c.query("UPDATE ritmo.whatsapp_conexiones SET estado='reconectando',desconectado_desde=$2 WHERE negocio_id=$1",[n,new Date(e.ahora())]));await e.cola.vuelta(n);assert.equal(enviados(e).length,0);e.avanzar(600001);await e.cola.reconciliar(n);assert.equal((await e.control.alertas(e.ident(),n))[0].tipo,'whatsapp_desconectado');
});
test('cambiar el consentimiento durante escribiendo impide la emisión',async t=>{
 const e=await entorno(t);await e.iniciar();await e.cita();e.cola.dormir=async()=>{await e.fuente({id:'clienta',kind:'clienta',nombre:'Sin permiso',telefono:'5511111111',whatsappOptIn:false});};await e.cola.vuelta(n);assert.equal(enviados(e).length,0);
});
test('Especialista no recibe CLABE, comprobantes ni vinculación; sesión revocada falla',async t=>{
 const e=await entorno(t);await e.iniciar(pagos);await e.cita();await e.cola.reconciliar(n);assert.deepEqual(await e.control.cita(e.ident('especialista'),n,'cita'),{soloLectura:true});await assert.rejects(()=>e.control.estado(e.ident('especialista'),n),err=>err.status===403);await assert.rejects(()=>e.control.cita(e.ident('otra'),n,'cita'),err=>err.status===403);await assert.rejects(()=>e.control.cita(e.ident('especialista'),n,'cita',{metodo:'efectivo'},'recibido'),err=>err.status===403);
 await e.db.usar(async c=>{await assert.rejects(()=>c.query('UPDATE ritmo.belleza_objetos SET data=NULL WHERE negocio_id=$1',[n]),/permission denied/);});
 await e.db.usar(async c=>{await assert.rejects(()=>c.query('SELECT * FROM auth.sessions'),/permission denied/);});
 await e.pool.connect().then(async c=>{try{await c.query('DELETE FROM auth.sessions WHERE id=$1',[sesiones.admin]);}finally{c.release();}});
 await assert.rejects(()=>e.control.estado(e.ident(),n),err=>err.status===401);
});

test('el aviso de anticipo conserva el horario nuevo, no duplica al reconciliar sin cambios',async t=>{
 const e=await entorno(t);await e.iniciar(pagos);const c=await e.cita();await e.cola.reconciliar(n);await e.control.cita(e.ident('recepcion'),n,'cita',{metodo:'efectivo'},'recibido');await e.fuente({...c,start:'16:00'});await e.cola.reconciliar(n);await e.cola.reconciliar(n);assert.equal((await filas(e)).filter(f=>f.tipo==='anticipo').length,1);await e.cola.enviarUno(n);e.avanzar(61000);await e.cola.enviarUno(n);const textos=enviados(e).map(x=>x[2]);assert.ok(textos.some(x=>/anticipo/.test(x)&&/16:00/.test(x)));
});
test('desvinculación sin red pausa y conserva credenciales hasta confirmar cierre en el teléfono',async t=>{
 const e=await entorno(t);await e.iniciar();await e.db.usar(c=>c.query('INSERT INTO ritmo.whatsapp_sesiones(negocio_id,llave,cifrado) VALUES($1,$2,$3)',[n,'a'.repeat(64),{simulada:true}]));
 e.remoto.salir=async()=>{throw Object.assign(new Error('Sin conexión'),{status:409});};await assert.rejects(()=>e.control.salir(e.ident(),n,{confirmar:true}),err=>err.status===409);
 assert.equal((await e.control.estado(e.ident(),n)).cerradaManualmente,true);assert.equal((await e.db.usar(c=>c.query('SELECT * FROM ritmo.whatsapp_sesiones'))).rows.length,1);
 await e.control.salir(e.ident(),n,{confirmar:true,cerradoEnTelefono:true});assert.equal((await e.db.usar(c=>c.query('SELECT * FROM ritmo.whatsapp_sesiones'))).rows.length,0);
});


test('Una solicitud pública no programa ni envía avisos antes de aceptarse',async t=>{
 const e=await preparar();t.after(()=>e.cerrar());await e.iniciar();await e.cita({estado:'solicitada'});await e.cola.reconciliar(ids.salon);assert.equal((await e.cola.tomar(ids.salon)),null);assert.equal(e.llamadas.filter(x=>x[0]==='envio').length,0);
 await e.cita({estado:'confirmada'});await e.cola.reconciliar(ids.salon);const c=await e.db.usar(c=>c.query("SELECT tipo FROM ritmo.whatsapp_envios WHERE negocio_id=$1 AND estado='pendiente'",[ids.salon]));assert.equal(c.rows.filter(x=>x.tipo==='inicio').length,1);
});
