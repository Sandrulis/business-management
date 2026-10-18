"use client";

import { useSyncExternalStore } from "react";

export type TaskStatusId = "todo" | "progress" | "done";

export type DemoList = {
  id: string;
  name: string;
  description: string;
};

export type DemoTask = {
  id: string;
  listId: string;
  parentId: string | null;
  title: string;
  description: string;
  status: TaskStatusId;
  assignee: string;
  startDate: string;
  dueDate: string;
};

export const TASK_STATUSES: { id: TaskStatusId; label: string; color: string }[] = [
  { id: "todo", label: "Darāms", color: "#8aa396" },
  { id: "progress", label: "Procesā", color: "#e07a1f" },
  { id: "done", label: "Gatavs", color: "#1f8a4c" },
];

export const DEMO_ASSIGNEES = ["Anna", "Mārtiņš", "Elīna", "Kārlis"];

const lists: DemoList[] = [
  {
    id: "objekti",
    name: "Objekta darbi",
    description: "Būvlaukuma uzdevumi un apakšuzdevumi.",
  },
  {
    id: "birojs",
    name: "Birojs",
    description: "Iekšējie darbi, kas vēl nav piesaistīti objektam.",
  },
];

let tasks: DemoTask[] = [
  {
    id: "pamati",
    listId: "objekti",
    parentId: null,
    title: "Pamatu betonēšana",
    description: "Veidņi, stiegrojums un betona liešana.",
    status: "progress",
    assignee: "Mārtiņš",
    startDate: "2026-10-13",
    dueDate: "2026-10-24",
  },
  {
    id: "veidni",
    listId: "objekti",
    parentId: "pamati",
    title: "Veidņu montāža",
    description: "",
    status: "done",
    assignee: "Kārlis",
    startDate: "2026-10-13",
    dueDate: "2026-10-15",
  },
  {
    id: "stiegrojums",
    listId: "objekti",
    parentId: "pamati",
    title: "Stiegrojuma siešana",
    description: "",
    status: "progress",
    assignee: "Mārtiņš",
    startDate: "2026-10-16",
    dueDate: "2026-10-20",
  },
  {
    id: "betons",
    listId: "objekti",
    parentId: "pamati",
    title: "Betona liešana",
    description: "",
    status: "todo",
    assignee: "Anna",
    startDate: "2026-10-21",
    dueDate: "2026-10-24",
  },
  {
    id: "jumts",
    listId: "objekti",
    parentId: null,
    title: "Jumta konstrukcija",
    description: "Spāres un segums.",
    status: "todo",
    assignee: "Elīna",
    startDate: "2026-10-27",
    dueDate: "2026-11-06",
  },
  {
    id: "spares",
    listId: "objekti",
    parentId: "jumts",
    title: "Spāru pasūtījums",
    description: "",
    status: "todo",
    assignee: "Elīna",
    startDate: "2026-10-27",
    dueDate: "2026-10-29",
  },
  {
    id: "segums",
    listId: "objekti",
    parentId: "jumts",
    title: "Seguma ieklāšana",
    description: "",
    status: "todo",
    assignee: "Kārlis",
    startDate: "2026-11-02",
    dueDate: "2026-11-06",
  },
  {
    id: "rekini",
    listId: "birojs",
    parentId: null,
    title: "Ienākošo rēķinu pārbaude",
    description: "Salīdzināt rēķinus ar tāmi pirms apmaksas.",
    status: "progress",
    assignee: "Anna",
    startDate: "2026-10-16",
    dueDate: "2026-10-18",
  },
  {
    id: "salidzinasana",
    listId: "birojs",
    parentId: "rekini",
    title: "Salīdzināt ar tāmi",
    description: "",
    status: "progress",
    assignee: "Anna",
    startDate: "2026-10-16",
    dueDate: "2026-10-17",
  },
  {
    id: "apmaksa",
    listId: "birojs",
    parentId: "rekini",
    title: "Apstiprināt apmaksu",
    description: "",
    status: "todo",
    assignee: "Elīna",
    startDate: "2026-10-18",
    dueDate: "2026-10-18",
  },
];

type Snapshot = { lists: DemoList[]; tasks: DemoTask[] };

let snapshot: Snapshot = { lists, tasks };
const listeners = new Set<() => void>();

function publish() {
  snapshot = { lists, tasks };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

export function useDemoTasks() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function addDemoTask(input: { listId: string; title: string; assignee: string }) {
  const title = input.title.trim();
  if (!title) return;
  tasks = [
    ...tasks,
    {
      id: crypto.randomUUID(),
      listId: input.listId,
      parentId: null,
      title,
      description: "",
      status: "todo",
      assignee: input.assignee,
      startDate: "",
      dueDate: "",
    },
  ];
  publish();
}

export function addDemoSubtask(input: { listId: string; parentId: string; title: string; assignee: string }) {
  const title = input.title.trim();
  if (!title) return;
  tasks = [
    ...tasks,
    {
      id: crypto.randomUUID(),
      listId: input.listId,
      parentId: input.parentId,
      title,
      description: "",
      status: "todo",
      assignee: input.assignee,
      startDate: "",
      dueDate: "",
    },
  ];
  publish();
}

export function setDemoStatus(id: string, status: TaskStatusId) {
  tasks = tasks.map((task) => (task.id === id ? { ...task, status } : task));
  publish();
}

export function childrenOf(all: DemoTask[], parentId: string) {
  return all.filter((task) => task.parentId === parentId);
}

export function rootsOf(all: DemoTask[], listId: string) {
  return all.filter((task) => task.listId === listId && task.parentId === null);
}

export function taskProgress(all: DemoTask[], taskId: string) {
  const children = childrenOf(all, taskId);
  const items = children.length > 0 ? children : all.filter((task) => task.id === taskId);
  const done = items.filter((task) => task.status === "done").length;
  return { done, total: items.length, percent: items.length === 0 ? 0 : Math.round((done / items.length) * 100) };
}
