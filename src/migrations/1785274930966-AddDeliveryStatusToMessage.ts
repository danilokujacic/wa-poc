import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeliveryStatusToMessage1785274930966 implements MigrationInterface {
  name = 'AddDeliveryStatusToMessage1785274930966';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."message_deliverystatus_enum" AS ENUM('Pending', 'Sent', 'Failed')`,
    );
    await queryRunner.query(
      `ALTER TABLE "message" ADD "deliveryStatus" "public"."message_deliverystatus_enum"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "message" DROP COLUMN "deliveryStatus"`,
    );
    await queryRunner.query(`DROP TYPE "public"."message_deliverystatus_enum"`);
  }
}
