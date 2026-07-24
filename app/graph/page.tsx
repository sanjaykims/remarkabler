import { isAuthenticated } from "@/lib/auth";
import { buildDiaryGraph } from "@/lib/diaryGraph";
import DiaryGraphClient from "./DiaryGraphClient";

export const dynamic = "force-dynamic";

export default function GraphPage() {
  if (!isAuthenticated()) return null;
  const graph = buildDiaryGraph();
  return <DiaryGraphClient initialGraph={graph} />;
}
