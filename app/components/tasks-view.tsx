"use client";

import { formatDate } from "@/app/lib/invoices/model";
import {
  DEMO_ASSIGNEES,
  TASK_STATUSES,
  addDemoSubtask,
  addDemoTask,
  childrenOf,
  rootsOf,
  setDemoStatus,
  taskProgress,
  useDemoTasks,
  type DemoTask,
  type TaskStatusId,
} from "@/app/lib/tasks/demo-store";
import { Calendar, ChevronDown, ListTodo, Plus, UserRound } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState, type ReactNode } from "react";

export function TasksHome() {
  const { lists, tasks } = useDemoTasks();
  return (
    <div className="animate-slide-up space-y-8">
      <PageHeading title="Uzdevumi" text="Saraksti ar uzdevumiem un apakšuzdevumiem. Šis ir priekšskats, dati netiek saglabāti." />
      {lists.map((list) => (
        <section key={list.id} className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{list.name}</h2>
              <p className="mt-1 text-sm text-[#5f756a]">{list.description}</p>
            </div>
            <Link href={`/tasks/${list.id}`} className="text-sm font-semibold text-[#1a6b4a] hover:underline">
              Atvērt
            </Link>
          </div>
          <TaskCards listId={list.id} listName={list.name} tasks={rootsOf(tasks, list.id)} all={tasks} />
        </section>
      ))}
    </div>
  );
}

export function TaskListView({ listId }: { listId: string }) {
  const { lists, tasks } = useDemoTasks();
  const list = lists.find((item) => item.id === listId);
  if (!list) return <Missing text="Saraksts nav atrasts." />;
  const roots = rootsOf(tasks, list.id);
  const progress = roots.reduce(
    (sum, task) => {
      const item = taskProgress(tasks, task.id);
      return { done: sum.done + item.done, total: sum.total + item.total };
    },
    { done: 0, total: 0 },
  );
  return (
    <div className="animate-slide-up">
      <PageHeading
        title={list.name}
        text={list.description}
        meta={progress.total > 0 ? `${progress.done}/${progress.total}` : ""}
        action={<AddTaskForm listId={list.id} />}
      />
      <p className="mt-3 text-xs text-[#8aa396]">Uzdevumi / {list.name}</p>
      <div className="mt-4">
        <TaskCards listId={list.id} listName={list.name} tasks={roots} all={tasks} />
      </div>
    </div>
  );
}

export function TaskDetailView({ listId, taskId }: { listId: string; taskId: string }) {
  const { lists, tasks } = useDemoTasks();
  const list = lists.find((item) => item.id === listId);
  const task = tasks.find((item) => item.id === taskId && item.listId === listId && item.parentId === null);
  if (!list || !task) return <Missing text="Uzdevums nav atrasts." />;
  const children = childrenOf(tasks, task.id);
  const progress = taskProgress(tasks, task.id);
  return (
    <div className="animate-slide-up">
      <PageHeading
        title={task.title}
        text={task.description || "Šim uzdevumam vēl nav apraksta."}
        meta={progress.total > 0 ? `${progress.done}/${progress.total}` : ""}
      />
      <p className="mt-3 text-xs text-[#8aa396]">
        <Link href="/tasks" className="hover:underline">Uzdevumi</Link>
        {" / "}
        <Link href={`/tasks/${list.id}`} className="hover:underline">{list.name}</Link>
        {" / "}
        {task.title}
      </p>
      <div className="mt-4">
        <ProgressBar percent={progress.percent} />
      </div>
      <section className="mt-6 overflow-hidden rounded-3xl border border-[#d3e4da] bg-white px-3 py-3">
        <SubtaskGroups tasks={children} />
        <AddSubtaskForm listId={list.id} parentId={task.id} />
      </section>
    </div>
  );
}

function TaskCards({ listId, listName, tasks, all }: { listId: string; listName: string; tasks: DemoTask[]; all: DemoTask[] }) {
  if (tasks.length === 0) {
    return <p className="rounded-3xl border border-dashed border-[#d3e4da] bg-white px-6 py-12 text-center text-sm text-[#5f756a]">Šajā sarakstā vēl nav uzdevumu.</p>;
  }
  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <TaskCard key={task.id} listId={listId} listName={listName} task={task} all={all} />
      ))}
    </div>
  );
}

function TaskCard({ listId, listName, task, all }: { listId: string; listName: string; task: DemoTask; all: DemoTask[] }) {
  const [open, setOpen] = useState(true);
  const children = childrenOf(all, task.id);
  const progress = taskProgress(all, task.id);
  const people = uniqueAssignees([task, ...children]);
  const range = dateRange([task, ...children]);
  return (
    <section className="rounded-3xl border border-[#d3e4da] bg-white">
      <p className="px-4 pt-3 text-[11px] text-[#8aa396]">Uzdevumi / {listName}</p>
      <header className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? "Sakļaut" : "Izvērst"}
          onClick={() => setOpen((current) => !current)}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-[#8aa396] hover:bg-[#f4faf6] hover:text-[#143028]"
        >
          <ChevronDown className={`size-4 transition ${open ? "" : "-rotate-90"}`} aria-hidden="true" />
        </button>
        <ListTodo className="size-4 shrink-0 text-[#8aa396]" aria-hidden="true" />
        <Link href={`/tasks/${listId}/${task.id}`} className="min-w-0 flex-1 truncate text-sm font-semibold hover:text-[#1a6b4a]">
          {task.title}
        </Link>
        <span className="shrink-0 text-xs font-medium text-[#8aa396] tabular-nums">{progress.done}/{progress.total}</span>
        <AssigneeStack names={people} />
        {range ? (
          <span className="hidden items-center gap-1.5 text-xs text-[#8aa396] sm:inline-flex">
            <Calendar className="size-3.5" aria-hidden="true" />
            {range}
          </span>
        ) : null}
      </header>
      <div className={open ? "px-4" : "px-4 pb-3"}>
        <ProgressBar percent={progress.percent} />
      </div>
      {open ? (
        <div className="px-3 pt-3 pb-3">
          <SubtaskGroups tasks={children} />
        </div>
      ) : null}
    </section>
  );
}

function SubtaskGroups({ tasks }: { tasks: DemoTask[] }) {
  if (tasks.length === 0) {
    return <p className="px-2 py-4 text-sm text-[#5f756a]">Apakšuzdevumu vēl nav.</p>;
  }
  return (
    <div className="space-y-4">
      {TASK_STATUSES.map((status) => {
        const rows = tasks.filter((task) => task.status === status.id);
        if (rows.length === 0) return null;
        const done = rows.filter((task) => task.status === "done").length;
        return (
          <div key={status.id}>
            <div className="flex items-center gap-2 px-2 py-1">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: status.color }} />
              <p className="text-sm font-semibold">{status.label}</p>
              <span className="text-xs text-[#8aa396] tabular-nums">{done}/{rows.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-sm">
                <thead className="text-left text-xs text-[#8aa396]">
                  <tr>
                    <th className="px-2 py-2 font-medium">Uzdevums</th>
                    <th className="px-2 py-2 font-medium">Statuss</th>
                    <th className="px-2 py-2 font-medium">Atbildīgais</th>
                    <th className="px-2 py-2 font-medium">Sākums</th>
                    <th className="px-2 py-2 font-medium">Termiņš</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((task) => (
                    <tr key={task.id} className="border-t border-[#e4efe8]">
                      <td className="px-2 py-2 font-medium">{task.title}</td>
                      <td className="px-2 py-2">
                        <StatusSelect value={task.status} onChange={(value) => setDemoStatus(task.id, value)} />
                      </td>
                      <td className="px-2 py-2">
                        <span className="inline-flex items-center gap-2">
                          <Avatar name={task.assignee} />
                          {task.assignee || "—"}
                        </span>
                      </td>
                      <td className="px-2 py-2 tabular-nums text-[#5f756a]">{showDate(task.startDate)}</td>
                      <td className="px-2 py-2 tabular-nums text-[#5f756a]">{showDate(task.dueDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatusSelect({ value, onChange }: { value: TaskStatusId; onChange: (value: TaskStatusId) => void }) {
  const status = TASK_STATUSES.find((item) => item.id === value) ?? TASK_STATUSES[0];
  return (
    <label className="inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-semibold" style={{ backgroundColor: `${status.color}22`, color: status.color }}>
      <span className="size-2 rounded-full" style={{ backgroundColor: status.color }} />
      <select
        value={value}
        aria-label="Statuss"
        onChange={(event) => onChange(event.target.value as TaskStatusId)}
        className="bg-transparent font-semibold outline-none"
        style={{ color: status.color }}
      >
        {TASK_STATUSES.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function AddTaskForm({ listId }: { listId: string }) {
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState(DEMO_ASSIGNEES[0]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    addDemoTask({ listId, title, assignee });
    setTitle("");
  }
  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Jauns uzdevums" className={fieldClass} />
      <AssigneeSelect value={assignee} onChange={setAssignee} />
      <button type="submit" disabled={title.trim() === ""} className={addButtonClass}>
        <Plus className="size-4 shrink-0" aria-hidden="true" />
        Pievienot
      </button>
    </form>
  );
}

function AddSubtaskForm({ listId, parentId }: { listId: string; parentId: string }) {
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState(DEMO_ASSIGNEES[0]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    addDemoSubtask({ listId, parentId, title, assignee });
    setTitle("");
  }
  return (
    <form onSubmit={submit} className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#e4efe8] px-2 pt-4">
      <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Jauns apakšuzdevums" className={fieldClass} />
      <AssigneeSelect value={assignee} onChange={setAssignee} />
      <button type="submit" disabled={title.trim() === ""} className={addButtonClass}>
        <Plus className="size-4 shrink-0" aria-hidden="true" />
        Pievienot
      </button>
    </form>
  );
}

function AssigneeSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <select value={value} aria-label="Atbildīgais" onChange={(event) => onChange(event.target.value)} className={`${fieldClass} w-auto`}>
      {DEMO_ASSIGNEES.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  );
}

function PageHeading({ title, text, meta, action }: { title: string; text: string; meta?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
          <span className="min-w-0 truncate">{title}</span>
          {meta ? <span className="text-base font-medium text-[#8aa396] tabular-nums">{meta}</span> : null}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[#5f756a]">{text}</p>
      </div>
      {action}
    </div>
  );
}

function Missing({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border border-[#d3e4da] bg-white px-6 py-12 text-center">
      <p className="text-sm text-[#5f756a]">{text}</p>
      <Link href="/tasks" className="mt-4 inline-flex h-10 items-center rounded-xl bg-[#e7f3ec] px-4 text-sm font-semibold text-[#1e3a2f]">
        Atpakaļ uz uzdevumiem
      </Link>
    </div>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-[#e4efe8]">
      <div className="h-full rounded-full bg-[#1a6b4a]" style={{ width: `${percent}%` }} />
    </div>
  );
}

function AssigneeStack({ names }: { names: string[] }) {
  if (names.length === 0) return <UserRound className="size-4 text-[#c5d9cd]" aria-hidden="true" />;
  return (
    <span className="flex items-center -space-x-1.5">
      {names.slice(0, 3).map((name) => (
        <Avatar key={name} name={name} />
      ))}
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  const letters = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className="grid size-6 place-items-center rounded-full text-[10px] font-semibold text-white ring-2 ring-white" style={{ backgroundColor: avatarColor(name) }}>
      {letters || "?"}
    </span>
  );
}

function avatarColor(name: string) {
  const palette = ["#1a6b4a", "#1e4d8c", "#8a4b12", "#6b3fa0"];
  const index = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palette.length;
  return palette[index];
}

function uniqueAssignees(tasks: DemoTask[]) {
  return [...new Set(tasks.map((task) => task.assignee).filter(Boolean))];
}

function dateRange(tasks: DemoTask[]) {
  const dates = tasks.flatMap((task) => [task.startDate, task.dueDate]).filter(Boolean).sort();
  if (dates.length === 0) return "";
  const start = formatDate(dates[0]);
  const end = formatDate(dates[dates.length - 1]);
  return start === end ? start : `${start} - ${end}`;
}

function showDate(iso: string) {
  return iso ? formatDate(iso) : "—";
}

const fieldClass = "h-11 rounded-xl border border-[#c5d9cd] bg-white px-3 text-sm outline-none focus:border-[#1a6b4a] focus:ring-4 focus:ring-[#1a6b4a]/15";
const addButtonClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1a6b4a] px-4 text-sm font-semibold text-white hover:bg-[#0f4a34] disabled:bg-[#c5d8cc] disabled:text-[#5f756a]";
