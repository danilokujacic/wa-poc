import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChannexAri1785498295179 implements MigrationInterface {
  name = 'AddChannexAri1785498295179';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "resort" ADD "currency" character varying NOT NULL DEFAULT 'EUR'`,
    );
    await queryRunner.query(
      `ALTER TABLE "resort_feature" ADD "channexRatePlanId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "resort_feature" ADD CONSTRAINT "UQ_resort_feature_channexRatePlanId" UNIQUE ("channexRatePlanId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "resort_feature" DROP CONSTRAINT "UQ_resort_feature_channexRatePlanId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "resort_feature" DROP COLUMN "channexRatePlanId"`,
    );
    await queryRunner.query(`ALTER TABLE "resort" DROP COLUMN "currency"`);
  }
}
