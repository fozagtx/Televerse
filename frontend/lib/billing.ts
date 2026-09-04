import { PLAN_LIMITS } from "@/lib/billing-constants";

export { PLAN_LIMITS } from "@/lib/billing-constants";

export async function getMaxAgentsForUser(_userId: string): Promise<number> {
  return PLAN_LIMITS.free.maxAgents;
}

export async function isProUser(_userId: string): Promise<boolean> {
  return false;
}
