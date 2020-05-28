import { InjectionToken } from "@graphql-modules/di";
import { ID } from "../shared/types";

export const CONTEXT = new InjectionToken<any>("context");
export const MODULE_ID = new InjectionToken<ID>("module-id");
