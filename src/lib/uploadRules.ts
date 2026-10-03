export const FINANCIAL_DOC_EXTENSIONS = ["pdf", "xlsx", "xls"];
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const FINANCIAL_DOC_ACCEPT = FINANCIAL_DOC_EXTENSIONS.map(e => `.${e}`).join(",");

export type RejectedFile = { name: string; reason: "type" | "size" };

export function validateFiles(files: File[] | FileList): { accepted: File[]; rejected: RejectedFile[] } {
  const accepted: File[] = [];
  const rejected: RejectedFile[] = [];
  for (const f of Array.from(files)) {
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    if (!FINANCIAL_DOC_EXTENSIONS.includes(ext)) rejected.push({ name: f.name, reason: "type" });
    else if (f.size > MAX_UPLOAD_BYTES) rejected.push({ name: f.name, reason: "size" });
    else accepted.push(f);
  }
  return { accepted, rejected };
}
