import { messages } from "@/lib/messages";

export class DomainError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, message: string, httpStatus: number) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message: string = messages.unauthorized) {
    super("unauthorized", message, 401);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message: string = messages.forbidden) {
    super("forbidden", message, 403);
  }
}

/**
 * ARCHITECTURE.md 17.3 — 이 예외 1건은 즉시 알람 대상이다.
 * details 는 조사 단서일 뿐이며 사용자 메시지에 포함하지 않는다.
 */
export type TenantViolationDetails = {
  ctxKind?: string;
  ctxCompanyId?: string | null;
  rowCompanyId?: string | null;
  ctxProjectId?: string | null;
  rowProjectId?: string | null;
};

export class TenantViolationError extends DomainError {
  readonly details: TenantViolationDetails;

  constructor(details: TenantViolationDetails = {}, message: string = messages.tenantViolation) {
    super("tenant_violation", message, 403);
    this.details = details;
  }
}

export class VerificationRequiredError extends DomainError {
  constructor(message: string = messages.verificationRequired) {
    super("verification_required", message, 403);
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string = messages.notFound) {
    super("not_found", message, 404);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string = messages.conflictSave) {
    super("conflict", message, 409);
  }
}

export class RateLimitError extends DomainError {
  constructor(message: string = messages.rateLimited) {
    super("rate_limited", message, 429);
  }
}

export class NotImplementedError extends DomainError {
  constructor(message: string = messages.notImplemented) {
    super("not_implemented", message, 501);
  }
}

export function errorToHttp(error: unknown): {
  status: number;
  code: string;
  message: string;
} {
  if (error instanceof DomainError) {
    return {
      status: error.httpStatus,
      code: error.code,
      message: error.message,
    };
  }
  return {
    status: 500,
    code: "internal_error",
    message: messages.internalError,
  };
}
