import type { PlannerInviteMemberDraft } from "@/lib/social/planner-group";

export type UserGroupRow = {
  id: string;
  owner_user_id: string;
  name: string;
  description?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type UserGroupMemberRow = {
  id: string;
  group_id: string;
  member_user_id: string;
  created_at?: string | null;
};

export const PLANNER_GROUP_IMPORT_STORAGE_KEY = "pd24_group_import";

export type PlannerGroupImport = {
  label: string;
  members: PlannerInviteMemberDraft[];
};

export function writePlannerGroupImport(payload: PlannerGroupImport) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PLANNER_GROUP_IMPORT_STORAGE_KEY, JSON.stringify(payload));
}

export function readPlannerGroupImport() {
  if (typeof window === "undefined") return null as PlannerGroupImport | null;
  try {
    const raw = window.localStorage.getItem(PLANNER_GROUP_IMPORT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PlannerGroupImport;
  } catch {
    return null as PlannerGroupImport | null;
  }
}

export function clearPlannerGroupImport() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PLANNER_GROUP_IMPORT_STORAGE_KEY);
}
