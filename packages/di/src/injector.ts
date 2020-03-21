import { Type, InjectionToken } from "./providers";

const _THROW_IF_NOT_FOUND = new Object();
export const THROW_IF_NOT_FOUND = _THROW_IF_NOT_FOUND;

export abstract class Injector {
  static THROW_IF_NOT_FOUND = _THROW_IF_NOT_FOUND;
  abstract get<T>(token: Type<T> | InjectionToken<T>, notFoundValue?: any): T;
}
