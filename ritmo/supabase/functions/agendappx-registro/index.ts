import {intermediario} from './intermediario.mjs';
// La llave Admin no sale de Supabase ni se comparte con Worker/Railway.
Deno.serve(intermediario({key:Deno.env.get('REGISTRO_OPERACION_KEY'),url:Deno.env.get('SUPABASE_URL'),adminKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}));
