// Ejecutar únicamente dentro del contenedor Railway, después de confirmar la vinculación.
const accion=process.argv[2];
if(!['estado','codigo'].includes(accion)||process.env.WA_CODIGOS_VINCULAR!=='true'||!process.env.WA_CODIGOS_OPERACION_KEY)throw new Error('La operación necesita autorización expresa y configuración privada.');
const r=await fetch('http://127.0.0.1:8081/'+accion,{method:accion==='codigo'?'POST':'GET',headers:{Authorization:'Bearer '+process.env.WA_CODIGOS_OPERACION_KEY},signal:AbortSignal.timeout(20000)});
if(!r.ok)throw new Error('No se completó la operación; la sesión existente se conserva.');
const d=await r.json();if(accion==='codigo')console.log('Código de Agendappx (vinculación autorizada): '+d.codigo.slice(0,4)+'-'+d.codigo.slice(4));else console.log(JSON.stringify(d));
