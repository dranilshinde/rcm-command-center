import { queryOptions } from "@tanstack/react-query";
import {
  getClaimDetail, getClaimStats, listAdmissions, listAssignees, listClaims, listImportJobs,
  listPatients, listPreauths, listTasks,
} from "./claims.functions";

type P = Record<string, string | number | undefined>;
const clean = <T extends P>(p: T) =>
  Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== "")) as T;

export const patientsQuery = (p: { search?: string; page?: number }) =>
  queryOptions({ queryKey: ["patients", p], queryFn: () => listPatients({ data: clean(p) }) });
export const admissionsQuery = (p: { search?: string; status?: string; page?: number }) =>
  queryOptions({ queryKey: ["admissions", p], queryFn: () => listAdmissions({ data: clean(p) }) });
export const preauthsQuery = (p: { status?: string; page?: number }) =>
  queryOptions({ queryKey: ["preauths", p], queryFn: () => listPreauths({ data: clean(p) }) });
export const claimsQuery = (p: { search?: string; status?: string; readiness?: string; hospitalId?: string; from?: string; to?: string; page?: number }) =>
  queryOptions({ queryKey: ["claims", p], queryFn: () => listClaims({ data: clean(p) }) });
export const claimDetailQuery = (claimId: string) =>
  queryOptions({ queryKey: ["claim", claimId], queryFn: () => getClaimDetail({ data: { claimId } }) });
export const tasksQuery = (p: { view: string; page?: number }) =>
  queryOptions({ queryKey: ["tasks", p], queryFn: () => listTasks({ data: p }) });
export const claimStatsQuery = queryOptions({ queryKey: ["claim-stats"], queryFn: () => getClaimStats(), staleTime: 30_000 });
export const importJobsQuery = queryOptions({ queryKey: ["import-jobs"], queryFn: () => listImportJobs() });
export const assigneesQuery = (hospitalId?: string) =>
  queryOptions({ queryKey: ["assignees", hospitalId ?? "all"], queryFn: () => listAssignees({ data: hospitalId ? { hospitalId } : {} }), staleTime: 60_000 });

import { getFollowupCenter, listEscalations, listQueries, listRules } from "./followups.functions";
export const queriesQuery = (p: { view: string; page?: number }) =>
  queryOptions({ queryKey: ["queries", p], queryFn: () => listQueries({ data: p }) });
export const followupCenterQuery = (p: { page?: number }) =>
  queryOptions({ queryKey: ["followups", p], queryFn: () => getFollowupCenter({ data: p }) });
export const escalationsQuery = (p: { status: string; page?: number }) =>
  queryOptions({ queryKey: ["escalations", p], queryFn: () => listEscalations({ data: p }) });
export const rulesQuery = queryOptions({ queryKey: ["rules"], queryFn: () => listRules() });
