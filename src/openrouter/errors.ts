import { Data } from 'effect';

export class EvidenceWriteFailed extends Data.TaggedError('EvidenceWriteFailed')<{
  cause: unknown;
}> {}
