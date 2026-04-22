"use client";

import { useEffect, useState, useCallback } from "react";
import { config } from "@/lib/config";
import { 
  ExternalLinkIcon, 
  PlayIcon, 
  CheckCircle2Icon, 
  XCircleIcon, 
  FileWarningIcon, 
  Loader2Icon, 
  AlertTriangleIcon,
  WrenchIcon,
  GitPullRequestIcon
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ActionToggle } from "@/components/ui/action-toggle";
import { DevinChat } from "@/components/devin-chat";

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  default_branch: string;
  updated_at: string;
  language: string | null;
  visibility: string;
}

interface DevinAnalysis {
  status: "IN_SYNC" | "NEEDS_UPDATE";
  reason: string;
}

interface ClarificationQuestion {
  endpoint: string;
  question: string;
}

interface AuditResult {
  endpoint: string;
  routeStatus: "exists" | "missing";
  docsStatus: "has-docs" | "missing" | "orphaned";
  apiPath?: string;
  docsPath?: string;
  devinAnalysis?: DevinAnalysis;
  selectedForFix?: boolean;
}

interface GitHubContentItem {
  name: string;
  path: string;
  type: "file" | "dir";
}

interface FixSessionResult {
  prUrl?: string;
  filesChanged?: string[];
  summary?: string;
  needsClarification?: boolean;
  clarificationQuestions?: ClarificationQuestion[];
}

type AuditPhase = "idle" | "fetching-github" | "analyzing-with-devin" | "complete";
type FixPhase = "idle" | "fixing" | "needs-clarification" | "complete";

export function ProjectsTable() {
  const [repo, setRepo] = useState<GitHubRepo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [auditPhase, setAuditPhase] = useState<AuditPhase>("idle");
  const [auditResults, setAuditResults] = useState<AuditResult[] | null>(null);
  const [visibleRows, setVisibleRows] = useState(0);
  const [devinSessionId, setDevinSessionId] = useState<string | null>(null);
  const [devinSessionUrl, setDevinSessionUrl] = useState<string | null>(null);
  
  // Fix with Devin state
  const [fixPhase, setFixPhase] = useState<FixPhase>("idle");
  const [fixSessionId, setFixSessionId] = useState<string | null>(null);
  const [fixSessionUrl, setFixSessionUrl] = useState<string | null>(null);
  const [fixResult, setFixResult] = useState<FixSessionResult | null>(null);
  const [showActionColumn, setShowActionColumn] = useState(false);
  const [showChat, setShowChat] = useState(false);
  
  // Clarification state for fix actions
  const [fixClarificationQuestions, setFixClarificationQuestions] = useState<ClarificationQuestion[]>([]);
  const [fixClarificationAnswers, setFixClarificationAnswers] = useState<string[]>([]);
  
  // Devin progress messages
  const [devinMessages, setDevinMessages] = useState<string[]>([]);
  const [latestDevinMessage, setLatestDevinMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchGitHubData() {
      try {
        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        // Fetch repo info
        const repoResponse = await fetch(
          `https://api.github.com/repos/${config.github_owner}/${config.github_repo}`,
          { signal: controller.signal }
        );
        clearTimeout(timeoutId);

        if (!repoResponse.ok) {
          // Check for rate limiting
          if (repoResponse.status === 403) {
            throw new Error("GitHub API rate limit exceeded. Please try again later.");
          }
          throw new Error(`Failed to fetch repo: ${repoResponse.status}`);
        }
        const repoData = await repoResponse.json();
        setRepo(repoData);
      } catch (err) {
        console.error("GitHub fetch error:", err);
        // On error, use fallback data from config
        setRepo({
          id: 0,
          name: config.github_repo,
          full_name: `${config.github_owner}/${config.github_repo}`,
          description: "An outdated Angular 14 example application used to demonstrate Angular 14 → 18 migration workflows.",
          html_url: config.github_url,
          stargazers_count: 0,
          forks_count: 0,
          open_issues_count: 0,
          default_branch: "main",
          updated_at: new Date().toISOString(),
          language: "TypeScript",
          visibility: "public",
        });
      } finally {
        setLoading(false);
      }
    }

    fetchGitHubData();
  }, []);

  // Animate rows appearing one by one
  useEffect(() => {
    if (auditResults && visibleRows < auditResults.length) {
      const timer = setTimeout(() => {
        setVisibleRows((prev) => prev + 1);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [auditResults, visibleRows]);

  // Poll Devin session for results
  const pollDevinSession = useCallback(async (sessionId: string, results: AuditResult[]) => {
    const maxAttempts = 60; // 5 minutes max (5 second intervals)
    let attempts = 0;
    let seenMessageCount = 0;

    const poll = async () => {
      try {
        // Fetch status and messages in parallel
        const [statusResponse, messagesResponse] = await Promise.all([
          fetch(`/api/devin/status/${sessionId}`),
          fetch(`/api/devin/messages/${sessionId}`)
        ]);
        
        // Handle messages
        if (messagesResponse.ok) {
          const messagesData = await messagesResponse.json();
          const messages = messagesData.messages || [];
          
          // Extract text from new messages (skip first message which is the prompt)
          if (messages.length > seenMessageCount) {
            const newMessages = messages.slice(Math.max(seenMessageCount, 1)); // Skip index 0 (prompt)
            for (const msg of newMessages) {
              // Get the message text - Devin API returns different formats
              let text = msg.text || msg.message || msg.content || "";
              const role = String(msg.role || "").toLowerCase();
              if (text && role !== "user") {
                // Truncate to first line, max 140 chars
                text = text.split('\n')[0].trim();
                if (text.length > 140) {
                  text = text.slice(0, 137) + "...";
                }
                if (text) {
                  console.log("New analyze message:", role, text.slice(0, 50));
                  setLatestDevinMessage(text);
                  setDevinMessages(prev => [...prev, text]);
                }
              }
            }
            seenMessageCount = messages.length;
          }
        }
        
        // Handle status response - 502 is transient, just retry
        if (!statusResponse.ok) {
          if (statusResponse.status === 502) {
            console.log("Devin API temporarily unavailable (502), will retry...");
            attempts++;
            if (attempts < maxAttempts) {
              setTimeout(poll, 5000);
            }
            return;
          }
          throw new Error("Failed to fetch session status");
        }
        
        const data = await statusResponse.json();
        
        // Both "finished" and "blocked" are valid terminal states
        // "blocked" means Devin stopped (possibly waiting for human input) but may have structured output
        if (data.status === "finished" || data.status === "blocked") {
          if (data.structuredOutput?.analyses) {
            // Update results with Devin's analysis
            const analysisMap = new Map<string, DevinAnalysis>();
            for (const analysis of data.structuredOutput.analyses) {
              analysisMap.set(analysis.endpoint, {
                status: analysis.status,
                reason: analysis.reason,
              });
            }

            const updatedResults = results.map((result) => ({
              ...result,
              devinAnalysis: analysisMap.get(result.endpoint),
            }));

            // Sort results: issues first (orphaned, missing, needs update), then in-sync
            const sortedResults = [...updatedResults].sort((a, b) => {
              const getPriority = (r: AuditResult) => {
                if (r.docsStatus === "orphaned") return 0;
                if (r.docsStatus === "missing") return 1;
                if (r.devinAnalysis?.status === "NEEDS_UPDATE") return 2;
                if (r.devinAnalysis?.status === "IN_SYNC") return 4;
                return 3; // analyzing or unknown
              };
              return getPriority(a) - getPriority(b);
            });

            setAuditResults(sortedResults);
          }
          setAuditPhase("complete");
          return;
        }

        if (data.status === "expired") {
          console.error("Devin session expired");
          setAuditPhase("complete");
          return;
        }

        // Still working, poll again
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000);
        } else {
          console.error("Devin session timed out");
          setAuditPhase("complete");
        }
      } catch (err) {
        console.error("Error polling Devin session:", err);
        setAuditPhase("complete");
      }
    };

    poll();
  }, []);

  const runAudit = async () => {
    setAuditPhase("fetching-github");
    setAuditResults(null);
    setVisibleRows(0);
    setDevinSessionId(null);
    setDevinSessionUrl(null);
    // Reset fix state
    setFixPhase("idle");
    setFixSessionId(null);
    setFixSessionUrl(null);
    setFixResult(null);
    setShowActionColumn(false);
    setShowChat(false);
    // Reset messages
    setDevinMessages([]);
    setLatestDevinMessage(null);
    
    try {
      // Fetch API routes from the repo (Next.js App Router uses app/api/)
      const apiResponse = await fetch(
        `https://api.github.com/repos/${config.github_owner}/${config.github_repo}/contents/app/api`
      );
      const apiContents: GitHubContentItem[] = apiResponse.ok ? await apiResponse.json() : [];
      
      // Fetch docs from the repo (may be nested)
      const docsResponse = await fetch(
        `https://api.github.com/repos/${config.github_owner}/${config.github_repo}/contents/docs/endpoints`
      );
      const docsContents: GitHubContentItem[] = docsResponse.ok ? await docsResponse.json() : [];
      
      // Build a map of doc files for path lookup
      const docFilesMap = new Map<string, string>();
      docsContents
        .filter((item) => item.type === "file" && item.name.endsWith(".md"))
        .forEach((item) => {
          docFilesMap.set(item.name.replace(".md", ""), item.path);
        });
      
      // Extract route names (directories in /api), excluding ignored endpoints
      const apiRoutesWithPaths = apiContents
        .filter((item) => item.type === "dir" && !config.ignoredEndpoints.includes(item.name))
        .map((item) => ({ name: item.name, path: item.path }));
      
      const docNames = new Set(docFilesMap.keys());
      
      const results: AuditResult[] = [];
      
      // Check each API route for corresponding docs
      for (const route of apiRoutesWithPaths) {
        const hasDoc = docNames.has(route.name);
        results.push({
          endpoint: `/api/${route.name}`,
          routeStatus: "exists",
          docsStatus: hasDoc ? "has-docs" : "missing",
          apiPath: route.path,
          docsPath: hasDoc ? docFilesMap.get(route.name) : undefined,
        });
        if (hasDoc) {
          docNames.delete(route.name);
        }
      }
      
      // Any remaining docs are orphaned (no corresponding route)
      for (const orphanedDoc of docNames) {
        results.push({
          endpoint: `/api/${orphanedDoc}`,
          routeStatus: "missing",
          docsStatus: "orphaned",
          docsPath: docFilesMap.get(orphanedDoc),
        });
      }
      
      // Sort by endpoint name
      results.sort((a, b) => a.endpoint.localeCompare(b.endpoint));
      
      setAuditResults(results);

      // Trigger Devin analysis for endpoints that have both route and docs
      const endpointsToAnalyze = results
        .filter((r) => r.routeStatus === "exists" && r.docsStatus === "has-docs" && r.apiPath && r.docsPath)
        .map((r) => ({
          endpoint: r.endpoint,
          apiPath: r.apiPath!,
          docsPath: r.docsPath!,
        }));

      if (endpointsToAnalyze.length > 0) {
        setAuditPhase("analyzing-with-devin");
        
        const devinResponse = await fetch("/api/devin/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoints: endpointsToAnalyze,
            repoOwner: config.github_owner,
            repoName: config.github_repo,
          }),
        });

        if (devinResponse.ok) {
          const devinData = await devinResponse.json();
          setDevinSessionId(devinData.sessionId);
          setDevinSessionUrl(devinData.url);
          
          // Start polling for results
          pollDevinSession(devinData.sessionId, results);
        } else {
          console.error("Failed to create Devin session");
          setAuditPhase("complete");
        }
      } else {
        setAuditPhase("complete");
      }
    } catch (err) {
      console.error("Audit failed:", err);
      setAuditResults([]);
      setAuditPhase("idle");
    }
  };

  // Show action column with animation after audit completes
  useEffect(() => {
    if (auditPhase === "complete" && auditResults && auditResults.length > 0) {
      // Delay showing action column for nice animation
      const timer = setTimeout(() => {
        setShowActionColumn(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [auditPhase, auditResults]);

  // Toggle selection for fix
  const toggleFixSelection = (endpoint: string) => {
    setAuditResults((prev) => {
      if (!prev) return prev;
      return prev.map((result) =>
        result.endpoint === endpoint
          ? { ...result, selectedForFix: !result.selectedForFix }
          : result
      );
    });
  };

  // Check if any items are selected for fix
  const hasSelectedItems = auditResults?.some((r) => r.selectedForFix) ?? false;

  // Get fixable items (NEEDS_UPDATE, orphaned, or missing docs)
  const getFixableItems = () => {
    if (!auditResults) return [];
    return auditResults.filter(
      (r) =>
        (r.devinAnalysis?.status === "NEEDS_UPDATE" && r.docsPath) ||
        r.docsStatus === "orphaned" ||
        (r.routeStatus === "exists" && r.docsStatus === "missing")
    );
  };

  // Get the action type for a result
  const getActionType = (result: AuditResult): "update" | "delete" | "create" | null => {
    if (result.docsStatus === "orphaned") return "delete";
    if (result.routeStatus === "exists" && result.docsStatus === "missing") return "create";
    if (result.devinAnalysis?.status === "NEEDS_UPDATE") return "update";
    return null;
  };

  // Poll fix session for results
  const pollFixSession = useCallback(async (sessionId: string) => {
    const maxAttempts = 120; // 10 minutes max
    let attempts = 0;
    let seenMessageCount = 0;

    const poll = async () => {
      try {
        // Fetch status and messages in parallel
        const [statusResponse, messagesResponse] = await Promise.all([
          fetch(`/api/devin/chat/${sessionId}`),
          fetch(`/api/devin/messages/${sessionId}`)
        ]);
        
        // Handle messages
        if (messagesResponse.ok) {
          const messagesData = await messagesResponse.json();
          const messages = messagesData.messages || [];
          
          // Skip first message (prompt) and truncate to one line
          if (messages.length > seenMessageCount) {
            const newMessages = messages.slice(Math.max(seenMessageCount, 1));
            for (const msg of newMessages) {
              let text = msg.text || msg.message || msg.content || "";
              // Show messages that aren't from user role (Devin uses "devin" or "assistant")
              const role = String(msg.role || "").toLowerCase();
              if (text && role !== "user") {
                text = text.split('\n')[0].trim();
                if (text.length > 140) {
                  text = text.slice(0, 137) + "...";
                }
                if (text) {
                  console.log("New fix message:", role, text.slice(0, 50));
                  setLatestDevinMessage(text);
                  setDevinMessages(prev => [...prev, text]);
                }
              }
            }
            seenMessageCount = messages.length;
          }
        }
        
        // Handle 502 gracefully
        if (!statusResponse.ok) {
          if (statusResponse.status === 502) {
            console.log("Devin API temporarily unavailable (502), will retry...");
            attempts++;
            if (attempts < maxAttempts) {
              setTimeout(poll, 5000);
            }
            return;
          }
          throw new Error("Failed to fetch session status");
        }
        
        const data = await statusResponse.json();
        
        if (data.status === "finished" || data.status === "blocked") {
          const result: FixSessionResult = {};
          
          // Check for PR URL
          if (data.pullRequest?.url) {
            result.prUrl = data.pullRequest.url;
          }
          if (data.structuredOutput?.pr_url) {
            result.prUrl = data.structuredOutput.pr_url;
          }
          if (data.structuredOutput?.files_changed) {
            result.filesChanged = data.structuredOutput.files_changed;
          }
          if (data.structuredOutput?.summary) {
            result.summary = data.structuredOutput.summary;
          }
          if (data.structuredOutput?.needs_clarification) {
            result.needsClarification = true;
            result.clarificationQuestions = data.structuredOutput.clarification_questions || [];
            // Set clarification state for UI
            setFixClarificationQuestions(result.clarificationQuestions || []);
            setFixPhase("needs-clarification");
          } else {
            setFixPhase("complete");
          }
          
          setFixResult(result);
          return;
        }

        if (data.status === "expired") {
          console.error("Fix session expired");
          setFixPhase("complete");
          return;
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000);
        } else {
          console.error("Fix session timed out");
          setFixPhase("complete");
        }
      } catch (err) {
        console.error("Error polling fix session:", err);
        setFixPhase("complete");
      }
    };

    poll();
  }, []);

  // Fix selected items with Devin
  const fixWithDevin = async () => {
    if (!auditResults) return;

    const selectedItems = auditResults.filter((r) => r.selectedForFix);
    if (selectedItems.length === 0) return;

    setFixPhase("fixing");
    setFixResult(null);
    // Clear previous messages
    setDevinMessages([]);
    setLatestDevinMessage(null);

    const actions = selectedItems.map((item) => ({
      endpoint: item.endpoint,
      action: getActionType(item)!,
      docsPath: item.docsPath,
      apiPath: item.apiPath,
      reason: item.devinAnalysis?.reason,
    }));

    try {
      const response = await fetch("/api/devin/fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actions,
          repoOwner: config.github_owner,
          repoName: config.github_repo,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setFixSessionId(data.sessionId);
        setFixSessionUrl(data.url);
        pollFixSession(data.sessionId);
      } else {
        console.error("Failed to create fix session");
        setFixPhase("idle");
      }
    } catch (err) {
      console.error("Fix failed:", err);
      setFixPhase("idle");
    }
  };

  const getRouteStatusBadge = (status: AuditResult["routeStatus"]) => {
    if (status === "exists") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-500">
          <CheckCircle2Icon className="h-3 w-3" />
          Exists
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-500">
        <XCircleIcon className="h-3 w-3" />
        No Route
      </span>
    );
  };

  const getDocsStatusBadge = (result: AuditResult) => {
    // If we have Devin analysis, show that instead
    if (result.devinAnalysis) {
      if (result.devinAnalysis.status === "IN_SYNC") {
        return (
          <Tooltip>
            <TooltipTrigger
              render={
                <div className="flex flex-col gap-1 cursor-help">
                  <span className="inline-flex w-fit items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-500">
                    <CheckCircle2Icon className="h-3 w-3" />
                    In Sync
                  </span>
                </div>
              }
            />
            <TooltipContent side="bottom" className="max-w-sm">
              <p className="text-sm">{result.devinAnalysis.reason}</p>
            </TooltipContent>
          </Tooltip>
        );
      } else {
        return (
          <Tooltip>
            <TooltipTrigger
              render={
                <div className="flex flex-col gap-1.5 cursor-help">
                  <span className="inline-flex w-fit items-center gap-1 rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-500">
                    <AlertTriangleIcon className="h-3 w-3" />
                    Needs Update
                  </span>
                  <span className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {result.devinAnalysis.reason}
                  </span>
                </div>
              }
            />
            <TooltipContent side="bottom" className="max-w-md">
              <p className="text-sm">{result.devinAnalysis.reason}</p>
            </TooltipContent>
          </Tooltip>
        );
      }
    }

    // Show analyzing state if Devin is actively working and this endpoint has docs
    if (result.docsStatus === "has-docs" && auditPhase === "analyzing-with-devin") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-500">
          <Loader2Icon className="h-3 w-3 animate-spin" />
          Analyzing...
        </span>
      );
    }

    // If has docs but analysis not started or complete without result, just show has docs
    if (result.docsStatus === "has-docs") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-500/10 px-2 py-0.5 text-xs font-medium text-gray-500">
          <CheckCircle2Icon className="h-3 w-3" />
          Has Docs
        </span>
      );
    }

    switch (result.docsStatus) {
      case "missing":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-500">
            <XCircleIcon className="h-3 w-3" />
            Missing
          </span>
        );
      case "orphaned":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-500">
            <FileWarningIcon className="h-3 w-3" />
            Orphaned Doc
          </span>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 rounded-lg bg-muted/50 animate-pulse" />
        <div className="h-48 rounded-lg bg-muted/50 animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        Error loading project: {error}
      </div>
    );
  }

  if (!repo) return null;



  return (
    <div className="space-y-6">
      {/* Project Header Card */}
      <div className="rounded-xl border border-border/50 bg-card p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#24292f]">
              <svg className="h-6 w-6 text-white" viewBox="0 0 98 96" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold">{repo.name}</h2>
              <p className="text-sm text-muted-foreground">{repo.full_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {auditPhase !== "complete" && (
              <button
                onClick={runAudit}
                disabled={auditPhase !== "idle"}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: "#0194E5" }}
              >
                {auditPhase !== "idle" ? (
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                ) : (
                  <PlayIcon className="h-4 w-4" />
                )}
                {auditPhase === "fetching-github" ? "Scanning..." : 
                 auditPhase === "analyzing-with-devin" ? "Analyzing..." : "Run Audit"}
              </button>
            )}
            {auditPhase === "complete" && getFixableItems().length > 0 && (
              <button
                onClick={fixWithDevin}
                disabled={!hasSelectedItems || fixPhase === "fixing"}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-all duration-200 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed animate-in fade-in slide-in-from-left-2"
                style={{ backgroundColor: hasSelectedItems ? "#1FAF8C" : "#6b7280" }}
              >
                {fixPhase === "fixing" ? (
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                ) : (
                  <WrenchIcon className="h-4 w-4" />
                )}
                {fixPhase === "fixing" ? "Fixing..." : "Fix with Devin"}
              </button>
            )}
            {(devinSessionUrl || fixSessionUrl) && (
              <a
                href={fixSessionUrl || devinSessionUrl || ""}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors hover:opacity-90"
                style={{ backgroundColor: "#0294DE" }}
              >
                <ExternalLinkIcon className="h-4 w-4" />
                View Devin Session
              </a>
            )}
            {fixResult?.prUrl && (
              <a
                href={fixResult.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors animate-in fade-in zoom-in-95 duration-300"
                style={{ backgroundColor: "#8957e5", color: "white" }}
              >
                <GitPullRequestIcon className="h-4 w-4" />
                View PR
              </a>
            )}
          </div>
        </div>
        
        {repo.description && (
          <p className="mt-4 text-muted-foreground">{repo.description}</p>
        )}

        {/* Clarification Questions UI - shown when Devin needs more info for creating docs */}
        {fixPhase === "needs-clarification" && fixClarificationQuestions.length > 0 && (
          <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangleIcon className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-amber-600">Devin needs clarification</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Please answer the following questions to help create accurate documentation:
                </p>
              </div>
            </div>
            
            <div className="space-y-4 mt-4">
              {fixClarificationQuestions.map((q, idx) => (
                <div key={idx} className="rounded-lg border border-border/50 bg-background p-4">
                  <p className="text-sm font-medium text-foreground mb-1">
                    <span className="text-muted-foreground">Endpoint:</span> {q.endpoint}
                  </p>
                  <p className="text-sm text-muted-foreground mb-3">{q.question}</p>
                  <textarea
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    rows={3}
                    placeholder="Enter your answer..."
                    value={fixClarificationAnswers[idx] || ""}
                    onChange={(e) => {
                      const newAnswers = [...fixClarificationAnswers];
                      newAnswers[idx] = e.target.value;
                      setFixClarificationAnswers(newAnswers);
                    }}
                  />
                </div>
              ))}
            </div>
            
            <div className="flex gap-3 mt-4">
              <button
                onClick={async () => {
                  // Send answers to Devin and continue
                  if (!fixSessionId) return;
                  
                  const answersText = fixClarificationQuestions
                    .map((q, idx) => `**${q.endpoint}**: ${fixClarificationAnswers[idx] || "No answer provided"}`)
                    .join("\n\n");
                  
                  try {
                    await fetch(`/api/devin/chat/${fixSessionId}`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        message: `Here are my answers to your questions:\n\n${answersText}\n\nPlease proceed with creating/updating the documentation.`,
                      }),
                    });
                    
                    // Clear clarification state and resume polling
                    setFixClarificationQuestions([]);
                    setFixClarificationAnswers([]);
                    setFixPhase("fixing");
                    pollFixSession(fixSessionId);
                  } catch (err) {
                    console.error("Failed to send answers:", err);
                  }
                }}
                disabled={fixClarificationQuestions.some((_, i) => !fixClarificationAnswers[i])}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: "#1FAF8C" }}
              >
                Submit Answers
              </button>
              {fixSessionUrl && (
                <a
                  href={fixSessionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium border border-border hover:bg-muted transition-colors"
                >
                  <ExternalLinkIcon className="h-4 w-4" />
                  Open Devin Session
                </a>
              )}
            </div>
          </div>
        )}

        {/* Devin Chat - shown when user wants to chat with Devin */}
        {showChat && fixSessionId && fixSessionUrl && (
          <div className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <DevinChat
              sessionId={fixSessionId}
              sessionUrl={fixSessionUrl}
              onClose={() => setShowChat(false)}
            />
          </div>
        )}

        {/* Fix Result Summary */}
        {fixResult && fixPhase === "complete" && (
          <div className="mt-6 rounded-lg border border-green-500/30 bg-green-500/5 p-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-start gap-3">
              <CheckCircle2Icon className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium text-green-600">Documentation Fixed!</p>
                {fixResult.summary && (
                  <p className="text-sm text-muted-foreground mt-1">{fixResult.summary}</p>
                )}
                {fixResult.filesChanged && fixResult.filesChanged.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Changed: {fixResult.filesChanged.join(", ")}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Devin Thinking Message */}
        {latestDevinMessage && (auditPhase === "analyzing-with-devin" || fixPhase === "fixing") && (
          <div className="flex items-center gap-3 px-2 py-3 text-sm text-muted-foreground animate-in fade-in duration-300">
            <svg className="h-4 w-4 animate-spin text-[#0294DE]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="italic">{latestDevinMessage}</span>
          </div>
        )}

        {/* Audit Results Table */}
        {(auditPhase !== "idle" || auditResults) && (
          <div className="-mx-6 -mb-6 mt-6 overflow-hidden border-t border-border/50">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="w-[180px] px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Endpoint
                  </th>
                  <th className="w-[120px] px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Route
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Docs
                  </th>
                  {showActionColumn && (
                    <th className="w-[200px] px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground animate-in fade-in slide-in-from-right-4 duration-500">
                      Action
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {auditPhase === "fetching-github" && !auditResults && (
                  <tr>
                    <td colSpan={showActionColumn ? 4 : 3} className="px-4 py-8 text-center">
                      <div className="flex items-center justify-center gap-2 text-muted-foreground">
                        <Loader2Icon className="h-5 w-5 animate-spin" />
                        <span>Scanning repository for API routes...</span>
                      </div>
                    </td>
                  </tr>
                )}
                {auditResults?.slice(0, visibleRows).map((result, index) => {
                  const actionType = getActionType(result);
                  const isFixable = actionType !== null;
                  
                  return (
                    <tr
                      key={result.endpoint}
                      className="animate-in fade-in slide-in-from-top-2 duration-300"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <td className="px-4 py-3">
                        <code className="rounded bg-muted px-2 py-1 font-mono text-sm">
                          {result.endpoint}
                        </code>
                      </td>
                      <td className="px-4 py-3">
                        {getRouteStatusBadge(result.routeStatus)}
                      </td>
                      <td className="px-4 py-3">
                        {getDocsStatusBadge(result)}
                      </td>
                      {showActionColumn && (
                        <td className="px-4 py-3 animate-in fade-in slide-in-from-right-4 duration-500" style={{ animationDelay: `${index * 50}ms` }}>
                          {isFixable ? (
                            <ActionToggle
                              checked={result.selectedForFix ?? false}
                              onChange={() => toggleFixSelection(result.endpoint)}
                              disabled={fixPhase === "fixing" || fixPhase === "complete"}
                              actionLabel={actionType === "update" ? "Update Docs" : actionType === "create" ? "Create Docs" : "Delete Docs"}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
