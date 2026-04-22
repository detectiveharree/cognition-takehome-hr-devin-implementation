import fs from "node:fs";
import path from "node:path";
import { Header } from "@/components/header";
import { MigrationWorkbench } from "@/components/migration-workbench";

export default function MigrationWorkbenchPage() {
  const playbook = fs.readFileSync(
    path.join(process.cwd(), "playbooks", "migration.md"),
    "utf-8",
  );

  return (
    <>
      <Header title="Migration Workbench" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="mx-auto w-full max-w-5xl">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Migration Workbench</h1>
            <p className="text-muted-foreground">
              Migrate Bank of America&apos;s legacy codebase from Angular 14 to Angular 18, one lap at a time.
            </p>
          </div>
          <div className="mt-6">
            <MigrationWorkbench playbook={playbook} />
          </div>
        </div>
      </div>
    </>
  );
}
