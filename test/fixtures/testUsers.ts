import type { Prisma } from '@prisma/client'

export const TEST_USER_1: Prisma.UserCreateInput = {
  name: 'John',
  email: 'john@test.com',
}
