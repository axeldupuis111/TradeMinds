type SkeletonProps = {
  className?: string;
  rounded?: boolean;
};

export function Skeleton({ className = "", rounded = false }: SkeletonProps) {
  return (
    <div
      className={`skeleton ${rounded ? "rounded-full" : "rounded"} ${className}`}
    />
  );
}
