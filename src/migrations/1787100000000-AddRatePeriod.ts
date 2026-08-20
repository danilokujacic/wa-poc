import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRatePeriod1787100000000 implements MigrationInterface {
  name = 'AddRatePeriod1787100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "rate_period" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "startDate" date NOT NULL, "endDate" date NOT NULL, "price" double precision NOT NULL, "minStay" integer, "stopSell" boolean NOT NULL DEFAULT false, "closedToArrival" boolean NOT NULL DEFAULT false, "closedToDeparture" boolean NOT NULL DEFAULT false, "priority" integer NOT NULL DEFAULT 0, "featureId" uuid, CONSTRAINT "PK_rate_period_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "rate_period" ADD CONSTRAINT "FK_rate_period_featureId" FOREIGN KEY ("featureId") REFERENCES "resort_feature"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_rate_period_feature_dates" ON "rate_period" ("featureId", "startDate", "endDate")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_rate_period_feature_dates"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rate_period" DROP CONSTRAINT "FK_rate_period_featureId"`,
    );
    await queryRunner.query(`DROP TABLE "rate_period"`);
  }
}
