const stripExt = (p: string): string => p.replace(/\.(ts|tsx|js|jsx)$/, "");

const dirParts = (file: string): string[] => file.split("/").slice(0, -1);

const resolveSpec = (fromFile: string, spec: string): string => {
  const parts = dirParts(fromFile);
  for (const seg of spec.split("/")) {
    if (seg === "." || seg === "") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
};

const relativeSpec = (fromFile: string, target: string): string => {
  const from = dirParts(fromFile);
  const to = target.split("/");
  let i = 0;
  while (i < from.length && i < to.length - 1 && from[i] === to[i]) i++;
  const ups = from.length - i;
  return (ups > 0 ? "../".repeat(ups) : "./") + to.slice(i).join("/");
};

// Rewrites relative imports in a test file that point at nothing, when exactly one real
// source file matches the end of the path. Valid imports are never touched.
export const fixTestImports = (testFile: string, code: string, sourcePaths: string[]): string => {
  const targets = sourcePaths.map(stripExt);
  const exists = (base: string): boolean =>
    targets.some((t) => t === base || t === `${base}/index`);
  const re = /(\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*|\bvi\.mock\s*\(\s*)(["'])(\.{1,2}\/[^"']+)\2/g;

  return code.replace(re, (whole: string, pre: string, q: string, spec: string) => {
    if (exists(stripExt(resolveSpec(testFile, spec)))) return whole;
    const tail = stripExt(spec.replace(/^(\.{1,2}\/)+/, ""));
    const matches = targets.filter(
      (t) => t === tail || t.endsWith(`/${tail}`) || t.endsWith(`/${tail}/index`),
    );
    if (matches.length !== 1) return whole;
    return `${pre}${q}${relativeSpec(testFile, matches[0]!)}${q}`;
  });
};