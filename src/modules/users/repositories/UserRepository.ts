import type { PrismaClient, User } from '@prisma/client'

import type { Dependencies } from '../../../infrastructure/diConfig'

export type CreateUserRow = Omit<User, 'id'>

export class UserRepository {
  private readonly prisma: PrismaClient

  constructor({ prisma }: Dependencies) {
    this.prisma = prisma
  }

  async getUser(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: {
        id,
      },
    })
  }

  async getUsers(userIds: number[]): Promise<User[]> {
    const result = await this.prisma.user.findMany({
      where: {
        id: {
          in: userIds,
        },
      },
    })
    return result
  }

  async createUser(user: CreateUserRow): Promise<User> {
    const createdUser = await this.prisma.user.create({
      data: user,
    })
    return createdUser
  }
}
