import { PublicError } from '@lokalise/errors'
import { USER_NOT_FOUND_ERROR_DEFINITION } from '@node-service-template/api-contracts'

// Binds the definition shared with the API contract, so HTTP status, error code and details
// shape stay in sync with what clients parse. Match with `UserNotFoundError.isInstance(err)`,
// not `instanceof`.
export class UserNotFoundError extends PublicError.from(USER_NOT_FOUND_ERROR_DEFINITION) {
  constructor(userId: string) {
    super({ message: 'User not found', details: { id: userId } })
  }
}
