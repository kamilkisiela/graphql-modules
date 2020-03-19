import { InjectionToken } from "injection-js";
import { ModulesMap } from "./app";
import { ID } from "../shared/types";

export const REQUEST = new InjectionToken("request");
export const RESPONSE = new InjectionToken("response");
export const MODULES = new InjectionToken<ModulesMap>("modules-map");
export const MODULE_ID = new InjectionToken<ID>("module-id");
