import { pgEnum } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["admin", "member"]);

export const albumStatus = pgEnum("album_status", ["indexing", "ready", "failed"]);

export const thumbStatus = pgEnum("thumb_status", ["pending", "ready", "failed", "missing"]);

export const shareMode = pgEnum("share_mode", ["public", "password", "magic_link"]);

export const downloadQuality = pgEnum("download_quality", ["original", "web"]);
