// loadEnvFile doesn't override variables that are already set, so .env.test wins over .env.shared
process.loadEnvFile('./.env.test')
process.loadEnvFile('./.env.shared')
