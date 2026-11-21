import { queryOptions } from "@tanstack/react-query";
import { getHospitalMailboxes } from "./mailboxes.functions";

export const hospitalMailboxesQuery = (hospitalId: string) => queryOptions({
  queryKey: ["hospital-mailboxes", hospitalId],
  queryFn: () => getHospitalMailboxes({ data: { hospitalId } }),
  staleTime: 30_000,
});