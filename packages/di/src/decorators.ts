import { Type, ProviderOptions, isType } from "./providers";
import {
  INJECTABLE,
  InjectableMetadata,
  readInjectableMetadata,
} from "./metadata";

export function Injectable(options?: ProviderOptions): ClassDecorator {
  return (target) => {
    const params: Type<any>[] = (
      Reflect.getMetadata("design:paramtypes", target) || []
    ).map((param: any) => (isType(param) ? param : null));

    const meta: InjectableMetadata = {
      params: params.map((param) => {
        return {
          type: param,
          optional: false,
        };
      }),
      options,
    };

    (target as any)[INJECTABLE] = meta;

    return target;
  };
}

export function Optional(): ParameterDecorator {
  return (target, _, index) => {
    const meta = readInjectableMetadata(target as any);
    meta.params[index].optional = true;
  };
}

export function Inject(type: Type<any>): ParameterDecorator {
  return (target, _, index) => {
    const meta = readInjectableMetadata(target as any);
    meta.params[index].type = type;
  };
}
