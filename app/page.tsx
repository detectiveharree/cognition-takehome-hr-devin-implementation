import { Header } from "@/components/header";
import { ProjectsTable } from "@/components/projects-table";

export default function Home() {
  return (
    <>
      <Header title="Documentation Sync" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="mx-auto w-full max-w-5xl">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Documentation Sync</h1>
            <p className="text-muted-foreground">
              Keep your API documentation in sync with your codebase. Detect drift, generate updates, and automate reviews.
            </p>
          </div>
          <div className="mt-6">
            <ProjectsTable />
          </div>
        </div>
      </div>
    </>
  );
}
