// Pronóstico, no lectura de facturación ni activación de servicios.
export function pronostico({dias=30,baseUSD=2.257121505730959,ramGB,cpuMedia,salidaGB=1,cronSegundos=10,cronRamGB=.25,cronCPUSegundos=2,limiteUSD=10,reservaUSD=2}) {
  for(const v of [dias,baseUSD,ramGB,cpuMedia,salidaGB,cronSegundos,cronRamGB,cronCPUSegundos,limiteUSD,reservaUSD]) {
    if(typeof v!=='number'||!Number.isFinite(v)||v<0)throw new Error('Completa los supuestos con números válidos.');
  }
  if(dias<=0||dias>365)throw new Error('Periodo inválido.');
  const segundos=dias*86400,corridas=dias*24*12;
  const conexion=ramGB*10*(dias/30)+cpuMedia*20*(dias/30)+salidaGB*.05;
  const cron=corridas*cronSegundos/segundos*cronRamGB*10*(dias/30)+corridas*cronCPUSegundos/segundos*20*(dias/30);
  const consumo=baseUSD+conexion+cron,factura=Math.max(5,consumo),margen=limiteUSD-factura;
  return {corridas,conexion,cron,consumo,facturaAntesDeImpuestos:factura,margen,cabeEnLimite:margen>=0,margenOperativo:margen-reservaUSD,recomendado:margen>=reservaUSD};
}
export const escenarios=[
  {nombre:'Ligero',ramGB:.125,cpuMedia:.01},
  {nombre:'Intermedio',ramGB:.25,cpuMedia:.02},
  {nombre:'Alto',ramGB:.5,cpuMedia:.03,cronSegundos:30,cronRamGB:.5,cronCPUSegundos:5},
  {nombre:'Fuera del presupuesto',ramGB:.75,cpuMedia:.05,cronSegundos:30,cronRamGB:.5,cronCPUSegundos:5},
].map(v=>({nombre:v.nombre,supuestos:v,...pronostico(v)}));
if(process.argv[1]?.replaceAll('\\','/').endsWith('/pronostico-whatsapp.mjs')) console.log(JSON.stringify(escenarios,null,2));
