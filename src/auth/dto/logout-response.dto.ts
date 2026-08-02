import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class LogoutResponseDto {
  @ApiProperty({ example: true })
  @Expose()
  loggedOut: boolean;

  static create(): LogoutResponseDto {
    const dto = new LogoutResponseDto();
    dto.loggedOut = true;
    return dto;
  }
}
