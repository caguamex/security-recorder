/* Identidad visual local y determinista: nunca depende del servicio o especialista.
   El ID sincronizado conserva el color entre dispositivos y sin conexiÃ³n.
   Es una paleta finita: dos clientas pueden compartir tono; el nombre las distingue. */
(function(global){
  'use strict';
  const paleta=Object.freeze(['#2E7AA8','#9A597E','#497F68','#9A6D35','#7463A9','#A25C57','#287F86','#697343']);
  function color(id){
    const clave=String(id??'').trim();
    if(!clave)return '#72767E';
    let hash=2166136261;
    for(let i=0;i<clave.length;i++){hash^=clave.charCodeAt(i);hash=Math.imul(hash,16777619);}
    return paleta[(hash>>>0)%paleta.length];
  }
  global.AgendappxColoresClientas=Object.freeze({color});
})(typeof window==='undefined'?globalThis:window);
