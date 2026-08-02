import { MessageRepository } from './message.repository';

function createRepository(): MessageRepository {
  return new MessageRepository({ createEntityManager: () => ({}) } as any);
}

describe('MessageRepository', () => {
  let repository: MessageRepository;

  beforeEach(() => {
    repository = createRepository();
  });

  describe('findAllForConversation', () => {
    it('finds all messages for a conversation ordered by sentAt ascending', async () => {
      const messages = [{ id: 'msg-1' }];
      const findSpy = jest
        .spyOn(repository, 'find')
        .mockResolvedValue(messages as any);

      const result = await repository.findAllForConversation('conv-1');

      expect(findSpy).toHaveBeenCalledWith({
        where: { conversation: { id: 'conv-1' } },
        relations: { conversation: true },
        order: { sentAt: 'ASC' },
      });
      expect(result).toBe(messages);
    });
  });

  describe('findOneForConversation', () => {
    it('finds a single message scoped to its conversation', async () => {
      const message = { id: 'msg-1' };
      const findOneSpy = jest
        .spyOn(repository, 'findOne')
        .mockResolvedValue(message as any);

      const result = await repository.findOneForConversation('conv-1', 'msg-1');

      expect(findOneSpy).toHaveBeenCalledWith({
        where: { id: 'msg-1', conversation: { id: 'conv-1' } },
        relations: { conversation: true },
      });
      expect(result).toBe(message);
    });

    it('returns null when the message is not found in that conversation', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      const result = await repository.findOneForConversation(
        'conv-1',
        'missing',
      );

      expect(result).toBeNull();
    });
  });
});
