import { Dependencies } from '../../../infrastructure/diConfig'

export class PermissionsService {
  private permissions: Record<number, string[]>

  constructor(dependencies: Dependencies) {
    this.permissions = {}
  }

  async setPermissions(userId: number, permissions: string[]) {
    this.permissions[userId] = permissions
  }

  async getUserPermissionsBulk(userIds: number[]) {
    return Object.entries(this.permissions)
      .filter((entry) => {
        return userIds.includes(Number.parseInt(entry[0]))
      })
      .map((entry) => {
        return entry[1]
      })
  }
}
