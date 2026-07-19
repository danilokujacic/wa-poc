import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { ResortFeature } from '../entity/resort-feature.entity';

@Injectable()
export class ResortFeatureRepository extends Repository<ResortFeature> {
    constructor(private readonly dataSource: DataSource) {
        super(ResortFeature, dataSource.createEntityManager());
    }
}
