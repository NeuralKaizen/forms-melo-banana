CREATE TABLE "strategy_stages" (
	"project_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"status" text DEFAULT 'pendiente' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "strategy_stages_project_id_stage_pk" PRIMARY KEY("project_id","stage")
);
--> statement-breakpoint
CREATE TABLE "strategy_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"content" jsonb NOT NULL,
	"author" text NOT NULL,
	"author_label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "strategy_stages" ADD CONSTRAINT "strategy_stages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_versions" ADD CONSTRAINT "strategy_versions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "strategy_versions_project_stage" ON "strategy_versions" USING btree ("project_id","stage");