import { GraphQLDateTime, GraphQLJSONObject } from 'graphql-scalars';
import type { Context } from './types';
import { Resolvers } from './generated/graphql';

const resolvers: Resolvers<Context> = {
  Query: {
    game: (_parent, { id }, { gameController }) =>
      id ? gameController.getById(id) : null,

    // Uses performant GSI query when publishMonth is provided
    // Otherwise falls back to slow scan with contains filters
    games: (
      _parent,
      { query: { ownerId, word, publishMonth } },
      { gameController },
    ) => gameController.query({ ownerId, word, publishMonth }),
  },

  Mutation: {
    submitGame: async (_parent, { words }, { ownerId, gameController }) =>
      gameController.create({ words }, ownerId),
  },

  Game: {
    // for finding out the info of the other games in the system
    __resolveReference: async ({ id }, { gameController }) =>
      gameController.getById(id),

    words: (parent, _args, _context) =>
      parent.words.map((word: string) => ({ __typename: 'Word', name: word })),

    // owners: (parent, _args, _context) =>
    //   parent.ownerIds
    //     .split('|')
    //     .map((ownerId: string) => ({ __typename: 'User', id: ownerId })),
  },

  DateTime: GraphQLDateTime,
  JSONObject: GraphQLJSONObject,
};

export default resolvers;
