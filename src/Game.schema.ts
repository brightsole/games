import { Schema } from 'dynamoose';

export default new Schema(
  {
    ownerIds: {
      type: String,
      required: true,
      index: { name: 'ownerIds', type: 'global' },
    }, // yes i'm aware it's plural, we smash ids together
    // we should never have more than 3 user ids per game
    id: { type: String, hashKey: true, required: true },
    isDraft: { type: Boolean, required: true, default: true },
    looksNaughty: { type: Boolean, required: true, default: false },
    wordsKey: {
      type: String,
      required: true,
    },
    publishDate: {
      type: Date,
      required: false,
    },
    words: {
      type: Array,
      schema: [String],
      required: true,
      validate: (value) => {
        if (!Array.isArray(value)) {
          return false;
        }
        if (value.length <= 1) {
          return false;
        }
        if (value.length > 5) {
          return false;
        }
        return true;
      },
    },
  },
  { timestamps: true },
);
