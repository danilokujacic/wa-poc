import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ResortFeature } from './resort-feature.entity';

// A named date range that overrides a feature's base price/policy for the
// dates it covers — seasonal pricing + stay policies as one resource, since
// a resort owner always sets them together ("Summer 2026: $200, 3-night
// minimum") and Channex's own /restrictions endpoint already bundles rate +
// restrictions in one payload. feature.price/quantity remain the default
// used for any date no RatePeriod covers — see rate-period.util.ts.
@Entity()
export class RatePeriod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ResortFeature, { onDelete: 'CASCADE' })
  feature: ResortFeature;

  @Column()
  name: string;

  // TypeORM `date` columns come back from pg as plain 'YYYY-MM-DD' strings
  // at runtime (same caveat already noted in channex-ari.service.ts) — typed
  // as `string` here rather than `Date` to match what's actually received.
  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  @Column({ type: 'float' })
  price: number;

  @Column({ type: 'int', nullable: true })
  minStay: number | null;

  @Column({ default: false })
  stopSell: boolean;

  @Column({ default: false })
  closedToArrival: boolean;

  @Column({ default: false })
  closedToDeparture: boolean;

  // Higher wins when two periods overlap the same date; ties broken by
  // narrowest date range — see pickWinner in rate-period.util.ts.
  @Column({ type: 'int', default: 0 })
  priority: number;
}
