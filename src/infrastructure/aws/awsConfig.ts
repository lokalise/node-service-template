import { fromTokenFile } from '@aws-sdk/credential-providers'
import type { ConfigScope } from '@lokalise/node-core'
import { generateWildcardSnsArn, generateWildcardSqsArn } from '@message-queue-toolkit/sqs'
import type { AwsCredentialIdentity, Provider } from '@smithy/types'

function ensureWildcard(value?: string) {
  if (!value) {
    return value
  }

  if (!value.endsWith('*')) {
    return `${value}*`
  }

  return value
}

export const awsSnsPrefixTransformer = (value?: string) => {
  const valueWithWildCard = ensureWildcard(value)
  if (!valueWithWildCard) {
    return
  }

  return generateWildcardSnsArn(valueWithWildCard)
}

export const awsSqsPrefixTransformer = (value?: string) => {
  const valueWithWildCard = ensureWildcard(value)
  if (!valueWithWildCard) {
    return
  }

  return generateWildcardSqsArn(valueWithWildCard)
}

export type AwsAwareDependencies = {
  config: {
    aws: AwsConfig
  }
}

export type AwsConfig = {
  region: string
  kmsKeyId: string
  allowedSourceOwner: string
  sns: {
    endpoint?: string
    topicArnPattern?: string
  }
  sqs: {
    endpoint?: string
    queueArnPattern?: string
  }
  credentials?: AwsCredentialIdentity | Provider<AwsCredentialIdentity>
}

export function getAwsConfig(configScope: ConfigScope): AwsConfig {
  const accessKeyId = configScope.getOptionalNullable('AWS_ACCESS_KEY_ID', undefined)
  const secretAccessKey = configScope.getOptionalNullable('AWS_SECRET_ACCESS_KEY', undefined)

  const resolvedCredentials =
    accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : fromTokenFile()

  return {
    region: configScope.getMandatory('AWS_REGION'),
    kmsKeyId: configScope.getOptionalNullable('AWS_KMS_KEY_ID', ''),
    allowedSourceOwner: configScope.getOptionalNullable('AWS_ALLOWED_SOURCE_OWNER', ''),
    sns: {
      endpoint: configScope.getOptionalNullable('AWS_SNS_ENDPOINT', undefined),
      topicArnPattern: configScope.getOptionalNullableTransformed(
        'AWS_SNS_TOPIC_NAME_PATTERN',
        undefined,
        awsSnsPrefixTransformer,
      ),
    },
    sqs: {
      endpoint: configScope.getOptionalNullable('AWS_SQS_ENDPOINT', undefined),
      queueArnPattern: configScope.getOptionalNullableTransformed(
        'AWS_SQS_QUEUE_NAME_PATTERN',
        undefined,
        awsSqsPrefixTransformer,
      ),
    },
    credentials: resolvedCredentials,
  }
}
