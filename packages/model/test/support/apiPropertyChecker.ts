/**
 * Static check that every model property's @ApiProperty options agree with
 * its declared TypeScript type.
 *
 * Runtime reflection can't do this: the model is compiled without
 * decorator metadata, and even with it TypeScript only records `Array` or
 * `Object` for arrays, maps and unions. So this reads the source with the
 * TypeScript compiler instead.
 *
 * Rules (the `rule` in each finding):
 *   missing-decorator    property has no @ApiProperty / @ApiTimestamp
 *   required-missing     no explicit `required`
 *   required-mismatch    `required` disagrees with the `?` on the property
 *   description-missing  no `description`
 *   description-todo     `description` still contains a TODO
 *   array-mismatch       `isArray` / array `type` disagrees with the declared type
 *   enum-mismatch        `enum` names a different enum than the declared type
 *   enumName-missing     `enum` without `enumName`
 *   enumName-mismatch    `enumName` differs from the enum's name
 *   type-mismatch        `type` names a different type than the declared type
 *   type-object          `type: Object` used for a structured declared type
 *   map-not-documented   declared Record/index signature documented as a single value
 *   union-unchecked      declared union of different types without `oneOf`
 *   timestamp-type       timestamp (Moment/Date) not documented as a string
 */
import * as path from "path";
import ts from "typescript";

export type Finding = {
  rule: string;
  /** `<Class>.<property>`, the allow-list key together with `rule`. */
  target: string;
  location: string;
  message: string;
};

type Options = Record<string, ts.Expression>;

const PRIMITIVES: Record<string, ts.TypeFlags> = {
  String: ts.TypeFlags.StringLike,
  Number: ts.TypeFlags.NumberLike,
  Boolean: ts.TypeFlags.BooleanLike,
};
const OPEN_TYPES = new Set(["any", "unknown", "object", "Object"]);

export function checkApiProperties(packageRoot: string): Finding[] {
  const configPath = path.join(packageRoot, "tsconfig.json");
  const config = ts.getParsedCommandLineOfConfigFile(
    configPath,
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (d) => {
        throw new Error(ts.flattenDiagnosticMessageText(d.messageText, "\n"));
      },
    },
  );
  if (!config) throw new Error(`Cannot read ${configPath}`);
  const program = ts.createProgram(config.fileNames, config.options);
  const checker = program.getTypeChecker();
  const findings: Finding[] = [];
  const srcRoot = path.join(packageRoot, "src");

  for (const sf of program.getSourceFiles()) {
    if (sf.isDeclarationFile || !sf.fileName.startsWith(srcRoot)) continue;
    const visit = (node: ts.Node) => {
      if (ts.isClassDeclaration(node) && node.name) {
        for (const member of node.members) {
          if (ts.isPropertyDeclaration(member)) {
            checkProperty(node.name.text, member);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);

    function checkProperty(cls: string, prop: ts.PropertyDeclaration) {
      const name = prop.name.getText(sf);
      const report = (rule: string, message: string) => {
        const { line } = sf.getLineAndCharacterOfPosition(prop.getStart(sf));
        findings.push({
          rule,
          target: `${cls}.${name}`,
          location: `${path.relative(packageRoot, sf.fileName)}:${line + 1}`,
          message,
        });
      };

      const decorator = readDecorator(prop);
      if (!decorator) return report("missing-decorator", "no @ApiProperty");
      const { kind, options } = decorator;

      const optional = !!prop.questionToken;
      const required = options.required?.getText(sf);
      if (required === undefined) {
        report("required-missing", "no explicit `required`");
      } else if (required === "true" && optional) {
        report(
          "required-mismatch",
          "`required: true` on an optional (`?`) property",
        );
      } else if (required === "false" && !optional) {
        report(
          "required-mismatch",
          "`required: false` on a non-optional property",
        );
      }
      if (!options.description) {
        report("description-missing", "no `description`");
      } else if (/\bTODO\b/.test(options.description.getText(sf))) {
        report("description-todo", "`description` still contains a TODO");
      }

      const declared = withoutUndefined(checker.getTypeAtLocation(prop));
      const declaredText = typeText(declared);

      if (kind === "timestamp") {
        if (!isTimestamp(declaredText)) {
          report(
            "timestamp-type",
            `@ApiTimestamp on a property declared ${declaredText}`,
          );
        }
        return;
      }

      // Maps: Record<K, V> or { [key: string]: V }
      if (isMap(declared)) {
        if (!options.additionalProperties) {
          report(
            "map-not-documented",
            `declared ${declaredText} but documented without additionalProperties`,
          );
        }
        return;
      }

      const declaredElement = arrayElement(declared);
      const typeExpr = unwrapThunk(options.type);
      const documentedArray =
        options.isArray?.getText(sf) === "true" ||
        (!!typeExpr && ts.isArrayLiteralExpression(typeExpr)) ||
        (!!typeExpr &&
          ts.isStringLiteral(typeExpr) &&
          typeExpr.text === "array");
      if (!!declaredElement !== documentedArray && !options.oneOf) {
        report(
          "array-mismatch",
          `declared ${declaredText} but documented as ${documentedArray ? "an array" : "a single value"}`,
        );
        return;
      }
      const inner = declaredElement ?? declared;
      const innerText = typeText(inner);

      if (options.enum) {
        const enumExpr = unwrapThunk(options.enum);
        if (enumExpr && !ts.isArrayLiteralExpression(enumExpr)) {
          const enumName = enumExpr.getText(sf);
          const declaredEnum = enumNameOf(inner);
          if (declaredEnum !== enumName) {
            report(
              "enum-mismatch",
              `enum ${enumName} but declared ${declaredEnum ?? innerText}`,
            );
          }
          const documentedName = options.enumName;
          if (!documentedName) {
            report("enumName-missing", `enum ${enumName} without enumName`);
          } else if (
            ts.isStringLiteral(documentedName) &&
            documentedName.text !== enumName
          ) {
            report(
              "enumName-mismatch",
              `enumName "${documentedName.text}" for enum ${enumName}`,
            );
          }
        }
        return;
      }

      if (options.oneOf) return;
      if (inner.isUnion() && !isLiteralUnionOfOnePrimitive(inner)) {
        report("union-unchecked", `declared union ${innerText} without oneOf`);
        return;
      }
      if (!typeExpr) {
        report("type-mismatch", `no \`type\` for declared ${innerText}`);
        return;
      }

      // `type: "array"` + `items`: only the array-ness is checked.
      if (ts.isStringLiteral(typeExpr)) return;
      const typeNode = ts.isArrayLiteralExpression(typeExpr)
        ? typeExpr.elements[0]
        : typeExpr;
      const typeName = typeNode.getText(sf);

      if (typeName in PRIMITIVES) {
        if (inner.flags & PRIMITIVES[typeName]) return;
        if (isLiteralUnionOf(inner, PRIMITIVES[typeName])) return;
        if (typeName === "String" && isTimestamp(innerText)) return;
        report("type-mismatch", `type ${typeName} but declared ${innerText}`);
        return;
      }
      if (typeName === "Object") {
        if (!OPEN_TYPES.has(innerText)) {
          report("type-object", `type Object for declared ${innerText}`);
        }
        return;
      }
      if (isTimestamp(innerText)) {
        report("timestamp-type", `timestamp documented as ${typeName}`);
        return;
      }

      const documented = resolveSymbol(checker.getSymbolAtLocation(typeNode));
      const actual = resolveSymbol(inner.getSymbol() ?? inner.aliasSymbol);
      if (!documented || !actual || documented !== actual) {
        report("type-mismatch", `type ${typeName} but declared ${innerText}`);
      }
    }
  }

  /** Name of the enum a type belongs to (the enum itself or one member). */
  function enumNameOf(type: ts.Type): string | undefined {
    const candidates = type.isUnion() ? nonNullParts(type) : [type];
    const names = new Set(
      candidates.map((t) => {
        const symbol = t.aliasSymbol ?? t.getSymbol();
        if (!symbol) return undefined;
        if (symbol.flags & ts.SymbolFlags.EnumMember) {
          return (symbol as ts.Symbol & { parent?: ts.Symbol }).parent?.name;
        }
        return symbol.flags & ts.SymbolFlags.Enum ? symbol.name : undefined;
      }),
    );
    if (
      type.aliasSymbol?.flags &&
      type.aliasSymbol.flags & ts.SymbolFlags.Enum
    ) {
      return type.aliasSymbol.name;
    }
    const symbol = type.getSymbol();
    if (symbol && symbol.flags & ts.SymbolFlags.Enum) return symbol.name;
    return names.size === 1 ? [...names][0] : undefined;
  }

  function typeText(type: ts.Type): string {
    return type.isUnion()
      ? nonNullParts(type)
          .map((t) => checker.typeToString(t))
          .join(" | ")
      : checker.typeToString(type);
  }

  function resolveSymbol(symbol: ts.Symbol | undefined) {
    if (!symbol) return undefined;
    return symbol.flags & ts.SymbolFlags.Alias
      ? checker.getAliasedSymbol(symbol)
      : symbol;
  }

  /** Drops `undefined`/`null` from a union; keeps other unions intact. */
  function withoutUndefined(type: ts.Type): ts.Type {
    if (!type.isUnion()) return type;
    const parts = nonNullParts(type);
    return parts.length === 1 ? parts[0] : type;
  }

  function arrayElement(type: ts.Type): ts.Type | undefined {
    if (checker.isArrayType(type) || checker.isTupleType(type)) {
      return checker.getTypeArguments(type as ts.TypeReference)[0];
    }
    return undefined;
  }

  function isMap(type: ts.Type): boolean {
    if (arrayElement(type) || !(type.flags & ts.TypeFlags.Object)) return false;
    const name = type.aliasSymbol?.name;
    if (name === "Record") return true;
    return (
      !type.getSymbol()?.valueDeclaration &&
      checker.getIndexInfosOfType(type).length > 0
    );
  }

  return findings;
}

function readDecorator(
  prop: ts.PropertyDeclaration,
): { kind: "property" | "timestamp"; options: Options } | undefined {
  for (const decorator of ts.getDecorators(prop) ?? []) {
    const call = decorator.expression;
    if (!ts.isCallExpression(call)) continue;
    const callee = call.expression.getText();
    if (callee !== "ApiProperty" && callee !== "ApiTimestamp") continue;
    const options: Options = {};
    const arg = call.arguments[0];
    if (arg && ts.isObjectLiteralExpression(arg)) {
      for (const p of arg.properties) {
        if (ts.isPropertyAssignment(p))
          options[p.name.getText()] = p.initializer;
      }
    }
    return {
      kind: callee === "ApiTimestamp" ? "timestamp" : "property",
      options,
    };
  }
  return undefined;
}

function unwrapThunk(
  expr: ts.Expression | undefined,
): ts.Expression | undefined {
  if (expr && ts.isArrowFunction(expr) && !ts.isBlock(expr.body))
    return expr.body;
  return expr;
}

function isTimestamp(typeText: string): boolean {
  return (
    typeText === "Moment" || typeText === "Date" || typeText === "moment.Moment"
  );
}

function nonNullParts(type: ts.UnionType): ts.Type[] {
  return type.types.filter(
    (t) => !(t.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null)),
  );
}

function isLiteralUnionOf(type: ts.Type, flags: ts.TypeFlags): boolean {
  return type.isUnion() && nonNullParts(type).every((t) => t.flags & flags);
}

function isLiteralUnionOfOnePrimitive(type: ts.UnionType): boolean {
  return Object.values(PRIMITIVES).some((f) => isLiteralUnionOf(type, f));
}
