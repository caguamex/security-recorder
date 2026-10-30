// La navegación aprobada mueve las preferencias a Mi negocio → Apariencia.
export async function elegirModo(p,modo){await p.locator('#tabbar').getByRole('tab',{name:'Negocio',exact:true}).click();await p.getByRole('button',{name:/^Apariencia/}).click();await p.getByRole('tab',{name:modo,exact:true}).click();await p.locator('#tabbar').getByRole('tab',{name:'Negocio',exact:true}).click();}
export async function elegirTema(p,tema){await p.locator('#tabbar').getByRole('tab',{name:'Negocio',exact:true}).click();await p.getByRole('button',{name:/^Apariencia/}).click();await p.getByRole('radio',{name:tema,exact:true}).click();await p.locator('#tabbar').getByRole('tab',{name:'Negocio',exact:true}).click();}

// Navegación de etapa 2: servicios y conexiones pertenecen a Mi negocio.
export async function abrirServicios(p){await p.locator('#tabbar').getByRole('tab',{name:'Negocio',exact:true}).click();await p.getByRole('button',{name:/^Servicios y precios/}).click();}
export async function abrirConexiones(p){const b=p.getByRole('button',{name:/^Conexiones/});if(await b.count())await b.click();}
export async function nuevaCita(p){await p.getByRole('button',{name:'Crear',exact:true}).click();await p.locator('#sheetCard').getByRole('button',{name:'Nueva cita',exact:true}).click();}
export function seccion(p,n){return {click:()=>n==='Servicios'?abrirServicios(p):p.locator('#tabbar').getByRole('tab',{name:n,exact:true}).click()};}
