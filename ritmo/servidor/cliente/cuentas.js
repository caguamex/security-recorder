import {montarRegistro} from './registro.js';
import {createClient} from '@supabase/supabase-js';
// Este puente solo entrega una sesión a la interfaz. El servidor vuelve a verificar todo.
(function(global){
 if(location.hash.startsWith('#invitacion=')){globalThis.__agendappxInvitacion=location.hash.slice(12);history.replaceState(null,'',location.pathname+location.search);}
 let abrirRegistro=location.hash==='#registro';if(abrirRegistro)history.replaceState(null,'',location.pathname+location.search);
 let cliente,config=null,contexto=null,error='',pendiente='',solicitud=null,tokenVinculacion='';
 const fetchNativo=global.fetch.bind(global);
 async function transporte(input,init={}){
  const u=new URL(typeof input==='string'?input:input.url);let d;try{d=JSON.parse(init.body);}catch{}
  if(!config?.acceso?.whatsapp||u.origin!==config.supabaseURL||!d)return fetchNativo(input,init);
  let ruta,payload;
  if(u.pathname==='/auth/v1/otp'){ruta='solicitar';payload={canal:d.phone?'whatsapp':'correo',destino:d.phone||d.email,captchaToken:d.gotrue_meta_security?.captcha_token};}
  else if(u.pathname==='/auth/v1/user'&&init.method==='PUT'&&d.phone){ruta='solicitar';payload={canal:'whatsapp',destino:d.phone,vincular:true};}
  else if(u.pathname==='/auth/v1/verify'&&d.token_hash){ruta='privado';payload={token_hash:d.token_hash};}
  else if(u.pathname==='/auth/v1/verify'&&d.token&&['sms','email','phone_change'].includes(d.type)){ruta='verificar';payload={id:solicitud?.id,prueba:solicitud?.prueba,destino:d.phone||d.email,codigo:d.token};}
  if(!ruta)return fetchNativo(input,init);
  const headers={'Content-Type':'application/json',...(tokenVinculacion?{Authorization:'Bearer '+tokenVinculacion}:{})};
  const r=await fetchNativo('/api/acceso/'+ruta,{method:'POST',headers,body:JSON.stringify(payload),cache:'no-store',signal:AbortSignal.timeout(20000)});
  const respuesta=await r.json();if(!r.ok)return new Response(JSON.stringify({msg:respuesta.error||'No se pudo verificar el código.',code:'acceso_no_disponible'}),{status:r.status,headers:{'Content-Type':'application/json'}});
  if(ruta==='solicitar'){solicitud={id:respuesta.id,prueba:respuesta.prueba};return new Response(JSON.stringify(payload.vincular?respuesta.usuario:{}),{status:200,headers:{'Content-Type':'application/json'}});}
  if(ruta==='verificar')solicitud=null;return new Response(JSON.stringify(respuesta),{status:200,headers:{'Content-Type':'application/json'}});
 }
 const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 if(location.hash.startsWith('#acceso-admin=')){pendiente=location.hash.slice(14);history.replaceState(null,'',location.pathname+location.search);}
 const aviso=()=>document.dispatchEvent(new Event('agendappx:sesion'));
 const listo=(async()=>{try{
 try{const r=await fetch('/api/cuentas/config',{cache:'no-store',signal:AbortSignal.timeout(8000)});if(!r.ok)throw new Error();config=await r.json();if(config.habilitado)localStorage.setItem('agendappx.config',JSON.stringify(config));}catch{try{config=JSON.parse(localStorage.getItem('agendappx.config'));}catch{}if(!config)return;}
 if(!config.habilitado)return;
 if(config.supabaseURL!=='https://zkqwephmuflbuagevvxj.supabase.co'||!config.llavePublica)throw new Error('Acceso pendiente de configurar.');
 localStorage.setItem('agendappx.cuentas.activas','si');
 cliente=createClient(config.supabaseURL,config.llavePublica,{global:{fetch:transporte},auth:{detectSessionInUrl:false,flowType:'pkce',persistSession:true,autoRefreshToken:true,storageKey:'agendappx.auth'}});
 cliente.auth.onAuthStateChange(()=>{setTimeout(()=>{contexto=null;aviso();},0);});
 }catch{error='No se pudo preparar el acceso.';} })();
 function sinConexion(){try{const s=JSON.parse(localStorage.getItem('agendappx.auth')),c=JSON.parse(localStorage.getItem('agendappx.contexto'));if(!s?.user?.id||c?.usuarioId!==s.user.id||!c.miembros?.[0])return null;const m=c.miembros.find(m=>m.negocioId===localStorage.getItem('agendappx.negocio.'+s.user.id))||c.miembros[0],p=JSON.parse(atob(s.access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));return {usuarioId:s.user.id,negocioId:m.negocioId,rol:m.rol,aal:p.aal,accessToken:s.access_token,sinConexion:true};}catch{return null;}}
 async function sesion(){await listo;if(navigator.onLine===false)return sinConexion();if(!cliente)return null;const {data}=await cliente.auth.getSession(),s=data.session;if(!s)return null;
 if(!contexto||contexto.usuarioId!==s.user.id){
  try{const r=await fetch('/api/cuentas/contexto',{headers:{Authorization:'Bearer '+s.access_token},cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok){if(r.status===401||r.status===403)localStorage.removeItem('agendappx.contexto');return null;}contexto=await r.json();localStorage.setItem('agendappx.contexto',JSON.stringify(contexto));}
  catch{try{const c=JSON.parse(localStorage.getItem('agendappx.contexto'));if(c?.usuarioId===s.user.id)contexto=c;}catch{}}
 }
 if(!contexto||contexto.usuarioId!==s.user.id)return null;
 const actual=contexto,m=actual.miembros?.find(m=>m.negocioId===localStorage.getItem('agendappx.negocio.'+s.user.id))||actual.miembros?.[0];if(!m)return null;
 const {data:a}=await cliente.auth.mfa.getAuthenticatorAssuranceLevel();
 return {usuarioId:s.user.id,negocioId:m.negocioId,rol:m.rol,aal:a.currentLevel,recuperarLegado:actual.recuperarLegado===true,accessToken:s.access_token};
 }
 async function sesionCliente(){await listo;if(!cliente||!navigator.onLine)return null;const {data}=await cliente.auth.getSession();if(!data.session)return null;const r=await fetch('/api/cliente/contexto',{headers:{Authorization:'Bearer '+data.session.access_token},cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)return null;return {...await r.json(),accessToken:data.session.access_token};}
 async function montar(root,opciones={}){await listo;if(!root.isConnected)return;
 if(!cliente){root.innerHTML='<p class="foot">El acceso de cuentas todavía no está activado. '+esc(error)+'</p>';return;}
 root.innerHTML=`${config.acceso?.whatsapp?`<section id="auth-otp"><h2 style="margin:20px 16px 8px">Entra a Agendappx</h2><p class="foot">Te mandamos un código a tu WhatsApp. Sin contraseñas.</p>
 <form id="auth-form"><div class="group"><label class="cell" for="auth-destino"><span class="l" id="auth-etiqueta">WhatsApp +52</span><input class="in" id="auth-destino" type="tel" inputmode="tel" autocomplete="tel-national" maxlength="24" placeholder="10 dígitos" required style="min-width:0;max-width:180px"></label></div><button class="btn fill" type="submit" id="auth-pedir" style="display:block;width:calc(100% - 32px);margin:16px">Enviar código por WhatsApp</button></form>
 <div class="group" id="auth-otp-code" hidden><label class="cell"><span class="l">Código de acceso</span><input class="in" id="auth-otp-valor" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" style="max-width:140px"></label><button class="cell" type="button" id="auth-confirmar">Entrar</button><button class="cell" type="button" id="auth-reenviar">Pedir otro código</button></div>
 <p class="foot" id="auth-otp-texto" aria-live="polite"></p><button class="cell" type="button" id="auth-correo">Prefiero recibirlo por correo</button><p class="foot" id="auth-correo-nota" hidden>${config.acceso.correo?'Usa el correo que ya está asociado a tu cuenta.':'El correo de respaldo está pendiente de configuración.'}</p></section>`:''}
 <details id="auth-recuperacion" ${config.acceso?.whatsapp&&!pendiente?'':'open'}><summary class="foot">Tengo un enlace privado de recuperación</summary><p class="foot">Úsalo solo si ya recibiste un enlace personal. Admin requiere también tu app autenticadora.</p>
 <div class="group"><label class="cell"><span class="l">Enlace privado</span><input class="in" id="auth-link" type="password" autocomplete="off" placeholder="Pega tu enlace" style="min-width:0;max-width:190px"></label><button type="button" class="cell" id="auth-entrar">Usar enlace de acceso</button></div></details>
 <div id="auth-factor" class="group" hidden><p class="foot" id="auth-texto"></p><img id="auth-qr" alt="Código para configurar la verificación en dos pasos" hidden style="display:block;max-width:220px;width:70%;margin:12px auto"><p class="foot" id="auth-secret" hidden style="overflow-wrap:anywhere"></p><label class="cell"><span class="l">Código de tu app</span><input class="in" id="auth-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" style="max-width:140px"></label><button type="button" class="cell" id="auth-verificar">Verificar dos pasos</button></div>
 <button type="button" class="cell" id="auth-vincular-numero" hidden>Vincular mi WhatsApp a esta cuenta</button><p class="foot" role="status" id="auth-status"></p><button type="button" class="cell" id="auth-salir">Cerrar sesión</button>`;
 const $=s=>root.querySelector(s);let factor=null,ocupado=false,canal='whatsapp',destino='',vincular=false,espera=null,reenviarEn=0;
 function ofrecerCorreo(){if(!root.isConnected||!config.acceso.correo)return;$('#auth-correo-nota').hidden=false;$('#auth-correo').textContent='¿No te llegó? Recibirlo por correo';}
 async function pedir(){if(Date.now()<reenviarEn)throw new Error('Espera un minuto antes de pedir otro código.');destino=$('#auth-destino').value.trim();if(canal==='whatsapp'&&!/^(?:\+?52)?[0-9]{10}$/.test(destino.replace(/[ ()-]/g,'')))throw new Error('Escribe los diez dígitos de tu WhatsApp.');if(canal==='correo'&&!config.acceso.correo)throw new Error('El correo de respaldo todavía no está configurado.');
 clearTimeout(espera);espera=setTimeout(ofrecerCorreo,20000);let e;
 if(vincular){const {data}=await cliente.auth.getSession();tokenVinculacion=data.session?.access_token||'';({error:e}=await cliente.auth.updateUser({phone:'+52'+destino.replace(/\D/g,'').slice(-10)}));}
 else {tokenVinculacion='';({error:e}=await cliente.auth.signInWithOtp({... (canal==='whatsapp'?{phone:'+52'+destino.replace(/\D/g,'').slice(-10)}:{email:destino}),options:{shouldCreateUser:false}}));}
 if(e){clearTimeout(espera);ofrecerCorreo();throw e;}reenviarEn=Date.now()+60000;$('#auth-otp-code').hidden=false;$('#auth-otp-texto').textContent='Si tu cuenta está registrada, recibirás un código de seis dígitos. Vence en diez minutos.';$('#auth-otp-valor').focus();$('#auth-status').textContent='Revisa tu '+(canal==='whatsapp'?'WhatsApp.':'correo.');}
 $('#auth-form')?.addEventListener('submit',async ev=>{ev.preventDefault();if(ocupado)return;ocupado=true;$('#auth-pedir').disabled=true;$('#auth-status').textContent='Enviando código…';try{await pedir();}catch(e){$('#auth-status').textContent=e.message||'No se pudo enviar.';}finally{ocupado=false;$('#auth-pedir').disabled=false;}});
 const registro=montarRegistro(root,{config,cliente,sesion,aviso,modoCliente:opciones.cliente===true,limpiarContexto:()=>{contexto=null;},solicitar:()=>{canal='whatsapp';vincular=false;tokenVinculacion='';return pedir();}});
 if($('#auth-correo'))$('#auth-correo').hidden=!config.acceso?.correo;
 $('#auth-link').value=pendiente;pendiente='';
 async function preparar(){const {data}=await cliente.auth.getSession();$('#auth-salir').hidden=!data.session;if(!data.session)return;const rolRegistro=registro.pendiente()?await registro.verificar():null;if(rolRegistro&&rolRegistro!=='admin'){await registro.finalizar();}
 if(opciones.cliente===true){const actual=await sesionCliente();if(!actual)throw new Error('Verifica tu WhatsApp para continuar.');if($('#auth-otp'))$('#auth-otp').hidden=true;$('#auth-recuperacion').hidden=true;$('#auth-status').textContent='Acceso verificado. Pulsa Listo para continuar.';aviso();return;}
 const vigente=await sesion();if(!registro.pendiente()&&vigente&&vigente.rol!=='admin'){if($('#auth-otp'))$('#auth-otp').hidden=true;$('#auth-status').textContent='Acceso verificado.';aviso();return;}const {data:a,error:e}=await cliente.auth.mfa.getAuthenticatorAssuranceLevel();if(e)throw e;
 if(a.currentLevel==='aal2'){if(registro.pendiente())await registro.finalizar();if($('#auth-otp')){$('#auth-otp').hidden=true;$('#auth-vincular-numero').hidden=!!data.session.user.phone;}contexto=null;const cuenta=await sesion();if(!cuenta)throw new Error('Esta cuenta todavía no tiene acceso al salón.');$('#auth-status').textContent='Acceso verificado. Pulsa Listo para abrir tu agenda.';await registro.equipo();aviso();return;}
 const {data:f,error:fe}=await cliente.auth.mfa.listFactors();if(fe)throw fe;factor=f.totp.find(x=>x.status==='verified')?.id;
 if(!factor){for(const x of f.all.filter(x=>x.factor_type==='totp'&&x.status!=='verified'))await cliente.auth.mfa.unenroll({factorId:x.id});const {data:n,error:ne}=await cliente.auth.mfa.enroll({factorType:'totp',friendlyName:'Agendappx Admin'});if(ne)throw ne;factor=n.id;$('#auth-qr').src=n.totp.qr_code;$('#auth-qr').hidden=false;$('#auth-secret').textContent='Clave manual: '+n.totp.secret;$('#auth-secret').hidden=false;}
 $('#auth-factor').hidden=false;$('#auth-texto').textContent='Abre tu app de autenticación (por ejemplo Microsoft Authenticator) y escribe su código actual.';$('#auth-status').textContent='Escribe el código de tu app autenticadora para completar el acceso.';
 }
 root.addEventListener('click',async ev=>{const id=ev.target.closest('button')?.id;if(!id||!id.startsWith('auth-')||ocupado)return;ocupado=true;$('#auth-status').textContent='Comprobando…';try{
 if(id==='auth-reenviar'){await pedir();}
 if(id==='auth-correo'){clearTimeout(espera);if(!config.acceso.correo){ofrecerCorreo();throw new Error('El correo de respaldo aún no está configurado.');}canal=canal==='correo'?'whatsapp':'correo';vincular=false;tokenVinculacion='';solicitud=null;$('#auth-otp-code').hidden=true;$('#auth-etiqueta').textContent=canal==='correo'?'Correo':'WhatsApp +52';const campo=$('#auth-destino');campo.value='';campo.type=canal==='correo'?'email':'tel';campo.inputMode=canal==='correo'?'email':'tel';campo.autocomplete=canal==='correo'?'email':'tel-national';campo.maxLength=canal==='correo'?254:24;campo.placeholder=canal==='correo'?'tu@correo.com':'10 dígitos';$('#auth-pedir').textContent='Enviar código por '+(canal==='correo'?'correo':'WhatsApp');$('#auth-correo').textContent=canal==='correo'?'Prefiero WhatsApp':'Prefiero recibirlo por correo';$('#auth-status').textContent='';}
 if(id==='auth-vincular-numero'){vincular=true;canal='whatsapp';$('#auth-otp').hidden=false;$('#auth-otp-texto').textContent='Vincula tu número sin crear otra cuenta. Conservas tu agenda y permisos.';$('#auth-destino').focus();$('#auth-status').textContent='Escribe tu número de WhatsApp.';}
 if(id==='auth-confirmar'){const code=$('#auth-otp-valor').value;if(!/^\d{6}$/.test(code))throw new Error('Escribe los seis dígitos.');const {error:e}=await cliente.auth.verifyOtp({... (canal==='whatsapp'?{phone:'+52'+destino.replace(/\D/g,'').slice(-10)}:{email:destino}),token:code,type:vincular?'phone_change':canal==='whatsapp'?'sms':'email'});$('#auth-otp-valor').value='';if(e)throw e;clearTimeout(espera);tokenVinculacion='';const eraVinculacion=vincular;vincular=false;$('#auth-otp').hidden=true;if(eraVinculacion){const {error:refresco}=await cliente.auth.refreshSession();if(refresco)throw new Error('Tu número ya está confirmado. Vuelve a abrir la página para actualizar tu sesión.');contexto=null;}await preparar();}
 if(id==='auth-entrar'){let h=$('#auth-link').value.trim();if(h.startsWith('https://')){const u=new URL(h);if(u.origin!==location.origin)throw new Error('Enlace de otra página.');h=u.hash.slice(14);}if(!/^[a-fA-F0-9]{32,128}$/.test(h))throw new Error('Pega el enlace privado completo.');$('#auth-link').value='';const {error:e}=await cliente.auth.verifyOtp({token_hash:h,type:'magiclink'});if(e)throw e;await preparar();}
 if(id==='auth-verificar'){if(!factor||!/^\d{6}$/.test($('#auth-code').value))throw new Error('Escribe seis dígitos.');const {error:e}=await cliente.auth.mfa.challengeAndVerify({factorId:factor,code:$('#auth-code').value});$('#auth-code').value='';if(e)throw e;$('#auth-factor').hidden=true;$('#auth-qr').removeAttribute('src');$('#auth-secret').textContent='';contexto=null;await sesion();await preparar();$('#auth-status').textContent='Acceso verificado.';aviso();}
 if(id==='auth-salir'){registro.limpiar();await cliente.auth.signOut();contexto=null;localStorage.removeItem('agendappx.contexto');$('#auth-factor').hidden=true;$('#auth-qr').removeAttribute('src');$('#auth-secret').textContent='';solicitud=null;tokenVinculacion='';vincular=false;clearTimeout(espera);if($('#auth-otp'))$('#auth-otp').hidden=false;$('#auth-vincular-numero').hidden=true;$('#auth-salir').hidden=true;$('#auth-status').textContent='Sesión cerrada.';aviso();}
 }catch(e){$('#auth-status').textContent=e.message||'No se pudo verificar el acceso.';}finally{ocupado=false;}});
 try{if(abrirRegistro){abrirRegistro=false;await registro.abrir();}else await preparar();}catch(e){$('#auth-status').textContent=e.message||'No se pudo comprobar tu acceso.';}
 }
 void listo.then(()=>{if(pendiente||abrirRegistro||globalThis.__agendappxInvitacion)document.dispatchEvent(new Event('agendappx:abrir-acceso'));});
 async function modo(){await listo;return config?.habilitado===true||localStorage.getItem('agendappx.cuentas.activas')==='si';}
 async function salir(){await listo;if(cliente)await cliente.auth.signOut();contexto=null;localStorage.removeItem('agendappx.contexto');aviso();}
 global.AgendappxCuentas=Object.freeze({sesion,sesionCliente,montar,modo,listo,salir});
})(window);
