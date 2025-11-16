import type { ModelType, DBGame } from '../types';
import { Query as QueryType } from 'dynamoose/dist/ItemRetriever';

type GameModelMock = jest.Mocked<ModelType & QueryType<DBGame>>;

let scheduleGamesHandler: (typeof import('./production'))['scheduleGamesHandler'];

beforeEach(async () => {
  jest.resetModules();
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  ({ scheduleGamesHandler } = await import('./production'));
});

afterEach(() => {
  jest.restoreAllMocks();
});

const createGameModelMock = (
  overrides: Partial<GameModelMock> = {},
): GameModelMock => {
  return {
    get: jest.fn().mockReturnThis(),
    query: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    contains: jest.fn().mockReturnThis(),
    using: jest.fn().mockReturnThis(),
    exec: jest.fn().mockReturnThis(),
    create: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    attributes: jest.fn().mockReturnThis(),
    ...overrides,
  } as unknown as GameModelMock;
};

const createGame = (overrides: Partial<DBGame> = {}): DBGame => {
  return {
    id: 'game-123',
    status: 'ready',
    ownerIds: 'owner1|owner2|owner3',
    wordsKey: 'cat|dog|fish',
    words: ['cat', 'dog', 'fish'],
    looksNaughty: false,
    publishMonth: `READY-${Date.now()}`,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-02T00:00:00.000Z'),
    ...overrides,
  } as DBGame;
};

describe('scheduleGames handler', () => {
  describe('happy path', () => {
    it('schedules eligible games when no games have publishDate yet', async () => {
      const eligibleGame1 = createGame({
        id: 'game1',
        ownerIds: 'owner1|owner2|owner3',
      });
      const eligibleGame2 = createGame({
        id: 'game2',
        ownerIds: 'owner4|owner5|owner6',
      });

      const GameModel = createGameModelMock({
        exec: jest
          .fn()
          .mockResolvedValueOnce([eligibleGame1, eligibleGame2]) // Query for eligible games
          .mockResolvedValueOnce([]), // Query for latest game (none exist)
        update: jest.fn().mockResolvedValue({}),
      });

      const result = await scheduleGamesHandler(GameModel);

      expect(result.statusCode).toBe(200);
      expect(result.scheduled).toBe(2);
      expect(result.gameIds).toEqual(['game1', 'game2']);
      expect(GameModel.update).toHaveBeenCalledTimes(2);

      // Verify first game update
      const firstCall = (GameModel.update as jest.Mock).mock.calls[0];
      expect(firstCall[0]).toEqual({ id: 'game1' });
      expect(firstCall[1]).toHaveProperty('publishDate');
      expect(firstCall[1]).toHaveProperty('publishMonth');

      // Verify second game update
      const secondCall = (GameModel.update as jest.Mock).mock.calls[1];
      expect(secondCall[0]).toEqual({ id: 'game2' });
      expect(secondCall[1]).toHaveProperty('publishDate');
      expect(secondCall[1]).toHaveProperty('publishMonth');

      // Verify dates are sequential (1 day apart)
      const firstDate = new Date(firstCall[1].publishDate);
      const secondDate = new Date(secondCall[1].publishDate);
      const daysDiff =
        (secondDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBe(1);
    });

    it('schedules games after the latest existing publishDate', async () => {
      const publishedGame = createGame({
        id: 'published-game',
        publishDate: new Date('2025-12-01T00:00:00.000Z'),
        publishMonth: '2025-12',
      });
      const eligibleGame = createGame({
        id: 'eligible-game',
        ownerIds: 'owner1|owner2|owner3',
      });

      const GameModel = createGameModelMock({
        exec: jest
          .fn()
          .mockResolvedValueOnce([eligibleGame]) // Query for eligible games
          .mockResolvedValueOnce([publishedGame]), // Query for latest game
        update: jest.fn().mockResolvedValue({}),
      });

      const result = await scheduleGamesHandler(GameModel);

      expect(result.statusCode).toBe(200);
      expect(result.scheduled).toBe(1);
      expect(result.gameIds).toEqual(['eligible-game']);

      const updateCall = (GameModel.update as jest.Mock).mock.calls[0];
      const scheduledDate = new Date(updateCall[1].publishDate);

      // Should be scheduled after 2025-12-01
      expect(scheduledDate.getTime()).toBeGreaterThan(
        new Date('2025-12-01T00:00:00.000Z').getTime(),
      );
      expect(updateCall[1].publishMonth).toBe('2025-12');
    });

    it('formats publishMonth correctly', async () => {
      const eligibleGame = createGame({
        id: 'game1',
        ownerIds: 'owner1|owner2|owner3',
      });

      const GameModel = createGameModelMock({
        exec: jest
          .fn()
          .mockResolvedValueOnce([eligibleGame])
          .mockResolvedValueOnce([]),
        update: jest.fn().mockResolvedValue({}),
      });

      await scheduleGamesHandler(GameModel);

      const updateCall = (GameModel.update as jest.Mock).mock.calls[0];
      const publishMonth = updateCall[1].publishMonth;

      // Should match YYYY-MM format
      expect(publishMonth).toMatch(/^\d{4}-\d{2}$/);
    });
  });

  describe('unhappy path / edge cases', () => {
    it('returns early when no eligible games exist', async () => {
      const GameModel = createGameModelMock({
        exec: jest.fn().mockResolvedValueOnce([]), // Query returns no eligible games
        update: jest.fn(),
      });

      const result = await scheduleGamesHandler(GameModel);

      expect(result.statusCode).toBe(200);
      expect(result.scheduled).toBe(0);
      expect(result.message).toBe('No games need scheduling');
      expect(GameModel.update).not.toHaveBeenCalled();
    });
  });
});
