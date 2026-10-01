import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { EmptyState, PageHeader, StatCard } from "@/components/rcm/app-shell";
import { Chip, DataTable, errMsg, td, tr } from "@/components/rcm/claims-ui";
import { Button } from "@/components/ui/button";
import { importClaims } from "@/lib/claims.functions";
import { EXPECTED_COLUMNS, mapSheetRow, type ImportRow } from "@/lib/claims-domain";
import { importJobsQuery } from "@/lib/claims-queries";

export const Route = createFileRoute("/_authenticated/imports")({
  head: () => ({
    meta: [
      { title: "Import Claims — RCM Buddy" },
      { name: "description", content: "Upload your claims Excel sheet, check every row, then import claims, payments and courier details." },
      { property: "og:title", content: "Import Claims — RCM Buddy" },
      { property: "og:description", content: "Upload and validate your claims Excel sheet." },
    ],
  }),
  component: Imports,
});

type Result = Awaited<ReturnType<typeof importClaims>>;

function Imports() {
  const run = useServerFn(importClaims);
  const qc = useQueryClient();
  const { data: jobs } = useQuery(importJobsQuery);
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [parseErrors, setParseErrors] = useState<Record<string, string[]>>({});
  const [missingCols, setMissingCols] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState<"check" | "import" | null>(null);

  async function onFile(f: File) {
    setResult(null);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await f.arrayBuffer(), { cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]!]!;
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null, raw: true });
      if (!raw.length) return toast.error("The first sheet is empty.");
      if (raw.length > 2000) return toast.error("Please upload at most 2,000 rows at a time.");
      const headers = Object.keys(raw[0]!).map((h) => h.toLowerCase().replace(/\s+/g, " ").trim());
      const required = ["hospital name", "patient name", "date of admission", "claim number", "claim status"];
      setMissingCols(required.filter((c) => !headers.includes(c)));
      const errs: Record<string, string[]> = {};
      const mapped = raw.map((r, i) => {
        const { row, errors } = mapSheetRow(r, i + 2);
        if (errors.length) errs[String(i + 2)] = errors;
        return row;
      });
      setFile(f.name); setRows(mapped); setParseErrors(errs);
      await check(f.name, mapped, errs);
    } catch (e) { toast.error("We could not read this file. Please upload an .xlsx or .csv file."); console.error(e); }
  }

  async function check(name = file!, r = rows, pe = parseErrors) {
    setBusy("check");
    try { setResult(await run({ data: { fileName: name, commit: false, rows: r, parseErrors: pe } })); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
  }

  async function commit() {
    setBusy("import");
    try {
      const res = await run({ data: { fileName: file!, commit: true, rows, parseErrors } });
      setResult(res);
      const s = res.summary as Result["summary"] & { created?: number; updated?: number; failed?: number };
      toast.success(`Imported: ${s.created ?? 0} new, ${s.updated ?? 0} updated${s.failed ? `, ${s.failed} not imported` : ""}`);
      ["import-jobs", "claims", "claim-stats", "patients", "admissions", "tasks"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
  }

  async function downloadReport() {
    if (!result) return;
    const XLSX = await import("xlsx");
    const data = result.results.map((r) => ({ Row: r.row, Claim: r.label, Result: r.status, Errors: r.errors.join("; "), Warnings: r.warnings.join("; ") }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Import report");
    XLSX.writeFile(wb, `import-report-${(file ?? "claims").replace(/\.[^.]+$/, "")}.xlsx`);
  }

  const s = result?.summary;
  return (
    <div>
      <PageHeader title="Import Claims" description="Upload your claims sheet (same columns as your Excel format). Every row is checked before anything is saved; re-uploading updates existing claims by claim number." />

      <div className="mb-4 rounded-lg border border-dashed border-border bg-card p-6 text-center">
        <input ref={input} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
        <Button onClick={() => input.current?.click()} disabled={!!busy}>{busy === "check" ? "Checking…" : "Choose Excel file"}</Button>
        <p className="mt-2 text-[12px] text-muted-foreground">{file ? `${file} · ${rows.length} rows` : `Expected columns include Hospital Name, RohiniId, Patient Name, Claim Number, Claim Status and ${EXPECTED_COLUMNS.length - 5} more.`}</p>
        {missingCols.length ? <p className="mt-2 text-[12px] font-medium text-risk">Missing required columns: {missingCols.join(", ")}</p> : null}
      </div>

      {s ? (
        <>
          <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Rows" value={s.total} />
            <StatCard label="New claims" value={s.newCount} tone="positive" />
            <StatCard label="Updates" value={s.updateCount} />
            <StatCard label="Rows with errors" value={s.errors} tone={s.errors ? "risk" : "default"} />
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {result?.committed ? (
              <span className="text-[13px] font-medium text-positive">Import finished. <Link to="/claims" className="underline">Open claims</Link></span>
            ) : (
              <Button onClick={commit} disabled={!!busy || s.valid === 0}>{busy === "import" ? "Importing…" : `Import ${s.valid} valid row${s.valid === 1 ? "" : "s"}`}</Button>
            )}
            <Button variant="outline" onClick={downloadReport}>Download row report</Button>
            {!result?.committed ? <Button variant="ghost" onClick={() => check()} disabled={!!busy}>Re-check</Button> : null}
            {s.errors && !result?.committed ? <span className="text-[12px] text-muted-foreground">Rows with errors are skipped. Fix them in Excel and upload again.</span> : null}
          </div>
          <DataTable head={["Row", "Claim · patient", "Result", "Problems"]}>
            {result!.results.map((r) => (
              <tr key={r.row} className={tr}>
                <td className={`${td} tnum`}>{r.row}</td>
                <td className={td}>{r.label}</td>
                <td className={td}><Chip value={r.status === "error" ? "rejected" : r.status === "new" ? "approved" : "submitted"} label={r.status === "error" ? "Error" : r.status === "new" ? "New" : "Update"} /></td>
                <td className={`${td} text-[12px]`}>
                  {r.errors.map((e, i) => <p key={i} className="text-risk">{e}</p>)}
                  {r.warnings.map((w, i) => <p key={`w${i}`} className="text-warning">{w}</p>)}
                </td>
              </tr>
            ))}
          </DataTable>
        </>
      ) : null}

      <h2 className="mb-2 mt-6 text-[13px] font-semibold">Import history</h2>
      {!jobs?.length ? <EmptyState title="No imports yet" description="Each upload you import is recorded here." /> : (
        <DataTable head={["File", "Hospital", "Rows", "Created", "Updated", "Not imported", "Status", "When"]}>
          {jobs.map((j) => (
            <tr key={j.id} className={tr}>
              <td className={`${td} font-medium`}>{j.file_name}</td>
              <td className={`${td} text-muted-foreground`}>{j.hospitals?.name ?? "Multiple"}</td>
              <td className={`${td} tnum`}>{j.total_rows}</td>
              <td className={`${td} tnum`}>{j.created_rows}</td>
              <td className={`${td} tnum`}>{j.updated_rows}</td>
              <td className={`${td} tnum`}>{j.error_rows}</td>
              <td className={td}><Chip value={j.status === "completed" ? "completed" : j.status === "running" ? "in_progress" : "waiting"} label={j.status.replace(/_/g, " ")} /></td>
              <td className={`${td} tnum text-muted-foreground`}>{new Date(j.created_at).toLocaleString("en-IN")}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}
