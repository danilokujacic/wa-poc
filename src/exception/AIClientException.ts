import { HttpException } from '@nestjs/common';

class AIClientException extends HttpException {
  constructor(message: string, status: number) {
    super(message, status);
  }
}

export default AIClientException;
