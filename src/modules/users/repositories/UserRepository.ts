import type { Prisma, PrismaClient, User } from '@prisma/client'

import type { UsersInjectableDependencies } from '../userDiConfig.js'

export class UserRepository {
  private readonly prisma: PrismaClient

  constructor({ prisma }: UsersInjectableDependencies) {
    this.prisma = prisma
  }

  getUser(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: {
        id,
      },
    })
  }

  deleteUser(id: string): Promise<User | null> {
    return this.prisma.user.delete({
      where: {
        id,
      },
    })
  }

  updateUser(id: string, updatedUser: Prisma.UserUpdateInput): Promise<User | null> {
    return this.prisma.user.update({
      data: updatedUser,
      where: {
        id,
      },
    })
  }

  async getUsers(userIds: string[]): Promise<User[]> {
    const result = await this.prisma.user.findMany({
      where: {
        id: {
          in: userIds,
        },
      },
    })
    return result
  }

  async createUser(user: Prisma.UserCreateInput): Promise<User> {
    const createdUser = await this.prisma.user.create({
      data: user,
    })
    return createdUser
  }
}
