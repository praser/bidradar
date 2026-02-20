CREATE UNIQUE INDEX IF NOT EXISTS "idx_api_keys_user_id_name" ON "api_keys" USING btree ("user_id", "name");
