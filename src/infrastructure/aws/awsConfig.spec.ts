import { ConfigScope } from '@lokalise/node-core'
import { describe, expect, it } from 'vitest'
import { getAwsConfig } from './awsConfig.ts'

const SNS_ENDPOINT_LITERAL = 'sns-endpoint'
const SQS_ENDPOINT_LITERAL = 'sqs-endpoint'
const KMS_KEY_ID_LITERAL = 'kms-key-id'
const DEFAULT_REGION = 'eu-west-1'

describe('aws-config', () => {
  describe('getAwsConfig', () => {
    it('provides aws config', () => {
      const configScope = new ConfigScope({
        AWS_REGION: DEFAULT_REGION,
        AWS_KMS_KEY_ID: KMS_KEY_ID_LITERAL,
        AWS_SNS_ENDPOINT: SNS_ENDPOINT_LITERAL,
        AWS_SQS_ENDPOINT: SQS_ENDPOINT_LITERAL,
        AWS_ALLOWED_SOURCE_OWNER: '000',
        AWS_ACCESS_KEY_ID: 'access-key-id',
        AWS_SECRET_ACCESS_KEY: 'secret-access-key',
      })

      const config = getAwsConfig(configScope)

      expect(config).toMatchObject({
        region: DEFAULT_REGION,
        kmsKeyId: KMS_KEY_ID_LITERAL,
        allowedSourceOwner: '000',
        sns: {
          endpoint: SNS_ENDPOINT_LITERAL,
        },
        sqs: {
          endpoint: SQS_ENDPOINT_LITERAL,
        },
        credentials: {
          accessKeyId: 'access-key-id',
          secretAccessKey: 'secret-access-key',
        },
      })
    })

    it('provides aws config with default credentials resolver when not explicitly provided', () => {
      const configScope = new ConfigScope({
        AWS_REGION: DEFAULT_REGION,
        AWS_KMS_KEY_ID: KMS_KEY_ID_LITERAL,
        AWS_SNS_ENDPOINT: SNS_ENDPOINT_LITERAL,
        AWS_SQS_ENDPOINT: SQS_ENDPOINT_LITERAL,
      })

      const config = getAwsConfig(configScope)

      expect(config).toMatchObject({
        region: DEFAULT_REGION,
        kmsKeyId: KMS_KEY_ID_LITERAL,
        sns: {
          endpoint: SNS_ENDPOINT_LITERAL,
          topicArnPattern: undefined,
        },
        sqs: {
          endpoint: SQS_ENDPOINT_LITERAL,
          queueArnPattern: undefined,
        },
        credentials: expect.any(Function),
      })
    })

    it('provides aws config with default credentials resolver when one of the values is blank', () => {
      const configScope = new ConfigScope({
        AWS_REGION: DEFAULT_REGION,
        AWS_KMS_KEY_ID: KMS_KEY_ID_LITERAL,
        AWS_SNS_ENDPOINT: SNS_ENDPOINT_LITERAL,
        AWS_SQS_ENDPOINT: SQS_ENDPOINT_LITERAL,
        AWS_ACCESS_KEY_ID: '',
        AWS_SECRET_ACCESS_KEY: 'test',
      })

      const config = getAwsConfig(configScope)

      expect(config).toMatchObject({
        region: DEFAULT_REGION,
        kmsKeyId: KMS_KEY_ID_LITERAL,
        sns: {
          endpoint: SNS_ENDPOINT_LITERAL,
          topicArnPattern: undefined,
        },
        sqs: {
          endpoint: SQS_ENDPOINT_LITERAL,
          queueArnPattern: undefined,
        },
        credentials: expect.any(Function),
      })
    })

    it('provides aws config with default credentials resolver when both values are blank', () => {
      const configScope = new ConfigScope({
        AWS_REGION: DEFAULT_REGION,
        AWS_KMS_KEY_ID: KMS_KEY_ID_LITERAL,
        AWS_SNS_ENDPOINT: SNS_ENDPOINT_LITERAL,
        AWS_SQS_ENDPOINT: SQS_ENDPOINT_LITERAL,
        AWS_ACCESS_KEY_ID: '',
        AWS_SECRET_ACCESS_KEY: '',
      })

      const config = getAwsConfig(configScope)

      expect(config).toMatchObject({
        region: DEFAULT_REGION,
        kmsKeyId: KMS_KEY_ID_LITERAL,
        sns: {
          endpoint: SNS_ENDPOINT_LITERAL,
          topicArnPattern: undefined,
        },
        sqs: {
          endpoint: SQS_ENDPOINT_LITERAL,
          queueArnPattern: undefined,
        },
        credentials: expect.any(Function),
      })
    })

    it('provides aws config with topic and queue arn', () => {
      const configScope = new ConfigScope({
        AWS_REGION: DEFAULT_REGION,
        AWS_KMS_KEY_ID: KMS_KEY_ID_LITERAL,
        AWS_SNS_ENDPOINT: SNS_ENDPOINT_LITERAL,
        AWS_SQS_ENDPOINT: SQS_ENDPOINT_LITERAL,
        AWS_SNS_TOPIC_NAME_PATTERN: 'topic-name',
        AWS_SQS_QUEUE_NAME_PATTERN: 'queue-name',
      })

      const config = getAwsConfig(configScope)

      expect(config).toMatchObject({
        region: DEFAULT_REGION,
        kmsKeyId: KMS_KEY_ID_LITERAL,
        sns: {
          endpoint: SNS_ENDPOINT_LITERAL,
          topicArnPattern: 'arn:aws:sns:*:*:topic-name*',
        },
        sqs: {
          endpoint: SQS_ENDPOINT_LITERAL,
          queueArnPattern: 'arn:aws:sqs:*:*:queue-name*',
        },
        credentials: expect.any(Function),
      })
    })

    it('does not append wildcard if one is already present to ARN', () => {
      const configScope = new ConfigScope({
        AWS_REGION: DEFAULT_REGION,
        AWS_KMS_KEY_ID: KMS_KEY_ID_LITERAL,
        AWS_SNS_ENDPOINT: SNS_ENDPOINT_LITERAL,
        AWS_SQS_ENDPOINT: SQS_ENDPOINT_LITERAL,
        AWS_SNS_TOPIC_NAME_PATTERN: 'topic-name:*',
        AWS_SQS_QUEUE_NAME_PATTERN: 'queue-name:*',
      })

      const config = getAwsConfig(configScope)

      expect(config).toMatchObject({
        region: DEFAULT_REGION,
        kmsKeyId: KMS_KEY_ID_LITERAL,
        sns: {
          endpoint: SNS_ENDPOINT_LITERAL,
          topicArnPattern: 'arn:aws:sns:*:*:topic-name:*',
        },
        sqs: {
          endpoint: SQS_ENDPOINT_LITERAL,
          queueArnPattern: 'arn:aws:sqs:*:*:queue-name:*',
        },
        credentials: expect.any(Function),
      })
    })

    it('checks for mandatory fields', () => {
      const configScope = new ConfigScope({
        AWS_KMS_KEY_ID: KMS_KEY_ID_LITERAL,
      })

      expect(() => getAwsConfig(configScope)).toThrow(
        'Missing mandatory configuration parameter: AWS_REGION',
      )
    })
  })
})
