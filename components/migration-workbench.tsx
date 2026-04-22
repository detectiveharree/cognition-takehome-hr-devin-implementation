"use client";

import { useEffect, useState, Fragment } from "react";
import { config } from "@/lib/config";
import {
  ExternalLinkIcon,
  Loader2Icon,
  AlertTriangleIcon,
  ChevronDownIcon,
  CheckIcon,
  RepeatIcon,
  PlayIcon,
  BookOpenIcon,
  CircleIcon,
  CircleDashedIcon,
  CircleCheckIcon,
  CircleAlertIcon,
  GitPullRequestIcon,
  HammerIcon,
  FlaskConicalIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Markdown } from "@/components/markdown";

interface GitHubRepo {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  default_branch: string;
  language: string | null;
  visibility: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
}

interface ConnectedRepo {
  owner: string;
  name: string;
  url: string;
}

type StepStatus = "not-started" | "in-progress" | "complete" | "issues-found";

interface BuildResult {
  status: "pass" | "fail";
  url?: string;
}

interface QAResult {
  status: "pass" | "fail";
  url?: string;
}

interface BreakingChange {
  type?: string;
  description?: string;
  resolved?: boolean;
}

interface MigrationStep {
  from: number;
  to: number;
  status: StepStatus;
  issuesFound: string | null;
  prUrl: string | null;
  build: BuildResult | null;
  qa: QAResult | null;
  sessionId: string | null;
  sessionUrl: string | null;
  currentAction: string | null;
  breakingChanges: BreakingChange[];
  summary: string | null;
  qaNotes: string | null;
  filesChanged: number | null;
  linesChanged: number | null;
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 98 96"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"
      />
    </svg>
  );
}

// Only one connected repo for now; selector will list these.
const connectedRepos: ConnectedRepo[] = [
  {
    owner: config.github_owner,
    name: config.github_repo,
    url: config.github_url,
  },
];

// Placeholder steps — populated with live data from Devin sessions once started.
const emptyStep = (from: number, to: number): MigrationStep => ({
  from,
  to,
  status: "not-started",
  issuesFound: null,
  prUrl: null,
  build: null,
  qa: null,
  sessionId: null,
  sessionUrl: null,
  currentAction: null,
  breakingChanges: [],
  summary: null,
  qaNotes: null,
  filesChanged: null,
  linesChanged: null,
});

const initialSteps: MigrationStep[] = [
  emptyStep(14, 15),
  emptyStep(15, 16),
  emptyStep(16, 17),
  emptyStep(17, 18),
];

function StatusBadge({ status }: { status: StepStatus }) {
  const map: Record<
    StepStatus,
    { label: string; icon: React.ComponentType<{ className?: string }>; className: string }
  > = {
    "not-started": {
      label: "Not started",
      icon: CircleIcon,
      className: "border-border/60 bg-muted/40 text-muted-foreground",
    },
    "in-progress": {
      label: "In progress",
      icon: CircleDashedIcon,
      className:
        "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400 [&>svg]:animate-spin",
    },
    complete: {
      label: "Complete",
      icon: CircleCheckIcon,
      className:
        "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    "issues-found": {
      label: "Issues found",
      icon: CircleAlertIcon,
      className:
        "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-500",
    },
  };
  const { label, icon: Icon, className } = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}
    >
      <Icon className="size-3" />
      {label}
    </span>
  );
}

function ResultPill({
  passed,
  url,
  passLabel,
  failLabel,
}: {
  passed: boolean;
  url?: string | null;
  passLabel: string;
  failLabel: string;
}) {
  const label = passed ? passLabel : failLabel;
  const className = passed
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-destructive";
  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1 text-xs font-medium hover:underline ${className}`}
      >
        {label}
        <ExternalLinkIcon className="size-3" />
      </a>
    );
  }
  return <span className={`text-xs font-medium ${className}`}>{label}</span>;
}

// Turn a GitHub PR URL into the Devin review URL for the same PR.
// e.g. https://github.com/acme/app/pull/5 -> https://app.devin.ai/review/acme/app/pull/5
function toDevinReviewUrl(githubPrUrl: string): string {
  try {
    const url = new URL(githubPrUrl);
    if (url.hostname !== "github.com") return githubPrUrl;
    return `https://app.devin.ai/review${url.pathname}`;
  } catch {
    return githubPrUrl;
  }
}

export function MigrationWorkbench({ playbook }: { playbook: string }) {
  const [selectedRepo, setSelectedRepo] = useState<ConnectedRepo>(connectedRepos[0]);
  const [repo, setRepo] = useState<GitHubRepo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playbookOpen, setPlaybookOpen] = useState(false);
  const [steps, setSteps] = useState<MigrationStep[]>(initialSteps);
  const [startingStep, setStartingStep] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleRow = (key: string) =>
    setExpandedRows((prev) => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    let cancelled = false;

    async function fetchRepo() {
      setLoading(true);
      setError(null);
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(
          `https://api.github.com/repos/${selectedRepo.owner}/${selectedRepo.name}`,
          { signal: controller.signal },
        );
        clearTimeout(timeoutId);

        if (!res.ok) {
          if (res.status === 403) {
            throw new Error("GitHub API rate limit exceeded. Please try again later.");
          }
          throw new Error(`Failed to fetch repo: ${res.status}`);
        }
        const data = (await res.json()) as GitHubRepo;
        if (!cancelled) setRepo(data);
      } catch (err) {
        console.error("GitHub fetch error:", err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load repository");
          setRepo({
            name: selectedRepo.name,
            full_name: `${selectedRepo.owner}/${selectedRepo.name}`,
            description: "Outdated Angular 14 example app — used as the migration target.",
            html_url: selectedRepo.url,
            default_branch: "main",
            language: "TypeScript",
            visibility: "public",
            stargazers_count: 0,
            forks_count: 0,
            open_issues_count: 0,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchRepo();
    return () => {
      cancelled = true;
    };
  }, [selectedRepo]);

  // Poll any in-progress Devin sessions every 15 seconds and fold the
  // structured_output back into the corresponding step.
  useEffect(() => {
    const inFlight = steps.filter(
      (s) => s.sessionId && s.status === "in-progress",
    );
    if (inFlight.length === 0) return;

    let cancelled = false;

    const pollOnce = async () => {
      await Promise.all(
        inFlight.map(async (step) => {
          if (!step.sessionId) return;
          try {
            const res = await fetch(`/api/devin/status/${step.sessionId}`);
            if (!res.ok) return;
            const data = await res.json();
            if (cancelled) return;

            const so = (data.structuredOutput ?? {}) as {
              status?: string;
              current_action?: string;
              breaking_changes?: BreakingChange[];
              build_status?: "pending" | "pass" | "fail";
              qa_status?: "pending" | "pass" | "fail";
              qa_notes?: string;
              pr_url?: string | null;
              notes?: string;
              summary?: string;
              files_changed?: number;
              lines_changed?: number;
            };
            const pullRequest = data.pullRequest as
              | { url?: string }
              | null
              | undefined;

            const sessionStatus = data.status as string | undefined;
            const sessionUrl = (data.url as string | undefined) || step.sessionUrl;
            const latestDevinMessage = (data.latestDevinMessage as
              | string
              | null
              | undefined) ?? null;

            setSteps((prev) =>
              prev.map((s) => {
                if (s.sessionId !== step.sessionId) return s;

                const breakingChanges = so.breaking_changes ?? s.breakingChanges;
                const unresolved = breakingChanges.filter(
                  (b) => b.resolved === false,
                ).length;
                const resolved = breakingChanges.filter(
                  (b) => b.resolved === true,
                ).length;
                const issuesFound =
                  breakingChanges.length === 0
                    ? s.issuesFound
                    : unresolved > 0
                      ? `${unresolved} unresolved / ${breakingChanges.length} total`
                      : `${resolved} resolved`;

                const build: BuildResult | null =
                  so.build_status === "pass" || so.build_status === "fail"
                    ? { status: so.build_status, url: sessionUrl ?? undefined }
                    : s.build;

                const qa: QAResult | null =
                  so.qa_status === "pass" || so.qa_status === "fail"
                    ? { status: so.qa_status, url: sessionUrl ?? undefined }
                    : s.qa;

                // Prefer the native pull_request.url; fall back to structured_output.
                const ghPrUrl = pullRequest?.url ?? so.pr_url ?? null;
                const prUrl = ghPrUrl ? toDevinReviewUrl(ghPrUrl) : s.prUrl;

                // Derive overall step status.
                let nextStatus: StepStatus = s.status;
                if (
                  sessionStatus === "stopped" ||
                  so.status === "complete"
                ) {
                  // Complete unless build/qa failed, in which case mark issues-found.
                  if (build?.status === "fail" || qa?.status === "fail") {
                    nextStatus = "issues-found";
                  } else {
                    nextStatus = "complete";
                  }
                } else if (
                  sessionStatus === "blocked" ||
                  so.status === "blocked" ||
                  so.status === "failed"
                ) {
                  nextStatus = "issues-found";
                } else {
                  nextStatus = "in-progress";
                }

                return {
                  ...s,
                  status: nextStatus,
                  issuesFound,
                  prUrl,
                  build,
                  qa,
                  sessionUrl: sessionUrl ?? s.sessionUrl,
                  currentAction:
                    latestDevinMessage ?? so.current_action ?? s.currentAction,
                  breakingChanges,
                  summary: so.summary ?? so.notes ?? s.summary,
                  qaNotes: so.qa_notes ?? s.qaNotes,
                  filesChanged:
                    typeof so.files_changed === "number"
                      ? so.files_changed
                      : s.filesChanged,
                  linesChanged:
                    typeof so.lines_changed === "number"
                      ? so.lines_changed
                      : s.linesChanged,
                };
              }),
            );
          } catch (err) {
            console.error("Poll error:", err);
          }
        }),
      );
    };

    // Kick off immediately, then every 5s.
    pollOnce();
    const interval = setInterval(pollOnce, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [steps]);

  const handleRunMigrationStep = async () => {
    const next = steps.find((s) => s.status === "not-started");
    if (!next || startingStep) return;

    setStartingStep(true);
    setStartError(null);

    try {
      const res = await fetch("/api/devin/migration/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromVersion: next.from,
          toVersion: next.to,
          repoOwner: selectedRepo.owner,
          repoName: selectedRepo.name,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.details || err.error || `Failed with ${res.status}`);
      }

      const data = (await res.json()) as { sessionId: string; url: string };

      setSteps((prev) =>
        prev.map((s) =>
          s.from === next.from && s.to === next.to
            ? {
                ...s,
                status: "in-progress",
                sessionId: data.sessionId,
                sessionUrl: data.url,
                currentAction: "Devin is picking up the session…",
              }
            : s,
        ),
      );
    } catch (err) {
      console.error("Failed to start migration step:", err);
      setStartError(err instanceof Error ? err.message : String(err));
    } finally {
      setStartingStep(false);
    }
  };

  const nextPendingStep = steps.find((s) => s.status === "not-started");
  const anyInProgress = steps.some((s) => s.status === "in-progress");

  return (
    <div className="flex flex-col gap-6">
      {/* Connected repository card */}
      <div className="rounded-lg border border-border/60 bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <GitHubIcon className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Connected Repository</span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm" className="gap-1.5">
                  <RepeatIcon className="size-3.5" />
                  Change repository
                  <ChevronDownIcon className="size-3.5 text-muted-foreground" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="min-w-64">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Connected repositories</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {connectedRepos.map((r) => {
                  const isSelected =
                    r.owner === selectedRepo.owner && r.name === selectedRepo.name;
                  return (
                    <DropdownMenuItem
                      key={`${r.owner}/${r.name}`}
                      onClick={() => setSelectedRepo(r)}
                      className="flex items-center gap-2"
                    >
                      <GitHubIcon className="size-3.5 text-muted-foreground" />
                      <span className="flex-1 truncate">
                        {r.owner}/{r.name}
                      </span>
                      {isSelected ? <CheckIcon className="size-3.5" /> : null}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center justify-between gap-4 p-4">
          <div className="min-w-0 flex-1">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" />
                Loading repository…
              </div>
            ) : repo ? (
              <>
                <div className="flex items-center gap-2">
                  <a
                    href={repo.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold hover:underline"
                  >
                    {repo.full_name}
                  </a>
                  <ExternalLinkIcon className="size-3.5 text-muted-foreground" />
                  <a
                    href="https://app.devin.ai/org/harrison-reeves-devin-demo/wiki/detectiveharree/outdated-angular-14-example?branch=main"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <BookOpenIcon className="size-3" />
                    Wiki
                  </a>
                </div>
                {repo.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">{repo.description}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {repo.language ? <span>{repo.language}</span> : null}
                  <span>default: {repo.default_branch}</span>
                  <span className="capitalize">{repo.visibility}</span>
                </div>
                {error ? (
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-500">
                    <AlertTriangleIcon className="size-3.5" />
                    Using cached details — {error}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangleIcon className="size-4" />
                Unable to load repository.
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center">
            <Button
              variant="default"
              size="sm"
              className="gap-1.5"
              onClick={handleRunMigrationStep}
              disabled={startingStep || anyInProgress || !nextPendingStep}
            >
              {startingStep ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                <PlayIcon className="size-3.5" />
              )}
              {nextPendingStep
                ? `Run Angular ${nextPendingStep.from} → ${nextPendingStep.to}`
                : "All steps complete"}
            </Button>
          </div>
        </div>

        {startError ? (
          <div className="mx-4 mb-3 flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertTriangleIcon className="size-3.5" />
            {startError}
          </div>
        ) : null}

        {/* Playbook (collapsible) */}
        <button
          type="button"
          onClick={() => setPlaybookOpen((v) => !v)}
          aria-expanded={playbookOpen}
          className="flex w-full items-center justify-between gap-3 border-t border-border/60 px-4 py-3 text-left transition-colors hover:bg-muted/30"
        >
          <div className="flex items-center gap-2">
            <BookOpenIcon className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Playbook</span>
            <span className="text-xs text-muted-foreground">
              Prompt Devin uses to execute each migration step
            </span>
          </div>
          <ChevronDownIcon
            className={`size-4 text-muted-foreground transition-transform duration-300 ${
              playbookOpen ? "rotate-180" : ""
            }`}
          />
        </button>
        <div
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
            playbookOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            <div className="border-t border-border/60 bg-muted/20 px-4 py-3">
              <div className="max-h-[28rem] overflow-y-auto pr-2" aria-readonly="true">
                <Markdown content={playbook} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Devin status — animates in while a session is running */}
      {(() => {
        const activeStep = steps.find((s) => s.status === "in-progress");
        const show = Boolean(activeStep);
        const action =
          activeStep?.currentAction?.trim() ||
          "Devin is picking up the session…";
        return (
          <div
            aria-live="polite"
            className={`grid overflow-hidden transition-[grid-template-rows,opacity,margin] duration-500 ease-out ${
              show
                ? "grid-rows-[1fr] opacity-100"
                : "-mt-6 grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="min-h-0">
              <div className="relative overflow-hidden rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3">
                {/* Pulsing sheen */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-blue-500/[0.06] to-transparent"
                />
                <div className="relative flex items-start gap-3">
                  <span className="relative mt-1 flex size-2.5 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-60" />
                    <span className="relative inline-flex size-2.5 rounded-full bg-blue-500" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs font-medium text-blue-600 dark:text-blue-400">
                      <span>
                        {activeStep
                          ? `Devin · Angular ${activeStep.from} → ${activeStep.to}`
                          : "Devin"}
                      </span>
                      {activeStep?.sessionUrl ? (
                        <a
                          href={activeStep.sessionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline"
                        >
                          View session
                          <ExternalLinkIcon className="size-3" />
                        </a>
                      ) : null}
                    </div>
                    <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-foreground/90">
                      {action}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Steps table */}
      <div className="rounded-lg border border-border/60 bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/30">
              <tr className="text-xs text-muted-foreground">
                <th className="w-8 px-2 py-2" aria-label="Expand" />
                <th className="px-4 py-2 font-medium">Step</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Issues Found</th>
                <th className="px-4 py-2 font-medium">
                  <span className="inline-flex items-center gap-1">
                    <GitPullRequestIcon className="size-3.5" /> PR
                  </span>
                </th>
                <th className="px-4 py-2 font-medium">
                  <span className="inline-flex items-center gap-1">
                    <HammerIcon className="size-3.5" /> Build
                  </span>
                </th>
                <th className="px-4 py-2 font-medium">
                  <span className="inline-flex items-center gap-1">
                    <FlaskConicalIcon className="size-3.5" /> QA
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {steps.map((step) => {
                const key = `${step.from}-${step.to}`;
                const isExpanded = !!expandedRows[key];
                const hasDetails =
                  step.status !== "not-started" &&
                  (step.summary ||
                    step.qaNotes ||
                    step.breakingChanges.length > 0 ||
                    step.filesChanged != null ||
                    step.linesChanged != null);

                return (
                  <Fragment key={key}>
                    <tr
                      className={`border-t border-border/40 ${
                        hasDetails
                          ? "cursor-pointer transition-colors hover:bg-muted/20"
                          : ""
                      }`}
                      onClick={hasDetails ? () => toggleRow(key) : undefined}
                    >
                      <td className="px-2 py-3 align-middle">
                        {hasDetails ? (
                          <ChevronDownIcon
                            className={`size-4 text-muted-foreground transition-transform duration-200 ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                          />
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        <div className="flex flex-col">
                          <span>
                            Angular {step.from} → {step.to}
                          </span>
                          {step.sessionUrl ? (
                            <a
                              href={step.sessionUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="mt-0.5 inline-flex items-center gap-1 text-xs font-normal text-muted-foreground hover:text-foreground hover:underline"
                            >
                              View session
                              <ExternalLinkIcon className="size-3" />
                            </a>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={step.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {step.issuesFound ? (
                          step.issuesFound
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {step.prUrl ? (
                          <a
                            href={step.prUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          >
                            Review PR
                            <ExternalLinkIcon className="size-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground/60">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {step.build ? (
                          <ResultPill
                            passed={step.build.status === "pass"}
                            url={step.build.url}
                            passLabel="Passing"
                            failLabel="Failing"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground/60">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {step.qa ? (
                          <ResultPill
                            passed={step.qa.status === "pass"}
                            url={step.qa.url}
                            passLabel="Passing"
                            failLabel="Failing"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground/60">—</span>
                        )}
                      </td>
                    </tr>
                    {hasDetails ? (
                      <tr key={`${key}-details`} className="border-t border-border/20">
                        <td colSpan={7} className="p-0">
                          <div
                            className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                              isExpanded
                                ? "grid-rows-[1fr] opacity-100"
                                : "grid-rows-[0fr] opacity-0"
                            }`}
                          >
                            <div className="min-h-0">
                              <div className="space-y-4 bg-muted/20 px-6 py-4">
                                {step.summary ? (
                                  <div>
                                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                      Summary
                                    </div>
                                    <p className="mt-1 text-sm text-foreground/90 whitespace-pre-wrap">
                                      {step.summary}
                                    </p>
                                  </div>
                                ) : null}

                                {step.breakingChanges.length > 0 ? (
                                  <div>
                                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                      {step.breakingChanges.every((bc) => bc.resolved)
                                        ? `Fixed breaking changes (${step.breakingChanges.length})`
                                        : `Breaking changes (${step.breakingChanges.length})`}
                                    </div>
                                    <ul className="mt-2 space-y-1.5">
                                      {step.breakingChanges.map((bc, idx) => (
                                        <li
                                          key={idx}
                                          className="flex items-start gap-2 text-sm"
                                        >
                                          {bc.resolved === false ? (
                                            <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-500" />
                                          ) : null}
                                          <div className="min-w-0">
                                            {bc.type ? (
                                              <span className="mr-1.5 rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                                                {bc.type}
                                              </span>
                                            ) : null}
                                            <span className="text-foreground/90">
                                              {bc.description ?? "—"}
                                            </span>
                                          </div>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ) : null}

                                {step.qaNotes ? (
                                  <div>
                                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                      <FlaskConicalIcon className="size-3.5" />
                                      QA notes
                                    </div>
                                    <p className="mt-1 text-sm text-foreground/90 whitespace-pre-wrap">
                                      {step.qaNotes}
                                    </p>
                                  </div>
                                ) : null}

                                {step.filesChanged != null ||
                                step.linesChanged != null ? (
                                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                                    {step.filesChanged != null ? (
                                      <span>
                                        <span className="font-medium text-foreground">
                                          {step.filesChanged}
                                        </span>{" "}
                                        files changed
                                      </span>
                                    ) : null}
                                    {step.linesChanged != null ? (
                                      <span>
                                        <span className="font-medium text-foreground">
                                          {step.linesChanged}
                                        </span>{" "}
                                        lines changed
                                      </span>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
