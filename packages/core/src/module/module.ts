import { DocumentNode } from "graphql";
import { ReflectiveInjector, Injector, Provider } from "@graphql-modules/di";
import { moduleFactory, ModuleFactory } from "./factory";
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
  factory: ModuleFactory;
}

export type ResolvedGraphQLModule = {
  injector: ReflectiveInjector;
  singletonProviders: Array<Provider<any>>;
  operationProviders: Array<Provider<any>>;
} & Omit<GraphQLModule, "factory">;

export function createModule(config: ModuleConfig) {
  return moduleFactory(config);
}
