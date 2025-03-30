import { CommonModule } from './infrastructure/CommonModule.js'
import { UserModule } from './modules/users/UserModule.js'

export const ALL_MODULES = [new CommonModule(), new UserModule()]
