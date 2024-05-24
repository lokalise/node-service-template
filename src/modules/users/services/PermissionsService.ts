// Not a real example of a service, do not use for non-testing purposes
import type { RequestContext } from '@lokalise/fastify-extras'

export class PermissionsService {
  private permissions: Record<string, string[]>

  constructor() {
    this.permissions = {}
  }

  setPermissions(requestContext: RequestContext, userId: string, permissions: string[]) {
    this.permissions[userId] = permissions

    requestContext.logger.info({ userId, permissions }, 'Updated permissions')
    return Promise.resolve()
  }

  async getUserPermissionsBulk(requestContext: RequestContext, userIds: string[]) {
    const result = Object.entries(this.permissions)
      .filter((entry) => {
        return userIds.includes(entry[0])
      })
      .map((entry) => {
        return entry[1]
      })

    requestContext.logger.debug({ userIds }, 'Resolved permissions')
    return Promise.resolve(result)
  }

  deleteAll(requestContext: RequestContext) {
    this.permissions = {}

    requestContext.logger.info('Deleted all permissions')
    return Promise.resolve()
  }
}
