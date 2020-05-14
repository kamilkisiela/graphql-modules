export function flatten<T>(arr: T[]): T extends (infer A)[] ? A[] : T[] {
  return Array.prototype.concat(...arr) as any;
}

export function isDefined<T>(val: T | null | undefined): val is T {
  return !isNil(val);
}

export function isNil<T>(val: T | null | undefined): val is null | undefined {
  return val === null || typeof val === "undefined";
}

export function isObject(val: any) {
  return Object.prototype.toString.call(val) === "[object Object]";
}

export function isPrimitive(
  val: any
): val is number | string | boolean | symbol | bigint {
  return ["number", "string", "boolean", "symbol", "bigint"].includes(
    typeof val
  );
}
