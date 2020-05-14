import { DocumentNode } from "graphql";
import { ReflectiveInjector, Injector, Provider } from "@graphql-modules/di";
import { moduleFactory, ModuleFactory } from "./factory";
import { ID, Single } from "../shared/types";
import { TypeDefs, Resolvers } from "./types";
import { ModuleMetadata } from "./metadata";
import { ResolveMiddlewareMap } from "../shared/middleware";

export interface ModuleConfig {
  id: ID;
  dirname?: string;
  typeDefs: TypeDefs;
  resolvers?: Resolvers;
  resolveMiddlewares?: ResolveMiddlewareMap;
  providers?: Provider[];
}

export interface ModuleContext {
  injector: Injector;
  moduleId: ID;
}

export interface GraphQLModule {
  id: ID;
  providers?: Provider[];
  typeDefs: DocumentNode[];
  metadata: ModuleMetadata;
  factory: ModuleFactory;
}

export type ResolvedGraphQLModule = {
  injector: ReflectiveInjector;
  singletonProviders: Array<Provider<any>>;
  operationProviders: Array<Provider<any>>;
  resolvers?: Single<Resolvers>;
} & Omit<GraphQLModule, "factory">;

export function createModule(config: ModuleConfig) {
  return moduleFactory(config);
}
