import { isAuthenticated } from "@/lib/auth";
import { buildDiaryGraph } from "@/lib/diaryGraph";
import { addVaultNotesToGraph } from "@/lib/vaultGraph";
import DiaryGraphClient from "./DiaryGraphClient";

export const dynamic = "force-dynamic";

export default async function GraphPage() {
  if (!(await isAuthenticated())) return null;
  const graph = await addVaultNotesToGraph(buildDiaryGraph()).catch(() => buildDiaryGraph());
  return <DiaryGraphClient initialGraph={graph} />;
}
