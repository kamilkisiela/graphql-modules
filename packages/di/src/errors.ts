import { wrappedError, ERROR_ORIGINAL_ERROR, getOriginalError } from "./utils";
import { stringify } from "./utils";
import { Type } from "./providers";

import { InjectableParamMetadata } from "./metadata";
import { ReflectiveInjector } from "./reflective-injector";
import { ReflectiveKey } from "./registry";

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

function constructResolvingPath(keys: any[]): string {
  if (keys.length > 1) {
    const reversed = findFirstClosedCycle(keys.slice().reverse());
    const tokenStrs = reversed.map(k => stringify(k.token));
    return " (" + tokenStrs.join(" -> ") + ")";
  }

  return "";
}

export interface InjectionError extends Error {
  keys: ReflectiveKey[];
  injectors: ReflectiveInjector[];
  constructResolvingMessage: (this: InjectionError) => string;
  addKey(injector: ReflectiveInjector, key: ReflectiveKey): void;
}

function injectionError(
  injector: ReflectiveInjector,
  key: ReflectiveKey,
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
  error.message = error.constructResolvingMessage();
  (error as any)[ERROR_ORIGINAL_ERROR] = originalError;
  return error;
}

function addKey(
  this: InjectionError,
  injector: ReflectiveInjector,
  key: ReflectiveKey
): void {
  this.injectors.push(injector);
  this.keys.push(key);
  this.message = this.constructResolvingMessage();
}

export function noProviderError(
  injector: ReflectiveInjector,
  key: ReflectiveKey
): InjectionError {
  return injectionError(injector, key, function(this: InjectionError) {
    const first = stringify(this.keys[0].token);
    return `No provider for ${first}!${constructResolvingPath(this.keys)}`;
  });
}

/**
 * Thrown when dependencies form a cycle.
 */
export function cyclicDependencyError(
  injector: ReflectiveInjector,
  key: ReflectiveKey
): InjectionError {
  return injectionError(injector, key, function(this: InjectionError) {
    return `Cannot instantiate cyclic dependency!${constructResolvingPath(
      this.keys
    )}`;
  });
}

/**
 * Thrown when a constructing type returns with an Error.
 *
 * The `InstantiationError` class contains the original error plus the dependency graph which caused
 * this object to be instantiated.
 * 
 * try {
 *   injector.get(A);
 * } catch (e) {
 *   expect(e instanceof InstantiationError).toBe(true);
 *   expect(e.originalException.message).toEqual("message");
 *   expect(e.originalStack).toBeDefined();
 * }
 * ```
 */
export function instantiationError(
  injector: ReflectiveInjector,
  originalException: any,
  _originalStack: any,
  key: ReflectiveKey
): InjectionError {
  return injectionError(
    injector,
    key,
    function(this: InjectionError) {
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

  for (let i = 0, ii = params.length; i < ii; i++) {
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
