import type { RouteVisibility } from '@lokalise/api-contracts'

/**
 * Field-level visibility of a response property, same domain as the route-level `visibility`
 * in @lokalise/api-contracts. Absent means public.
 */
export type FieldVisibility = RouteVisibility

// Zod v4's GlobalMeta interface is deliberately empty so consumers can augment it. Typing the
// `visibility` key here means `.meta({ visibility: 'intrenal' })` is a compile error instead
// of a silently ignored marker, and readers (publicApiSerializationPlugin) get
// `RouteVisibility | undefined` from `schema.meta()` instead of `unknown`.
declare module 'zod/v4/core' {
  interface GlobalMeta {
    visibility?: FieldVisibility
  }
}
