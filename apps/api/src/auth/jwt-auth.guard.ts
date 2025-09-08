import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const method = (req.method || '').toUpperCase();
    const path = String(req.url || '').split('?')[0];

    if (method === 'OPTIONS') return true;

    // Dev bypass
    if (process.env.API_AUTH_DISABLED === '1') return true;

    // @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    // Also allow these paths without auth (robust to optional '/api' prefix)
    if (/(^|\/)standards(\/|$)/.test(path) || /( ^|\/)ai(\/|$)/.test(path)) return true;

    // Internal key
    if (req.headers['x-internal-key'] === (process.env.INTERNAL_KEY || 'dev-local-key')) return true;

    // TODO: validate real session/JWT for prod
    return false;
  }
}