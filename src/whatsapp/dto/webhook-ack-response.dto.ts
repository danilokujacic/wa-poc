import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class WebhookAckResponseDto {
  @ApiProperty({ example: 'handled' })
  @Expose()
  status: string;

  static create(): WebhookAckResponseDto {
    const dto = new WebhookAckResponseDto();
    dto.status = 'handled';
    return dto;
  }
}
