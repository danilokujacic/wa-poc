import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { RatePeriod } from '../entity/rate-period.entity';

@Injectable()
export class RatePeriodRepository extends Repository<RatePeriod> {
  constructor(private readonly dataSource: DataSource) {
    super(RatePeriod, dataSource.createEntityManager());
  }

  findAllForFeature(featureId: string): Promise<RatePeriod[]> {
    return this.find({
      where: { feature: { id: featureId } },
      order: { startDate: 'ASC' },
    });
  }
}
