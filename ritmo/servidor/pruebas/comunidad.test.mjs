import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filtrar,publicaciones,negocios,fechas,disponible} from '../../comunidad/modelo.mjs';
test('comunidad: búsqueda sin acentos, mayúsculas ni plural; combina filtros',()=>{
 assert.deepEqual(filtrar(publicaciones,{busqueda:'UÑA'}).map(p=>p.id),['francesas']);
 assert.equal(filtrar(publicaciones,{busqueda:'BARBERÍAS'}).length,1);
 assert.equal(filtrar(publicaciones,{busqueda:'pestaña'}).length,2);
 assert.equal(filtrar(publicaciones,{categoria:'Cortes',precio:200}).length,0);
 assert.equal(filtrar(publicaciones,{distancia:2}).length,1);
 assert.equal(filtrar(publicaciones,{busqueda:'AB BEAUTY',guardados:['lifting']})[0].id,'lifting');
 assert.equal(filtrar(publicaciones,{seguidos:[]}).length,0);
 assert.equal(filtrar(publicaciones,{busqueda:'<script>'}).length,0);
});
test('comunidad: no muestra trabajos sin negocio o servicio válido',()=>{
 assert.equal(filtrar([...publicaciones,{id:'ajeno',negocio:'otro',servicio:'corte',etiquetas:[]}]).length,publicaciones.length);
 assert.ok(publicaciones.every(p=>negocios.some(b=>b.id===p.negocio&&b.servicios.some(s=>s.id===p.servicio))));
});
test('comunidad: reserva local separa especialista y negocio, y evita cruces por duración',()=>{
 const now=new Date('2026-10-28T09:00:00'),fecha=fechas(now)[0].id;
 const a={negocio:'ab-beauty-room',especialista:'Ale',fecha,hora:'10:00',duracion:90};
 assert.equal(disponible([],a,now),true);
 assert.equal(disponible([a],{...a,hora:'11:00',duracion:30},now),false);
 assert.equal(disponible([a],{...a,hora:'12:00'},now),true);
 assert.equal(disponible([a],{...a,especialista:'Mariana'},now),true);
 assert.equal(disponible([a],{...a,negocio:'distrito-barber',especialista:'Diego'},now),true);
 assert.equal(disponible([],{...a,especialista:'Desconocido'},now),false);
 assert.equal(disponible([],{...a,fecha:'2026-10-20'},now),false);
 assert.equal(disponible([],{...a,hora:'03:00'},now),false);
 assert.equal(disponible([],a,new Date('2026-10-28T10:00:00')),false);
});
