import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(webRoot, "src");
const canvasAgentRoot = path.join(webRoot, "..", "canvas-agent", "src");
const scanRoots = [path.join(srcRoot, "app", "(user)"), path.join(srcRoot, "components"), path.join(srcRoot, "services")];
const excludedFiles = new Set();
const dictionaryFiles = ["i18n.ts", "i18n-workbench.ts", "i18n-canvas.ts", "i18n-shared.ts"].map((name) => path.join(srcRoot, "lib", name)).filter(fs.existsSync);
const han = /[\u3400-\u9fff]/u;
const uiPropertyNames = new Set(["ariaLabel", "cancelText", "content", "description", "detail", "empty", "extra", "label", "message", "okText", "placeholder", "text", "title", "tooltip"]);
const localizedCallName = /(?:^|\.)(?:t|.*Text|.*Label|.*Message|localize.*|translate.*)$/;
const globalDictionaryNames = new Set(["coreZhToEn", "workbenchZhToEn", "canvasZhToEn", "sharedZhToEn"]);

function parse(file) {
    const text = fs.readFileSync(file, "utf8");
    return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
}

function propertyName(node) {
    if (!node) return "";
    if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return node.text;
    return node.getText();
}

function objectKeys(variableNames) {
    const keys = new Set();
    for (const file of dictionaryFiles) {
        const source = parse(file);
        function visit(node) {
            if (ts.isVariableDeclaration(node) && variableNames.has(node.name.getText(source))) {
                let initializer = node.initializer;
                while (initializer && (ts.isAsExpression(initializer) || ts.isSatisfiesExpression(initializer))) initializer = initializer.expression;
                if (initializer && ts.isObjectLiteralExpression(initializer)) {
                    for (const item of initializer.properties) {
                        if (ts.isPropertyAssignment(item)) keys.add(propertyName(item.name));
                        if (ts.isShorthandPropertyAssignment(item)) keys.add(item.name.text);
                    }
                }
            }
            ts.forEachChild(node, visit);
        }
        visit(source);
    }
    return keys;
}

function dictionaryKeys() {
    return objectKeys(globalDictionaryNames);
}

function walkFiles(dir, result = []) {
    if (!fs.existsSync(dir)) return result;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walkFiles(full, result);
        else if (/\.(?:ts|tsx)$/.test(entry.name) && !/\.(?:test|spec)\.(?:ts|tsx)$/.test(entry.name)) result.push(full);
    }
    return result;
}

function normalized(value) {
    return value.replace(/\s+/g, " ").trim();
}

function hasNoI18nAncestor(node) {
    const attribute = ts.isJsxAttribute(node);
    let current = node.parent;
    while (current && !ts.isSourceFile(current)) {
        if (attribute && (ts.isJsxOpeningElement(current) || ts.isJsxSelfClosingElement(current))) {
            return current.attributes.properties.some((item) => ts.isJsxAttribute(item) && item.name.getText() === "data-no-i18n");
        }
        if (ts.isJsxElement(current)) {
            if (current.openingElement.attributes.properties.some((item) => ts.isJsxAttribute(item) && item.name.getText() === "data-no-i18n")) return true;
        }
        current = current.parent;
    }
    return false;
}

function isExplicitlyLocalized(node) {
    let current = node.parent;
    while (current && !ts.isSourceFile(current)) {
        if (ts.isCallExpression(current) && localizedCallName.test(current.expression.getText())) return true;
        if (ts.isConditionalExpression(current) && /\blanguage\b/.test(current.condition.getText())) return true;
        if (ts.isIfStatement(current) && /\blanguage\b/.test(current.expression.getText())) return true;
        if (ts.isFunctionLike(current)) return false;
        current = current.parent;
    }
    return false;
}

function isUiSink(node) {
    let current = node.parent;
    while (current && !ts.isSourceFile(current)) {
        if (ts.isJsxElement(current) || ts.isJsxSelfClosingElement(current) || ts.isJsxFragment(current)) return true;
        if (ts.isPropertyAssignment(current) && uiPropertyNames.has(propertyName(current.name))) return true;
        if (ts.isCallExpression(current)) {
            const callee = current.expression.getText();
            if (/\b(?:message|notification|Modal|confirm|alert|Error)\b/.test(callee)) return true;
        }
        if (ts.isFunctionLike(current)) return false;
        current = current.parent;
    }
    return false;
}

function isModelInstruction(node, file) {
    if (file !== path.join(srcRoot, "services", "api", "prompt.ts")) return false;
    let current = node.parent;
    while (current && !ts.isSourceFile(current)) {
        if (ts.isVariableDeclaration(current) && current.name.getText() === "messages") return true;
        current = current.parent;
    }
    return false;
}

const keys = dictionaryKeys();
const findings = [];
for (const file of scanRoots.flatMap((root) => walkFiles(root)).filter((item) => !excludedFiles.has(item))) {
    const source = parse(file);
    function add(node, value, kind) {
        const text = normalized(value);
        if (!text || !han.test(text) || keys.has(text) || hasNoI18nAncestor(node) || isExplicitlyLocalized(node) || isModelInstruction(node, file)) return;
        const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
        findings.push({ file: path.relative(webRoot, file).replaceAll("\\", "/"), line: line + 1, kind, text });
    }
    function visit(node) {
        if (ts.isJsxText(node)) add(node, node.text, "jsx-text");
        else if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) add(node, node.initializer.text, `attribute:${node.name.getText(source)}`);
        else if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !ts.isJsxAttribute(node.parent) && isUiSink(node)) add(node, node.text, "ui-string");
        else if (ts.isTemplateExpression(node) && isUiSink(node)) add(node, node.getText(source).slice(1, -1), "ui-template");
        ts.forEachChild(node, visit);
    }
    visit(source);
}

const canvasAgentErrorKeys = objectKeys(new Set(["canvasAgentErrorZhToEn"]));
const canvasAgentErrorPrefixes = objectKeys(new Set(["canvasAgentErrorPrefixZhToEn"]));
for (const file of walkFiles(canvasAgentRoot)) {
    const source = parse(file);
    function visitAgentError(node) {
        if (ts.isNewExpression(node) && node.expression.getText(source) === "Error" && node.arguments?.length) {
            const argument = node.arguments[0];
            let value = "";
            let known = true;
            if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) {
                value = normalized(argument.text);
                known = !han.test(value) || canvasAgentErrorKeys.has(value);
            } else if (ts.isTemplateExpression(argument)) {
                value = normalized(argument.head.text);
                known = !han.test(value) || canvasAgentErrorPrefixes.has(value);
            }
            if (value && !known) {
                const { line } = source.getLineAndCharacterOfPosition(argument.getStart(source));
                findings.push({ file: path.relative(path.join(webRoot, ".."), file).replaceAll("\\", "/"), line: line + 1, kind: "canvas-agent-error", text: value });
            }
        }
        ts.forEachChild(node, visitAgentError);
    }
    visitAgentError(source);
}

const unique = [...new Map(findings.map((item) => [`${item.file}:${item.line}:${item.kind}:${item.text}`, item])).values()];
if (process.argv.includes("--summary")) {
    const byFile = Object.entries(
        unique.reduce((result, item) => {
            result[item.file] = (result[item.file] ?? 0) + 1;
            return result;
        }, {}),
    ).sort((a, b) => b[1] - a[1]);
    console.log(JSON.stringify({ untranslated: unique.length, dictionaryEntries: keys.size, byFile }, null, 2));
    process.exit(0);
}
if (unique.length) {
    console.error(`i18n audit found ${unique.length} untranslated user-interface strings:`);
    for (const item of unique) console.error(`${item.file}:${item.line} [${item.kind}] ${item.text}`);
    process.exit(1);
}
console.log(`i18n audit passed (${keys.size} dictionary entries across ${dictionaryFiles.length} files).`);
