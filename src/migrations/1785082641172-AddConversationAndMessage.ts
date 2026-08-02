import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConversationAndMessage1785082641172 implements MigrationInterface {
  name = 'AddConversationAndMessage1785082641172';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."conversation_status_enum" AS ENUM('Bot', 'Human', 'Closed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "conversation" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "guestPhoneNumber" character varying NOT NULL, "status" "public"."conversation_status_enum" NOT NULL DEFAULT 'Bot', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "resortId" uuid, "assignedUserId" uuid, CONSTRAINT "UQ_7ebbae345aafa9eecc313ca204a" UNIQUE ("resortId", "guestPhoneNumber"), CONSTRAINT "PK_864528ec4274360a40f66c29845" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."message_sender_enum" AS ENUM('Guest', 'Ai', 'Employee')`,
    );
    await queryRunner.query(
      `CREATE TABLE "message" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sender" "public"."message_sender_enum" NOT NULL, "body" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "conversationId" uuid, "sentByUserId" uuid, CONSTRAINT "PK_ba01f0a3e0123651915008bc578" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation" ADD CONSTRAINT "FK_80e6cacf8787600326f68268bd4" FOREIGN KEY ("resortId") REFERENCES "resort"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation" ADD CONSTRAINT "FK_5a97b1a1b834373d6a71c42a267" FOREIGN KEY ("assignedUserId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "message" ADD CONSTRAINT "FK_7cf4a4df1f2627f72bf6231635f" FOREIGN KEY ("conversationId") REFERENCES "conversation"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "message" ADD CONSTRAINT "FK_b2426d179d96fa406a5852f7c52" FOREIGN KEY ("sentByUserId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "message" DROP CONSTRAINT "FK_b2426d179d96fa406a5852f7c52"`,
    );
    await queryRunner.query(
      `ALTER TABLE "message" DROP CONSTRAINT "FK_7cf4a4df1f2627f72bf6231635f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation" DROP CONSTRAINT "FK_5a97b1a1b834373d6a71c42a267"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation" DROP CONSTRAINT "FK_80e6cacf8787600326f68268bd4"`,
    );
    await queryRunner.query(`DROP TABLE "message"`);
    await queryRunner.query(`DROP TYPE "public"."message_sender_enum"`);
    await queryRunner.query(`DROP TABLE "conversation"`);
    await queryRunner.query(`DROP TYPE "public"."conversation_status_enum"`);
  }
}
