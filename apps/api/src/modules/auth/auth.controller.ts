
import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
constructor(private svc: AuthService) {}

@Post('magic/request')
async magic(@Body() body: { email: string }) {
if (!body?.email) throw new Error('Email required');
return this.svc.requestMagicLink(body.email);
}

@Post('verify')
async verify(@Body() body: { token: string }) {
if (!body?.token) throw new Error('Token required');
const user = await this.svc.verifyMagicToken(body.token);
return { ok: true, user, token: user.apiToken };
}
}
