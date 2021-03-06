import { Type, ProviderOptions, isType, InjectionToken } from "./providers";
import {
  INJECTABLE,
  InjectableMetadata,
  readInjectableMetadata,
  ensureInjectableMetadata,
} from "./metadata";
import { Injector } from "./injector";

export function Injectable(options?: ProviderOptions): ClassDecorator {
  return (target) => {
    const params: Type<any>[] = (
      Reflect.getMetadata("design:paramtypes", target) || []
    ).map((param: any) => (isType(param) ? param : null));

    const existingMeta = readInjectableMetadata(target as any);

    const meta: InjectableMetadata = {
      params: params.map((param, i) => {
        const existingParam = existingMeta?.params?.[i];
        return {
          type: existingParam?.type || param,
          optional: typeof existingParam?.optional === "boolean" ? existingParam.optional : false,
        };
      }),
      options: {
        ...(existingMeta?.options || {}),
        ...(options || {}),
      },
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

export function Inject(type: Type<any> | InjectionToken<any>): ParameterDecorator {
  return (target, _, index) => {
    ensureInjectableMetadata(target as any);
    const meta = readInjectableMetadata(target as any);

    meta.params[index] = {
      type,
      optional: false,
    };
  };
}

export type ExecutionContext<TContext = {}> = {
  injector: Injector;
} & TContext;

export function ExecutionContext(): PropertyDecorator {
  return (obj, propertyKey) => {
    const target = obj.constructor;

    ensureInjectableMetadata(target as any);

    const meta = readInjectableMetadata(target as any);

    if (!meta.options) {
      meta.options = {};
    }

    if (!meta.options.executionContextIn) {
      meta.options!.executionContextIn = [];
    }

    meta.options!.executionContextIn.push(propertyKey);
  };
}
