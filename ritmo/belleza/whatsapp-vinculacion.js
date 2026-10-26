/* Vinculación de Agendappx. La cuenta la administra Auth; el código vive solo en esta hoja. */
(function (global) {
  'use strict';
  function montar(root, opciones) {
    let cerrado = false, timer, abort, huella = '', codigo = '', ocultarEn = 0, fallos = 0, ocupado = false, actual = null;
    const obtenerSesion = opciones.obtenerSesion;
    const pedir = opciones.fetch || global.fetch.bind(global);
    root.innerHTML = `<p class="foot" id="wa-info" role="status">Comprobando tu cuenta…</p>
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
      <p class="foot">Vinculación proporcionada por <a href="https://github.com/evolution-foundation/evolution-api" target="_blank" rel="noopener noreferrer">Evolution API</a>.</p>
      <div class="group" id="wa-confirmar" hidden><p class="foot">¿Quieres cerrar la conexión de este salón? Para usarla otra vez tendrás que vincularla.</p>
      <button type="button" class="cell" id="wa-conservar">Conservar vínculo</button><button type="button" class="cell" id="wa-confirmar-salida" style="color:var(--red,#ff453a)">Sí, desvincular</button></div>`;
    const $ = s => root.querySelector(s);
    const textos = { sin_vincular:'Sin vincular', vinculando:'Esperando que aceptes el código', conectado:'Vinculado',
      reconectando:'Recuperando conexión', requiere_vincular:'WhatsApp pide vincular de nuevo', revisar:'Revisar conexión' };
    function borrarCodigo() { codigo=''; ocultarEn=0; $('#wa-codigo').textContent='';$('#wa-codigo-panel').hidden=true; }
    function mensaje(s) { $('#wa-error').textContent=s;$('#wa-error').hidden=!s; }
    function pintar() {
      if(cerrado)return;
      $('#wa-numero').disabled=ocupado||!huella||actual?.estado==='conectado';
      $('#wa-generar').disabled=ocupado||!huella||actual?.estado==='conectado';
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
        huella='';borrarCodigo();actual=null;$('#wa-numero').value='';
        $('#wa-info').textContent='Inicia sesión como Admin y completa la verificación en dos pasos para vincular el WhatsApp del salón.';
        pintar();return null;
      }
      const nueva=s.usuarioId+'|'+s.negocioId;
      if(huella&&huella!==nueva){borrarCodigo();actual=null;$('#wa-numero').value='';mensaje('');}
      huella=nueva;return s;
    }
    async function api(accion,datos) {
      const s=await sesion();if(!s)throw new Error('Se requiere la cuenta de Admin con dos pasos.');
      const contexto=huella;
      abort=new AbortController();
      const r=await pedir('/api/negocios/'+encodeURIComponent(s.negocioId)+'/whatsapp'+(accion?'/'+accion:''),{
        method:accion?'POST':'GET',cache:'no-store',credentials:'same-origin',signal:abort.signal,
        headers:{Authorization:'Bearer '+s.accessToken,'Content-Type':'application/json'},
        ...(accion?{body:JSON.stringify(datos||{})}:{}) });
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
      if(j.estado==='conectado'&&j.verificado){borrarCodigo();$('#wa-info').textContent='Vinculado al '+j.numero+'. Los mensajes automáticos se habilitarán al completar su configuración.';}
      else $('#wa-info').textContent=j.detalle||'Los mensajes de este salón saldrán del número que vincules.';
      pintar();
    }
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
        if(tipo==='desvincular'&&j){borrarCodigo();$('#wa-confirmar').hidden=true;$('#wa-numero').value='';}
        mostrar(j);fallos=0;
      }catch(e){if(!cerrado&&e.name!=='AbortError')mensaje(e.message);}
      finally{ocupado=false;pintar();programar();}
    }
    const click=e=>{
      const b=e.target.closest('button');if(!b)return;
      if(b.id==='wa-copiar'&&codigo&&Date.now()<ocultarEn){
        if(navigator.clipboard?.writeText)void navigator.clipboard.writeText(codigo).then(()=>mensaje('Código copiado.')).catch(()=>mensaje('Selecciona el código y cópialo.'));
        else mensaje('Selecciona el código y cópialo.');
      }
      if(b.id==='wa-generar')void accion('codigo',{telefono:$('#wa-numero').value});
      if(b.id==='wa-recuperar')void accion('recuperar',{});
      if(b.id==='wa-salir'){$('#wa-confirmar').hidden=false;}
      if(b.id==='wa-conservar'){$('#wa-confirmar').hidden=true;}
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
  global.AgendappxWhatsApp=Object.freeze({montar});
})(window);
