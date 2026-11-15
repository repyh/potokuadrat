import "server-only";

import { hashPassword } from "better-auth/crypto";

import { getDb } from "@/server/db/client";

import type { ShareAdminRepository } from "./admin-repository";
import { createDrizzleShareAdminRepository } from "./admin-repository";
import type { ShareAdminService } from "./admin";
import { createShareAdminService } from "./admin";
import type { ShareRepository } from "./repository";
import { createDrizzleShareRepository } from "./repository";

let repository: ShareRepository | null = null;
let adminRepository: ShareAdminRepository | null = null;
let adminService: ShareAdminService | null = null;

export function getShareRepository(): ShareRepository {
  repository ??= createDrizzleShareRepository(getDb());
  return repository;
}

export function getShareAdminService(): ShareAdminService {
  adminRepository ??= createDrizzleShareAdminRepository(getDb());
  adminService ??= createShareAdminService({
    repository: adminRepository,
    hashPassword: (password) => hashPassword(password),
    baseUrl: () =>
      process.env.APP_URL?.trim() ||
      process.env.BETTER_AUTH_URL?.trim() ||
      "http://localhost:3000",
  });
  return adminService;
}
