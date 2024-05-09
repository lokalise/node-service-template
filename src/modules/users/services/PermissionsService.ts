// Not a real example of a service, do not use for non-testing purposes
export class PermissionsService {
  private permissions: Record<string, string[]>

  constructor() {
    this.permissions = {}
  }

  async setPermissions(userId: string, permissions: string[]) {
    this.permissions[userId] = permissions
    return Promise.resolve()
  }

  async getUserPermissionsBulk(userIds: string[]) {
    const result = Object.entries(this.permissions)
      .filter((entry) => {
        return userIds.includes(entry[0])
      })
      .map((entry) => {
        return entry[1]
      })
    return Promise.resolve(result)
  }

  async deleteAll() {
    this.permissions = {}
    return Promise.resolve()
  }
}
