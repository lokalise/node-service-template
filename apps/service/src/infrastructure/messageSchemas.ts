import type { ZodObject } from 'zod/v4'
import z from 'zod/v4'

type EnrichedMessageSchemas = {
  consumerSchema: ZodObject
  publisherSchema: ZodObject
}

/**
 * Replaces the consumer and publisher schemas of an enriched message definition with their
 * AOT-compiled equivalents. Every inbound message is parsed against `consumerSchema` and every
 * outbound one against `publisherSchema`, so the compiled fast path pays for itself.
 *
 * `z.compile()` preserves the schema type and its registry metadata, so message definitions keep
 * satisfying `CommonEventDefinition` and their descriptions still reach generated documentation.
 */
export function withCompiledSchemas<T extends EnrichedMessageSchemas>(definition: T): T {
  return {
    ...definition,
    consumerSchema: z.compile(definition.consumerSchema),
    publisherSchema: z.compile(definition.publisherSchema),
  }
}
