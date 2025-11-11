import { gql } from 'graphql-tag';

export default gql`
  scalar DateTime
  scalar JSONObject

  extend schema
    @link(
      url: "https://specs.apollo.dev/federation/v2.0"
      import: ["@key", "@shareable", "@external"]
    )

  type Word @key(fields: "name") {
    name: ID!
  }

  # type User @key(fields: "id") @external {
  #   id: ID!
  # }

  type Game @key(fields: "id") @shareable {
    id: ID!
    words: [Word!]!
    # owners: [User!]!
    publicReleaseDate: DateTime
    createdAt: DateTime
    updatedAt: DateTime
  }

  input GameQueryInput {
    ownerId: String
    word: String
    releaseMonth: String
  }

  type Query {
    # no id returns today's game
    game(id: ID): Game
    games(query: GameQueryInput!): [Game]
  }

  type Mutation {
    submitGame(words: [String!]!): Game
  }
`;
