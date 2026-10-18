import { TaskDetailView } from "@/app/components/tasks-view";
import { Suspense } from "react";

export function generateStaticParams() {
  return [
    { listId: "objekti", taskId: "pamati" },
    { listId: "objekti", taskId: "jumts" },
    { listId: "birojs", taskId: "rekini" },
  ];
}

export default function TaskDetailPage({ params }: { params: Promise<{ listId: string; taskId: string }> }) {
  return (
    <Suspense fallback={<div className="h-48 animate-pulse rounded-3xl bg-white/70" />}>
      <TaskDetailContent params={params} />
    </Suspense>
  );
}

async function TaskDetailContent({ params }: { params: Promise<{ listId: string; taskId: string }> }) {
  const { listId, taskId } = await params;
  return <TaskDetailView listId={listId} taskId={taskId} />;
}
