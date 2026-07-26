---
name: list-filter-pattern
description: TypeORM list/findAll filtering convention used in this repo — build a mutable FindOptionsWhere object by conditionally assigning optional filters, with defaults set via destructured params and TypeORM operators (MoreThanOrEqual/LessThanOrEqual/ILike). Use whenever adding or reviewing a new findAll-style list method with query-param filters.
---

# List filter pattern (TypeORM `findAll`)

This is the house convention for any `findAll(scopeId, filters)`-style service method in wa-poc, taken directly from `ReservationService.findAll` (src/reservation/reservation.service.ts).

Reference implementation:

```ts
findAll(resortId: string, { from = new Date().toString(), to, status = 'ALL', search = '' }: {
    from?: string; to?: string; status?: ReservationStatus | 'ALL'; search?: string;
}): Promise<Reservation[]> {
    const fromISO = this.parseDate(from);
    const toISO = to ? this.parseDate(to) : undefined;
    const query: FindOptionsWhere<Reservation> = {
        feature: { resort: { id: resortId } },
        startDate: MoreThanOrEqual(fromISO),
    }

    if (toISO) {
        query.endDate = LessThanOrEqual(toISO);
    }

    if (status && status !== 'ALL') {
        query.status = status;
    }

    if (search) {
        query.phoneNumber = ILike(`%${search}%`);
    }

    return this.reservationRepository.find({
        where: query,
        relations: { feature: true },
    });
}
```

## Steps to follow for a new list method

1. **Signature**: `findAll(scopeId: string, { ...filters }: { ... })`. Defaults live in the destructuring itself (`status = 'ALL'`, `search = ''`), not as body-level `??` fallbacks. No separate DTO/interface for read filters — an inline object type is enough.

2. **Base query object**: start `const query: FindOptionsWhere<Entity> = { ... }` with only the filters that are *always* applied — tenant/scope isolation (e.g. `feature: { resort: { id: resortId } }`) and any filter that has a real default (e.g. `startDate: MoreThanOrEqual(fromISO)`).

3. **Conditionally mutate, never assign undefined**: each optional filter gets its own `if`, assigning straight onto `query.field`. The key is omitted entirely when not provided — never set to `undefined`/`null`.
   ```ts
   if (toISO) query.endDate = LessThanOrEqual(toISO);
   if (status && status !== 'ALL') query.status = status;
   if (search) query.phoneNumber = ILike(`%${search}%`);
   ```

4. **Enum filters use an `'ALL'` sentinel**, not `undefined`/optional, to mean "no filter" — keeps the parameter required-with-default instead of optional-and-absent.

5. **Operators over raw SQL**: date ranges use `MoreThanOrEqual` / `LessThanOrEqual`; partial/case-insensitive text search uses `ILike(\`%x%\`)`. Never hand-build a WHERE string.

6. **Terminal call**: `return this.repository.find({ where: query, relations: {...} })` — plain repository `.find()`, not the query builder, unless a filter genuinely can't be expressed as `FindOptionsWhere` (e.g. cross-field OR, full-text search).

## When to deviate

If a filter can't be expressed with `FindOptionsWhere`, fall back to `createQueryBuilder`, but keep the same "conditionally assign only when present" shape for readability and consistency with the rest of the codebase.
