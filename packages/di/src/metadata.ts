import { Type, ProviderOptions } from "./providers";

export const INJECTABLE = Symbol("di:injectable");

export interface InjectableParamMetadata {
  type: Type<any>;
  optional: boolean;
}

export interface InjectableMetadata {
  params: InjectableParamMetadata[];
  options?: ProviderOptions;
}

export function readInjectableMetadata(type: Type<any>): InjectableMetadata {
  return (type as any)[INJECTABLE];
}
