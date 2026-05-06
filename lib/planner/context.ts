import { preferredDaytimesForMode, timeBudgetForMode } from "./slots";
import type { GroupMember, PlannerRequest, PlanningContext } from "./types";
import { norm } from "./features";
import { getOccasionModule } from "./occasions/registry";
import { applyExperienceModeToSlotTemplate } from "./events";

function defaultEventStrictnessForMode(mode: PlannerRequest["experienceMode"]) {
  if (mode === "show") return "required" as const;
  if (mode === "event_visit" || mode === "market_festival") return "hybrid" as const;
  return "off" as const;
}

export function mergeInterests(owner: string[], members: GroupMember[], enabled: boolean) {
  const all = new Set(owner.map(norm).filter(Boolean));
  if (enabled) {
    members.forEach((m) =>
      (m.interests ?? [])
        .map(norm)
        .filter(Boolean)
        .forEach((t) => all.add(t))
    );
  }
  return Array.from(all).slice(0, 20);
}

export function interestWeights(owner: string[], members: GroupMember[], enabled: boolean) {
  const counts = new Map<string, number>();

  const addList = (arr: string[]) => {
    for (const x of arr.map(norm).filter(Boolean)) {
      counts.set(x, (counts.get(x) ?? 0) + 1);
    }
  };

  addList(owner);
  if (enabled) {
    for (const m of members) addList(m.interests ?? []);
  }

  const weight = new Map<string, number>();
  for (const [k, c] of counts.entries()) {
    const w = c <= 1 ? 1.0 : c === 2 ? 1.6 : c === 3 ? 2.1 : 2.6;
    weight.set(k, w);
  }
  return weight;
}

function buildGroupSignals(owner: string[], members: GroupMember[], enabled: boolean) {
  const participants = [
    {
      name: "Du",
      interests: owner.map(norm).filter(Boolean),
      isCurrentUser: true,
    },
    ...(enabled
      ? members.map((member, index) => ({
          name: member.name?.trim() || `Gast ${index + 1}`,
          interests: (member.interests ?? []).map(norm).filter(Boolean),
          isCurrentUser: false,
        }))
      : []),
  ];

  const activeParticipants = participants.filter((participant) => participant.interests.length > 0);
  const counts = new Map<string, number>();

  for (const participant of activeParticipants) {
    for (const interest of new Set(participant.interests)) {
      counts.set(interest, (counts.get(interest) ?? 0) + 1);
    }
  }

  const sharedAcrossAll =
    activeParticipants.length > 1
      ? Array.from(counts.entries())
          .filter(([, count]) => count === activeParticipants.length)
          .map(([interest]) => interest)
          .slice(0, 5)
      : [];

  const overlapping = Array.from(counts.entries())
    .filter(([, count]) => count >= 2)
    .map(([interest]) => interest)
    .filter((interest) => !sharedAcrossAll.includes(interest))
    .slice(0, 6);

  const uniqueSignals = participants
    .map((participant) => ({
      name: participant.name,
      isCurrentUser: participant.isCurrentUser,
      interests: participant.interests
        .filter((interest) => (counts.get(interest) ?? 0) === 1)
        .slice(0, 3),
    }))
    .filter((participant) => participant.interests.length > 0);

  return {
    enabled,
    participantCount: participants.length,
    activeParticipantCount: activeParticipants.length,
    participants: participants.map((participant) => ({
      name: participant.name,
      interests: participant.interests,
      isCurrentUser: participant.isCurrentUser,
    })),
    sharedAcrossAll,
    overlapping,
    uniqueSignals,
  };
}

export function buildPlanningContext(request: PlannerRequest): PlanningContext {
  const merged = mergeInterests(request.interests, request.group.members, request.group.enabled);
  const weights = interestWeights(request.interests, request.group.members, request.group.enabled);
  const groupSignals = buildGroupSignals(
    request.interests,
    request.group.members,
    request.group.enabled
  );
  const occasionModule = getOccasionModule(request.occasion);
  const experienceMode = request.experienceMode ?? "classic";
  const eventStrictness =
    request.eventStrictness ?? defaultEventStrictnessForMode(experienceMode);
  const eventPlanningMode = request.eventPlanningMode ?? "auto";
  const slotTemplate = applyExperienceModeToSlotTemplate({
    slotTemplate: occasionModule.buildSlotTemplate(request.planMode),
    experienceMode,
    occasion: request.occasion,
    planMode: request.planMode,
  });

  return {
    citySlug: request.citySlug,
    planDate: request.planDate ?? null,
    explicitEventId: request.selectedEventId ?? null,
    eventPlanningMode,
    occasion: request.occasion,
    experienceMode,
    eventStrictness,
    evaluationMode: request.evaluationMode ?? "normal",
    origin: {
      label: request.startPoint.label || "Startpunkt",
      lat: request.startPoint.lat,
      lng: request.startPoint.lng,
    },
    timeBudgetMin: timeBudgetForMode(request.planMode),
    preferredDaytimes: preferredDaytimesForMode(request.planMode),
    mergedInterests: merged,
    interestWeights: weights,
    groupSignals,
    slotTemplate,
    filters: {
      budget: request.budget,
      occasion: request.occasion,
      radiusKm: request.radiusKm,
      sortMode: request.sortMode ?? "match",
      routeProfile: request.routeProfile ?? "foot",
    },
  };
}
