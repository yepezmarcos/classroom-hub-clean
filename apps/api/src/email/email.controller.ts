import { Body, Controller, Post } from '@nestjs/common';
import { EmailService } from './email.service';

@Controller('dev-email')
export class EmailController {
  constructor(private readonly svc: EmailService) {}

  @Post('send')
  async send(@Body() body: any) {
    return await this.svc.send(body.to, body.subject, body.html || '<p>Hello from Classroom Hub</p>');
  }
}