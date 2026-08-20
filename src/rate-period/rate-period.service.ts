import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RatePeriodRepository } from '../repository/rate-period.repository';
import { ResortFeatureRepository } from '../repository/resort-feature.repository';
import { ChannexAriProducer } from '../bullmq/channex-ari/channex-ari.producer';
import { RatePeriod } from '../entity/rate-period.entity';
import { ResortFeature } from '../entity/resort-feature.entity';
import { CreateRatePeriodDto } from './dto/create-rate-period.dto';
import { UpdateRatePeriodDto } from './dto/update-rate-period.dto';

@Injectable()
export class RatePeriodService {
  constructor(
    private readonly ratePeriodRepository: RatePeriodRepository,
    private readonly resortFeatureRepository: ResortFeatureRepository,
    private readonly channexAriProducer: ChannexAriProducer,
  ) {}

  async create(
    resortId: string,
    featureId: string,
    dto: CreateRatePeriodDto,
  ): Promise<RatePeriod> {
    const feature = await this.loadFeature(resortId, featureId);
    this.assertValidRange(dto.startDate, dto.endDate);

    const period = this.ratePeriodRepository.create({ ...dto, feature });
    await this.ratePeriodRepository.save(period);
    // A new season changes what Channex should already know about future
    // dates — same trigger ResortFeatureService uses when price changes.
    void this.channexAriProducer.enqueueRestrictionsPush(featureId);
    return period;
  }

  async findAll(resortId: string, featureId: string): Promise<RatePeriod[]> {
    await this.loadFeature(resortId, featureId);
    return this.ratePeriodRepository.findAllForFeature(featureId);
  }

  async findOne(
    resortId: string,
    featureId: string,
    id: string,
  ): Promise<RatePeriod> {
    await this.loadFeature(resortId, featureId);
    const period = await this.ratePeriodRepository.findOne({
      where: { id, feature: { id: featureId } },
    });
    if (!period) {
      throw new NotFoundException(
        `Rate period ${id} not found for feature ${featureId}`,
      );
    }
    return period;
  }

  async update(
    resortId: string,
    featureId: string,
    id: string,
    dto: UpdateRatePeriodDto,
  ): Promise<RatePeriod> {
    const period = await this.findOne(resortId, featureId, id);
    const nextStart = dto.startDate ?? period.startDate;
    const nextEnd = dto.endDate ?? period.endDate;
    this.assertValidRange(nextStart, nextEnd);

    Object.assign(period, dto);
    await this.ratePeriodRepository.save(period);
    void this.channexAriProducer.enqueueRestrictionsPush(featureId);
    return period;
  }

  async remove(resortId: string, featureId: string, id: string): Promise<void> {
    await this.findOne(resortId, featureId, id);
    await this.ratePeriodRepository.delete(id);
    // A removed season means Channex needs to hear about the (now-reverted-
    // to-default) dates it used to cover, same as create/update.
    void this.channexAriProducer.enqueueRestrictionsPush(featureId);
  }

  private async loadFeature(
    resortId: string,
    featureId: string,
  ): Promise<ResortFeature> {
    const feature = await this.resortFeatureRepository.findOne({
      where: { id: featureId, resort: { id: resortId } },
    });
    if (!feature) {
      throw new NotFoundException(
        `Feature ${featureId} not found for resort ${resortId}`,
      );
    }
    return feature;
  }

  private assertValidRange(startDate: string, endDate: string): void {
    if (new Date(startDate) > new Date(endDate)) {
      throw new BadRequestException('startDate must not be after endDate');
    }
  }
}
