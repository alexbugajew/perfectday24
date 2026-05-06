import type { CandidateEvaluationContext, PolicyResult, SlotCandidatePolicy } from "./types";

export function evaluateCandidateWithPolicies(
  input: CandidateEvaluationContext,
  policies: SlotCandidatePolicy[]
) {
  const results: PolicyResult[] = policies.map((policy) => policy.evaluate(input));
  const hardFail = results.some((result) => result.hardFail === true);
  const scoreDelta = results.reduce((sum, result) => sum + result.scoreDelta, 0);
  const reasons = results.flatMap((result) => result.reasons ?? []);

  return {
    hardFail,
    scoreDelta,
    results,
    reasons,
  };
}
