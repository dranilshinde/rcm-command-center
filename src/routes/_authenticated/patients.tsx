import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { EmptyState, PageHeader } from "@/components/rcm/app-shell";
import { DataTable, Pager, fmtDate, td, tr } from "@/components/rcm/claims-ui";
import { Input } from "@/components/ui/input";
import { patientsQuery } from "@/lib/claims-queries";

export const Route = createFileRoute("/_authenticated/patients")({
  head: () => ({
    meta: [
      { title: "Patients — RCM Buddy" },
      { name: "description", content: "Insured patients across your hospitals with UHID, member ID and admissions." },
      { property: "og:title", content: "Patients — RCM Buddy" },
      { property: "og:description", content: "Insured patients across your hospitals." },
    ],
  }),
  component: Patients,
});

function Patients() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, isFetching, error } = useQuery({ ...patientsQuery({ search, page }), placeholderData: (p) => p });
  const rows = data?.rows ?? [];
  return (
    <div>
      <PageHeader title="Patients" description="Patients are created when you add an admission or import claims." />
      <div className="mb-3 flex items-center gap-2">
        <Input className="h-9 max-w-xs" placeholder="Search name, UHID, member ID, phone" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <span className="tnum text-[12px] text-muted-foreground">{isFetching ? "Loading…" : `${data?.total ?? 0} patients`}</span>
      </div>
      {error ? <EmptyState title="Could not load patients" description={(error as Error).message} /> :
        rows.length === 0 ? <EmptyState title="No patients yet" description="Add an admission or import your claims sheet to see patients here." /> : (
          <DataTable head={["Patient", "UHID", "Member ID", "Phone", "Hospital", "Admissions", "Added"]}>
            {rows.map((p) => (
              <tr key={p.id} className={tr}>
                <td className={`${td} font-medium`}>{p.full_name}</td>
                <td className={`${td} tnum text-muted-foreground`}>{p.uhid ?? "—"}</td>
                <td className={`${td} tnum text-muted-foreground`}>{p.member_id ?? "—"}</td>
                <td className={`${td} tnum text-muted-foreground`}>{p.phone ?? "—"}</td>
                <td className={`${td} text-muted-foreground`}>{p.hospital_name}</td>
                <td className={`${td} tnum`}>{p.admission_count}</td>
                <td className={`${td} tnum text-muted-foreground`}>{fmtDate(p.created_at)}</td>
              </tr>
            ))}
          </DataTable>
        )}
      <Pager page={page} total={data?.total ?? 0} pageSize={data?.pageSize ?? 25} onPage={setPage} />
    </div>
  );
}
