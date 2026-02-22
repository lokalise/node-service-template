process.loadEnvFile('./.env')
process.env.DATABASE_URL = 'postgresql://serviceuser:pass@localhost:5432/service_db_test'
process.env.AWS_ENDPOINT = 'http://localhost:4567'
