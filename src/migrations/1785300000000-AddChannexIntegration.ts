import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChannexIntegration1785300000000 implements MigrationInterface {
  name = 'AddChannexIntegration1785300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "resort" ADD "channexPropertyId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "resort" ADD CONSTRAINT "UQ_resort_channexPropertyId" UNIQUE ("channexPropertyId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "resort_feature" ADD "channexRoomTypeId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "resort_feature" ADD CONSTRAINT "UQ_resort_feature_channexRoomTypeId" UNIQUE ("channexRoomTypeId")`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."reservation_source_enum" AS ENUM('Manual', 'Channex')`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservation" ADD "source" "public"."reservation_source_enum" NOT NULL DEFAULT 'Manual'`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservation" ADD "channexBookingId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservation" ADD "otaName" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservation" ADD "otaReservationCode" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reservation" DROP COLUMN "otaReservationCode"`,
    );
    await queryRunner.query(`ALTER TABLE "reservation" DROP COLUMN "otaName"`);
    await queryRunner.query(
      `ALTER TABLE "reservation" DROP COLUMN "channexBookingId"`,
    );
    await queryRunner.query(`ALTER TABLE "reservation" DROP COLUMN "source"`);
    await queryRunner.query(`DROP TYPE "public"."reservation_source_enum"`);
    await queryRunner.query(
      `ALTER TABLE "resort_feature" DROP CONSTRAINT "UQ_resort_feature_channexRoomTypeId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "resort_feature" DROP COLUMN "channexRoomTypeId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "resort" DROP CONSTRAINT "UQ_resort_channexPropertyId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "resort" DROP COLUMN "channexPropertyId"`,
    );
  }
}
