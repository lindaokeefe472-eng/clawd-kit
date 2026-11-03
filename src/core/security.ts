// TypeScript AST-based security scanner for model-authored components (both styles).
// clawd: no value imports at all (everything comes through api) and no direct seeding/boil control.
import ts from 'typescript';

const FORBIDDEN_GLOBALS = new Set([
  'process',
  'globalThis',
  'window',
  'global',
  'eval',
  'Function',
  'fetch',
  'WebSocket',
  'setTimeout',
  'setInterval',
  'setImmediate',
  'clearTimeout',
  'clearInterval',
  'clearImmediate',
  'child_process',
  'fs',
  'require',
  'document',
  'self',
  'Reflect',
  'Proxy',
  'XMLHttpRequest',
  'importScripts',
  'Worker',
  'localStorage',
]);

/** Engine-managed randomness: components must not reseed or move the boil clock */
const CLAWD_FORBIDDEN = new Set(['randomSeed', 'setBoil', 'boilSeed', 'random']);

export interface SecurityOptions {
  style?: 'clawd' | 'pixel';
}

const FORBIDDEN_PROPERTIES = new Set([
  'constructor',
  'prototype',
  '__proto__',
]);

const FORBIDDEN_DYNAMIC_KEYS = new Set([
  'key',
  'prop',
  'property',
  'propName',
  'attr',
  'attribute',
  'field',
  'member',
  'method',
  'cmd',
]);

function isSafeIndexExpression(expr: ts.Expression): boolean {
  if (ts.isNumericLiteral(expr)) return true;
  if (ts.isIdentifier(expr)) {
    if (FORBIDDEN_DYNAMIC_KEYS.has(expr.text)) return false;
    return true;
  }
  if (ts.isBinaryExpression(expr)) {
    const op = expr.operatorToken.kind;
    const isMathOp =
      op === ts.SyntaxKind.PlusToken ||
      op === ts.SyntaxKind.MinusToken ||
      op === ts.SyntaxKind.AsteriskToken ||
      op === ts.SyntaxKind.SlashToken ||
      op === ts.SyntaxKind.PercentToken ||
      op === ts.SyntaxKind.LessThanLessThanToken ||
      op === ts.SyntaxKind.GreaterThanGreaterThanToken ||
      op === ts.SyntaxKind.BarToken ||
      op === ts.SyntaxKind.AmpersandToken ||
      op === ts.SyntaxKind.CaretToken;
    return isMathOp && isSafeIndexExpression(expr.left) && isSafeIndexExpression(expr.right);
  }
  if (ts.isPrefixUnaryExpression(expr)) return isSafeIndexExpression(expr.operand);
  if (ts.isParenthesizedExpression(expr)) return isSafeIndexExpression(expr.expression);
  if (ts.isElementAccessExpression(expr)) return isSafeIndexExpression(expr.argumentExpression);
  if (ts.isPropertyAccessExpression(expr)) {
    if (expr.name.text === 'length') return true;
    if (ts.isIdentifier(expr.expression) && expr.expression.text === 'Math') return true;
  }
  if (ts.isConditionalExpression(expr)) {
    return isSafeIndexExpression(expr.whenTrue) && isSafeIndexExpression(expr.whenFalse);
  }
  if (ts.isCallExpression(expr)) {
    return expr.arguments.every(isSafeIndexExpression);
  }
  return false;
}

/** Validate model-generated TypeScript component source code before importing or running */
export function validateComponentSource(sourceText: string, fileName = 'component.ts', opts: SecurityOptions = {}): void {
  const clawd = opts.style === 'clawd';
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  function checkNode(node: ts.Node): void {
    // 1. Check imports: only allow engine relative paths
    if (ts.isImportDeclaration(node)) {
      const specifier = node.moduleSpecifier;
      if (ts.isStringLiteral(specifier)) {
        const p = specifier.text;
        const cl = node.importClause;
        const nb = cl?.namedBindings;
        const typeOnly = cl !== undefined && (cl.isTypeOnly || (!cl.name && nb !== undefined && ts.isNamedImports(nb) && nb.elements.every((e) => e.isTypeOnly)));
        if (clawd && !typeOnly) throw new Error(`Security violation: forbidden import "${p}". clawd components may only use "import type"; drawing tools come through api.`);
        const isAllowed =
          /^(?:\.\.\/)+src\/(?:engine|core|styles)\//.test(p) ||
          /^(?:\.\.\/)+engine\//.test(p) ||
          p.startsWith('./') ||
          p.startsWith('../src/engine/');
        if (!isAllowed) {
          throw new Error(`Security violation: forbidden import "${p}". Only engine imports are allowed.`);
        }
      } else {
        throw new Error('Security violation: dynamic import specifier');
      }
    }

    // 2. Reject dynamic import()
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      throw new Error('Security violation: dynamic import() is forbidden');
    }

    // 3. Reject forbidden property access (dot notation)
    if (ts.isPropertyAccessExpression(node)) {
      const propName = node.name.text;
      if (propName === 'random' && ts.isIdentifier(node.expression) && node.expression.text === 'Math') {
        throw new Error('Security violation: Math.random is forbidden (use api.jit / api.hash)');
      }
      if (ts.isMetaProperty(node.expression)) throw new Error('Security violation: import.meta is forbidden');
      if (FORBIDDEN_PROPERTIES.has(propName)) {
        throw new Error(`Security violation: forbidden property: ${propName}`);
      }
    }

    // 4. Reject bracket element access if not a constant literal, or if accessing forbidden properties
    if (ts.isElementAccessExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ThisKeyword) {
        throw new Error('Security violation: computed property access on "this" is forbidden');
      }
      const arg = node.argumentExpression;
      if (ts.isStringLiteral(arg)) {
        if (FORBIDDEN_PROPERTIES.has(arg.text)) {
          throw new Error(`Security violation: forbidden property: ${arg.text}`);
        }
      } else if (!isSafeIndexExpression(arg)) {
        throw new Error(`Security violation: dynamic computed property access is forbidden in "${node.getText()}" (expression: "${arg.getText()}", kind: ${ts.SyntaxKind[arg.kind]})`);
      }
    }

    // 5. Reject forbidden global identifiers (excluding property definitions / imports)
    if (ts.isIdentifier(node)) {
      const name = node.text;
      if (clawd && CLAWD_FORBIDDEN.has(name)) {
        const parent = node.parent;
        const isPropName = parent && ts.isPropertyAccessExpression(parent) && parent.name === node && !(ts.isIdentifier(parent.expression) && parent.expression.text === 'api');
        if (!isPropName) throw new Error(`Security violation: forbidden identifier: ${name} (seeding is engine-managed; use api.subSeed)`);
      }
      if (FORBIDDEN_GLOBALS.has(name)) {
        const parent = node.parent;
        // Allow if it's the right-hand name in an allowed property access (e.g., obj.process would be checked by property access)
        const isPropName = parent && ts.isPropertyAccessExpression(parent) && parent.name === node;
        const isImportClause = parent && (ts.isImportSpecifier(parent) || ts.isImportClause(parent));
        if (!isPropName && !isImportClause) {
          throw new Error(`Security violation: forbidden identifier: ${name}`);
        }
      }
    }

    // 6. Reject top-level mutable variables (let/var)
    if (node.parent === sourceFile && ts.isVariableStatement(node)) {
      const isConst = (node.declarationList.flags & ts.NodeFlags.Const) !== 0;
      if (!isConst) {
        throw new Error('Security violation: mutable top-level variable (let/var). Top-level variables must be const.');
      }
    }

    ts.forEachChild(node, checkNode);
  }

  checkNode(sourceFile);
}
