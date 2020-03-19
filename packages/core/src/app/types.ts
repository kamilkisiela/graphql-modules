import { Provider } from "injection-js";
import { GraphQLModule } from "../module/module";
import { ModuleContext } from "../module/types";
import { ID } from "../shared/types";

export interface AppConfig {
  modules: GraphQLModule[];
  providers?: Provider[];
}

export type ModulesMap = Map<ID, GraphQLModule>;

export interface AppContext {
  ɵgetModuleContext(moduleId: ID): ModuleContext;
}

// Kamil: somehow our build process doesn't emit `types.d.ts` file, this should force it...
export function ɵtypes() {}