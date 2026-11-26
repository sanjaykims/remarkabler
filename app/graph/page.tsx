import { isAuthenticated } from "@/lib/auth";
import { buildDiaryGraph } from "@/lib/diaryGraph";
import { addVaultNotesToGraph } from "@/lib/vaultGraph";
import DiaryGraphClient from "./DiaryGraphClient";

export const dynamic = "force-dynamic";

export default async function GraphPage() {
  if (!(await isAuthenticated())) return null;
  const base = buildDiaryGraph(); // built once; the vault overlay is optional and fail-soft
  const graph = await addVaultNotesToGraph(base).catch(() => base);
  return <DiaryGraphClient initialGraph={graph} />;
}
