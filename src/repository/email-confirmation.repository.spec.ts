import { LessThan } from 'typeorm';
import { EmailConfirmationRepository } from './email-confirmation.repository';

describe('EmailConfirmationRepository', () => {
  let repository: EmailConfirmationRepository;

  beforeEach(() => {
    repository = new EmailConfirmationRepository({
      createEntityManager: () => ({}),
    } as any);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  it('findValidBySlug queries findOne with the slug and user relation', async () => {
    const findOneSpy = jest
      .spyOn(repository, 'findOne')
      .mockResolvedValue(null);

    const result = await repository.findValidBySlug('slug-1');

    expect(findOneSpy).toHaveBeenCalledWith({
      where: { slug: 'slug-1' },
      relations: { user: true },
    });
    expect(result).toBeNull();
  });

  it('deleteExpired deletes confirmations whose expiry has passed and returns the affected count', async () => {
    const deleteSpy = jest
      .spyOn(repository, 'delete')
      .mockResolvedValue({ affected: 2, raw: [] });

    const result = await repository.deleteExpired();

    expect(deleteSpy).toHaveBeenCalledWith({
      expires: LessThan(expect.any(Date)),
    });
    expect(result).toBe(2);
  });

  it('deleteExpired returns 0 when affected is null', async () => {
    jest
      .spyOn(repository, 'delete')
      .mockResolvedValue({ affected: null, raw: [] });

    const result = await repository.deleteExpired();

    expect(result).toBe(0);
  });
});
