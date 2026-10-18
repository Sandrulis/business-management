import { TaskListView } from "@/app/components/tasks-view";
import { Suspense } from "react";

export function generateStaticParams() {
  return [{ listId: "objekti" }, { listId: "birojs" }];
}

export default function TaskListPage({ params }: { params: Promise<{ listId: string }> }) {
  return (
    <Suspense fallback={<div className="h-48 animate-pulse rounded-3xl bg-white/70" />}>
      <TaskListContent params={params} />
    </Suspense>
  );
}

async function TaskListContent({ params }: { params: Promise<{ listId: string }> }) {
  const { listId } = await params;
  return <TaskListView listId={listId} />;
}
