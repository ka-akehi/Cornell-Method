import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

type TestElement = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  style: {
    fill: string;
    stroke: string;
    strokeWidth: number;
  };
  z: number;
  textStyle?: Record<string, unknown>;
};

type TestFabricObject = {
  get(key: string): unknown;
  getObjects(): never[];
};

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const jiti = createJiti(projectRoot, {
  alias: { "@": path.join(projectRoot, "src") },
  fsCache: false,
  moduleCache: false,
});
const { fabricCanvasToDocument } = jiti(
  path.join(
    projectRoot,
    "src/shared/canvas/adapters/fabric/fabric-canvas-to-document.ts",
  ),
);
const { readCanvasElementMetadata } = jiti(
  path.join(projectRoot, "src/shared/canvas/adapters/fabric/fabric-metadata.ts"),
);

function createElement(
  type: TestElement["type"],
  textStyle?: Record<string, unknown>,
): TestElement {
  return {
    id: `${type}-1`,
    type,
    x: 10,
    y: 20,
    width: 240,
    height: 120,
    rotation: 0,
    style: {
      fill: "#ffffff",
      stroke: "#000000",
      strokeWidth: 2,
    },
    z: 0,
    ...(textStyle === undefined ? {} : { textStyle }),
  };
}

function createFabricObject(element: TestElement): TestFabricObject {
  const values = new Map([
    ["canvasElement", { element, baseLeft: element.x, baseTop: element.y }],
  ]);

  return {
    get(key: string) {
      return values.get(key);
    },
    getObjects() {
      return [];
    },
  };
}

for (const type of ["rect", "ellipse"]) {
  test(`${type} metadata accepts the canonical textStyle keys`, () => {
    const textStyle = {
      fill: "#000000",
      fontSize: 18,
      fontFamily: "Arial",
      textAlign: "center",
    };
    const element = createElement(type, textStyle);
    const metadata = readCanvasElementMetadata(createFabricObject(element));

    assert.ok(metadata);
    assert.deepEqual(metadata.element.textStyle, textStyle);
  });

  test(`${type} metadata rejects unsupported textStyle keys`, () => {
    const element = createElement(type, { fill: "#000000", bogus: true });

    assert.equal(
      readCanvasElementMetadata(createFabricObject(element)),
      undefined,
    );
  });

  test(`${type} metadata accepts an omitted textStyle`, () => {
    const element = createElement(type);
    const metadata = readCanvasElementMetadata(createFabricObject(element));

    assert.ok(metadata);
    assert.equal(Object.hasOwn(metadata.element, "textStyle"), false);
  });
}

test("fabricCanvasToDocument excludes elements with unsupported textStyle metadata", () => {
  const malformed = createFabricObject(
    createElement("rect", { fill: "#000000", bogus: true }),
  );
  const valid = createFabricObject(
    createElement("ellipse", {
      fill: "#000000",
      fontSize: 18,
      fontFamily: "Arial",
      textAlign: "right",
    }),
  );

  const document = fabricCanvasToDocument({
    getObjects() {
      return [malformed, valid];
    },
    width: 1200,
    height: 800,
  });

  assert.equal(document.elements.length, 1);
  assert.equal(document.elements[0].type, "ellipse");
  assert.deepEqual(document.elements[0].textStyle, {
    fill: "#000000",
    fontSize: 18,
    fontFamily: "Arial",
    textAlign: "right",
  });
});
