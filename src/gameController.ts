import { Condition, model } from 'dynamoose';
import { customAlphabet } from 'nanoid';
import { LRUCache } from 'lru-cache';
import { Filter } from 'bad-words';
import type { DBGame, ModelType } from './types';
import GameSchema from './Game.schema';
import env from './env';
import { normalizeWord } from './sanitize';
import { GameQueryInput, MutationSubmitGameArgs } from './generated/graphql';

// good ole motorCase
const nanoid = customAlphabet('brumBRUM', 24);
const cache = new LRUCache<string, DBGame>({
  max: 1000,
});

const buildScan = (queryObject: Record<string, string | null>) =>
  Object.entries(queryObject).reduce((acc, [key, value]) => {
    // also, these act as a filter. other properties are ignored
    if (!value) return acc;

    if (key === 'ownerId') return { ...acc, ownerIds: { contains: value } };
    if (key === 'word') return { ...acc, wordsKey: { contains: value } };

    return acc;
  }, {});

export const createGameController = (GameModel: ModelType) => ({
  getById: async (id: string) => {
    const cachedGame = cache.get(id);
    if (cachedGame) return cachedGame;

    const game = await GameModel.get(id);
    if (game) cache.set(id, game);
    return game;
  },

  query: async (query: GameQueryInput) => {
    if (query.releaseMonth) {
      return await GameModel.query('releaseMonth')
        .eq(query.releaseMonth)
        .using('releaseMonth')
        .exec();
    }

    return GameModel.scan(buildScan(query)).exec();
  },

  create: async (input: MutationSubmitGameArgs, ownerId?: string) => {
    if (!ownerId) throw new Error('Unauthorized');

    const normalizedWords = input.words.map(normalizeWord);
    const wordsKey = normalizedWords.sort().join('|');

    // first out: found existing game with these words.
    const [existingGame] = await GameModel.query({
      wordsKey: { eq: wordsKey },
    }).exec();
    const existingGameOwnerIds = existingGame
      ? existingGame.ownerIds.split('|')
      : [];
    if (existingGame && existingGameOwnerIds.length >= 3) return existingGame;
    if (existingGame && existingGameOwnerIds.length < 3) {
      const updatedGame = await GameModel.update(
        { id: existingGame.id },
        {
          ownerIds: [...existingGameOwnerIds, ownerId].join('|'),
          isDraft:
            existingGameOwnerIds.length + 1 === 3
              ? false
              : existingGame.isDraft,
        },
        {
          returnValues: 'ALL_NEW',
        },
      );
      cache.set(updatedGame.id, updatedGame);
      return updatedGame;
    }

    // second out: test if two words are only 1 hop apart
    const adjacentPairs = normalizedWords
      .slice(0, -1)
      .map((word, index) => [word, normalizedWords[index + 1]]);
    const hopsResponses = await Promise.allSettled(
      adjacentPairs.map(([from, to]) =>
        fetch(`${env.hopsApiUrl}/linked`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            [env.authHeaderName]: env.authHeaderValue,
          },
          body: JSON.stringify({ from, to }),
        }),
      ),
    );
    const anyPositiveLinks = hopsResponses.some(
      (result) => result.status === 'fulfilled' && result.value.ok,
    );
    if (anyPositiveLinks) {
      throw new Error(
        `Can't create, word pairs directly linked: ${adjacentPairs
          .map(([from, to], i) =>
            hopsResponses[i].status === 'fulfilled' ? `${from}-${to}` : null,
          )
          .filter(Boolean)
          .join(', ')}`,
      );
    }

    // finally, just create the game because it's valid and none exist yet
    const filter = new Filter();
    const game = await GameModel.create(
      {
        id: nanoid(),
        ownerIds: ownerId,
        wordsKey,
        words: normalizedWords,
        isDraft: true,
        looksNaughty: filter.isProfane(normalizedWords.join(' ')),
        // publishDate set by cron scanner TODO
      },
      {
        overwrite: false,
      },
    );
    cache.set(game.id, game);
    return game;
  },

  update: async (id: string, input: Partial<DBGame>, userId?: string) => {
    if (userId !== env.adminUserId || !env.adminUserId) {
      throw new Error('Only admin can update games');
    }

    const updatedItem = await GameModel.update({ id }, input, {
      condition: new Condition().attribute('id').exists(),
      returnValues: 'ALL_NEW',
    });
    if (updatedItem?.id) cache.set(updatedItem.id, updatedItem);
    return updatedItem;
  },
});

export const startController = () => {
  const gameModel = model<DBGame>(env.tableName, GameSchema);

  return createGameController(gameModel);
};
