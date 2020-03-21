import { ReflectiveKey } from "./registry";
import { resolveForwardRef } from "./forward-ref";
import { readInjectableMetadata, InjectableParamMetadata } from "./metadata";
import {
  Provider,
  Type,
  ValueProvider,
  FactoryProvider,
  ClassProvider
} from "./providers";
import { invalidProviderError, noAnnotationError } from "./errors";

const _EMPTY_LIST: any[] = [];

export type NormalizedProvider<T = any> =
  | ValueProvider<T>
  | ClassProvider<T>
  | FactoryProvider<T>;

function isClassProvider(provider: any): provider is ClassProvider<any> {
  return typeof provider.useClass !== "undefined";
}

function isFactoryProvider(provider: any): provider is FactoryProvider<any> {
  return typeof provider.useFactory !== "undefined";
}

export class ResolvedProvider {
  constructor(public key: ReflectiveKey, public factory: ResolvedFactory) {}
}

export class ResolvedFactory {
  constructor(
    /**
     * Factory function which can return an instance of an object represented by a key.
     */
    public factory: Function,
    /**
     * Arguments (dependencies) to the `factory` function.
     */
    public dependencies: Dependency[]
  ) {}
}

export class Dependency {
  constructor(public key: ReflectiveKey, public optional: boolean) {}

  static fromKey(key: ReflectiveKey): Dependency {
    return new Dependency(key, false);
  }
}

export function normalizeProviders(
  providers: Provider[],
  res: Provider[]
): NormalizedProvider[] {
  providers.forEach(token => {
    if (token instanceof Type) {
      res.push({ provide: token, useClass: token });
    } else if (
      token &&
      typeof token === "object" &&
      (token as any).provide !== undefined
    ) {
      res.push(token as NormalizedProvider);
    } else if (token instanceof Array) {
      normalizeProviders(token as Provider[], res);
    } else {
      throw invalidProviderError(token);
    }
  });

  return res as NormalizedProvider[];
}

function makeFactory<T>(t: Type<T>): (args: any[]) => T {
  return (...args: any[]) => new t(...args);
}

function resolveFactory(provider: NormalizedProvider): ResolvedFactory {
  let factoryFn: Function;
  let resolvedDeps: Dependency[] = _EMPTY_LIST;
  if (isClassProvider(provider)) {
    const useClass = resolveForwardRef(provider.useClass);
    factoryFn = makeFactory(useClass);
    resolvedDeps = dependenciesFor(useClass);
  } else if (isFactoryProvider(provider)) {
    factoryFn = provider.useFactory;
    resolvedDeps = constructDependencies(provider.useFactory);
  } else {
    factoryFn = () => provider.useValue;
    resolvedDeps = _EMPTY_LIST;
  }
  return new ResolvedFactory(factoryFn, resolvedDeps);
}

function resolveProvider(provider: NormalizedProvider): ResolvedProvider {
  return new ResolvedProvider(
    ReflectiveKey.get(provider.provide),
    resolveFactory(provider)
  );
}

export function resolveProviders(providers: Provider[]): ResolvedProvider[] {
  const normalized = normalizeProviders(providers, []);
  const resolved = normalized.map(resolveProvider);
  const resolvedProviderMap = mergeResolvedProviders(resolved, new Map());

  return Array.from(resolvedProviderMap.values());
}

export function mergeResolvedProviders(
  providers: ResolvedProvider[],
  normalizedProvidersMap: Map<number, ResolvedProvider>
): Map<number, ResolvedProvider> {
  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    normalizedProvidersMap.set(provider.key.id, provider);
  }

  return normalizedProvidersMap;
}

function dependenciesFor(type: any): Dependency[] {
  const { params } = readInjectableMetadata(type);

  if (!params) return [];
  if (params.some(p => p == null)) {
    throw noAnnotationError(type, params);
  }

  return params.map(p => extractToken(p, params));
}

function constructDependencies(typeOrFunc: any): Dependency[] {
  return dependenciesFor(typeOrFunc);
}

function extractToken(
  param: InjectableParamMetadata,
  params: InjectableParamMetadata[]
) {
  const token = resolveForwardRef(param.type);

  if (token) {
    return createDependency(token, param.optional);
  }

  throw noAnnotationError(param.type, params);
}

function createDependency(token: any, optional: boolean): Dependency {
  return new Dependency(ReflectiveKey.get(token), optional);
}
