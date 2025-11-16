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
    status: {
      type: String,
      required: true,
      default: 'draft',
      enum: ['draft', 'ready', 'published'],
      index: {
        name: 'status',
        type: 'global',
        rangeKey: 'publishMonth',
      },
    },
    looksNaughty: { type: Boolean, required: true, default: false },
    wordsKey: {
      type: String,
      required: true,
      index: { name: 'wordsKey', type: 'global' },
    }, // same kind of horrible plurality thing, sorry
    publishDate: {
      type: Date,
      required: false,
    },
    publishMonth: {
      type: String,
      required: false,
      index: { name: 'publishMonth', type: 'global' },
    }, // Format: YYYY-MM for efficient querying by month
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
