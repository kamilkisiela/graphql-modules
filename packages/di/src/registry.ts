import { stringify } from "./utils";
import { resolveForwardRef } from "./forward-ref";
import { Type } from "./providers";

export class ReflectiveKey {
  constructor(public token: Type<any>, public id: number) {
    if (!token) {
      throw new Error("Token must be defined!");
    }
  }

  /**
   * Returns a stringified token.
   */
  get displayName(): string {
    return stringify(this.token);
  }

  static get(token: Object): ReflectiveKey {
    return _globalKeyRegistry.get(resolveForwardRef(token));
  }
}

class KeyRegistry {
  private _allKeys = new Map<Object, ReflectiveKey>();

  get(token: Type<any>): ReflectiveKey {
    if (token instanceof ReflectiveKey) {
      return token;
    }

    if (this._allKeys.has(token)) {
      return this._allKeys.get(token)!;
    }

    const newKey = new ReflectiveKey(token, _globalKeyRegistry.numberOfKeys);
    this._allKeys.set(token, newKey);
    return newKey;
  }

  get numberOfKeys(): number {
    return this._allKeys.size;
  }
}

const _globalKeyRegistry = new KeyRegistry();
