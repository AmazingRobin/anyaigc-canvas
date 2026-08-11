import assert from "node:assert/strict";

import { collectZipImageFiles } from "../src/lib/asset-archive.ts";
import { createZip, readZip } from "../src/lib/zip";

const zip = await createZip([
    { name: "参考图/hero.png", data: new Uint8Array([1, 2, 3]) },
    { name: "参考图/hero.jpg", data: new Uint8Array([4, 5, 6]) },
    { name: "nested/ignore.txt", data: "skip me" },
    { name: "nested/empty/", data: "" },
]);

const imageFiles = collectZipImageFiles(await readZip(zip));

assert.deepEqual(
    imageFiles.map(({ path, mimeType, title }) => ({ path, mimeType, title })),
    [
        { path: "参考图/hero.png", mimeType: "image/png", title: "hero" },
        { path: "参考图/hero.jpg", mimeType: "image/jpeg", title: "hero" },
    ],
);

console.log("Asset ZIP import contract checks passed");
