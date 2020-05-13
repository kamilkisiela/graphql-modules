import { InjectionToken } from "@graphql-modules/di";
import { ID } from "../shared/types";

export const REQUEST = new InjectionToken<any>("request");
export const RESPONSE = new InjectionToken<any>("response");
export const MODULE_ID = new InjectionToken<ID>("module-id");
