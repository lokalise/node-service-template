import { isStandardizedError } from '../typeUtils'

import { AmqpMessageInvalidFormat } from './amqpErrors'
import {ErrorProcessor} from "../errors/ErrorProcessor";

export class ConsumerErrorProcessor implements ErrorProcessor{
  public processError(exception: unknown) {
    if (isStandardizedError(exception)) {
      throw new AmqpMessageInvalidFormat({
        message: exception.message,
      })
    }
  }
}
