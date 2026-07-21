import { findTagOptions } from "@/server/notes/infrastructure";

export async function listTagOptions() {
  return findTagOptions();
}
