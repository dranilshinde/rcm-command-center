import { queryOptions } from "@tanstack/react-query";
import {
  getFoundationStats,
  getHospitalDetail,
  getSessionContext,
  listAuditLogs,
  listHospitalGroups,
  listHospitals,
  listMasterData,
  listNotifications,
  listOrganizations,
  listPayers,
  listRolesWithPermissions,
  listUsers,
} from "./rcm.functions";

export const sessionQuery = queryOptions({
  queryKey: ["session"],
  queryFn: () => getSessionContext(),
  staleTime: 60_000,
});

export const statsQuery = queryOptions({
  queryKey: ["foundation-stats"],
  queryFn: () => getFoundationStats(),
  staleTime: 30_000,
});

export const groupsQuery = queryOptions({
  queryKey: ["hospital-groups"],
  queryFn: () => listHospitalGroups(),
});

export const organizationsQuery = queryOptions({
  queryKey: ["organizations"],
  queryFn: () => listOrganizations(),
});

export const hospitalsQuery = (params: { search?: string; status?: string; page?: number }) =>
  queryOptions({
    queryKey: ["hospitals", params],
    queryFn: () => listHospitals({ data: params }),
  });

export const hospitalDetailQuery = (hospitalId: string) =>
  queryOptions({
    queryKey: ["hospital", hospitalId],
    queryFn: () => getHospitalDetail({ data: { hospitalId } }),
  });

export const usersQuery = queryOptions({
  queryKey: ["users"],
  queryFn: () => listUsers(),
});

export const rolesQuery = queryOptions({
  queryKey: ["roles"],
  queryFn: () => listRolesWithPermissions(),
});

export const payersQuery = queryOptions({
  queryKey: ["payers"],
  queryFn: () => listPayers(),
});

export const masterDataQuery = queryOptions({
  queryKey: ["master-data"],
  queryFn: () => listMasterData(),
});

export const notificationsQuery = queryOptions({
  queryKey: ["notifications"],
  queryFn: () => listNotifications(),
});

export const auditQuery = (params: { page?: number; module?: string }) =>
  queryOptions({
    queryKey: ["audit", params],
    queryFn: () => listAuditLogs({ data: params }),
  });
