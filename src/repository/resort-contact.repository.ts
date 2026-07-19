import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { ResortContact } from '../entity/resort-contact.entity';

@Injectable()
export class ResortContactRepository extends Repository<ResortContact> {
    constructor(private readonly dataSource: DataSource) {
        super(ResortContact, dataSource.createEntityManager());
    }
}
