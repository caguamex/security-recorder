import {createClient} from '@supabase/supabase-js';
// Este puente solo entrega una sesión a la interfaz. El servidor vuelve a verificar todo.
(function(global){
 let cliente,config=null,contexto=null,error='',pendiente='';
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
 return {usuarioId:s.user.id,negocioId:m.negocioId,rol:m.rol,aal:a.currentLevel,accessToken:s.access_token};
 }
 async function montar(root){await listo;if(!root.isConnected)return;
 if(!cliente){root.innerHTML='<p class="foot">El acceso de cuentas todavía no está activado. '+esc(error)+'</p>';return;}
 root.innerHTML=`<p class="foot">Acceso de Admin: usa el enlace privado de un solo uso. El segundo paso se genera en tu app de autenticación, sin SMS.</p>
 <div class="group"><label class="cell"><span class="l">Enlace privado</span><input class="in" id="auth-link" type="password" autocomplete="off" placeholder="Pega tu enlace" style="min-width:0;max-width:190px"></label><button type="button" class="cell" id="auth-entrar">Usar enlace de acceso</button></div>
 <div id="auth-factor" class="group" hidden><p class="foot" id="auth-texto"></p><img id="auth-qr" alt="Código para configurar la verificación en dos pasos" hidden style="display:block;max-width:220px;width:70%;margin:12px auto"><p class="foot" id="auth-secret" hidden style="overflow-wrap:anywhere"></p><label class="cell"><span class="l">Código de tu app</span><input class="in" id="auth-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" style="max-width:140px"></label><button type="button" class="cell" id="auth-verificar">Verificar dos pasos</button></div>
 <p class="foot" role="status" id="auth-status"></p><button type="button" class="cell" id="auth-salir">Cerrar sesión</button>`;
 const $=s=>root.querySelector(s);let factor=null,ocupado=false;
 $('#auth-link').value=pendiente;pendiente='';
 async function preparar(){const {data}=await cliente.auth.getSession();if(!data.session)return;const {data:a,error:e}=await cliente.auth.mfa.getAuthenticatorAssuranceLevel();if(e)throw e;
 if(a.currentLevel==='aal2'){contexto=null;await sesion();$('#auth-status').textContent='Acceso verificado. Pulsa Listo y vuelve a abrir WhatsApp.';aviso();return;}
 const {data:f,error:fe}=await cliente.auth.mfa.listFactors();if(fe)throw fe;factor=f.totp.find(x=>x.status==='verified')?.id;
 if(!factor){for(const x of f.all.filter(x=>x.factor_type==='totp'&&x.status!=='verified'))await cliente.auth.mfa.unenroll({factorId:x.id});const {data:n,error:ne}=await cliente.auth.mfa.enroll({factorType:'totp',friendlyName:'Agendappx Admin'});if(ne)throw ne;factor=n.id;$('#auth-qr').src=n.totp.qr_code;$('#auth-qr').hidden=false;$('#auth-secret').textContent='Clave manual: '+n.totp.secret;$('#auth-secret').hidden=false;}
 $('#auth-factor').hidden=false;$('#auth-texto').textContent='Abre tu app de autenticación (por ejemplo Microsoft Authenticator) y escribe su código actual.';
 }
 root.addEventListener('click',async ev=>{const id=ev.target.closest('button')?.id;if(!id||ocupado)return;ocupado=true;$('#auth-status').textContent='Comprobando…';try{
 if(id==='auth-entrar'){let h=$('#auth-link').value.trim();if(h.startsWith('https://')){const u=new URL(h);if(u.origin!==location.origin)throw new Error('Enlace de otra página.');h=u.hash.slice(14);}if(!/^[a-fA-F0-9]{32,128}$/.test(h))throw new Error('Pega el enlace privado completo.');$('#auth-link').value='';const {error:e}=await cliente.auth.verifyOtp({token_hash:h,type:'magiclink'});if(e)throw e;await preparar();}
 if(id==='auth-verificar'){if(!factor||!/^\d{6}$/.test($('#auth-code').value))throw new Error('Escribe seis dígitos.');const {error:e}=await cliente.auth.mfa.challengeAndVerify({factorId:factor,code:$('#auth-code').value});$('#auth-code').value='';if(e)throw e;$('#auth-factor').hidden=true;$('#auth-qr').removeAttribute('src');$('#auth-secret').textContent='';contexto=null;await sesion();$('#auth-status').textContent='Acceso verificado.';aviso();}
 if(id==='auth-salir'){await cliente.auth.signOut();contexto=null;localStorage.removeItem('agendappx.contexto');$('#auth-factor').hidden=true;$('#auth-qr').removeAttribute('src');$('#auth-secret').textContent='';$('#auth-status').textContent='Sesión cerrada.';aviso();}
 }catch(e){$('#auth-status').textContent=e.message||'No se pudo verificar el acceso.';}finally{ocupado=false;}});
 try{await preparar();}catch{$('#auth-status').textContent='Revisa el acceso antes de vincular.';}
 }
 void listo.then(()=>{if(pendiente)document.dispatchEvent(new Event('agendappx:abrir-acceso'));});
 async function modo(){await listo;return config?.habilitado===true||localStorage.getItem('agendappx.cuentas.activas')==='si';}
 global.AgendappxCuentas=Object.freeze({sesion,montar,modo,listo});
})(window);
