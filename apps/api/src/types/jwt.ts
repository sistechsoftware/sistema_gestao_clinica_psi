import type { FastifyRequest } from 'fastify';

// Contrato do access token (doc 03; §10):
// sub = userId; tid = tenant ativo; role = papel no tenant ativo;
// sam = super admin global (R10).

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  tid?: string;
  role?: 'ADMIN' | 'PROFESSIONAL' | 'SECRETARY';
  sam: boolean;
  iat?: number;
  exp?: number;
}

/** Acessador tipado do payload JWT decorado pelo @fastify/jwt. */
export function getJwtPayload(request: FastifyRequest): JwtPayload {
  return request.user as JwtPayload;
}
