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

const MAX_ROWS = 50000;
const CHECK_BATCH = 500;
const COMMIT_BATCH = 25;

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
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [showAll, setShowAll] = useState(false);

  async function onFile(f: File) {
    setResult(null);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await f.arrayBuffer(), { cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]!]!;
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null, raw: true });
      if (!raw.length) { toast.error("The first sheet is empty."); return; }
      if (raw.length > MAX_ROWS) { toast.error(`Please upload at most ${MAX_ROWS.toLocaleString("en-IN")} rows at a time.`); return; }
      const headers = Object.keys(raw[0]!).map((h) => h.toLowerCase().replace(/\s+/g, " ").trim());
      const required = ["hospital name", "patient name", "date of admission", "claim number", "claim status"];
      setMissingCols(required.filter((c) => !headers.includes(c)));
      const errs: Record<string, string[]> = {};
      const mapped = raw.map((r, i) => {
        const { row, errors } = mapSheetRow(r, i + 2);
        if (errors.length) errs[String(i + 2)] = errors;
        return row;
      });
      // Repeated claim numbers are caught across the whole file, not just within one batch.
      const seenKeys = new Set<string>();
      for (const r of mapped) {
        if (!r.claim_number) continue;
        const k = `${(r.rohini_id ?? r.hospital_name ?? "").toLowerCase()}|${r.claim_number}`;
        if (seenKeys.has(k)) (errs[String(r.row)] ??= []).push("Claim number repeats in this file");
        seenKeys.add(k);
      }
      setFile(f.name); setRows(mapped); setParseErrors(errs);
      await check(f.name, mapped, errs);
    } catch (e) { toast.error("We could not read this file. Please upload an .xlsx or .csv file."); console.error(e); }
  }

  const chunks = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
  const subset = (pe: Record<string, string[]>, part: ImportRow[]) =>
    Object.fromEntries(part.filter((r) => pe[String(r.row)]).map((r) => [String(r.row), pe[String(r.row)]!]));

  async function check(name = file!, r = rows, pe = parseErrors) {
    setBusy("check"); setShowAll(false);
    const parts = chunks(r, CHECK_BATCH);
    setProgress({ done: 0, total: r.length });
    try {
      const merged: Result = { committed: false, jobId: null, summary: { total: 0, valid: 0, errors: 0, newCount: 0, updateCount: 0 }, results: [] } as unknown as Result;
      for (const part of parts) {
        const res = await run({ data: { fileName: name, commit: false, rows: part, parseErrors: subset(pe, part) } });
        for (const k of ["total", "valid", "errors", "newCount", "updateCount"] as const) merged.summary[k] += res.summary[k];
        merged.results.push(...res.results);
        setProgress((p) => p && { ...p, done: p.done + part.length });
      }
      setResult(merged);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); setProgress(null); }
  }

  async function commit() {
    if (!result) return;
    setBusy("import");
    const errorRows = new Set(result.results.filter((x) => x.status === "error").map((x) => x.row));
    const valid = rows.filter((r) => !errorRows.has(r.row));
    const parts = chunks(valid, COMMIT_BATCH);
    setProgress({ done: 0, total: valid.length });
    let jobId: string | null = null, created = 0, updated = 0, failed = 0;
    const byRow = new Map(result.results.map((x) => [x.row, { ...x }]));
    try {
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]!;
        const res = await run({ data: {
          fileName: file!, commit: true, rows: part, parseErrors: {}, jobId, last: i === parts.length - 1,
          totals: { total: result.summary.total, valid: result.summary.valid, errors: result.summary.errors },
        } });
        jobId = res.jobId;
        const s = res.summary as { created?: number; updated?: number; failed?: number };
        created += s.created ?? 0; updated += s.updated ?? 0; failed += s.failed ?? 0;
        for (const x of res.results) if (x.status === "error") byRow.set(x.row, x);
        setProgress((p) => p && { ...p, done: p.done + part.length });
      }
      setResult({ ...result, committed: true, jobId, results: [...byRow.values()], summary: { ...result.summary, created, updated, failed } } as unknown as Result);
      toast.success(`Imported: ${created} new, ${updated} updated${failed + errorRows.size ? `, ${failed + errorRows.size} not imported` : ""}`);
    } catch (e) {
      toast.error(`${errMsg(e)} — ${created + updated} rows were saved before this stopped. Upload the file again to continue; saved claims will be updated, not duplicated.`);
    } finally {
      setBusy(null); setProgress(null);
      ["import-jobs", "claims", "claim-stats", "patients", "admissions", "tasks"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    }
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
  const problemRows = result ? result.results.filter((r) => r.errors.length || r.warnings.length) : [];
  const visible = result ? (showAll ? result.results : problemRows).slice(0, 500) : [];
  return (
    <div>
      <PageHeader title="Import Claims" description="Upload your claims sheet (same columns as your Excel format). Every row is checked before anything is saved; re-uploading updates existing claims by claim number." />

      <div className="mb-4 rounded-lg border border-dashed border-border bg-card p-6 text-center">
        <input ref={input} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
        <Button onClick={() => input.current?.click()} disabled={!!busy}>{busy === "check" ? "Checking…" : "Choose Excel file"}</Button>
        <p className="mt-2 text-[12px] text-muted-foreground">{file ? `${file} · ${rows.length} rows` : `Expected columns include Hospital Name, RohiniId, Patient Name, Claim Number, Claim Status and ${EXPECTED_COLUMNS.length - 5} more.`}</p>
        {progress ? (
          <div className="mx-auto mt-3 max-w-md">
            <div className="h-2 overflow-hidden rounded bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${Math.round((progress.done / Math.max(progress.total, 1)) * 100)}%` }} /></div>
            <p className="mt-1 text-[12px] text-muted-foreground tnum">{busy === "import" ? "Importing" : "Checking"} {progress.done.toLocaleString("en-IN")} of {progress.total.toLocaleString("en-IN")} rows — keep this page open.</p>
          </div>
        ) : null}
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
          <div className="mb-2 flex items-center gap-3 text-[12px] text-muted-foreground">
            <span>Showing {visible.length.toLocaleString("en-IN")} of {(showAll ? result!.results.length : problemRows.length).toLocaleString("en-IN")} {showAll ? "rows" : "rows with errors or warnings"}{visible.length >= 500 ? " — download the row report for the full list" : ""}.</span>
            <button className="underline" onClick={() => setShowAll((v) => !v)}>{showAll ? "Show only problems" : "Show all rows"}</button>
          </div>
          <DataTable head={["Row", "Claim · patient", "Result", "Problems"]}>
            {visible.map((r) => (
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
