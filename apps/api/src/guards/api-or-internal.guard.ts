import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class ApiOrInternalGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const expected = process.env.INTERNAL_API_KEY;

    // Internal key path
    const internal = (req.headers['x-internal-key'] || req.headers['x-internal-api-key']) as string | undefined;
    if (internal && expected && internal === expected) {
      const tenantId = (req.headers['x-tenant-id'] as string) || process.env.DEFAULT_TENANT_ID || null;
      (req as any).user = { tenantId, userId: 'internal' };
      return true;
    }

    // Bearer path
    const auth = req.headers['authorization'];
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException();
    const token = auth.slice(7);
    const parts = token.split('.');
    if (parts.length < 2) throw new UnauthorizedException();
    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
      (req as any).user = { tenantId: payload?.tenantId || process.env.DEFAULT_TENANT_ID || null, userId: payload?.sub || payload?.id || 'user' };
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}