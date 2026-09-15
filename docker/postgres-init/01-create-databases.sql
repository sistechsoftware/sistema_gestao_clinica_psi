-- Executado automaticamente pelo entrypoint do Postgres NA PRIMEIRA
-- inicialização do volume (docker-entrypoint-initdb.d).
-- psa_dev já é criado via POSTGRES_DB.
--
-- Para recriar: docker compose down -v && npm run db:up
CREATE DATABASE psa_test;
GRANT ALL PRIVILEGES ON DATABASE psa_test TO psa;
