import { gql } from 'graphql-tag';
import { customAlphabet } from 'nanoid';
import getGraphqlServer from '../test/getGraphqlServer';
import type { createGameController } from '../src/gameController';

// good ole motorCase
const nanoid = customAlphabet('brumBRUM', 24);

type GameController = ReturnType<typeof createGameController>;

// INTEGRATION TEST OF THE FULL PATH
// only test for completion of high level access
// correct low level unit testing should be done on the resolver/util level

describe('Resolver full path', () => {
  it('submits a game without error', async () => {
    const server = getGraphqlServer();

    const submitGameMutation = gql`
      mutation SubmitGame($words: [String!]!) {
        submitGame(words: $words) {
          id
          words {
            id
          }
          owners {
            id
          }
        }
      }
    `;

    const create = jest.fn();
    const gameController = {
      create,
      getById: jest.fn(),
      listByOwner: jest.fn(),
      update: jest.fn(),
    } satisfies Partial<GameController>;

    const ownerId = 'player-who-submits-games';
    const words = ['cat', 'dog', 'fish'];

    create.mockResolvedValueOnce({
      id: nanoid(),
      ownerIds: ownerId,
      wordsKey: words.sort().join('|'),
      words,
      isDraft: true,
      looksNaughty: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const { body } = await server.executeOperation(
      {
        query: submitGameMutation,
        variables: {
          words,
        },
      },
      {
        contextValue: {
          ownerId,
          gameController,
        },
      },
    );

    if (body.kind !== 'single') {
      throw new Error('Expected a single GraphQL response');
    }

    const { singleResult } = body;

    expect(singleResult.errors).toBeUndefined();
    expect(singleResult.data).toEqual({
      submitGame: {
        id: expect.any(String),
        words: [{ id: 'cat' }, { id: 'dog' }, { id: 'fish' }],
        owners: [{ id: ownerId }],
      },
    });
    expect(create).toHaveBeenCalledWith({ words }, ownerId);
  });
});
