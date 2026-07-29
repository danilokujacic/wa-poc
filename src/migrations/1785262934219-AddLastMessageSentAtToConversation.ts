import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLastMessageSentAtToConversation1785262934219 implements MigrationInterface {
    name = 'AddLastMessageSentAtToConversation1785262934219'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "conversation" ADD "lastMessageSentAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "conversation" DROP COLUMN "lastMessageSentAt"`);
    }

}
