-- 菜名搜索使用三元组索引（没有 Embedding 时的检索方式，见 docs/design-docs/recommendation-agent.md）。
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "public"."course" AS ENUM('meat', 'veg', 'soup', 'staple', 'snack', 'dessert', 'drink');--> statement-breakpoint
CREATE TYPE "public"."ingredient_category" AS ENUM('vegetable', 'fruit', 'meat', 'seafood', 'egg_dairy', 'soy', 'staple', 'dry_goods', 'seasoning', 'other');--> statement-breakpoint
CREATE TYPE "public"."ingredient_group" AS ENUM('main', 'side', 'seasoning');--> statement-breakpoint
CREATE TYPE "public"."meal_type" AS ENUM('breakfast', 'lunch', 'dinner');--> statement-breakpoint
CREATE TYPE "public"."recipe_source" AS ENUM('seed', 'llm', 'admin');--> statement-breakpoint
CREATE TYPE "public"."recipe_status" AS ENUM('draft', 'pending_review', 'published', 'rejected', 'archived');--> statement-breakpoint
CREATE TYPE "public"."seed_item_status" AS ENUM('imported', 'failed', 'skipped');--> statement-breakpoint
CREATE TABLE "ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"aliases" text[] DEFAULT '{}' NOT NULL,
	"category" "ingredient_category" NOT NULL,
	"allergen_tags" text[] DEFAULT '{}' NOT NULL,
	"diet_tags" text[] DEFAULT '{}' NOT NULL,
	"is_pantry_staple" boolean DEFAULT false NOT NULL,
	"search_keyword" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ingredients_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "recipe_ingredients" (
	"recipe_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"group" "ingredient_group" NOT NULL,
	"quantity" numeric,
	"unit" text NOT NULL,
	"prep_note" text,
	"optional" boolean DEFAULT false NOT NULL,
	CONSTRAINT "recipe_ingredients_recipe_id_position_pk" PRIMARY KEY("recipe_id","position")
);
--> statement-breakpoint
CREATE TABLE "recipe_steps" (
	"recipe_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"instruction" text NOT NULL,
	"duration_minutes" integer,
	"tip" text,
	CONSTRAINT "recipe_steps_recipe_id_position_pk" PRIMARY KEY("recipe_id","position")
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"cuisine" text,
	"meal_types" "meal_type"[] NOT NULL,
	"course" "course" NOT NULL,
	"difficulty" integer NOT NULL,
	"prep_minutes" integer NOT NULL,
	"cook_minutes" integer NOT NULL,
	"base_servings" integer NOT NULL,
	"flavor_tags" text[] DEFAULT '{}' NOT NULL,
	"spice_level" integer DEFAULT 0 NOT NULL,
	"equipment" text[] DEFAULT '{}' NOT NULL,
	"tips" text,
	"allergen_tags" text[] DEFAULT '{}' NOT NULL,
	"diet_flags" text[] DEFAULT '{}' NOT NULL,
	"status" "recipe_status" NOT NULL,
	"source" "recipe_source" NOT NULL,
	"source_ref" text,
	"generated_for_user_id" uuid,
	"generated_model" text,
	"review_note" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seed_import_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch" text NOT NULL,
	"source_path" text NOT NULL,
	"status" "seed_item_status" NOT NULL,
	"recipe_id" uuid,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seed_import_items_source_path_unique" UNIQUE("source_path")
);
--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_steps" ADD CONSTRAINT "recipe_steps_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_generated_for_user_id_users_id_fk" FOREIGN KEY ("generated_for_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seed_import_items" ADD CONSTRAINT "seed_import_items_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ingredients_aliases_idx" ON "ingredients" USING gin ("aliases");--> statement-breakpoint
CREATE INDEX "recipe_ingredients_ingredient_idx" ON "recipe_ingredients" USING btree ("ingredient_id");--> statement-breakpoint
CREATE INDEX "recipes_status_idx" ON "recipes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "recipes_allergen_tags_idx" ON "recipes" USING gin ("allergen_tags");--> statement-breakpoint
CREATE INDEX "recipes_meal_types_idx" ON "recipes" USING gin ("meal_types");--> statement-breakpoint
CREATE INDEX "recipes_name_trgm_idx" ON "recipes" USING gin ("name" gin_trgm_ops);