import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

type JwtPayload = {
  sub?: string;
  userId?: string;
  email?: string;
  tenantId?: string | null;
  [k: string]: any;
};

@Injectable()
export class JwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const authHeader = (req.headers['authorization'] || '') as string;

    const tryInternal = (): boolean => {
      const internalKey = process.env.INTERNAL_API_KEY;
      const providedKey = req.headers['x-api-key'] as string | undefined;
      if (internalKey && providedKey && providedKey === internalKey) {
        const defaultTenant = process.env.DEFAULT_TENANT_ID || 'dev-tenant';
        const tenantFromHeader = (req.headers['x-tenant-id'] as string | undefined) ?? undefined;
        const tenantId = tenantFromHeader || defaultTenant;

        req.user = { userId: 'internal', email: null, tenantId };
        return true;
      }
      return false;
    };

    // Bearer path
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-change-me') as JwtPayload;
        const tenantInToken = (payload.tenantId ?? null) as string | null;

        if (!tenantInToken) {
          // fall back to internal if allowed
          if (tryInternal()) return true;
          throw new ForbiddenException('Missing tenant in token');
        }

        req.user = {
          userId: payload.sub || payload.userId || 'unknown',
          email: payload.email || null,
          tenantId: tenantInToken,
        };
        return true;
      } catch {
        if (tryInternal()) return true;
        throw new UnauthorizedException('Invalid or expired token');
      }
    }

    // Internal path
    if (tryInternal()) return true;

    throw new ForbiddenException('Forbidden');
  }
}