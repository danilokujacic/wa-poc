import { Injectable } from '@nestjs/common';
import { DataSource, MoreThanOrEqual, Repository } from 'typeorm';
import { PhoneChange } from '../entity/phone-change.entity';

@Injectable()
export class PhoneChangeRepository extends Repository<PhoneChange> {
    constructor(private readonly dataSource: DataSource) {
        super(PhoneChange, dataSource.createEntityManager());
    }

    findRecentForResort(resortId: string, since: Date): Promise<PhoneChange | null> {
        return this.findOne({
            where: { resort: { id: resortId }, createdAt: MoreThanOrEqual(since) },
            order: { createdAt: 'DESC' },
        });
    }
}
