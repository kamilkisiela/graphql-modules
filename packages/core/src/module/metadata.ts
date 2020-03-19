import { DocumentNode, visit } from "graphql";
import { ModuleConfig } from "./module";
import { ToDo, ID } from "../shared/types";

export type TypesRegistry = Record<string, string[]>; // we need unions and other kinds

export type Registry = {
  types?: TypesRegistry;
};

export interface ModuleMetadata {
  id: ID;
  typeDefs: DocumentNode[];
  implements?: Registry;
  extends?: Registry;
  provides?: ToDo;
  dirname?: string;
}

export function metadataFactory(
  typeDefs: DocumentNode[],
  config: ModuleConfig
): ModuleMetadata {
  const implementedTypes: TypesRegistry = {};
  const extendedTypes: TypesRegistry = {};

  for (const doc of typeDefs) {
    visit(doc, {
      ObjectTypeDefinition(node) {
        if (node.fields) {
          implementedTypes[node.name.value] = node.fields.map(
            field => field.name.value
          );
        }
      },
      ObjectTypeExtension(node) {
        if (node.fields) {
          extendedTypes[node.name.value] = [];

          node.fields.forEach(field => {
            extendedTypes[node.name.value].push(field.name.value);
          });
        }
      }
    });
  }

  return {
    id: config.id,
    typeDefs,
    implements: {
      types: implementedTypes
    },
    extends: {
      types: extendedTypes
    },
    dirname: config.dirname
  };
}
