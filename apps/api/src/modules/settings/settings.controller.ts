import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtGuard } from '../auth/jwt.guard';

@UseGuards(JwtGuard)
@Controller('settings')
export class SettingsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async get(@Req() req: any) {
    const { tenantId } = req.user;
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    return t?.settings ?? {};
  }

  @Put()
  async set(@Req() req: any, @Body() body: any) {
    const { tenantId } = req.user;
    const safe = (body && typeof body === 'object') ? body : {};
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: safe as any },
    });
    return { ok: true };
  }
}