"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Briefcase, Plus, Trash2 } from "lucide-react";

import { Ar } from "@/components/ar";
import { Sheet } from "@/components/sheet";
import { cn, uuid } from "@/lib/client";
import type { ProjectTotals, Totals } from "@/lib/finance";
import { formatMoney } from "@/lib/format";
import type { Project, ProjectInput } from "@/types/finance";

type Props = {
  totals: ProjectTotals[];
  projects: Project[];
  onSave: (projects: ProjectInput[]) => Promise<string | null>;
};

export function ProjectsCard({ totals, projects, onSave }: Props) {
  const [editing, setEditing] = useState(false);

  return (
    <>
      {projects.length === 0 ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-dashed border-neutral-300 px-4 py-4 text-start transition hover:border-neutral-400 hover:bg-white dark:border-neutral-700 dark:hover:border-neutral-600 dark:hover:bg-neutral-900"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 dark:bg-neutral-800">
            <Briefcase className="size-4" strokeWidth={1.5} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">
              Track your projects <Ar className="ms-1 font-normal text-neutral-400">مشاريعي</Ar>
            </span>
            <span className="mt-0.5 block text-xs text-neutral-500">See what each one brings in and costs</span>
          </span>
        </button>
      ) : (
        <div className="mt-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] font-medium text-neutral-500">
              Projects <span aria-hidden className="mx-1 text-neutral-300 dark:text-neutral-600">·</span>
              <Ar className="font-normal text-neutral-400">المشاريع</Ar>
            </p>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="-me-2 h-8 rounded-full px-3 text-[13px] font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            >
              Edit
            </button>
          </div>

          <ul className="mt-3 divide-y divide-neutral-100 dark:divide-neutral-800">
            {totals.map(({ project, month, allTime }) => (
              <li key={project.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-3">
                  <bdi className="min-w-0 truncate text-sm font-medium">{project.name}</bdi>
                  <Net value={month.net} className="text-sm font-semibold" />
                </div>
                <InOut totals={month} className="mt-0.5 text-xs text-neutral-500" />
                <p className="mt-1 flex flex-wrap items-baseline gap-x-1 text-[11px] text-neutral-400 tabular-nums">
                  All time <Ar>· من الأول</Ar>
                  <Net value={allTime.net} className="ms-1 font-medium" />
                  <InOut totals={allTime} className="ms-1" />
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <AnimatePresence>
        {editing && <ProjectEditor projects={projects} onClose={() => setEditing(false)} onSave={onSave} />}
      </AnimatePresence>
    </>
  );
}

function Net({ value, className }: { value: number; className?: string }) {
  return (
    <span
      className={cn(
        "shrink-0 tabular-nums",
        value > 0 && "text-emerald-600 dark:text-emerald-400",
        value < 0 && "text-red-600 dark:text-red-400",
        className,
      )}
    >
      {value > 0 && "+"}
      {formatMoney(value)}
    </span>
  );
}

function InOut({ totals, className }: { totals: Totals; className?: string }) {
  return (
    <span className={cn("tabular-nums", className)}>
      in {formatMoney(totals.income)} · out {formatMoney(totals.expense)}
    </span>
  );
}

type Draft = { id: string; name: string };

function ProjectEditor({
  projects,
  onClose,
  onSave,
}: {
  projects: Project[];
  onClose: () => void;
  onSave: (projects: ProjectInput[]) => Promise<string | null>;
}) {
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    projects.length > 0 ? projects.map(({ id, name }) => ({ id, name })) : [{ id: uuid(), name: "" }],
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const list = useRef<HTMLUListElement>(null);
  const focusLast = useRef(projects.length === 0);

  useEffect(() => {
    if (!focusLast.current) return;
    focusLast.current = false;
    list.current?.lastElementChild?.querySelector("input")?.focus();
  }, [drafts.length]);

  async function save() {
    const named = drafts
      .map((draft) => ({ id: draft.id, name: draft.name.trim() }))
      .filter((draft) => draft.name);
    setSaving(true);
    const failure = await onSave(named);
    setSaving(false);
    if (failure) setError(failure);
    else onClose();
  }

  return (
    <Sheet
      id="projects-editor-title"
      title="Projects"
      titleAr="المشاريع"
      subtitle="Removing a project keeps its income and spending, just untagged."
      onClose={onClose}
      footer={
        <>
          <p role="alert" className="min-h-4 text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="mt-2 flex h-11 w-full items-center justify-center rounded-xl bg-neutral-900 text-sm font-medium text-white transition hover:bg-neutral-800 active:scale-[0.99] disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {saving ? "Saving…" : "Save projects"}
          </button>
        </>
      }
    >
      <ul ref={list} className="space-y-2">
        {drafts.map((draft) => (
          <li key={draft.id} className="flex items-center gap-2">
            <input
              dir="auto"
              value={draft.name}
              maxLength={40}
              placeholder="Project name"
              aria-label="Project name"
              onChange={(event) => {
                const name = event.target.value;
                setDrafts((current) => current.map((d) => (d.id === draft.id ? { ...d, name } : d)));
                setError(null);
              }}
              className="h-11 min-w-0 flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-base outline-none transition placeholder:text-neutral-400 focus:border-neutral-400 focus:bg-white dark:border-neutral-800 dark:bg-neutral-800/50 dark:focus:border-neutral-600 dark:focus:bg-neutral-900"
            />
            <button
              type="button"
              onClick={() => setDrafts((current) => current.filter((d) => d.id !== draft.id))}
              aria-label={`Remove ${draft.name || "project"}`}
              className="flex size-11 shrink-0 items-center justify-center rounded-xl text-neutral-400 transition hover:bg-neutral-100 hover:text-red-500 dark:hover:bg-neutral-800"
            >
              <Trash2 className="size-4" strokeWidth={1.5} />
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => {
          focusLast.current = true;
          setDrafts((current) => [...current, { id: uuid(), name: "" }]);
        }}
        className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 text-sm font-medium text-neutral-600 transition hover:border-neutral-400 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-100"
      >
        <Plus className="size-4" strokeWidth={1.75} />
        Add project <Ar className="font-normal text-neutral-400">مشروع جديد</Ar>
      </button>
    </Sheet>
  );
}
