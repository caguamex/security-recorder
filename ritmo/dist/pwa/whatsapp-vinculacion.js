/* Vinculación de Agendappx. La cuenta la administra Auth; el código vive solo en esta hoja. */
(function (global) {
  'use strict';
  function montar(root, opciones) {
    let cerrado = false, timer, abort, huella = '', codigo = '', ocultarEn = 0, fallos = 0, ocupado = false, actual = null;
    const obtenerSesion = opciones.obtenerSesion;
    const pedir = opciones.fetch || global.fetch.bind(global);
    root.innerHTML = `<button type="button" class="cell" id="wa-acceso">Acceso de Admin</button><p class="foot" id="wa-info" role="status">Comprobando tu cuenta…</p>
      <div class="group"><div class="cell"><span class="ico" style="background:#25D366">💬</span><span class="l">WhatsApp del salón<small id="wa-estado">Sin comprobar</small></span></div>
      <label class="cell"><span class="l">Tu número</span><input class="in" id="wa-numero" type="tel" inputmode="tel" autocomplete="tel" maxlength="25" placeholder="+52 y tu número" style="min-width:0;max-width:190px" disabled></label></div>
      <div class="group"><button type="button" class="cell" id="wa-generar" style="color:var(--acc)" disabled>Generar código</button></div>
      <div id="wa-codigo-panel" class="group" hidden><p class="foot">En WhatsApp abre Ajustes → Dispositivos vinculados → Vincular dispositivo → Vincular con número de teléfono.</p>
      <p id="wa-codigo" aria-label="Código de vinculación" style="text-align:center;font:700 clamp(24px,7vw,36px)/1.4 ui-monospace,monospace;letter-spacing:2px;user-select:all;overflow-wrap:anywhere"></p>
      <button type="button" class="cell" id="wa-copiar" style="color:var(--acc)">Copiar código</button>
      <p class="foot">Escribe este código en WhatsApp. Si indica que venció, solicita otro.</p></div>
      <p class="foot" id="wa-error" role="alert" hidden></p>
      <div class="group" id="wa-acciones" hidden><button type="button" class="cell" id="wa-recuperar"><span class="l">Recuperar conexión<small>Conserva la sesión guardada</small></span></button>
      <button type="button" class="cell" id="wa-salir" style="color:var(--red,#ff453a)"><span class="l">Desvincular WhatsApp</span></button></div>
      <p class="foot">Conexión por dispositivo vinculado con Baileys. Solo envía avisos; responde desde tu teléfono.</p>
      <div id="wa-freno"></div><div id="wa-config"></div><div class="group" id="wa-alertas"></div><div class="group" id="wa-confirmar" hidden><p class="foot">¿Quieres cerrar la conexión de este salón? Para usarla otra vez tendrás que vincularla.</p>
      <button type="button" class="cell" id="wa-conservar">Conservar vínculo</button><button type="button" class="cell" id="wa-confirmar-salida" style="color:var(--red,#ff453a)">Sí, desvincular</button><button type="button" class="cell" id="wa-olvidar" hidden>Ya cerré el dispositivo en mi teléfono: quitar sesión guardada</button></div>`;
    const $ = s => root.querySelector(s);
    const textos = { sin_vincular:'Sin vincular', vinculando:'Esperando que aceptes el código', conectado:'Vinculado',
      reconectando:'Recuperando conexión', requiere_vincular:'WhatsApp pide vincular de nuevo', revisar:'Revisar conexión' };
    function borrarCodigo() { codigo=''; ocultarEn=0; $('#wa-codigo').textContent='';$('#wa-codigo-panel').hidden=true; }
    function mensaje(s) { $('#wa-error').textContent=s;$('#wa-error').hidden=!s; }
    function pintar() {
      if(cerrado)return;
      $('#wa-numero').disabled=ocupado||!huella||actual?.estado==='conectado';
      $('#wa-generar').disabled=ocupado||!huella||actual?.estado==='conectado'||actual?.vinculacionAutorizada===false;
      $('#wa-generar').textContent=codigo?'Solicitar otro código':'Generar código';
      $('#wa-estado').textContent=textos[actual?.estado]||'Sin comprobar';
      $('#wa-acciones').hidden=!huella||!actual||actual.estado==='sin_vincular';
      $('#wa-recuperar').hidden=!actual?.ultimaConexion||actual?.estado==='conectado';
      $('#wa-recuperar').disabled=ocupado||actual?.cerradaManualmente||!actual?.ultimaConexion||actual?.estado==='requiere_vincular';
      $('#wa-salir').disabled=ocupado;
      if(codigo&&Date.now()<ocultarEn){$('#wa-codigo').textContent=codigo.slice(0,4)+' – '+codigo.slice(4);$('#wa-codigo-panel').hidden=false;}
      else borrarCodigo();
    }
    async function sesion() {
      const s=await obtenerSesion?.();
      if(!s?.accessToken||!s?.usuarioId||!s?.negocioId||s.rol!=='admin'||s.aal!=='aal2') {
        huella='';borrarCodigo();actual=null;$('#wa-numero').value='';ajustesMostrados=false;$('#wa-config').replaceChildren();$('#wa-freno').replaceChildren();$('#wa-alertas').replaceChildren();
        $('#wa-info').textContent='Inicia sesión como Admin y completa la verificación en dos pasos para vincular el WhatsApp del salón.';
        pintar();return null;
      }
      const nueva=s.usuarioId+'|'+s.negocioId;
      if(huella&&huella!==nueva){borrarCodigo();ajustesMostrados=false;$('#wa-config').replaceChildren();$('#wa-freno').replaceChildren();$('#wa-alertas').replaceChildren();actual=null;$('#wa-numero').value='';mensaje('');}
      huella=nueva;return s;
    }
    async function api(accion,datos) {
      const s=await sesion();if(!s)throw new Error('Se requiere la cuenta de Admin con dos pasos.');
      const contexto=huella;
      abort=new AbortController();
      const r=await pedir('/api/negocios/'+encodeURIComponent(s.negocioId)+'/whatsapp'+(accion?'/'+accion:''),{
        method:accion&&accion!=='alertas'?'POST':'GET',cache:'no-store',credentials:'same-origin',signal:abort.signal,
        headers:{Authorization:'Bearer '+s.accessToken,'Content-Type':'application/json'},
        ...(accion&&accion!=='alertas'?{body:JSON.stringify(datos||{})}:{}) });
      const j=await r.json();
      if(cerrado)return null;
      const vigente=await sesion();
      if(!vigente||huella!==contexto)return null;
      if(!r.ok){ if(r.status===401||r.status===403){borrarCodigo();huella='';actual=null;$('#wa-numero').value='';pintar();}
        throw new Error(j.error||'No se pudo comprobar WhatsApp. Conservamos tu conexión.'); }
      return j;
    }
    function mostrar(j) {
      if(!j||cerrado)return;
      actual=j;
      if(j.numero&&!$('#wa-numero').value)$('#wa-numero').value='+'+j.numero;
      if(j.estado==='conectado'&&j.verificado){borrarCodigo();$('#wa-info').textContent='Vinculado al '+j.numero+'. Responde a las clientas desde tu teléfono.';}
      else $('#wa-info').textContent=j.detalle||'Los mensajes de este salón saldrán del número que vincules.';
      $('#wa-freno').innerHTML=j.freno?'<div class="group"><p class="foot">Envíos detenidos por protección. Revisa WhatsApp en tu teléfono.</p><button type="button" class="cell" id="wa-reanudar">Ya revisé el bloqueo: reanudar</button></div>':'';configurar(j);pintar();
    }
    let ajustesMostrados=false;
    const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    function configurar(j){if(!j.ajustes||ajustesMostrados)return;ajustesMostrados=true;const a=j.ajustes;
      $('#wa-config').innerHTML=`<p class="gh">Avisos automáticos</p><div class="group"><label class="cell"><span class="l">Activar avisos de citas</span><input id="wa-habilitado" type="checkbox" ${a.habilitado?'checked':''}></label>
      <label class="cell"><span class="l">Dirección del salón</span><input class="in" id="wa-direccion" value="${esc(a.direccion)}" maxlength="300" style="min-width:0;max-width:190px"></label>
      <label class="cell"><span class="l">Aviso del día</span><input class="in" id="wa-horaDia" type="time" value="${esc(a.horaDia)}" style="max-width:135px"></label>
      <label class="cell"><span class="l">Antes de llegar</span><select class="in" id="wa-minutosAntes" style="max-width:135px">${[30,60,120].map(x=>`<option ${a.minutosAntes===x?'selected':''} value="${x}">${x} min</option>`).join('')}</select></label></div>
      <p class="gh">Anticipos</p><div class="group"><label class="cell"><span class="l">Pedir anticipo</span><input id="wa-anticipoActivo" type="checkbox" ${a.anticipoActivo?'checked':''}></label>
      <label class="cell"><span class="l">Porcentaje</span><select class="in" id="wa-porcentaje" style="max-width:100px">${[20,30,50].map(x=>`<option ${a.porcentaje===x?'selected':''} value="${x}">${x} %</option>`).join('')}</select></label>
      <label class="cell"><span class="l">Servicios desde $</span><input class="in" id="wa-minimo" inputmode="decimal" type="number" min="300" value="${a.minimo}" style="max-width:110px"></label>
      ${[['banco','Banco'],['clabe','CLABE de 18 dígitos'],['titular','Titular']].map(([k,n])=>`<label class="cell"><span class="l">${n}</span><input class="in" id="wa-${k}" value="${esc(a[k])}" maxlength="${k==='clabe'?18:200}" style="min-width:0;max-width:190px"></label>`).join('')}</div>
      <p class="foot">Hasta 30 por hora, 150 al día y 600 al mes. Sin avisos de 21:00 a 08:00. El horario no se libera si vence el anticipo.</p>
      <div class="group">${[['maxHora','Máximo por hora',30],['maxDia','Máximo al día',150],['maxMes','Máximo al mes',600]].map(([k,n,max])=>`<label class="cell"><span class="l">${n}</span><input id="wa-${k}" class="in" type="number" min="1" max="${max}" value="${a[k]}" style="max-width:90px"></label>`).join('')}<button type="button" class="cell" id="wa-guardar-ajustes">Guardar configuración</button></div>
      <p class="foot">${j.enviosActivados?'El envío está autorizado.':'El envío sigue apagado hasta la autorización de publicación y del primer mensaje real.'}</p>`;
      void api('alertas').then(v=>{if(!cerrado&&Array.isArray(v))$('#wa-alertas').textContent=v.map(x=>x.tipo==='anticipo_vencido'?'Venció un anticipo. Revisa la cita; el horario sigue apartado.':x.tipo==='envios_detenidos'?'Envíos detenidos: revisa el bloqueo.':'WhatsApp está desconectado.').join(' ');}).catch(()=>{});
    }
    async function guardarAjustes(){const d={};for(const k of ['habilitado','anticipoActivo'])d[k]=$('#wa-'+k).checked;for(const k of ['porcentaje','minimo','minutosAntes','maxHora','maxDia','maxMes'])d[k]=Number($('#wa-'+k).value);for(const k of ['direccion','horaDia','banco','clabe','titular'])d[k]=$('#wa-'+k).value;await accion('ajustes',d);}
    function programar() {
      clearTimeout(timer);
      if(!cerrado&&!document.hidden)timer=setTimeout(comprobar,Math.min(60000,5000*(2**Math.min(fallos,4))));
    }
    async function comprobar() {
      clearTimeout(timer);
      if(cerrado||document.hidden||ocupado)return;
      try {if(!await sesion())return;mostrar(await api(''));fallos=0;mensaje('');}
      catch(e){if(!cerrado&&e.name!=='AbortError'){fallos++;mensaje(e.message);pintar();}}
      finally {programar();}
    }
    async function accion(tipo,datos) {
      if(ocupado||cerrado)return;
      clearTimeout(timer);abort?.abort();ocupado=true;mensaje('');pintar();
      try {
        const j=await api(tipo,datos);
        if(j?.codigo){codigo=j.codigo;ocultarEn=new Date(j.mostrarHasta).getTime();}
        if(tipo==='desvincular'&&j){borrarCodigo();$('#wa-confirmar').hidden=true;$('#wa-olvidar').hidden=true;$('#wa-numero').value='';}
        mostrar(j);fallos=0;
      }catch(e){if(!cerrado&&e.name!=='AbortError'){mensaje(e.message);if(tipo==='desvincular')$('#wa-olvidar').hidden=false;}}
      finally{ocupado=false;pintar();programar();}
    }
    const click=e=>{
      const b=e.target.closest('button');if(!b)return;
      if(b.id==='wa-acceso')opciones.abrirAcceso?.();
      if(b.id==='wa-guardar-ajustes')void guardarAjustes();
      if(b.id==='wa-reanudar'&&confirm('¿Ya revisaste el bloqueo en tu teléfono? Los envíos inciertos no se repetirán.'))void accion('reanudar',{confirmar:true});
      if(b.id==='wa-copiar'&&codigo&&Date.now()<ocultarEn){
        if(navigator.clipboard?.writeText)void navigator.clipboard.writeText(codigo).then(()=>mensaje('Código copiado.')).catch(()=>mensaje('Selecciona el código y cópialo.'));
        else mensaje('Selecciona el código y cópialo.');
      }
      if(b.id==='wa-generar')void accion('codigo',{telefono:$('#wa-numero').value});
      if(b.id==='wa-recuperar')void accion('recuperar',{});
      if(b.id==='wa-salir'){$('#wa-confirmar').hidden=false;}
      if(b.id==='wa-conservar'){$('#wa-confirmar').hidden=true;}
      if(b.id==='wa-olvidar'&&confirm('En WhatsApp → Dispositivos vinculados, ¿ya cerraste el dispositivo de Agendappx? Se quitará su sesión guardada.'))void accion('desvincular',{confirmar:true,cerradoEnTelefono:true});
      if(b.id==='wa-confirmar-salida')void accion('desvincular',{confirmar:true});
    };
    const visibilidad=()=>{if(document.hidden){clearTimeout(timer);abort?.abort();}else void comprobar();};
    const cambios=()=>{if(!root.isConnected||root.closest('#sheet')?.hidden)destruir();};
    const authCambio=()=>{abort?.abort();clearTimeout(timer);void sesion().then(()=>comprobar());};
    function destruir(){if(cerrado)return;cerrado=true;clearTimeout(timer);abort?.abort();borrarCodigo();
      root.removeEventListener('click',click);document.removeEventListener('visibilitychange',visibilidad);
      document.removeEventListener('ritmo:hoja',cambios);document.removeEventListener('agendappx:sesion',authCambio);}
    root.addEventListener('click',click);document.addEventListener('visibilitychange',visibilidad);
    document.addEventListener('ritmo:hoja',cambios);document.addEventListener('agendappx:sesion',authCambio);
    void comprobar();return destruir;
  }
  function montarCita(root,{id,obtenerSesion,prepararFoto,alRecibir,fetch:pedir=global.fetch.bind(global)}){
    if(!root)return;let sesion,datos,ocupado=false,cerrado=false,abort=new AbortController();
    const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const $=s=>root.querySelector(s),mensaje=s=>{const e=$('#wa-cita-info');if(e)e.textContent=s;};
    async function api(accion='',d){const actual=await obtenerSesion?.();if(!actual||!sesion||actual.usuarioId!==sesion.usuarioId||actual.negocioId!==sesion.negocioId)throw new Error('Tu sesión cambió. Vuelve a abrir la cita.');const r=await pedir('/api/negocios/'+encodeURIComponent(actual.negocioId)+'/whatsapp/citas/'+encodeURIComponent(id)+(accion?'/'+accion:''),{method:d?'POST':'GET',credentials:'same-origin',cache:'no-store',signal:abort.signal,headers:{Authorization:'Bearer '+actual.accessToken,...(d?{'Content-Type':'application/json'}:{})},...(d?{body:JSON.stringify(d)}:{})});const j=await r.json();if(!r.ok)throw new Error(j.error||'No se pudo revisar el anticipo.');return j;}
    function pintar(){if(cerrado||!root.isConnected||datos?.soloLectura)return;const a=datos?.anticipo;if(!a)return;
      const nombres={pendiente:'Apartada: falta anticipo',recibido:'Confirmada: anticipo recibido',vencido:'Anticipo vencido: conserva el horario',no_aplica:'Sin anticipo'};
      root.innerHTML=`<p class="gh">Anticipo</p><div class="group"><div class="cell"><span class="l">${nombres[a.estado]||'Revisar anticipo'}<small>$${Number(a.monto).toLocaleString('es-MX')} · ${a.limite?esc(new Date(a.limite).toLocaleString('es-MX')):''}</small></span></div>
      ${a.estado!=='no_aplica'?`<label class="cell"><span class="l">Forma de pago</span><select class="in" id="wa-metodo" style="max-width:170px" ${a.estado==='recibido'?'disabled':''}>${['transferencia','efectivo','tarjeta'].map(v=>`<option value="${v}" ${a.metodo===v?'selected':''}>${v[0].toUpperCase()+v.slice(1)}</option>`).join('')}</select></label>
      ${a.estado!=='recibido'?'<button type="button" class="cell" id="wa-recibido">Marcar anticipo recibido</button><div id="wa-pago-confirmar" hidden><p class="foot">Confirma que revisaste el dinero recibido. Adjuntar una foto por sí solo no confirma el pago.</p><button type="button" class="cell" id="wa-pago-si">Sí, recibí el anticipo</button><button type="button" class="cell" id="wa-pago-no">Volver</button></div>':''}
      <input type="file" id="wa-recibo" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" hidden><input type="hidden" id="wa-recibo-data" value="${esc(a.comprobante||'')}">
      <img id="wa-recibo-preview" alt="Comprobante adjunto" ${a.comprobante?'src="'+esc(a.comprobante)+'"':'hidden'} style="display:block;width:calc(100% - 32px);max-height:220px;object-fit:contain;margin:12px 16px;border-radius:14px">
      <button type="button" class="cell" id="wa-recibo-elegir">Adjuntar foto del comprobante</button><button type="button" class="cell" id="wa-recibo-quitar">Quitar foto</button><button type="button" class="cell" id="wa-recibo-guardar" hidden>Guardar comprobante</button>`:''}</div>
      <p class="foot" role="status" id="wa-cita-info"></p><p class="gh">Avisos de la cita</p><div class="group">${(datos.envios||[]).filter(x=>!['cancelado','omitido'].includes(x.estado)).map(x=>`<div class="cell"><span class="l">${esc({inicio:'Cita agendada',anticipo:'Anticipo recibido',dia:'Recordatorio del día',antes:'Antes de llegar',cambio:'Cambio de cita'}[x.tipo]||x.tipo)}<small>${esc({pendiente:'Pendiente',procesando:'En proceso',aceptado:'Aceptado por WhatsApp',incierto:'Resultado incierto: no se repetirá'}[x.estado]||x.estado)}</small></span></div>`).join('')}</div>`;
    }
    async function iniciar(){sesion=await obtenerSesion?.();if(!sesion||!['admin','recepcion'].includes(sesion.rol))return;try{datos=await api();pintar();}catch(e){if(!cerrado){root.innerHTML='<p class="foot" id="wa-cita-info"></p>';mensaje(e.message);}}}
    root.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b||ocupado||cerrado)return;
      if(b.id==='wa-recibido'){$('#wa-pago-confirmar').hidden=false;return;}if(b.id==='wa-pago-no'){$('#wa-pago-confirmar').hidden=true;return;}
      if(b.id==='wa-recibo-elegir'){$('#wa-recibo').click();return;}
      if(b.id==='wa-recibo-quitar'){$('#wa-recibo-data').value='';$('#wa-recibo-preview').removeAttribute('src');$('#wa-recibo-preview').hidden=true;$('#wa-recibo-guardar').hidden=false;mensaje('Foto quitada. Guarda para confirmar el cambio.');return;}
      if(!['wa-pago-si','wa-recibo-guardar'].includes(b.id))return;ocupado=true;b.disabled=true;
      try{datos=await api(b.id==='wa-pago-si'?'recibido':'comprobante',b.id==='wa-pago-si'?{metodo:$('#wa-metodo').value}:{foto:$('#wa-recibo-data').value||null});if(cerrado)return;if(b.id==='wa-pago-si')alRecibir?.();pintar();mensaje('Guardado.');}catch(err){if(!cerrado)mensaje(err.message);}finally{ocupado=false;if(b.isConnected)b.disabled=false;}
    });
    root.addEventListener('change',async e=>{if(e.target.id!=='wa-recibo'||ocupado)return;const f=e.target.files?.[0];if(!f)return;ocupado=true;root.dataset.preparandoFoto='si';mensaje('Preparando foto…');try{const foto=await prepararFoto(f);if(cerrado)return;$('#wa-recibo-data').value=foto;$('#wa-recibo-preview').src=foto;$('#wa-recibo-preview').hidden=false;$('#wa-recibo-guardar').hidden=false;mensaje('Foto lista. Toca Guardar comprobante.');}catch(err){mensaje(err.message);}finally{ocupado=false;delete root.dataset.preparandoFoto;e.target.value='';}});
    const cerrar=()=>{if(!root.isConnected||root.closest('#sheet')?.hidden){cerrado=true;abort.abort();document.removeEventListener('ritmo:hoja',cerrar);document.removeEventListener('agendappx:sesion',cambio);}};
    const cambio=()=>{cerrado=true;abort.abort();root.replaceChildren();document.removeEventListener('ritmo:hoja',cerrar);document.removeEventListener('agendappx:sesion',cambio);};
    document.addEventListener('ritmo:hoja',cerrar);document.addEventListener('agendappx:sesion',cambio);void iniciar();return cambio;
  }
  global.AgendappxWhatsApp=Object.freeze({montar,montarCita});
})(window);
