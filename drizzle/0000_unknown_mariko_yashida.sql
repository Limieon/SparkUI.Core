DO $$ BEGIN
 CREATE TYPE "public"."EControlNetMode" AS ENUM('Balanced', 'Prompt', 'ControlNet');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."EControlNetResizeMode" AS ENUM('Resize', 'CropAndResize', 'ResizeAndFill');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."EControlNetType" AS ENUM('Blur', 'Canny', 'Depth', 'IPAdapter', 'Inpaint', 'InstantID', 'Lineart', 'MLSD', 'NormalMap', 'OpenPose', 'Recolor', 'Reference', 'Revision', 'Scribble', 'Segmentation', 'Shuffle', 'Sketch', 'SoftEdge', 'T2IAdapter', 'Tile');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."EGenerationStatus" AS ENUM('Pending', 'Running', 'Succeded', 'Failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."EFileFormat" AS ENUM('SafeTensors', 'PickleTensor', 'ONNX', 'Other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."EPrecision" AS ENUM('FP32', 'FP16', 'BF16');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."ESizeType" AS ENUM('Pruned', 'Full', 'Unknown');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."ESDItemType" AS ENUM('Checkpoint', 'Lora', 'Embedding', 'ControlNet', 'ControlNetPreProcessor', 'Other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."ESDTrainingType" AS ENUM('CheckpointTrained', 'CheckpointMered', 'Unknown');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Image" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"data" "bytea",
	"file" varchar(256),
	"creator_id" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "JSDGenerationBatchControlNet" (
	"type" "EControlNetType" NOT NULL,
	"pixel_perfect" boolean NOT NULL,
	"preprocessor_id" uuid,
	"pre_image_id" uuid,
	"input_image_id" uuid,
	"mask" "bytea",
	"mode" "EControlNetMode" NOT NULL,
	"resize_mode" "EControlNetResizeMode" NOT NULL,
	"resolution" integer NOT NULL,
	"batch_id" uuid NOT NULL,
	"control_net_item_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "JSDGenerationBatchSDBaseItem" (
	"weight" double precision NOT NULL,
	"batch_id" uuid NOT NULL,
	"base_item_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "JTagImage" (
	"tag_name" varchar(64) NOT NULL,
	"image_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "JTagSDBaseItem" (
	"tag_name" varchar(64) NOT NULL,
	"base_item_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "JTagSDDataset" (
	"tag_name" varchar(64) NOT NULL,
	"dataset_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "SDBaseItem" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "ESDItemType",
	"name" varchar(256),
	"description" text,
	"brief" varchar(256),
	"version" varchar(64),
	"used_in_batches" integer DEFAULT 0,
	"used_in_images" integer DEFAULT 0,
	"nsfw" boolean NOT NULL,
	"nsfw_level" integer NOT NULL,
	"training_type" "ESDTrainingType" DEFAULT 'Unknown' NOT NULL,
	"container_id" uuid,
	"creator_id" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"last_used_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "SDCheckpointItem" (
	"id" uuid PRIMARY KEY NOT NULL,
	"refiner" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "SDContainer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(256),
	"description" text,
	"brief" varchar(256),
	"creator_id" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "SDControlNetItem" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "SDControlNetPreProcessorItem" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "SDDataset" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(256),
	"description" text,
	"brief" varchar(256),
	"creator_id" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "SDDatasetItem" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"caption" text,
	"dataset_id" uuid,
	"image_id" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "SDEmbeddingItem" (
	"id" uuid PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "SDGenerationBatch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"input_image_id" uuid,
	"prompt" text,
	"negative_prompt" text,
	"sampler" varchar(64),
	"cfg_scale" double precision,
	"steps" integer,
	"seed" bigint,
	"custom_data" jsonb,
	"generation_status" "EGenerationStatus",
	"used_checkpoint_id" uuid,
	"used_refiner_id" uuid,
	"creator_id" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"started_at" timestamp,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "SDGenerationBatchItem" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subseed" bigint,
	"rating" smallint,
	"custom_data" jsonb,
	"batch_id" uuid,
	"image_id" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "SDGenerationBatchItemAnalysis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"image_id" uuid,
	"model" varchar(256) NOT NULL,
	"quantization" varchar(64) NOT NULL,
	"prompt" text NOT NULL,
	"system_prompt" text,
	"analysis_text" text,
	"analysis_data" jsonb,
	"analyzed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "SDLoraItem" (
	"id" uuid PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "SDModelFile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location" varchar(256),
	"format" "EFileFormat",
	"precision" "EPrecision",
	"size_type" "ESizeType",
	"sha1" varchar(40),
	"sha256" varchar(64),
	"model_hash" varchar(16),
	"size" double precision NOT NULL,
	"item_id" uuid,
	"uploader_id" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "SDNode" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host" varchar(256),
	"port" smallint,
	"authentication_key" uuid DEFAULT gen_random_uuid(),
	"cpu" varchar(256),
	"gpu" varchar(256),
	"total_vram" integer,
	"total_ram" integer,
	"cache_size" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "SDTrainingInfo_Merged" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resulted_item_id" uuid NOT NULL,
	"merged_id" uuid NOT NULL,
	"weight" double precision NOT NULL,
	"hyperparameters" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "SDTrainingInfo_Trained" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid,
	"dataset_id" uuid,
	"hyperparameters" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Tag" (
	"name" varchar(64) PRIMARY KEY NOT NULL,
	"color" integer DEFAULT 0,
	"creator_id" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "User" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(256) NOT NULL,
	"username" varchar(64) NOT NULL,
	"profile_picture" "bytea",
	"password" varchar(256) NOT NULL,
	"role_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "User_email_unique" UNIQUE("email"),
	CONSTRAINT "User_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "UserRole" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(64) NOT NULL,
	"color" integer DEFAULT 0,
	"premissions" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "UserRole_name_unique" UNIQUE("name")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Image" ADD CONSTRAINT "Image_creator_id_User_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "JSDGenerationBatchControlNet" ADD CONSTRAINT "JSDGenerationBatchControlNet_preprocessor_id_SDControlNetPreProcessorItem_id_fk" FOREIGN KEY ("preprocessor_id") REFERENCES "public"."SDControlNetPreProcessorItem"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "JSDGenerationBatchControlNet" ADD CONSTRAINT "JSDGenerationBatchControlNet_pre_image_id_Image_id_fk" FOREIGN KEY ("pre_image_id") REFERENCES "public"."Image"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "JSDGenerationBatchControlNet" ADD CONSTRAINT "JSDGenerationBatchControlNet_input_image_id_Image_id_fk" FOREIGN KEY ("input_image_id") REFERENCES "public"."Image"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "JSDGenerationBatchControlNet" ADD CONSTRAINT "JSDGenerationBatchControlNet_batch_id_SDGenerationBatch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."SDGenerationBatch"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "JSDGenerationBatchControlNet" ADD CONSTRAINT "JSDGenerationBatchControlNet_control_net_item_id_SDControlNetItem_id_fk" FOREIGN KEY ("control_net_item_id") REFERENCES "public"."SDControlNetItem"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "JSDGenerationBatchSDBaseItem" ADD CONSTRAINT "JSDGenerationBatchSDBaseItem_batch_id_SDGenerationBatch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."SDGenerationBatch"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "JSDGenerationBatchSDBaseItem" ADD CONSTRAINT "JSDGenerationBatchSDBaseItem_base_item_id_SDBaseItem_id_fk" FOREIGN KEY ("base_item_id") REFERENCES "public"."SDBaseItem"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "JTagImage" ADD CONSTRAINT "JTagImage_tag_name_Tag_name_fk" FOREIGN KEY ("tag_name") REFERENCES "public"."Tag"("name") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "JTagImage" ADD CONSTRAINT "JTagImage_image_id_Image_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."Image"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "JTagSDBaseItem" ADD CONSTRAINT "JTagSDBaseItem_tag_name_Tag_name_fk" FOREIGN KEY ("tag_name") REFERENCES "public"."Tag"("name") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "JTagSDBaseItem" ADD CONSTRAINT "JTagSDBaseItem_base_item_id_SDBaseItem_id_fk" FOREIGN KEY ("base_item_id") REFERENCES "public"."SDBaseItem"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "JTagSDDataset" ADD CONSTRAINT "JTagSDDataset_tag_name_Tag_name_fk" FOREIGN KEY ("tag_name") REFERENCES "public"."Tag"("name") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "JTagSDDataset" ADD CONSTRAINT "JTagSDDataset_dataset_id_SDDataset_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."SDDataset"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "SDBaseItem" ADD CONSTRAINT "SDBaseItem_container_id_SDContainer_id_fk" FOREIGN KEY ("container_id") REFERENCES "public"."SDContainer"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "SDBaseItem" ADD CONSTRAINT "SDBaseItem_creator_id_User_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "SDCheckpointItem" ADD CONSTRAINT "SDCheckpointItem_id_SDBaseItem_id_fk" FOREIGN KEY ("id") REFERENCES "public"."SDBaseItem"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "SDContainer" ADD CONSTRAINT "SDContainer_creator_id_User_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "SDControlNetItem" ADD CONSTRAINT "SDControlNetItem_item_id_SDBaseItem_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."SDBaseItem"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "SDControlNetPreProcessorItem" ADD CONSTRAINT "SDControlNetPreProcessorItem_item_id_SDBaseItem_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."SDBaseItem"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "SDDataset" ADD CONSTRAINT "SDDataset_creator_id_User_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "SDDatasetItem" ADD CONSTRAINT "SDDatasetItem_dataset_id_SDDataset_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."SDDataset"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "SDDatasetItem" ADD CONSTRAINT "SDDatasetItem_image_id_Image_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."Image"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "SDEmbeddingItem" ADD CONSTRAINT "SDEmbeddingItem_id_SDBaseItem_id_fk" FOREIGN KEY ("id") REFERENCES "public"."SDBaseItem"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "SDGenerationBatch" ADD CONSTRAINT "SDGenerationBatch_input_image_id_Image_id_fk" FOREIGN KEY ("input_image_id") REFERENCES "public"."Image"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "SDGenerationBatch" ADD CONSTRAINT "SDGenerationBatch_used_checkpoint_id_SDCheckpointItem_id_fk" FOREIGN KEY ("used_checkpoint_id") REFERENCES "public"."SDCheckpointItem"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "SDGenerationBatch" ADD CONSTRAINT "SDGenerationBatch_used_refiner_id_SDCheckpointItem_id_fk" FOREIGN KEY ("used_refiner_id") REFERENCES "public"."SDCheckpointItem"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "SDGenerationBatch" ADD CONSTRAINT "SDGenerationBatch_creator_id_User_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "SDGenerationBatchItem" ADD CONSTRAINT "SDGenerationBatchItem_batch_id_SDGenerationBatch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."SDGenerationBatch"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "SDGenerationBatchItem" ADD CONSTRAINT "SDGenerationBatchItem_image_id_Image_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."Image"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "SDGenerationBatchItemAnalysis" ADD CONSTRAINT "SDGenerationBatchItemAnalysis_image_id_SDGenerationBatchItem_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."SDGenerationBatchItem"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "SDLoraItem" ADD CONSTRAINT "SDLoraItem_id_SDBaseItem_id_fk" FOREIGN KEY ("id") REFERENCES "public"."SDBaseItem"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "SDModelFile" ADD CONSTRAINT "SDModelFile_item_id_SDBaseItem_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."SDBaseItem"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "SDModelFile" ADD CONSTRAINT "SDModelFile_uploader_id_User_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "SDTrainingInfo_Merged" ADD CONSTRAINT "SDTrainingInfo_Merged_resulted_item_id_SDBaseItem_id_fk" FOREIGN KEY ("resulted_item_id") REFERENCES "public"."SDBaseItem"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "SDTrainingInfo_Merged" ADD CONSTRAINT "SDTrainingInfo_Merged_merged_id_SDBaseItem_id_fk" FOREIGN KEY ("merged_id") REFERENCES "public"."SDBaseItem"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "SDTrainingInfo_Trained" ADD CONSTRAINT "SDTrainingInfo_Trained_item_id_SDBaseItem_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."SDBaseItem"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "SDTrainingInfo_Trained" ADD CONSTRAINT "SDTrainingInfo_Trained_dataset_id_SDDataset_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."SDDataset"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Tag" ADD CONSTRAINT "Tag_creator_id_User_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "User" ADD CONSTRAINT "User_role_id_UserRole_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."UserRole"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
