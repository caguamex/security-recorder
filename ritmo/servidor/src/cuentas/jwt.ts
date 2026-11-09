import { createRemoteJWKSet, customFetch, decodeProtectedHeader, jwtVerify, type FetchImplementation } from 'jose';
import { ErrorAPI } from '../modelo.js';
import type { Identidad } from './permisos.js';
export type IdentidadFirmada = Identidad & { sesionId: string };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

/** Verifica la firma; después se deben comprobar sesión vigente y membresía en la base. */
export class VerificadorJWT {
  private emisor: string;
  private llaves: ReturnType<typeof createRemoteJWKSet>;
  constructor(urlSupabase: string, private opciones: { fetch?: FetchImplementation; ahora?: () => Date } = {}) {
    const base = new URL(urlSupabase);
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname !== '/') {
      throw new Error('La dirección de Supabase debe ser un origen HTTPS de confianza.');
    }
    this.emisor = base.origin + '/auth/v1';
    this.llaves = createRemoteJWKSet(new URL(this.emisor + '/.well-known/jwks.json'), {
      cacheMaxAge: 300000, cooldownDuration: 30000, timeoutDuration: 5000,
      ...(opciones.fetch ? { [customFetch]: opciones.fetch } : {}),
    });
  }
  async verificar(token: string): Promise<IdentidadFirmada> {
    const invalido = () => new ErrorAPI(401, 'Inicia sesión de nuevo.');
    if (typeof token !== 'string' || token.length > 16384 || token.length < 20) throw invalido();
    try {
      const cabecera = decodeProtectedHeader(token);
      if (!['ES256','RS256'].includes(String(cabecera.alg)) || typeof cabecera.kid !== 'string' ||
          !cabecera.kid || cabecera.kid.length > 200) throw invalido();
      // Nunca usar jku/x5u u otro emisor indicado por el token para descargar llaves.
      const { payload } = await jwtVerify(token, this.llaves, {
        issuer: this.emisor, audience: 'authenticated', algorithms: ['ES256','RS256'],
        requiredClaims: ['sub','exp','iat','session_id','aal','role'],
        maxTokenAge: 3600, clockTolerance: 5, currentDate: this.opciones.ahora?.(),
      });
      if (typeof payload.sub !== 'string' || !uuid.test(payload.sub) ||
          typeof payload.session_id !== 'string' || !uuid.test(payload.session_id) ||
          !['aal1','aal2'].includes(String(payload.aal)) || payload.role !== 'authenticated' || payload.is_anonymous === true ||
          !Number.isSafeInteger(payload.exp) || !Number.isSafeInteger(payload.iat) ||
          payload.exp! - payload.iat! > 3600 || payload.exp! <= payload.iat!) throw invalido();
      // No devolver ni confiar en user_metadata o roles de negocio contenidos en el JWT.
      return { usuarioId: payload.sub, aal: payload.aal as 'aal1' | 'aal2', sesionId: payload.session_id };
    } catch (e: any) {
      if (e?.code === 'ERR_JWKS_TIMEOUT' || e?.code === 'ECONNRESET' || e?.code === 'ENOTFOUND') {
        throw new ErrorAPI(503, 'No se pudo verificar tu sesión. Intenta de nuevo.');
      }
      throw invalido();
    }
  }
}
