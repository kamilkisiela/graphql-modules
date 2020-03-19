import { DocumentNode } from "graphql";
import { Injector, Provider } from "injection-js";
import { Plural, ID, Single } from "../shared/types";
import { ModuleMetadata } from "./metadata";

export type TypeDefs = Plural<DocumentNode | string>;
export type Resolvers = Plural<Record<string, any>>;

export interface ModuleConfig {
  id: ID;
  dirname?: string;
  typeDefs: TypeDefs;
  resolvers?: Resolvers;
  providers?: Provider[];
}

export interface ModuleContext {
  injector: Injector;
  moduleId: ID;
}

export interface ResolvedModule {
  id: ID;
  typeDefs: DocumentNode[];
  resolvers?: Single<Resolvers>;
  providers?: Provider[];
  metadata: ModuleMetadata;
}

// Kamil: somehow our build process doesn't emit `types.d.ts` file, this should force it...
export function ɵmodule() {}
