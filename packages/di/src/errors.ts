import { InjectableParamMetadata } from "./metadata";
import { Type } from "./providers";
import {
  stringify,
  wrappedError,
  ERROR_ORIGINAL_ERROR,
  getOriginalError,
} from "./utils";
import { ReflectiveInjector } from "./injector";
import { Key } from "./registry";

export function invalidProviderError(provider: any) {
  return Error(
    `Invalid provider - only instances of Provider and Type are allowed, got: ${provider}`
  );
}

export function noAnnotationError(
  typeOrFunc: Type<any> | Function,
  params: InjectableParamMetadata[]
): Error {
  const signature: string[] = [];

  for (let i = 0, len = params.length; i < len; i++) {
    const parameter = params[i];
    if (!parameter.type) {
      signature.push("?");
    } else {
      signature.push(stringify(parameter.type));
    }
  }

  return Error(
    "Cannot resolve all parameters for '" +
      stringify(typeOrFunc) +
      "'(" +
      signature.join(", ") +
      "). " +
      "Make sure that all the parameters are decorated with Inject or have valid type annotations and that '" +
      stringify(typeOrFunc) +
      "' is decorated with Injectable."
  );
}

export function cyclicDependencyError(
  injector: ReflectiveInjector,
  key: Key
): InjectionError {
  return injectionError(injector, key, function (this: InjectionError) {
    return `Cannot instantiate cyclic dependency!${constructResolvingPath(
      this.keys
    )}`;
  });
}

export function noProviderError(
  injector: ReflectiveInjector,
  key: Key
): InjectionError {
  return injectionError(injector, key, function (this: InjectionError) {
    const first = stringify(this.keys[0].token);
    return `No provider for ${first}!${constructResolvingPath(this.keys)}`;
  });
}

export function instantiationError(
  injector: ReflectiveInjector,
  originalException: any,
  key: Key
): InjectionError {
  return injectionError(
    injector,
    key,
    function (this: InjectionError) {
      const first = stringify(this.keys[0].token);
      return `${
        getOriginalError(this).message
      }: Error during instantiation of ${first}!${constructResolvingPath(
        this.keys
      )}.`;
    },
    originalException
  );
}

export interface InjectionError extends Error {
  keys: Key[];
  injectors: ReflectiveInjector[];
  constructResolvingMessage: (this: InjectionError) => string;
  addKey(injector: ReflectiveInjector, key: Key): void;
}

function injectionError(
  injector: ReflectiveInjector,
  key: Key,
  constructResolvingMessage: (this: InjectionError) => string,
  originalError?: Error
): InjectionError {
  const error = (originalError
    ? wrappedError("", originalError)
    : Error()) as InjectionError;
  error.addKey = addKey;
  error.keys = [key];
  error.injectors = [injector];
  error.constructResolvingMessage = constructResolvingMessage;
  error.message =
    error.constructResolvingMessage() + ` - in ${injector.displayName}`;
  (error as any)[ERROR_ORIGINAL_ERROR] = originalError;
  return error;
}

function constructResolvingPath(keys: any[]): string {
  if (keys.length > 1) {
    const reversed = findFirstClosedCycle(keys.slice().reverse());
    const tokenStrs = reversed.map((k) => stringify(k.token));
    return " (" + tokenStrs.join(" -> ") + ")";
  }

  return "";
}

function findFirstClosedCycle(keys: any[]): any[] {
  const res: any[] = [];
  for (let i = 0; i < keys.length; ++i) {
    if (res.indexOf(keys[i]) > -1) {
      res.push(keys[i]);
      return res;
    }
    res.push(keys[i]);
  }
  return res;
}

function addKey(
  this: InjectionError,
  injector: ReflectiveInjector,
  key: Key
): void {
  this.injectors.push(injector);
  this.keys.push(key);
  this.message = this.constructResolvingMessage();
}
