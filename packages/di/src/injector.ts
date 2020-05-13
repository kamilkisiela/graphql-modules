import { Type, InjectionToken, Provider } from "./providers";
import { ResolvedProvider, resolveProviders, Dependency } from "./resolution";
import { Key } from "./registry";
import {
  noProviderError,
  cyclicDependencyError,
  instantiationError,
} from "./errors";

const _THROW_IF_NOT_FOUND = new Object();
export const THROW_IF_NOT_FOUND = _THROW_IF_NOT_FOUND;
const UNDEFINED = new Object();

export abstract class Injector {
  static THROW_IF_NOT_FOUND = _THROW_IF_NOT_FOUND;
  abstract get<T>(token: Type<T> | InjectionToken<T>, notFoundValue?: any): T;
}

export class ReflectiveInjector implements Injector {
  _constructionCounter: number = 0;
  private _parent: Injector | null;
  private _fallbackParent: Injector | null;
  private _providers: ResolvedProvider[];

  private _keyIds: number[];
  private _objs: any[];

  constructor(
    providers: Provider[],
    parent?: Injector,
    fallbackParent?: Injector
  ) {
    this._parent = parent || null;
    this._fallbackParent = fallbackParent || null;
    this._providers = resolveProviders(providers);

    const len = this._providers.length;

    this._keyIds = new Array(len);
    this._objs = new Array(len);

    for (let i = 0; i < len; i++) {
      this._keyIds[i] = this._providers[i].key.id;
      this._objs[i] = UNDEFINED;
    }
  }

  get parent(): Injector | null {
    return this._parent;
  }

  get(token: any, notFoundValue: any = THROW_IF_NOT_FOUND): any {
    return this._getByKey(Key.get(token), notFoundValue);
  }

  instantiateAll() {
    this._providers.forEach((provider) => {
      this.get(provider.key);
    });
  }

  private _getByKey(key: Key, notFoundValue: any): any {
    let inj: Injector | null = this;

    function getObj() {
      while (inj instanceof ReflectiveInjector) {
        const inj_ = inj as ReflectiveInjector;
        const obj = inj_._getObjByKeyId(key.id);

        if (obj !== UNDEFINED) {
          return obj;
        }

        inj = inj_._parent;
      }
    }

    const resolvedValue = getObj();

    if (resolvedValue) {
      return resolvedValue;
    }

    // search in fallback Injector
    if (this._fallbackParent) {
      inj = this._fallbackParent;

      const resolvedFallbackValue = getObj();

      if (resolvedFallbackValue) {
        return resolvedFallbackValue;
      }
    }

    if (inj !== null) {
      return inj.get(key.token, notFoundValue);
    }

    return this._throwOrNull(key, notFoundValue);
  }

  private _getObjByKeyId(keyId: number): any {
    for (let i = 0; i < this._keyIds.length; i++) {
      if (this._keyIds[i] === keyId) {
        if (this._objs[i] === UNDEFINED) {
          this._objs[i] = this._new(this._providers[i]);
        }

        return this._objs[i];
      }
    }

    return UNDEFINED;
  }

  _throwOrNull(key: Key, notFoundValue: any): any {
    if (notFoundValue !== THROW_IF_NOT_FOUND) {
      return notFoundValue;
    } else {
      throw noProviderError(this, key);
    }
  }

  private _instantiateProvider(provider: ResolvedProvider): any {
    const factory = provider.factory.factory;

    let deps: any[];
    try {
      deps = provider.factory.dependencies.map((dep) =>
        this._getByDependency(dep)
      );
    } catch (e) {
      if (e.addKey) {
        e.addKey(this, provider.key);
      }
      throw e;
    }

    let obj: any;
    try {
      obj = factory(...deps);
    } catch (e) {
      throw instantiationError(this, e, provider.key);
    }

    return obj;
  }

  private _getByDependency(dep: Dependency): any {
    return this._getByKey(dep.key, dep.optional ? null : THROW_IF_NOT_FOUND);
  }

  private _new(provider: ResolvedProvider): any {
    if (this._constructionCounter++ > this._getMaxNumberOfObjects()) {
      throw cyclicDependencyError(this, provider.key);
    }
    return this._instantiateProvider(provider);
  }

  private _getMaxNumberOfObjects(): number {
    return this._objs.length;
  }
}
