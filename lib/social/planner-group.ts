export const GROUP_INVITE_STORAGE_KEY = "pd24_group_invites";

export type PlannerInviteMemberDraft = {
  id: string;
  name: string;
  interests: string[];
  profileUserId?: string | null;
  profileHandle?: string | null;
};

export function readPlannerInviteDrafts() {
  if (typeof window === "undefined") return [] as PlannerInviteMemberDraft[];
  try {
    const raw = window.localStorage.getItem(GROUP_INVITE_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as PlannerInviteMemberDraft[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as PlannerInviteMemberDraft[];
  }
}

export function writePlannerInviteDrafts(members: PlannerInviteMemberDraft[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GROUP_INVITE_STORAGE_KEY, JSON.stringify(members));
}

export function queuePlannerInviteDraft(member: PlannerInviteMemberDraft) {
  const existing = readPlannerInviteDrafts();
  const memberKey = member.profileUserId || member.id;
  const filtered = existing.filter((candidate) => (candidate.profileUserId || candidate.id) !== memberKey);
  writePlannerInviteDrafts([...filtered, member]);
}
