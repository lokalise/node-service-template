/**
 * Canonical OpenAPI tag catalog for this service's public API.
 *
 * Each tag's `name` and `description` are defined together, exactly ONCE, so a
 * tag name never ends up carrying different descriptions across contracts.
 *
 * Usage:
 * - a contract tags itself with `OpenApiTags.<Tag>.name`;
 * - the app registers the `{ name, description }` objects under `openapi.tags`
 *   (see `src/app.ts`) so the descriptions reach the generated OpenAPI document.
 */
export const OpenApiTags = {
  User: {
    name: 'User',
    description:
      'Operations for managing users: creating, retrieving, updating, and deleting user records.',
  },
} as const satisfies Record<string, { name: string; description: string }>
