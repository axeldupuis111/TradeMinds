/**
 * Minimal class-name merger — filters falsy values and joins with a space.
 * Equivalent to clsx without a dependency.
 */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
