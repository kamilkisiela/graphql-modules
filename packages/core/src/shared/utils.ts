export function flatten<T>(arr: T[]): T extends (infer A)[] ? A[] : T[] {
  return Array.prototype.concat(...arr) as any;
}

export function isDefined<T>(val: T | null | undefined): val is T {
  return !!val;
}
