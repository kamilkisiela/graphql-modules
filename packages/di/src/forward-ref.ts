import { stringify } from "./utils";
import { Type } from "./providers";

export type ForwardRefFn<T> = () => T;

export function forwardRef<T>(forwardRefFn: ForwardRefFn<T>) {
  (forwardRefFn as any).__forward_ref__ = forwardRef;
  (<any>forwardRefFn).toString = function() {
    return stringify(this());
  };
  return <Type<any>>(<any>forwardRefFn);
}

export function resolveForwardRef(type: any): any {
  if (
    typeof type === "function" &&
    type.hasOwnProperty("__forward_ref__") &&
    type.__forward_ref__ === forwardRef
  ) {
    return (type as ForwardRefFn<any>)();
  } else {
    return type;
  }
}
