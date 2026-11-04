import { Schema } from 'effect';

const ExtraFields = Schema.Record(Schema.String, Schema.Unknown);
const TokenCount = Schema.Int.check(
  Schema.isBetween({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
);
const Usage = Schema.StructWithRest(
  Schema.Struct({
    prompt_tokens: Schema.optional(Schema.NullOr(TokenCount)),
    completion_tokens: Schema.optional(Schema.NullOr(TokenCount)),
    cost: Schema.optional(
      Schema.NullOr(Schema.Number.check(Schema.isGreaterThanOrEqualTo(0), Schema.isFinite())),
    ),
  }),
  [ExtraFields],
);

export const Configuration = Schema.Struct({
  apiKey: Schema.String.check(Schema.isMinLength(1)),
  model: Schema.String.check(Schema.isBetweenLength(1, 200)),
  endpoint: Schema.String,
  maxInputChars: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 200_000 })),
  maxResponseBytes: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 1_048_576 })),
});

export const Generation = Schema.Struct({
  messages: Schema.Array(
    Schema.Struct({
      role: Schema.Literals(['system', 'user', 'assistant']),
      content: Schema.String,
    }),
  ).check(Schema.isMinLength(1)),
  responseSchema: Schema.JsonObject,
  maxOutputTokens: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 32_000 })),
});

export const Envelope = Schema.StructWithRest(
  Schema.Struct({
    model: Schema.String.check(Schema.isBetweenLength(1, 200)),
    usage: Schema.optional(Schema.NullOr(Usage)),
    choices: Schema.Unknown,
    error: Schema.optional(Schema.Null),
  }),
  [ExtraFields],
);

export const Choices = Schema.Array(
  Schema.StructWithRest(
    Schema.Struct({
      message: Schema.StructWithRest(
        Schema.Struct({ content: Schema.String.check(Schema.isMaxLength(200_000)) }),
        [ExtraFields],
      ),
    }),
    [ExtraFields],
  ),
).check(Schema.isMinLength(1));
