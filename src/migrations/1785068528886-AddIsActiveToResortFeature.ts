import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIsActiveToResortFeature1785068528886 implements MigrationInterface {
    name = 'AddIsActiveToResortFeature1785068528886'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "resort_feature" ADD "isActive" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "resort_feature" DROP COLUMN "isActive"`);
    }

}
