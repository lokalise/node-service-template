import type { RouteVisibility } from '@lokalise/api-contracts'
import type { FastifyInstance, FastifyPluginCallback } from 'fastify'
import fp from 'fastify-plugin'
import { ResponseSerializationError } from 'fastify-type-provider-zod'
import z from 'zod/v4'
import { type JSONSchema, safeEncode } from 'zod/v4/core'

/**
 * PoC: field-level response visibility driven by the `visibility` Zod meta key, mirroring the
 * route-level `visibility: 'internal' | 'public'` that @lokalise/api-contracts already uses.
 *
 * A response schema property marked `.meta({ visibility: 'internal' })` is returned to
 * internal consumers but stripped for public ones (no meta means public). The flag is the
 * single source of truth: the same marker drives the serializer split here and the OpenAPI
 * document cleanup in
 * {@link stripInternalFieldsFromJsonSchema}, so the public document and the public responses
 * cannot drift apart.
 *
 * How it works:
 * - `onRoute` (boot time, once per route): derives a "public" Zod schema per response status
 *   code by recursively dropping `x-internal` properties, and precompiles an encoder for it.
 *   Routes whose responses carry no internal fields get no encoder and zero runtime overhead.
 * - `preHandler` (per request): resolves the consumer from the `x-api-source` header into
 *   `req.reqContext.source` and, for public requests on routes that have public encoders,
 *   swaps the serializer for this reply only via `reply.serializer()`. Internal requests go
 *   through the route's normal compiled serializer, untouched.
 *
 * PoC shortcuts (would change before production):
 * - The source comes from a plain request header, so any caller can claim to be internal.
 *   The real implementation would derive it from authentication or a gateway-stamped header,
 *   and default to `public` (fail closed) instead of `internal`.
 */

export const API_SOURCE_HEADER = 'x-api-source'

// Same domain as the route-level `visibility` in @lokalise/api-contracts: the consumer is
// either an internal one or a public one.
export type ApiSource = RouteVisibility

type PublicEncoder = (payload: unknown) => string

declare module 'fastify' {
  interface RequestContext {
    source?: ApiSource
  }

  interface FastifyContextConfig {
    publicEncoders?: Record<string, PublicEncoder>
  }
}

// Key name as it appears in the generated JSON Schema; the typed access below goes through
// the GlobalMeta augmentation in @node-service-template/api-contracts (zodMeta.ts).
const VISIBILITY_META_KEY = 'visibility'
const INTERNAL_VISIBILITY = 'internal' satisfies RouteVisibility

const isInternalField = (schema: z.ZodType): boolean =>
  schema.meta()?.visibility === INTERNAL_VISIBILITY

/**
 * Derive the public variant of a response schema by dropping every property marked
 * `visibility: 'internal'`, recursing through objects, arrays and optional/nullable wrappers.
 *
 * Returns the input schema instance unchanged when nothing was stripped, so callers can use
 * identity (`derived === schema`) to detect "this schema has no internal fields".
 *
 * PoC scope: unions, records, lazy and discriminated unions are passed through untouched.
 * A production version should either recurse into them or fail at boot when an internal
 * field hides inside an unsupported construct, so nothing leaks silently.
 */
export function derivePublicSchema(schema: z.ZodType): z.ZodType {
  if (schema instanceof z.ZodObject) {
    return derivePublicObjectSchema(schema)
  }
  if (schema instanceof z.ZodArray) {
    return deriveRewrapped(schema, schema.element as z.ZodType, (inner) => z.array(inner))
  }
  if (schema instanceof z.ZodOptional) {
    return deriveRewrapped(schema, schema.unwrap() as z.ZodType, (inner) => inner.optional())
  }
  if (schema instanceof z.ZodNullable) {
    return deriveRewrapped(schema, schema.unwrap() as z.ZodType, (inner) => inner.nullable())
  }
  return schema
}

function derivePublicObjectSchema(schema: z.ZodObject): z.ZodType {
  const shape: Record<string, z.ZodType> = {}
  let changed = false
  for (const [key, property] of Object.entries<z.ZodType>(schema.shape)) {
    if (isInternalField(property)) {
      changed = true
      continue
    }
    const derived = derivePublicSchema(property)
    if (derived !== property) {
      changed = true
    }
    shape[key] = derived
  }
  return changed ? z.object(shape) : schema
}

function deriveRewrapped(
  schema: z.ZodType,
  inner: z.ZodType,
  rewrap: (inner: z.ZodType) => z.ZodType,
): z.ZodType {
  const derived = derivePublicSchema(inner)
  return derived === inner ? schema : rewrap(derived)
}

/**
 * `zodToJsonConfig.override` for `createJsonSchemaTransform`: removes `visibility: 'internal'`
 * properties from the generated OpenAPI document, mirroring what the public serializer strips
 * at runtime. The `visibility` key itself is scrubbed from surviving properties too — it is a
 * Zod-side marker, not an OpenAPI extension (`x-` prefixed), so it should not leak into the
 * published document.
 *
 * PoC caveat: `apiDocumentationPlugin` runs one shared transform for both the public and the
 * internal document, so the field disappears from both. Showing internal fields in the
 * internal document would need a per-audience transform option in fastify-extras.
 */
export function stripInternalFieldsFromJsonSchema(ctx: { jsonSchema: JSONSchema.BaseSchema }) {
  const properties = ctx.jsonSchema.properties
  if (!properties) {
    return
  }
  for (const [key, value] of Object.entries(properties)) {
    if (!value || typeof value !== 'object' || !(VISIBILITY_META_KEY in value)) {
      continue
    }
    if (value[VISIBILITY_META_KEY] === INTERNAL_VISIBILITY) {
      delete properties[key]
      if (Array.isArray(ctx.jsonSchema.required)) {
        ctx.jsonSchema.required = ctx.jsonSchema.required.filter((name) => name !== key)
      }
    } else {
      delete value[VISIBILITY_META_KEY]
    }
  }
}

function plugin(fastify: FastifyInstance, _opts: unknown, next: (err?: Error) => void) {
  fastify.addHook('onRoute', (route) => {
    const responses = route.schema?.response as Record<string, unknown> | undefined
    if (!responses) {
      return
    }
    const publicEncoders: Record<string, PublicEncoder> = {}
    for (const [statusCode, maybeSchema] of Object.entries(responses)) {
      if (!(maybeSchema instanceof z.ZodType)) {
        continue
      }
      const publicSchema = derivePublicSchema(maybeSchema)
      if (publicSchema === maybeSchema) {
        continue
      }
      publicEncoders[statusCode] = (payload) => {
        const result = safeEncode(publicSchema, payload)
        if (result.error) {
          throw new ResponseSerializationError(String(route.method), route.url, {
            cause: result.error,
          })
        }
        return JSON.stringify(result.data)
      }
    }
    if (Object.keys(publicEncoders).length === 0) {
      return
    }
    // Narrowed view of the route: `apiContract` is declared required on FastifyContextConfig
    // by @lokalise/fastify-api-contracts' augmentation, but plain (non-contract) routes have
    // no config at all, so a fresh `{ publicEncoders }` literal would not typecheck.
    const holder = route as { config?: { publicEncoders?: Record<string, PublicEncoder> } }
    holder.config ??= {}
    holder.config.publicEncoders = publicEncoders
  })

  fastify.addHook('preHandler', (req, reply, done) => {
    // PoC: header-driven. Missing header counts as internal so the rest of the template's
    // routes and tests keep their current behavior; production would fail closed instead.
    const source: ApiSource = req.headers[API_SOURCE_HEADER] === 'public' ? 'public' : 'internal'
    req.reqContext.source = source

    const encoders = req.routeOptions.config?.publicEncoders
    if (source === 'public' && encoders) {
      // The closure reads reply.statusCode at send time, after the handler fixed the status,
      // so multi-status routes (200/201/4xx) pick the right encoder. Statuses without a
      // derived encoder (no internal fields, or no zod schema) fall back to plain JSON,
      // matching Fastify's own behavior for schema-less responses.
      reply.serializer((payload: unknown) => {
        const encode = encoders[String(reply.statusCode)]
        return encode ? encode(payload) : JSON.stringify(payload)
      })
    }
    done()
  })

  next()
}

export const publicApiSerializationPlugin: FastifyPluginCallback = fp(plugin, {
  fastify: '5.x',
  name: 'public-api-serialization-plugin',
})
