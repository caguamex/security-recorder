// Panel de Agendappx. El servidor y la base exigen dueño reservado y sesión verificada por WhatsApp.
(function(){
 const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fecha=v=>v?new Date(v).toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'}):'—';
 const hace=v=>{if(!v)return 'sin uso';const d=Math.floor((Date.now()-new Date(v))/86400000);return d<=0?'hoy':d===1?'ayer':'hace '+d+' días';};
 const PLANES={solo:'Solo',salon:'Salón',pro:'Pro'};
 let salones=[],resumen={},codigos=[],respaldo=false,filtro='todos',q='',actual=null,codigoActual=null,avisador,revision=0;
 // Mismo aviso de versión nueva que Comunidad: «Actualizar» también instala el código del panel, no solo los datos.
 const actualizador=import('/comunidad/actualizacion.mjs').then(m=>m.prepararActualizacion()).catch(()=>null);
 const aviso=t=>{clearTimeout(avisador);$('#aviso').textContent=t;$('#aviso').hidden=false;avisador=setTimeout(()=>{$('#aviso').hidden=true;},3500);};
 async function api(ruta,datos){const s=await window.AgendappxCuentas?.sesionPlataforma();if(!s?.accessToken)throw Object.assign(new Error('Entra con tu cuenta de dueño para ver el panel.'),{entrar:true});
  const r=await fetch(ruta,{method:datos?'POST':'GET',headers:{Authorization:'Bearer '+s.accessToken,...(datos?{'Content-Type':'application/json'}:{})},...(datos?{body:JSON.stringify(datos)}:{}),cache:'no-store',signal:AbortSignal.timeout(20000)});
  let d={};try{d=await r.json();}catch{}if(!r.ok)throw new Error(d.error||'No se pudo cargar el panel.');return d;}
 function diasPrueba(s){if(s.estado!=='prueba'||!s.pruebaFin)return null;return Math.ceil((new Date(s.pruebaFin)-Date.now())/86400000);}
 function estadoSalon(s){const d=diasPrueba(s);if(s.suspendido)return ['mal','En pausa'];if(d!==null&&d<=0)return ['mal','Prueba vencida'];if(d!==null&&d<=5)return ['aviso','Prueba: '+d+' días'];if(d!==null)return ['ok','Prueba: '+d+' días'];if(s.estado==='legado')return ['ok','Cuenta original'];return ['','Sin plan'];}
 const FILTROS=[['todos','Todos'],['prueba','En prueba'],['vencer','Por vencer'],['vencida','Vencidos'],['pausa','En pausa'],['sinverificar','Sin verificar'],['sinuso','Sin uso 14 días']];
 function pasa(s){const d=diasPrueba(s);const ok={todos:true,prueba:d!==null&&d>0,vencer:d!==null&&d>0&&d<=5,vencida:d!==null&&d<=0,pausa:s.suspendido,sinverificar:!s.verificado,sinuso:!s.ultimoUso||Date.now()-new Date(s.ultimoUso)>14*86400000}[filtro];
  const t=(s.nombre+' '+(s.slug||'')+' '+(s.duena?.nombre||'')+' '+(s.ciudad||'')).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();return ok&&(!q||t.includes(q));}
 const cifra=(n,t,extra='')=>`<div class="cifra"><b>${esc(n)}</b><small>${esc(t)}</small>${extra?`<i>${esc(extra)}</i>`:''}</div>`;
 function pintar(){const r=resumen,w=r.whatsappPlataforma||{},conectado=w.estado==='conectado';
  const lista=salones.filter(pasa);
  $('#contenido').innerHTML=`<div class="cifras">${cifra(r.salones,'Salones',r.nuevosSemana+' nuevos esta semana')}${cifra(r.enPrueba,'En prueba gratis',r.pruebaPorVencer+' vencen en 5 días')}${cifra(r.pruebaVencida,'Pruebas vencidas','Para ofrecerles un plan')}${cifra((r.fundadoras||0)+' de 20','Precio de fundadora')}
   ${cifra(r.personas,'Personas con acceso')}${cifra(r.clientas,'Clientas registradas')}${cifra(r.citasSemana,'Citas movidas esta semana')}${cifra(r.solicitudesSemana,'Pedidas desde la app','Esta semana')}</div>
   ${codigos.length?`<h2>Códigos sin entregar · ${codigos.length}</h2><div class="grupo alerta">${codigos.map(x=>`<div class="celda"><span class="punto mal"></span><span class="l"><b>${esc(x.telefono||'Número protegido')}</b><small>${esc({sms:'Para entrar o registrarse',phone_change:'Para vincular su número',email:'Correo'}[x.tipo]||'Código de acceso')} · ${esc(MOTIVO[x.motivo]||'No salió')} · ${esc(minutos(x.creadoEn))}</small><small>Vence ${esc(new Date(x.venceEn).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit',hourCycle:'h23'}))}</small></span><button type="button" class="mini" data-codigo="${esc(x.id)}">${x.revelado?'Ver de nuevo':'Ver y enviar'}</button></div>`).join('')}</div>`:''}
   <h2>Salud de la plataforma</h2><div class="grupo">
    <div class="celda"><span class="punto ${conectado?'ok':'mal'}"></span><span class="l">WhatsApp de códigos (866 124 1483)<small>${conectado?'Conectado':'Revisar: '+esc(w.estado||'sin datos')}${w.ultimaConexion?' · última conexión '+esc(fecha(w.ultimaConexion)):''}</small></span></div>
    <div class="celda"><span class="punto ${r.codigosFallidosHoy?'aviso':'ok'}"></span><span class="l">Códigos enviados en 24 h<small>${esc(r.codigosHoy)} pedidos · ${esc(r.codigosFallidosHoy)} con error</small></span></div>
    <div class="celda"><span class="punto ${r.registrosSinTerminar?'aviso':'ok'}"></span><span class="l">Registros esta semana<small>${esc(r.registrosSemana)} completos · ${esc(r.registrosSinTerminar)} sin terminar</small></span></div>
    <div class="celda"><span class="punto ${r.reportesPendientes?'aviso':'ok'}"></span><span class="l">Reportes de Comunidad<small>${esc(r.reportesPendientes)} pendientes de revisar</small></span>${r.reportesPendientes?'<a class="v" href="/comunidad/">Revisar ›</a>':''}</div>
    <div class="celda"><span class="punto ${respaldo?'ok':'aviso'}"></span><span class="l">Respaldo manual de códigos<small>${respaldo?'Activo: si un código no sale, te avisamos y aparece arriba para que lo envíes tú.':'Pendiente de activar en el servicio de WhatsApp.'}</small></span></div>
    <button type="button" class="celda" id="avisos-celular"><span class="punto"></span><span class="l">Avisarme en este celular<small>Notificación al momento si un código no sale.</small></span><span class="chev">›</span></button>
    <div class="celda"><span class="punto ok"></span><span class="l">En Explorar<small>${esc(r.visiblesExplorar)} visibles · ${esc(r.verificados)} verificados · ${esc(r.suspendidos)} en pausa</small></span></div></div>
   <h2>Salones · ${lista.length}</h2><label class="buscar"><span aria-hidden="true">⌕</span><input id="buscar" type="search" placeholder="Nombre, enlace, dueña o ciudad" value="${esc(q)}" aria-label="Buscar salón"></label>
   <div class="chips" role="group" aria-label="Filtrar">${FILTROS.map(([k,t])=>`<button type="button" data-filtro="${k}" aria-pressed="${filtro===k}">${t}</button>`).join('')}</div>
   <div class="grupo">${lista.map(s=>{const [c,e]=estadoSalon(s);return `<button type="button" class="celda" data-salon="${esc(s.id)}"><span class="punto ${c}"></span><span class="l"><b>${esc(s.nombre)}</b> ${s.verificado?'<span class="etq negra">✔︎</span>':''}<small>${s.plan?esc(PLANES[s.plan]||s.plan)+' · ':''}${esc(e)}${s.fundadora?' · Fundadora #'+esc(s.fundadora):''}</small><small>${esc(s.duena?.nombre||'Sin Admin')} · ${esc(s.personas)} ${s.personas===1?'persona':'personas'} · ${esc(s.citas30)} citas en 30 días · ${esc(hace(s.ultimoUso))}</small></span><span class="chev">›</span></button>`;}).join('')||'<p class="vacio">No hay salones con ese filtro.</p>'}</div>
   <h2>Lo último que hiciste</h2><div class="grupo" id="bitacora"><p class="vacio">Cargando…</p></div>`;
  void cargarBitacora();
 }
 const NOMBRE_ACCION={verificar:'Verificación',ocultar:'Ocultado de Explorar',extender_prueba:'Prueba extendida',plan:'Plan cambiado',suspender:'Salón en pausa',reactivar:'Salón reactivado'};
 async function cargarBitacora(){try{const d=await api('/api/plataforma/bitacora');$('#bitacora').innerHTML=d.bitacora.slice(0,15).map(b=>`<div class="celda"><span class="l">${esc(NOMBRE_ACCION[b.accion]||b.accion)} · ${esc(b.salon)}<small>${esc(new Date(b.en).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short',hourCycle:'h23'}))}${b.detalle?.dias?' · +'+esc(b.detalle.dias)+' días':''}${b.detalle?.plan?' · '+esc(PLANES[b.detalle.plan]):''}${b.detalle?.motivo?' · '+esc(b.detalle.motivo):''}</small></span></div>`).join('')||'<p class="vacio">Todavía no hay acciones.</p>';}catch{}}
 function hoja(s){actual=s;const [c,e]=estadoSalon(s),d=diasPrueba(s),wa=s.duena?.whatsapp?String(s.duena.whatsapp).replace(/\D/g,''):'';
  $('#hoja-titulo').textContent=s.nombre;
  $('#hoja-cuerpo').innerHTML=`<div class="grupo"><div class="celda"><span class="punto ${c}"></span><span class="l">${esc(e)}<small>Desde ${esc(fecha(s.creadoEn))}${s.slug?' · /'+esc(s.slug):''}</small></span></div>
   <div class="celda"><span class="l">Dueña<small>${esc(s.duena?.nombre||'—')}${wa?' · +'+esc(wa):''}</small></span>${wa?`<a class="v" href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener">WhatsApp ›</a>`:''}</div>
   <div class="celda"><span class="l">Uso<small>${esc(s.personas)} ${s.personas===1?'persona':'personas'} · ${esc(s.servicios)} servicios · ${esc(s.citas30)} citas en 30 días · ${esc(s.trabajos)} fotos · ${esc(hace(s.ultimoUso))}</small></span></div>
   <label class="celda"><span class="l">Plan</span><select id="hoja-plan" ${s.plan?'':'disabled'}>${Object.entries(PLANES).map(([k,t])=>`<option value="${k}" ${s.plan===k?'selected':''}>${t}</option>`).join('')}</select></label>
   ${s.suspendido?`<div class="celda"><span class="l">En pausa<small>${esc(s.motivoSuspension)}</small></span></div>`:''}</div>
   ${d!==null?`<div class="fila2"><button type="button" class="btn" data-accion="extender_prueba" data-dias="7">+7 días de prueba</button><button type="button" class="btn" data-accion="extender_prueba" data-dias="14">+14 días de prueba</button></div>`:''}
   <button type="button" class="btn p" data-accion="verificar">${s.verificado?'Quitar verificado ✔︎':'Marcar como verificado ✔︎'}</button>
   ${s.slug&&s.visible?`<a class="btn" href="/${esc(s.slug)}" target="_blank" rel="noopener">Ver perfil público</a><button type="button" class="btn" data-accion="ocultar">Ocultar de Explorar</button>`:''}
   ${s.suspendido?'<button type="button" class="btn" data-accion="reactivar">Reactivar salón</button>':'<button type="button" class="btn mal" data-accion="suspender">Poner en pausa</button>'}
   <p class="vacio" style="padding:12px 4px 0;text-align:left">Verifica solo cuando confirmes que el salón existe (dirección y WhatsApp). En pausa, el salón conserva sus datos pero no puede agendar ni aparece en Explorar.</p>`;
  if(!$('#hoja').open)$('#hoja').showModal();
 }
 const MOTIVO={desconectado:'WhatsApp desconectado',detenido:'Envíos detenidos',sin_confirmar:'WhatsApp no confirmó',error:'No salió'};
 const minutos=v=>{const m=Math.max(0,Math.round((Date.now()-new Date(v))/60000));return m<1?'ahora':m===1?'hace 1 minuto':'hace '+m+' minutos';};
 // El código solo se muestra al tocar «Ver y enviar», queda en la bitácora y se manda al mismo número desde tu WhatsApp.
 async function verCodigo(id){codigoActual=id;const d=await api('/api/plataforma/codigos/'+id+'/ver',{});$('#hoja-titulo').textContent='Enviar código';
  $('#hoja-cuerpo').innerHTML=`<div class="grupo"><div class="celda"><span class="l">Para<small>${esc(d.telefono)}</small></span></div><div class="celda codigo-grande" aria-label="Código ${esc(d.codigo.split('').join(' '))}">${esc(d.codigo.slice(0,3))} ${esc(d.codigo.slice(3))}</div></div>
   <a class="btn p" href="${esc(d.whatsapp)}" target="_blank" rel="noopener" id="codigo-whatsapp">Enviar por WhatsApp</a><button type="button" class="btn" data-entregado="${esc(id)}">Ya lo envié</button>
   <p class="vacio" style="padding:12px 4px 0;text-align:left">Se abre tu WhatsApp con el mensaje listo para ese número. Vence a los 10 minutos de haberlo pedido; si venció, la persona puede pedir otro.</p>`;
  if(!$('#hoja').open)$('#hoja').showModal();}
 async function cargar(){const turno=++revision;try{const [r,s,c]=await Promise.all([api('/api/plataforma/resumen'),api('/api/plataforma/salones'),api('/api/plataforma/codigos').catch(()=>({codigos:[],activo:false}))]);if(turno!==revision)return;resumen=r;salones=s.salones;codigos=c.codigos;respaldo=c.activo;$('#salir-dueno').hidden=false;$('#panel').classList.remove('entrada-dueno');pintar();}
  catch(e){if(turno!==revision)return;if(e.entrar){$('#salir-dueno').hidden=true;if($('#acceso-plataforma'))return;$('#panel').classList.add('entrada-dueno');$('#contenido').innerHTML='<section class="acceso-dueno"><p class="etapa-dueno">DUEÑO DE AGENDAPPX</p><div id="acceso-plataforma"></div><p class="nota-dueno">Aquí administras los negocios registrados. No necesitas crear un salón ni elegir un plan.</p></section>';await window.AgendappxCuentas.montar($('#acceso-plataforma'),{plataforma:true,alVerificar:()=>{void cargar();}});}else $('#contenido').innerHTML=`<p class="vacio">${esc(e.message)}</p>`;}}
 async function accion(a,valor={}){await api('/api/plataforma/salones/'+actual.id,{accion:a,valor});aviso({verificar:'Listo.',extender_prueba:'Prueba extendida.',plan:'Plan cambiado.',suspender:'Salón en pausa.',reactivar:'Salón reactivado.',ocultar:'Ya no aparece en Explorar.'}[a]);
  const id=actual.id;await cargar();const s=salones.find(x=>x.id===id);if(s&&$('#hoja').open)hoja(s);}
 document.addEventListener('click',async ev=>{const b=ev.target.closest('button');if(!b)return;try{
  if(b.id==='recargar'){if(await (await actualizador)?.pendiente()){(await actualizador).aplicar();return;}await cargar();aviso('Actualizado.');}
  if(b.id==='salir-dueno'){revision++;salones=[];resumen={};codigos=[];actual=null;codigoActual=null;$('#contenido').textContent='Cerrando sesión…';if($('#hoja').open)$('#hoja').close();$('#hoja-cuerpo').replaceChildren();await window.AgendappxCuentas.salir();await cargar();return;}
  if(b.id==='hoja-cerrar')$('#hoja').close();
  if(b.dataset.filtro){filtro=b.dataset.filtro;pintar();}
  if(b.dataset.codigo){b.disabled=true;await verCodigo(b.dataset.codigo);return;}
  if(b.dataset.entregado){await api('/api/plataforma/codigos/'+b.dataset.entregado+'/entregado',{});$('#hoja').close();aviso('Listo. Quedó anotado.');await cargar();return;}
  if(b.id==='avisos-celular'){await window.AgendappxAvisos.activar('plataforma');aviso('Te avisaremos en este celular.');return;}
  if(b.dataset.salon)hoja(salones.find(s=>s.id===b.dataset.salon));
  const a=b.dataset.accion;if(!a)return;b.disabled=true;
  if(a==='verificar')await accion(a,{si:!actual.verificado});
  if(a==='extender_prueba')await accion(a,{dias:Number(b.dataset.dias)});
  if(a==='ocultar'&&confirm('¿Ocultar '+actual.nombre+' de Explorar? Su Admin puede volver a mostrarlo.'))await accion(a);
  if(a==='reactivar')await accion(a);
  if(a==='suspender'){const motivo=prompt('¿Por qué pones en pausa a '+actual.nombre+'? (lo verá en la bitácora)');if(motivo?.trim())await accion(a,{motivo:motivo.trim().slice(0,300)});}
 }catch(e){aviso(e.message);}finally{b.disabled=false;}});
 document.addEventListener('change',async ev=>{if(ev.target.id==='hoja-plan'&&actual&&ev.target.value!==actual.plan){try{await accion('plan',{plan:ev.target.value});}catch(e){aviso(e.message);}}});
 document.addEventListener('input',ev=>{if(ev.target.id==='buscar'){q=ev.target.value.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();const pos=ev.target.selectionStart;pintar();const c=$('#buscar');c.focus();c.setSelectionRange(pos,pos);}});
 // Revisa cada minuto mientras el panel está abierto.
 setInterval(()=>{if(!document.hidden&&!$('#hoja').open)void cargar();},60000);
 void cargar();
})();
