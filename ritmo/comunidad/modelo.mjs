// Datos exclusivos de la demostración. No se leen tablas, personas ni citas reales.
export const CLAVE='agendappx.comunidad.demo.v1';
export const categorias=['Todo','Cortes','Uñas','Cejas','Pestañas','Cabello'];
export const negocios=[
 {id:'distrito-barber',nombre:'Distrito Barber',tipo:'Barbería',zona:'Centro · Monclova',distancia:1.2,avatar:'DB',foto:'assets/barberia.png',descripcion:'Cortes con detalle, degradados y arreglo de barba. Elige tu estilo y un espacio en la agenda.',especialistas:['Diego','Luis'],servicios:[{id:'corte-barba',nombre:'Corte + barba',categoria:'Cortes',precio:280,minutos:45},{id:'corte',nombre:'Corte clásico',categoria:'Cortes',precio:180,minutos:30}]},
 {id:'ab-beauty-room',nombre:'AB Beauty Room',tipo:'Salón de belleza',zona:'Guadalupe · Monclova',distancia:2.3,avatar:'AB',logo:'assets/logo-ab.jpg',foto:'assets/cejas.jpg',descripcion:'Un espacio para cuidar cada detalle. Diseño de cejas, lifting y extensiones de pestañas.',especialistas:['Ale','Mariana'],servicios:[{id:'cejas',nombre:'Diseño de cejas',categoria:'Cejas',precio:300,minutos:30},{id:'lifting',nombre:'Lifting de pestañas',categoria:'Pestañas',precio:450,minutos:60},{id:'extensiones',nombre:'Extensiones de pestañas',categoria:'Pestañas',precio:650,minutos:90}]},
 {id:'luna-nails',nombre:'Luna Nails',tipo:'Estudio de uñas',zona:'Los Pinos · Monclova',distancia:3.1,avatar:'LN',foto:'assets/unas.png',descripcion:'Manos cuidadas, acabados finos y diseños para cada ocasión. Encuentra tu próxima manicura.',especialistas:['Fernanda'],servicios:[{id:'francesas',nombre:'Uñas francesas',categoria:'Uñas',precio:380,minutos:60},{id:'gelish',nombre:'Gelish en manos',categoria:'Uñas',precio:300,minutos:45}]}
];
export const publicaciones=[
 {id:'degradado',negocio:'distrito-barber',servicio:'corte-barba',titulo:'Degradado bajo + textura',texto:'Un acabado limpio, trabajado a tu estilo. Mira el resultado de hoy.',foto:'assets/barberia.png',alt:'Degradado bajo y barba perfilada; imagen ilustrativa',etiquetas:['degradados','barberías','cortes','barbas'],baseLikes:0},
 {id:'francesas',negocio:'luna-nails',servicio:'francesas',titulo:'Francesas que van con todo',texto:'Base natural y líneas finas. Guarda esta idea para tu próxima visita.',foto:'assets/unas.png',alt:'Manicura francesa en tono natural; imagen ilustrativa',etiquetas:['uñas','manicura','francesas','nails'],baseLikes:0},
 {id:'mirada',negocio:'ab-beauty-room',servicio:'extensiones',titulo:'Una mirada con más volumen',texto:'Extensiones de pestañas: el servicio y sus horarios, aquí mismo.',foto:'assets/pestanas.jpg',alt:'Trabajo de extensiones de pestañas proporcionado por el propietario para demostración',etiquetas:['pestañas','extensiones','volumen'],baseLikes:0},
 {id:'lifting',negocio:'ab-beauty-room',servicio:'lifting',titulo:'El detalle está en la mirada',texto:'Lifting para definir tus pestañas. Explora los servicios del salón.',foto:'assets/cejas.jpg',alt:'Resultado de lifting y definición de cejas, fotografía de demostración',etiquetas:['cejas','pestañas','lifting'],baseLikes:0}
];
export function normalizar(v){return String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').trim();}
export function raiz(v){return v.length>5&&v.endsWith('es')?v.slice(0,-2):v.length>3&&v.endsWith('s')?v.slice(0,-1):v;}
export function coincide(texto,consulta){const palabras=normalizar(texto).split(/\s+/).filter(v=>!['un','una','uno','el','la','los','las','de','y','en','tu','sus'].includes(v)).map(raiz);return normalizar(consulta).split(/\s+/).filter(Boolean).every(q=>palabras.some(p=>p.startsWith(raiz(q))));}
export function servicioDe(p){const b=negocios.find(b=>b.id===p.negocio);return {b,s:b?.servicios.find(s=>s.id===p.servicio)};}
export function filtrar(posts,{busqueda='',categoria='Todo',precio=Infinity,distancia=Infinity,seguidos=null,guardados=null}={}){return posts.filter(p=>{const {b,s}=servicioDe(p);return b&&s&&coincide([p.titulo,p.texto,b.nombre,b.tipo,s.nombre,s.categoria,...p.etiquetas].join(' '),busqueda)&&(categoria==='Todo'||s.categoria===categoria)&&s.precio<=precio&&b.distancia<=distancia&&(!seguidos||seguidos.includes(b.id))&&(!guardados||guardados.includes(p.id));});}
export function fechas(base=new Date()){return Array.from({length:3},(_,i)=>{const d=new Date(base);d.setDate(d.getDate()+i);return {id:[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'),texto:i===0?'Hoy':new Intl.DateTimeFormat('es-MX',{weekday:'short',day:'numeric',month:'short'}).format(d)};});}
export const horarios=['10:00','11:00','12:00','13:00','16:00','17:00','18:00'];
const minutos=h=>Number(h.slice(0,2))*60+Number(h.slice(3));
export function disponible(reservas,{negocio,especialista,fecha,hora,duracion},ahora=new Date()){
 if(!Number.isInteger(duracion)||duracion<=0||duracion>180||minutos(hora)+duracion>1200)return false;
 if(!negocios.some(b=>b.id===negocio&&b.especialistas.includes(especialista))||!fechas(ahora).some(f=>f.id===fecha)||!horarios.includes(hora))return false;
 const inicio=new Date(fecha+'T'+hora+':00');if(inicio<=ahora)return false;
 return !reservas.some(r=>r.negocio===negocio&&r.especialista===especialista&&r.fecha===fecha&&minutos(hora)<minutos(r.hora)+r.duracion&&minutos(r.hora)<minutos(hora)+duracion);
}
