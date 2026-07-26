import { Body, Controller, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { EmailConfirmationService } from './email-confirmation.service';
import { ConfirmEmailDto } from './dto/confirm-email.dto';

@ApiTags('email-confirmation')
@Controller('email-confirmation')
export class EmailConfirmationController {
    constructor(private readonly emailConfirmationService: EmailConfirmationService) { }

    @Post()
    @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
    @ApiOperation({ summary: "Confirm a user's email address using the slug/code sent on account creation" })
    confirm(@Body() dto: ConfirmEmailDto) {
        return this.emailConfirmationService.confirm(dto.slug, dto.code);
    }
}
