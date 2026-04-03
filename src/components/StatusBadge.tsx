interface StatusBadgeProps {
  runningCount: number;
  totalCount: number;
  status: 'stopped' | 'partial' | 'running';
}

export default function StatusBadge({ runningCount, totalCount, status }: StatusBadgeProps) {
  if (status === 'stopped' || totalCount === 0) {
    return null;
  }

  const theme =
    status === 'running'
      ? 'bg-emerald-100 text-emerald-800'
      : 'bg-amber-100 text-amber-800';

  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${theme}`}>
      <span className="h-2 w-2 rounded-full bg-current" />
      {runningCount} / {totalCount} 运行中
    </span>
  );
}
