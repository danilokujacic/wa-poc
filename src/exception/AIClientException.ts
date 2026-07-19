import { HttpException } from "@nestjs/common";



class AIClientException extends HttpException {
    constructor(message: string, status: number) {
        super("AI Client failed to connect.", status);
    }
}

export default AIClientException;