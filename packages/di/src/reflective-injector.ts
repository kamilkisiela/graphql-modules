import { Provider } from "./providers";
import { Injector, THROW_IF_NOT_FOUND } from "./injector";
import { ReflectiveKey } from "./registry";
import {
  ResolvedProvider,
  ResolvedFactory,
  Dependency,
  resolveProviders
} from "./resolution";
import { cyclicDependencyError, instantiationError, noProviderError } from './errors';

const UNDEFINED = new Object();

export class ReflectiveInjector {
  _constructionCounter: number = 0;
  public _providers: ResolvedProvider[];
  public _parent: Injector | null;
  public _fallback: Injector | null;

  keyIds: number[];
  objs: any[];

  constructor(
    _providers: Provider[],
    _parent?: Injector,
    _fallback?: Injector
  ) {
    this._providers = resolveProviders(_providers);
    this._parent = _parent || null;
    this._fallback = _fallback || null;

    const len = this._providers.length;

    this.keyIds = new Array(len);
    this.objs = new Array(len);

    for (let i = 0; i < len; i++) {
      this.keyIds[i] = this._providers[i].key.id;
      this.objs[i] = UNDEFINED;
    }
  }

  get parent(): Injector | null {
    return this._parent;
  }

  get(token: any, notFoundValue: any = THROW_IF_NOT_FOUND): any {
    return this._getByKey(ReflectiveKey.get(token), notFoundValue);
  }

  private _getByKey(key: ReflectiveKey, notFoundValue: any): any {
    if (key === INJECTOR_KEY) {
      return this;
    }

    return this._getByKeyDefault(key, notFoundValue);
  }

  _getByKeyDefault(key: ReflectiveKey, notFoundValue: any): any {
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

    if (inj !== null) {
      if (this._fallback) {
        const resolved = inj.get(key.token, null);

        if (resolved) {
          return resolved;
        }
      } else {
        return inj.get(key.token, notFoundValue);
      }
    }

    // search in fallback Injector
    if (this._fallback) {
      inj = this._fallback;

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
    for (let i = 0; i < this.keyIds.length; i++) {
      if (this.keyIds[i] === keyId) {
        if (this.objs[i] === UNDEFINED) {
          this.objs[i] = this._new(this._providers[i]);
        }

        return this.objs[i];
      }
    }

    return UNDEFINED;
  }

  private _new(provider: ResolvedProvider): any {
    if (this._constructionCounter++ > this._getMaxNumberOfObjects()) {
      throw cyclicDependencyError(this, provider.key);
    }
    return this._instantiateProvider(provider);
  }

  private _instantiateProvider(provider: ResolvedProvider): any {
    return this._instantiate(provider, provider.factory);
  }

  private _instantiate(
    provider: ResolvedProvider,
    resolvedFactory: ResolvedFactory
  ): any {
    const factory = resolvedFactory.factory;

    let deps: any[];
    try {
      deps = resolvedFactory.dependencies.map(dep =>
        this._getByReflectiveDependency(dep)
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
      throw instantiationError(this, e, e.stack, provider.key);
    }

    return obj;
  }

  private _getByReflectiveDependency(dep: Dependency): any {
    return this._getByKey(dep.key, dep.optional ? null : THROW_IF_NOT_FOUND);
  }

  private _getMaxNumberOfObjects(): number {
    return this.objs.length;
  }

  _throwOrNull(key: ReflectiveKey, notFoundValue: any): any {
    if (notFoundValue !== THROW_IF_NOT_FOUND) {
      return notFoundValue;
    }

    throw noProviderError(this, key);
  }
}

const INJECTOR_KEY = ReflectiveKey.get(Injector);
