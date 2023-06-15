import type { Prisma, PrismaClient, User } from '@prisma/client'

import type { Dependencies } from '../../../infrastructure/diConfig'

export class UserRepository {
  private readonly prisma: PrismaClient

  constructor({ prisma }: Dependencies) {
    this.prisma = prisma
  }

  getUser(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: {
        id,
      },
    })
  }

  deleteUser(id: number): Promise<User | null> {
    return this.prisma.user.delete({
      where: {
        id,
      },
    })
  }

  updateUser(id: number, updatedUser: Prisma.UserUpdateInput): Promise<User | null> {
    return this.prisma.user.update({
      data: updatedUser,
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

  async createUser(user: Prisma.UserCreateInput): Promise<User> {
    const createdUser = await this.prisma.user.create({
      data: user,
    })
    return createdUser
  }
}
