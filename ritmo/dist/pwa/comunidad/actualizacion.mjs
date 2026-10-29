// Comparte la instalación de la agenda, conservando la decisión del usuario y sus formularios.
export function prepararActualizacion(){
 if(!('serviceWorker'in navigator))return;
 const aviso=document.querySelector('#pwa-update'),ahora=document.querySelector('#pwa-update-now'),luego=document.querySelector('#pwa-update-later');let registro,solicitada=false,controlada=!!navigator.serviceWorker.controller,otra=false,base='',timer;
 const estado=()=>{const hoja=document.querySelector('#hoja');if(!hoja?.open)return '';return JSON.stringify([...hoja.querySelectorAll('input,textarea,select,[aria-checked],[aria-pressed]')].map(e=>[e.id,e.value??'',e.checked??false,e.getAttribute('aria-checked'),e.getAttribute('aria-pressed'),e.files?.length||0]));};
 const colocar=()=>{const hoja=document.querySelector('#hoja'),destino=hoja?.open?hoja:document.body;if(aviso.parentNode!==destino)destino.append(aviso);};
 const mostrar=()=>{colocar();if(controlada&&!solicitada&&(registro?.waiting||otra))aviso.hidden=false;};
 document.addEventListener('agendappx:hoja',()=>{base=estado();colocar();});document.querySelector('#hoja')?.addEventListener('close',()=>{base='';colocar();});
 luego.onclick=()=>aviso.hidden=true;
 ahora.onclick=()=>{if(solicitada)return;if(estado()!==base&&!confirm('Tienes cambios sin guardar. ¿Quieres actualizar y descartar este formulario?'))return;if(otra&&!registro?.waiting){location.reload();return;}if(!registro?.waiting)return;solicitada=true;ahora.disabled=true;ahora.textContent='Actualizando…';timer=setTimeout(()=>{solicitada=false;ahora.disabled=false;ahora.textContent='Actualizar ahora';mostrar();},15000);registro.waiting.postMessage({tipo:'RITMO_ACTUALIZAR'});};
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!controlada){controlada=true;return;}otra=true;if(solicitada){clearTimeout(timer);location.reload();}else mostrar();});
 async function revisar(){if(navigator.onLine&&document.visibilityState==='visible')try{await registro?.update();mostrar();}catch{}}
 async function iniciar(){try{registro=await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});const observar=w=>w?.addEventListener('statechange',()=>{if(w.state==='installed')mostrar();});observar(registro.installing);registro.addEventListener('updatefound',()=>observar(registro.installing));mostrar();document.addEventListener('visibilitychange',revisar);window.addEventListener('online',revisar);setInterval(revisar,60000);void revisar();}catch{}}
 if(document.readyState==='complete')void iniciar();else window.addEventListener('load',iniciar,{once:true});
}
