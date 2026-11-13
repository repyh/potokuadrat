CREATE TYPE "public"."album_status" AS ENUM('indexing', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."download_quality" AS ENUM('original', 'web');--> statement-breakpoint
CREATE TYPE "public"."share_mode" AS ENUM('public', 'password', 'magic_link');--> statement-breakpoint
CREATE TYPE "public"."thumb_status" AS ENUM('pending', 'ready', 'failed', 'missing');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'member');--> statement-breakpoint
CREATE TABLE "album_folders" (
	"album_id" uuid NOT NULL,
	"drive_folder_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "album_folders_album_id_drive_folder_id_pk" PRIMARY KEY("album_id","drive_folder_id")
);
--> statement-breakpoint
CREATE TABLE "albums" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"status" "album_status" DEFAULT 'indexing' NOT NULL,
	"cover_photo_id" uuid,
	"owner_user_id" text NOT NULL,
	"branding" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "download_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"share_id" uuid NOT NULL,
	"photo_id" uuid,
	"quality" "download_quality" NOT NULL,
	"visitor_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "view_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"share_id" uuid NOT NULL,
	"photo_id" uuid,
	"visitor_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" "user_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drive_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"drive_folder_id" text NOT NULL,
	"name" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"recursive" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"title" text,
	"logo" text,
	"accent" text,
	"footer_enabled" boolean DEFAULT true NOT NULL,
	"strip_metadata" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"album_id" uuid NOT NULL,
	"drive_file_id" text NOT NULL,
	"name" text NOT NULL,
	"mime_type" text,
	"width" integer,
	"height" integer,
	"bytes" bigint,
	"taken_at" timestamp with time zone,
	"drive_modified_at" timestamp with time zone,
	"exif" jsonb,
	"sort_index" integer DEFAULT 0 NOT NULL,
	"thumb_status" "thumb_status" DEFAULT 'pending' NOT NULL,
	"missing_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"share_id" uuid NOT NULL,
	"email" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"client_session_id" uuid NOT NULL,
	"photo_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorites_client_session_id_photo_id_pk" PRIMARY KEY("client_session_id","photo_id")
);
--> statement-breakpoint
CREATE TABLE "share_photos" (
	"share_id" uuid NOT NULL,
	"photo_id" uuid NOT NULL,
	CONSTRAINT "share_photos_share_id_photo_id_pk" PRIMARY KEY("share_id","photo_id")
);
--> statement-breakpoint
CREATE TABLE "share_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"share_id" uuid NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"album_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"mode" "share_mode" DEFAULT 'public' NOT NULL,
	"password_hash" text,
	"expires_at" timestamp with time zone,
	"allow_download" boolean DEFAULT true NOT NULL,
	"allowed_qualities" "download_quality"[] DEFAULT '{"original","web"}' NOT NULL,
	"branding" jsonb,
	"strip_metadata" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "album_folders" ADD CONSTRAINT "album_folders_album_id_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "album_folders" ADD CONSTRAINT "album_folders_drive_folder_id_drive_folders_id_fk" FOREIGN KEY ("drive_folder_id") REFERENCES "public"."drive_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "albums" ADD CONSTRAINT "albums_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_events" ADD CONSTRAINT "download_events_share_id_shares_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."shares"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_events" ADD CONSTRAINT "download_events_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "view_events" ADD CONSTRAINT "view_events_share_id_shares_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."shares"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "view_events" ADD CONSTRAINT "view_events_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_folders" ADD CONSTRAINT "drive_folders_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_album_id_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_sessions" ADD CONSTRAINT "client_sessions_share_id_shares_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."shares"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_client_session_id_client_sessions_id_fk" FOREIGN KEY ("client_session_id") REFERENCES "public"."client_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_photos" ADD CONSTRAINT "share_photos_share_id_shares_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."shares"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_photos" ADD CONSTRAINT "share_photos_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_recipients" ADD CONSTRAINT "share_recipients_share_id_shares_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."shares"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shares" ADD CONSTRAINT "shares_album_id_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "album_folders_drive_folder_id_idx" ON "album_folders" USING btree ("drive_folder_id");--> statement-breakpoint
CREATE UNIQUE INDEX "albums_slug_unique" ON "albums" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "albums_owner_user_id_idx" ON "albums" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "download_events_share_created_idx" ON "download_events" USING btree ("share_id","created_at");--> statement-breakpoint
CREATE INDEX "view_events_share_created_idx" ON "view_events" USING btree ("share_id","created_at");--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_unique" ON "sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "drive_folders_drive_folder_id_unique" ON "drive_folders" USING btree ("drive_folder_id");--> statement-breakpoint
CREATE INDEX "drive_folders_owner_user_id_idx" ON "drive_folders" USING btree ("owner_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "photos_album_drive_file_id_unique" ON "photos" USING btree ("album_id","drive_file_id");--> statement-breakpoint
CREATE INDEX "photos_album_sort_index_idx" ON "photos" USING btree ("album_id","sort_index");--> statement-breakpoint
CREATE INDEX "client_sessions_share_id_idx" ON "client_sessions" USING btree ("share_id");--> statement-breakpoint
CREATE INDEX "client_sessions_email_idx" ON "client_sessions" USING btree ("email");--> statement-breakpoint
CREATE INDEX "favorites_photo_id_idx" ON "favorites" USING btree ("photo_id");--> statement-breakpoint
CREATE INDEX "share_photos_photo_id_idx" ON "share_photos" USING btree ("photo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "share_recipients_share_email_unique" ON "share_recipients" USING btree ("share_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "share_recipients_token_hash_unique" ON "share_recipients" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "shares_slug_unique" ON "shares" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "shares_album_id_idx" ON "shares" USING btree ("album_id");