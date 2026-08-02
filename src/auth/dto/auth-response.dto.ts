import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { User } from '../../entity/user.entity';
import { UserResponseDto } from '../../users/dto/user-response.dto';

export class AuthResponseDto {
  @ApiProperty({ type: UserResponseDto })
  @Expose()
  @Type(() => UserResponseDto)
  user: UserResponseDto;

  static fromUser(user: User): AuthResponseDto {
    const dto = new AuthResponseDto();
    dto.user = UserResponseDto.fromEntity(user);
    return dto;
  }
}
