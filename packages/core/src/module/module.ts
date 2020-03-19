import { ModuleConfig } from "./types";
import { moduleFactory } from "./factory";

export function createModule(config: ModuleConfig) {
  return moduleFactory(config);
}

export type GraphQLModule = ReturnType<typeof createModule>;
