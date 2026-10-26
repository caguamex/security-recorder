import test from 'node:test';
import assert from 'node:assert/strict';
import {pronostico,escenarios} from '../../herramientas/pronostico-whatsapp.mjs';
test('Pronóstico incluye conexión permanente, cron, uso previo y mínimo Hobby; no confunde consumo con factura',()=>{
  const p=pronostico({ramGB:.25,cpuMedia:.02});assert.equal(p.corridas,8640);
  assert.ok(Math.abs(p.conexion-2.95)<1e-9);assert.ok(Math.abs(p.cron-.2166666667)<1e-9);
  assert.equal(p.cabeEnLimite,true);assert.equal(escenarios[0].facturaAntesDeImpuestos,5);
  assert.equal(escenarios[3].cabeEnLimite,false);assert.equal(escenarios[2].recomendado,false);assert.equal(escenarios[1].recomendado,true);
  assert.throws(()=>pronostico({ramGB:NaN,cpuMedia:.1}));
});
