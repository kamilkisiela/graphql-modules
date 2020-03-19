import { DocumentNode } from "graphql";
import { Injector, Provider } from "injection-js";
import { moduleFactory } from "./factory";
import { ID, Single } from "../shared/types";
import { TypeDefs, Resolvers } from "./types";
import { ModuleMetadata } from "./metadata";

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

export interface GraphQLModule {
  id: ID;
  typeDefs: DocumentNode[];
  resolvers?: Single<Resolvers>;
  providers?: Provider[];
  metadata: ModuleMetadata;
}

export function createModule(config: ModuleConfig): GraphQLModule {
  return moduleFactory(config);
}
