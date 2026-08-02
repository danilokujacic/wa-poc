import { getMetadataArgsStorage } from 'typeorm';
import { Resort } from './resort.entity';
import { Faq } from './faq.entity';
import { User } from './user.entity';
import { ResortFeature } from './resort-feature.entity';
import { ResortContact } from './resort-contact.entity';

// Resort is a plain TypeORM entity — no exported constants/logic/computed
// getters live in this file, only @Column/@OneToMany decorators. The
// OneToMany relation callbacks (type + inverse side functions) aren't
// invoked at import time; TypeORM only calls them lazily once a real
// connection resolves relation metadata. We pull them out of TypeORM's
// metadata args storage and invoke them directly to verify each relation is
// wired to the right target entity and inverse property.
describe('Resort entity', () => {
  function relationMetadata(propertyName: string) {
    const relation = getMetadataArgsStorage().relations.find(
      (r) => r.target === Resort && r.propertyName === propertyName,
    );
    if (!relation) {
      throw new Error(`No relation metadata found for Resort.${propertyName}`);
    }
    return relation;
  }

  it('constructs a plain instance', () => {
    const resort = new Resort();
    expect(resort).toBeInstanceOf(Resort);
  });

  it('wires the faqs relation to Faq and its inverse side to faq.resort', () => {
    const relation = relationMetadata('faqs');
    expect((relation.type as () => unknown)()).toBe(Faq);
    const inverse = relation.inverseSideProperty as (faq: Faq) => unknown;
    expect(inverse({ resort: 'resort-value' } as unknown as Faq)).toBe(
      'resort-value',
    );
  });

  it('wires the users relation to User and its inverse side to user.resort', () => {
    const relation = relationMetadata('users');
    expect((relation.type as () => unknown)()).toBe(User);
    const inverse = relation.inverseSideProperty as (user: User) => unknown;
    expect(inverse({ resort: 'resort-value' } as unknown as User)).toBe(
      'resort-value',
    );
  });

  it('wires the features relation to ResortFeature and its inverse side to feature.resort', () => {
    const relation = relationMetadata('features');
    expect((relation.type as () => unknown)()).toBe(ResortFeature);
    const inverse = relation.inverseSideProperty as (
      feature: ResortFeature,
    ) => unknown;
    expect(
      inverse({ resort: 'resort-value' } as unknown as ResortFeature),
    ).toBe('resort-value');
  });

  it('wires the contacts relation to ResortContact and its inverse side to contact.resort', () => {
    const relation = relationMetadata('contacts');
    expect((relation.type as () => unknown)()).toBe(ResortContact);
    const inverse = relation.inverseSideProperty as (
      contact: ResortContact,
    ) => unknown;
    expect(
      inverse({ resort: 'resort-value' } as unknown as ResortContact),
    ).toBe('resort-value');
  });
});
