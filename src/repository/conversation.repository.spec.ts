import { ConversationRepository } from './conversation.repository';
import { ConversationStatus } from '../entity/conversation.entity';

function createRepository(): ConversationRepository {
  return new ConversationRepository({
    createEntityManager: () => ({}),
  } as any);
}

describe('ConversationRepository', () => {
  let repository: ConversationRepository;

  beforeEach(() => {
    repository = createRepository();
  });

  describe('findOrCreate', () => {
    it('returns the existing conversation when one is already found', async () => {
      const existing = { id: 'conv-1' };
      const findOneSpy = jest
        .spyOn(repository, 'findOne')
        .mockResolvedValue(existing as any);
      const saveSpy = jest.spyOn(repository, 'save');

      const result = await repository.findOrCreate('resort-1', '+123');

      expect(findOneSpy).toHaveBeenCalledWith({
        where: { resort: { id: 'resort-1' }, guestPhoneNumber: '+123' },
      });
      expect(saveSpy).not.toHaveBeenCalled();
      expect(result).toBe(existing);
    });

    it('creates and saves a new conversation when none exists', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);
      const created = { resort: { id: 'resort-1' }, guestPhoneNumber: '+123' };
      const createSpy = jest
        .spyOn(repository, 'create')
        .mockReturnValue(created as any);
      const saved = { id: 'conv-new', ...created };
      const saveSpy = jest
        .spyOn(repository, 'save')
        .mockResolvedValue(saved as any);

      const result = await repository.findOrCreate('resort-1', '+123');

      expect(createSpy).toHaveBeenCalledWith({
        resort: { id: 'resort-1' },
        guestPhoneNumber: '+123',
      });
      expect(saveSpy).toHaveBeenCalledWith(created);
      expect(result).toBe(saved);
    });

    it('recovers from a unique-constraint race by returning the conversation created concurrently', async () => {
      const findOneSpy = jest.spyOn(repository, 'findOne');
      findOneSpy.mockResolvedValueOnce(null);
      const existingAfterRace = { id: 'conv-race' };
      findOneSpy.mockResolvedValueOnce(existingAfterRace as any);
      jest.spyOn(repository, 'create').mockReturnValue({} as any);
      jest
        .spyOn(repository, 'save')
        .mockRejectedValue(new Error('duplicate key'));

      const result = await repository.findOrCreate('resort-1', '+123');

      expect(findOneSpy).toHaveBeenCalledTimes(2);
      expect(result).toBe(existingAfterRace);
    });

    it('rethrows the save error when no conversation exists even after the race check', async () => {
      const findOneSpy = jest.spyOn(repository, 'findOne');
      findOneSpy.mockResolvedValueOnce(null);
      findOneSpy.mockResolvedValueOnce(null);
      jest.spyOn(repository, 'create').mockReturnValue({} as any);
      const saveError = new Error('duplicate key');
      jest.spyOn(repository, 'save').mockRejectedValue(saveError);

      await expect(repository.findOrCreate('resort-1', '+123')).rejects.toThrow(
        saveError,
      );
    });
  });

  describe('findAllForResort', () => {
    it('finds all conversations for a resort ordered by updatedAt descending', async () => {
      const conversations = [{ id: 'conv-1' }];
      const findSpy = jest
        .spyOn(repository, 'find')
        .mockResolvedValue(conversations as any);

      const result = await repository.findAllForResort('resort-1');

      expect(findSpy).toHaveBeenCalledWith({
        where: { resort: { id: 'resort-1' } },
        order: { updatedAt: 'DESC' },
      });
      expect(result).toBe(conversations);
    });
  });

  describe('findForResort', () => {
    it('finds a single conversation scoped to its resort', async () => {
      const conversation = { id: 'conv-1' };
      const findOneSpy = jest
        .spyOn(repository, 'findOne')
        .mockResolvedValue(conversation as any);

      const result = await repository.findForResort('resort-1', 'conv-1');

      expect(findOneSpy).toHaveBeenCalledWith({
        where: { id: 'conv-1', resort: { id: 'resort-1' } },
      });
      expect(result).toBe(conversation);
    });
  });

  describe('isHumanHandled', () => {
    it('returns true when the conversation status is HUMAN', async () => {
      jest
        .spyOn(repository, 'findOne')
        .mockResolvedValue({ status: ConversationStatus.HUMAN } as any);

      const result = await repository.isHumanHandled('resort-1', '+123');

      expect(result).toBe(true);
    });

    it('returns false when the conversation status is not HUMAN', async () => {
      jest
        .spyOn(repository, 'findOne')
        .mockResolvedValue({ status: ConversationStatus.BOT } as any);

      const result = await repository.isHumanHandled('resort-1', '+123');

      expect(result).toBe(false);
    });

    it('returns false when no conversation exists yet', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      const result = await repository.isHumanHandled('resort-1', '+123');

      expect(result).toBe(false);
    });
  });

  describe('updateLastMessageSentAt', () => {
    it('updates the lastMessageSentAt column for the given conversation id', async () => {
      const updateSpy = jest
        .spyOn(repository, 'update')
        .mockResolvedValue({} as any);
      const sentAt = new Date('2026-08-01T00:00:00.000Z');

      await repository.updateLastMessageSentAt('conv-1', sentAt);

      expect(updateSpy).toHaveBeenCalledWith('conv-1', {
        lastMessageSentAt: sentAt,
      });
    });
  });
});
