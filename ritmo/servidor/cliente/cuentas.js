import {createClient} from '@supabase/supabase-js';
// Este puente solo entrega una sesión a la interfaz. El servidor vuelve a verificar todo.
(function(global){
 let cliente,config=null,contexto=null,error='',pendiente='',invitacion='';
 if(location.hash.startsWith('#invitacion=')){invitacion=location.hash.slice(12);history.replaceState(null,'',location.pathname+location.search);}
 const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 if(location.hash.startsWith('#acceso-admin=')){pendiente=location.hash.slice(14);history.replaceState(null,'',location.pathname+location.search);}
 const aviso=()=>document.dispatchEvent(new Event('agendappx:sesion'));
 const listo=(async()=>{try{
 try{const r=await fetch('/api/cuentas/config',{cache:'no-store',signal:AbortSignal.timeout(8000)});if(!r.ok)throw new Error();config=await r.json();if(config.habilitado)localStorage.setItem('agendappx.config',JSON.stringify(config));}catch{try{config=JSON.parse(localStorage.getItem('agendappx.config'));}catch{}if(!config)return;}
 if(!config.habilitado)return;
 if(config.supabaseURL!=='https://zkqwephmuflbuagevvxj.supabase.co'||!config.llavePublica)throw new Error('Acceso pendiente de configurar.');
 localStorage.setItem('agendappx.cuentas.activas','si');
 cliente=createClient(config.supabaseURL,config.llavePublica,{auth:{detectSessionInUrl:false,flowType:'pkce',persistSession:true,autoRefreshToken:true,storageKey:'agendappx.auth'}});
 cliente.auth.onAuthStateChange(()=>{setTimeout(()=>{contexto=null;aviso();},0);});
 }catch{error='No se pudo preparar el acceso.';} })();
 function sinConexion(){try{const s=JSON.parse(localStorage.getItem('agendappx.auth')),c=JSON.parse(localStorage.getItem('agendappx.contexto'));if(!s?.user?.id||c?.usuarioId!==s.user.id||!c.miembros?.[0])return null;const m=c.miembros[0],p=JSON.parse(atob(s.access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));return {usuarioId:s.user.id,negocioId:m.negocioId,rol:m.rol,aal:p.aal,accessToken:s.access_token,sinConexion:true};}catch{return null;}}
 async function sesion(){await listo;if(navigator.onLine===false)return sinConexion();if(!cliente)return null;const {data}=await cliente.auth.getSession(),s=data.session;if(!s)return null;
 if(!contexto||contexto.usuarioId!==s.user.id){
  try{const r=await fetch('/api/cuentas/contexto',{headers:{Authorization:'Bearer '+s.access_token},cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok){if(r.status===401||r.status===403)localStorage.removeItem('agendappx.contexto');return null;}contexto=await r.json();localStorage.setItem('agendappx.contexto',JSON.stringify(contexto));}
  catch{try{const c=JSON.parse(localStorage.getItem('agendappx.contexto'));if(c?.usuarioId===s.user.id)contexto=c;}catch{}}
 }
 if(!contexto||contexto.usuarioId!==s.user.id)return null;
 const m=contexto.miembros?.[0];if(!m)return null;
 const {data:a}=await cliente.auth.mfa.getAuthenticatorAssuranceLevel();
 return {usuarioId:s.user.id,negocioId:m.negocioId,rol:m.rol,aal:a.currentLevel,recuperarLegado:contexto.recuperarLegado===true,accessToken:s.access_token};
 }
 async function montar(root){await listo;if(!root.isConnected)return;
 if(!cliente){root.innerHTML='<p class="foot">El acceso de cuentas todavía no está activado. '+esc(error)+'</p>';return;}
 root.innerHTML=`<div id="auth-existente"><p class="foot">Acceso de Admin: usa el enlace privado de un solo uso. El segundo paso se genera en tu app de autenticación, sin SMS.</p>
 <div class="group"><label class="cell"><span class="l">Enlace privado</span><input class="in" id="auth-link" type="password" autocomplete="off" placeholder="Pega tu enlace" style="min-width:0;max-width:190px"></label><button type="button" class="cell" id="auth-entrar">Usar enlace de acceso</button></div></div>
 <div id="auth-factor" class="group" hidden><p class="foot" id="auth-texto"></p><img id="auth-qr" alt="Código para configurar la verificación en dos pasos" hidden style="display:block;max-width:220px;width:70%;margin:12px auto"><p class="foot" id="auth-secret" hidden style="overflow-wrap:anywhere"></p><label class="cell"><span class="l">Código de tu app</span><input class="in" id="auth-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" style="max-width:140px"></label><button type="button" class="cell" id="auth-verificar">Verificar dos pasos</button></div>
 <p class="foot" role="status" id="auth-status"></p><button type="button" class="cell" id="auth-salir">Cerrar sesión</button>
 <div id="auth-invitar-panel" hidden><p class="gh">Tu equipo</p><div class="group" id="auth-equipo"></div><p class="gh">Compartir acceso</p><p class="foot">Comparte este enlace solo con la persona que administrará contigo el salón. Vence en 48 horas y se usa una vez.</p><button type="button" class="cell" id="auth-invitar">Crear enlace para otra administradora</button><div class="group" id="auth-enlace-panel" hidden><label class="cell" style="display:block"><span class="l">Enlace privado</span><textarea class="in" id="auth-enlace" readonly aria-label="Enlace de invitación" style="display:block;width:100%;min-height:72px;margin-top:8px;overflow-wrap:anywhere"></textarea></label></div><button type="button" class="cell" id="auth-copiar" hidden>Copiar enlace</button></div>
 <div id="auth-unirse-panel" hidden><p class="gh">Unirme al salón</p><p class="foot">Este acceso temporal se guarda en este dispositivo. Si cierras sesión o borras los datos del navegador, necesitarás otra invitación hasta activar el correo.</p><div class="group"><label class="cell"><span class="l" style="flex:none;white-space:nowrap">Tu nombre</span><input class="in" id="auth-nombre" maxlength="200" autocomplete="name" placeholder="Nombre y apellido" style="min-width:0"></label></div><div id="auth-captcha"></div><button type="button" class="cta" id="auth-unirse">Continuar con la invitación</button></div>`;
 const $=s=>root.querySelector(s);let factor=null,ocupado=false;
 $('#auth-link').value=pendiente;pendiente='';
 let captchaToken='',captchaWidget=null;
 async function llamada(path,body,access){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+access},body:JSON.stringify(body),cache:'no-store'});let d={};try{d=await r.json();}catch{}if(!r.ok)throw new Error(d.error||'No se pudo completar. Intenta de nuevo.');return d;}
 async function estadoEquipo(){const actual=await sesion();const permitido=actual?.rol==='admin'&&actual.aal==='aal2';$('#auth-invitar-panel').hidden=!permitido;if(!permitido)return;const r=await fetch('/api/negocios/'+encodeURIComponent(actual.negocioId)+'/miembros',{headers:{Authorization:'Bearer '+actual.accessToken},cache:'no-store'});if(!r.ok)throw new Error('No se pudo consultar el equipo.');const d=await r.json();$('#auth-equipo').innerHTML=d.miembros.map(m=>`<div class="cell"><span class="l">${esc(m.nombre)}<small>${esc(m.rol)}${m.propia?' · Tú':''}</small></span>${m.propia?'':`<button type="button" class="btn" data-quitar-miembro="${esc(m.id)}">Quitar acceso</button>`}</div>`).join('');}
 async function aceptarInvitacion(){if(!invitacion)return;const nombre=$('#auth-nombre').value.trim();if(!nombre)throw new Error('Escribe tu nombre.');const {data}=await cliente.auth.getSession();if(!data.session)throw new Error('Inicia tu acceso de nuevo.');await llamada('/api/invitaciones/aceptar',{codigo:invitacion,nombre},data.session.access_token);invitacion='';$('#auth-unirse-panel').hidden=true;contexto=null;aviso();await estadoEquipo();}
 function prepararCaptcha(){
  if(!config.turnstileSiteKey){$('#auth-status').textContent='La invitación aún no está disponible. Pide a la administradora que termine la configuración.';$('#auth-unirse').disabled=true;return;}
  const cargar=()=>{if(!root.isConnected||captchaWidget!==null)return;captchaWidget=window.turnstile.render($('#auth-captcha'),{sitekey:config.turnstileSiteKey,callback:t=>{captchaToken=t;},'expired-callback':()=>{captchaToken='';},'error-callback':()=>{captchaToken='';}});};
  if(window.turnstile){cargar();return;}const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.onload=cargar;script.onerror=()=>{$('#auth-status').textContent='No se pudo verificar la invitación. Revisa tu conexión.';};document.head.appendChild(script);
 }
 if(invitacion){$('#auth-existente').hidden=true;$('#auth-unirse-panel').hidden=false;const previo=await cliente.auth.getSession();$('#auth-salir').hidden=!previo.data.session;prepararCaptcha();}

 async function preparar(){const {data}=await cliente.auth.getSession();if(!data.session)return;const {data:a,error:e}=await cliente.auth.mfa.getAuthenticatorAssuranceLevel();if(e)throw e;
 if(a.currentLevel==='aal2'){if(invitacion)await aceptarInvitacion();contexto=null;await sesion();await estadoEquipo();$('#auth-status').textContent='Acceso verificado. Pulsa Listo.';aviso();return;}
 const {data:f,error:fe}=await cliente.auth.mfa.listFactors();if(fe)throw fe;factor=f.totp.find(x=>x.status==='verified')?.id;
 if(!factor){for(const x of f.all.filter(x=>x.factor_type==='totp'&&x.status!=='verified'))await cliente.auth.mfa.unenroll({factorId:x.id});const {data:n,error:ne}=await cliente.auth.mfa.enroll({factorType:'totp',friendlyName:'Agendappx Admin'});if(ne)throw ne;factor=n.id;$('#auth-qr').src=n.totp.qr_code;$('#auth-qr').hidden=false;$('#auth-secret').textContent='Clave manual: '+n.totp.secret;$('#auth-secret').hidden=false;}
 $('#auth-factor').hidden=false;$('#auth-texto').textContent='Abre tu app de autenticación (por ejemplo Microsoft Authenticator) y escribe su código actual.';
 }
 root.addEventListener('click',async ev=>{const boton=ev.target.closest('button'),id=boton?.id,quitar=boton?.dataset.quitarMiembro;if((!id&&!quitar)||ocupado)return;if(quitar&&!confirm('Esta persona perderá el acceso al salón. ¿Quitar acceso?'))return;ocupado=true;$('#auth-status').textContent='Comprobando…';try{
 if(quitar){const actual=await sesion();if(!actual||actual.rol!=='admin'||actual.aal!=='aal2')throw new Error('Completa tu acceso de administrador.');const r=await fetch('/api/negocios/'+encodeURIComponent(actual.negocioId)+'/miembros/'+encodeURIComponent(quitar),{method:'DELETE',headers:{Authorization:'Bearer '+actual.accessToken},cache:'no-store'});if(!r.ok)throw new Error('No se pudo quitar el acceso.');await estadoEquipo();$('#auth-status').textContent='Acceso retirado.';}
 if(id==='auth-invitar'){const actual=await sesion();if(!actual||actual.rol!=='admin'||actual.aal!=='aal2')throw new Error('Completa tu acceso de administrador.');const d=await llamada('/api/negocios/'+encodeURIComponent(actual.negocioId)+'/invitaciones',{nombre:'Administradora invitada'},actual.accessToken);$('#auth-enlace').value=d.enlace;$('#auth-enlace-panel').hidden=false;$('#auth-copiar').hidden=false;$('#auth-status').textContent='Enlace creado. Compártelo solo con la persona invitada.';}
 if(id==='auth-copiar'){await navigator.clipboard.writeText($('#auth-enlace').value);$('#auth-status').textContent='Enlace copiado.';}
 if(id==='auth-unirse'){if(!invitacion||!/^[A-Za-z0-9_-]{22}$/.test(invitacion))throw new Error('La invitación no está disponible.');if(!$('#auth-nombre').value.trim())throw new Error('Escribe tu nombre.');const {data:prev}=await cliente.auth.getSession();if(prev.session)throw new Error('Cierra la sesión abierta antes de usar esta invitación.');if(!captchaToken)throw new Error('Completa la verificación de seguridad.');const result=await cliente.auth.signInAnonymously({options:{captchaToken}});captchaToken='';if(result.error){if(captchaWidget!==null)window.turnstile.reset(captchaWidget);throw result.error;}await preparar();}
 if(id==='auth-entrar'){let h=$('#auth-link').value.trim();if(h.startsWith('https://')){const u=new URL(h);if(u.origin!==location.origin)throw new Error('Enlace de otra página.');h=u.hash.slice(14);}if(!/^[a-fA-F0-9]{32,128}$/.test(h))throw new Error('Pega el enlace privado completo.');$('#auth-link').value='';const {error:e}=await cliente.auth.verifyOtp({token_hash:h,type:'magiclink'});if(e)throw e;await preparar();}
 if(id==='auth-verificar'){if(!factor||!/^\d{6}$/.test($('#auth-code').value))throw new Error('Escribe seis dígitos.');const {error:e}=await cliente.auth.mfa.challengeAndVerify({factorId:factor,code:$('#auth-code').value});$('#auth-code').value='';if(e)throw e;$('#auth-factor').hidden=true;$('#auth-qr').removeAttribute('src');$('#auth-secret').textContent='';if(invitacion)await aceptarInvitacion();contexto=null;await sesion();await estadoEquipo();$('#auth-status').textContent='Acceso verificado.';aviso();}
 if(id==='auth-salir'){await cliente.auth.signOut();contexto=null;localStorage.removeItem('agendappx.contexto');$('#auth-factor').hidden=true;$('#auth-qr').removeAttribute('src');$('#auth-secret').textContent='';$('#auth-status').textContent='Sesión cerrada.';$('#auth-enlace').value='';$('#auth-enlace-panel').hidden=true;$('#auth-copiar').hidden=true;if(invitacion)$('#auth-salir').hidden=true;await estadoEquipo();aviso();}
 }catch(e){$('#auth-status').textContent=e.message||'No se pudo verificar el acceso.';}finally{ocupado=false;}});
 try{if(!invitacion)await preparar();await estadoEquipo();}catch{$('#auth-status').textContent='Revisa tu acceso.';}
 }
 void listo.then(()=>{if(pendiente||invitacion)document.dispatchEvent(new Event('agendappx:abrir-acceso'));});
 async function modo(){await listo;return config?.habilitado===true||localStorage.getItem('agendappx.cuentas.activas')==='si';}
 async function salir(){await listo;if(cliente)await cliente.auth.signOut();contexto=null;localStorage.removeItem('agendappx.contexto');aviso();}
 global.AgendappxCuentas=Object.freeze({sesion,montar,modo,listo,salir});
})(window);
