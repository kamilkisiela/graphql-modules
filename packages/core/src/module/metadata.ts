import { ModuleConfig } from "./types";
import { ToDo } from "../shared/types";

export type TypesRegistry = Record<string, string[]>; // we need unions and other kinds

export type Implements = {
  types?: TypesRegistry;
};

export type Extends = {
  types?: TypesRegistry;
};

export interface ModuleMetadata {
  implements?: Implements;
  extends?: Extends;
  provides?: ToDo;
  dirname?: string;
}

export function metadataFactory(config: ModuleConfig): ModuleMetadata {
  return {
    implements: {},
    extends: {},
    dirname: config.dirname
  };
}
