export class ModuleDuplicatedError extends ExtendableBuiltin(Error) {
  constructor(message: string, ...rest: string[]) {
    super(composeMessage(message, ...rest));
    this.name = this.constructor.name;
    this.message = composeMessage(message, ...rest);
  }
}

export class ExtraResolverError extends ExtendableBuiltin(Error) {
  constructor(message: string, ...rest: string[]) {
    super(composeMessage(message, ...rest));
    this.name = this.constructor.name;
    this.message = composeMessage(message, ...rest);
  }
}

export class ResolverDuplicatedError extends ExtendableBuiltin(Error) {
  constructor(message: string, ...rest: string[]) {
    super(composeMessage(message, ...rest));
    this.name = this.constructor.name;
    this.message = composeMessage(message, ...rest);
  }
}

// helpers

export function ExtendableBuiltin<T extends Function>(cls: T): T {
  function ExtendableBuiltin(this: any) {
    cls.apply(this, arguments);
  }
  ExtendableBuiltin.prototype = Object.create(cls.prototype);
  Object.setPrototypeOf(ExtendableBuiltin, cls);

  return ExtendableBuiltin as any;
}

export function composeMessage(...lines: string[]): string {
  return lines.join("\n");
}
