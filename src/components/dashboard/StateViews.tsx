import type { ReactNode } from "react";
import { AlertTriangle, SearchX } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export function LoadingState({ height = 260 }: { height?: number }) {
  return (
    <div role="status" aria-label="Loading" style={{ height }} className="flex flex-col gap-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="flex-1" />
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden />
      <p className="text-sm font-medium">Could not load data</p>
      <p className="text-xs text-muted-foreground">{message ?? "Please try again."}</p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <SearchX className="h-5 w-5 text-muted-foreground" aria-hidden />
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-sm text-xs text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}

interface QueryLike<T> {
  data: T | undefined;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
}

/** Renders loading / error / empty / success states for a query consistently. */
export function QueryState<T>({
  query,
  children,
  isEmpty,
  empty,
  height,
}: {
  query: QueryLike<T>;
  children: (data: T) => ReactNode;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  height?: number;
}) {
  if (query.isPending) return <LoadingState height={height} />;
  if (query.isError || query.data === undefined)
    return (
      <ErrorState
        message={query.error instanceof Error ? query.error.message : undefined}
        onRetry={() => query.refetch()}
      />
    );
  if (isEmpty?.(query.data)) return <>{empty ?? <EmptyState title="No data for this selection" />}</>;
  return <>{children(query.data)}</>;
}
