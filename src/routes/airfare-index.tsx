import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/airfare-index")({
  head: () => ({ meta: [{ title: "airfare-index — Airfare Index India" }, { name: "description", content: "Airfare Index India prototype (demo data)." }] }),
  component: () => <p className="p-8 text-sm text-muted-foreground">This page is not built yet.</p>,
});
