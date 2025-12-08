process.loadEnvFile('./.env')
process.env.DATABASE_URL = 'postgresql://serviceuser:pass@localhost:5432/service_db_test'
