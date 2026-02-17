DROP VIEW IF EXISTS "current_offers";
--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "registration_url" text;
--> statement-breakpoint
UPDATE "offers" SET "registration_url" = 'https://venda-imoveis.caixa.gov.br/editais/matricula/' || uf || '/' || source_id || '.pdf';
--> statement-breakpoint
ALTER TABLE "offers" ALTER COLUMN "registration_url" SET NOT NULL;
--> statement-breakpoint
CREATE VIEW "current_offers" AS
SELECT * FROM (
  SELECT DISTINCT ON (source_id) *
  FROM offers
  ORDER BY source_id, version DESC
) latest
WHERE operation != 'delete';
