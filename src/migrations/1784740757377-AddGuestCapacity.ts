import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGuestCapacity1784740757377 implements MigrationInterface {
  name = 'AddGuestCapacity1784740757377';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "resort_feature" ADD "capacity" integer NOT NULL DEFAULT 2`,
    );
    await queryRunner.query(
      `ALTER TABLE "resort_feature" ALTER COLUMN "capacity" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservation" ADD "adults" integer NOT NULL DEFAULT 1`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservation" ALTER COLUMN "adults" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservation" ADD "kids" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservation" ALTER COLUMN "kids" DROP DEFAULT`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reservation" DROP COLUMN "kids"`);
    await queryRunner.query(`ALTER TABLE "reservation" DROP COLUMN "adults"`);
    await queryRunner.query(
      `ALTER TABLE "resort_feature" DROP COLUMN "capacity"`,
    );
  }
}
