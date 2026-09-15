// ============================================================================
// Erros de domínio — a única exceção que casos de uso devem lançar.
// Mapeamento → HTTP fica no error-handler central (error-handler.ts).
// ============================================================================

export class DomainError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'DomainError';
    this.status = status;
    this.code = code;
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Authentication required') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Insufficient permissions') {
    super(403, 'FORBIDDEN', message);
  }
}

export class NotFoundError extends DomainError {
  constructor(message = 'Resource not found') {
    super(404, 'NOT_FOUND', message);
  }
}

export class ConflictError extends DomainError {
  constructor(message = 'Resource already exists') {
    super(409, 'CONFLICT', message);
  }
}

export class ValidationError extends DomainError {
  constructor(message = 'Invalid input') {
    super(400, 'VALIDATION', message);
  }
}

export class RateLimitError extends DomainError {
  constructor(message = 'Too many attempts, try again later') {
    super(429, 'RATE_LIMITED', message);
  }
}
