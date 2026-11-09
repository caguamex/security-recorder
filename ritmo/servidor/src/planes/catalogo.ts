export const PLANES=[
 {id:'solo',nombre:'Solo',mensual:249,personas:1,admins:1,descripcion:'Para trabajar por tu cuenta'},
 {id:'salon',nombre:'Salón',mensual:449,personas:5,admins:2,descripcion:'Para salones y barberías con equipo',recomendado:true},
 {id:'pro',nombre:'Pro',mensual:799,personas:null,admins:null,descripcion:'Para equipos grandes y varias sucursales'}
] as const;
export const PRUEBA_DIAS=30;
export const precioPlan=(id:string,anual=false,fundadora=false)=>{const p=PLANES.find(p=>p.id===id);if(!p)throw new Error('Plan no disponible');return (fundadora&&id==='salon'?199:p.mensual)*(anual?10:1);};
export function diasRestantes(fin:string|Date|null,ahora=Date.now()){return fin?Math.max(0,Math.ceil((new Date(fin).getTime()-ahora)/86400000)):null;}
export function errorPlan(e:any){if(e?.code==='P0001'&&e?.message==='agendappx_limite_plan')return {status:409,mensaje:'Llegaste al límite de personas o Admin de tu plan. Consulta Mi plan; tus datos se conservan.'};if(e?.code==='P0001'&&e?.message==='agendappx_prueba_finalizada')return {status:402,mensaje:'Tu prueba terminó. Tus datos se conservan y puedes consultarlos. Los cobros todavía no están habilitados.'};return null;}
