const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

function loadModalDrag() {
  const context = { globalThis: {} };
  vm.runInNewContext(fs.readFileSync("src/modal-drag.js", "utf8"), context);
  return context.globalThis.NexusMediaPreviewModalDrag;
}

test("keeps a usable part of the dialog visible while allowing off-screen placement", () => {
  const api = loadModalDrag();

  const position = api.clampPosition({
    left: -800,
    top: 1200,
    width: 600,
    height: 400,
    viewportWidth: 1000,
    viewportHeight: 800,
    margin: 12
  });
  assert.equal(position.left, -516);
  assert.equal(position.top, 740);
});

test("dragging the header moves the dialog and ignores controls", () => {
  const api = loadModalDrag();
  const listeners = new Map();
  const root = {
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener() {}
  };
  const handle = {
    addEventListener(type, listener) { listeners.set(`handle:${type}`, listener); },
    setPointerCapture() {},
    releasePointerCapture() {}
  };
  const dialog = {
    style: {},
    classList: { add() {}, remove() {} },
    getBoundingClientRect() { return { left: 100, top: 120, width: 400, height: 300 }; }
  };
  const ignoredTarget = { closest(selector) { assert.match(selector, /button/); return {}; } };

  api.attach(dialog, handle, { root, viewport: () => ({ width: 1000, height: 800 }) });
  listeners.get("handle:pointerdown")({ button: 0, pointerId: 1, clientX: 200, clientY: 220, target: ignoredTarget, preventDefault() {} });
  assert.equal(dialog.style.left, undefined);

  listeners.get("handle:pointerdown")({ button: 0, pointerId: 1, clientX: 200, clientY: 220, target: { closest() { return null; } }, preventDefault() {} });
  listeners.get("pointermove")({ pointerId: 1, clientX: 260, clientY: 280 });
  assert.equal(dialog.style.left, "160px");
  assert.equal(dialog.style.top, "180px");
  assert.equal(dialog.style.transform, "none");
});

test("caches dialog geometry during a drag", () => {
  const api = loadModalDrag();
  const listeners = new Map();
  const root = {
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener() {}
  };
  const handle = {
    addEventListener(type, listener) { listeners.set(`handle:${type}`, listener); },
    setPointerCapture() {},
    releasePointerCapture() {}
  };
  let measurements = 0;
  const dialog = {
    style: {},
    classList: { add() {}, remove() {} },
    getBoundingClientRect() {
      measurements += 1;
      return { left: 100, top: 120, width: 400, height: 300 };
    }
  };

  api.attach(dialog, handle, { root, viewport: () => ({ width: 1000, height: 800 }) });
  listeners.get("handle:pointerdown")({ button: 0, pointerId: 1, clientX: 200, clientY: 220, target: { closest() { return null; } }, preventDefault() {} });
  listeners.get("pointermove")({ pointerId: 1, clientX: 210, clientY: 230 });
  listeners.get("pointermove")({ pointerId: 1, clientX: 220, clientY: 240 });
  listeners.get("pointermove")({ pointerId: 1, clientX: 230, clientY: 250 });

  assert.equal(measurements, 1);
});

test("coalesces rapid pointer moves into one animation frame", () => {
  const api = loadModalDrag();
  const listeners = new Map();
  const root = {
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener() {}
  };
  const handle = {
    addEventListener(type, listener) { listeners.set(`handle:${type}`, listener); },
    setPointerCapture() {},
    releasePointerCapture() {}
  };
  const dialog = {
    style: {},
    classList: { add() {}, remove() {} },
    getBoundingClientRect() { return { left: 100, top: 120, width: 400, height: 300 }; }
  };
  let scheduled = 0;
  let frameCallback;

  api.attach(dialog, handle, {
    root,
    viewport: () => ({ width: 1000, height: 800 }),
    requestFrame(callback) { scheduled += 1; frameCallback = callback; return 1; },
    cancelFrame() {}
  });
  listeners.get("handle:pointerdown")({ button: 0, pointerId: 1, clientX: 200, clientY: 220, target: { closest() { return null; } }, preventDefault() {} });
  listeners.get("pointermove")({ pointerId: 1, clientX: 210, clientY: 230 });
  listeners.get("pointermove")({ pointerId: 1, clientX: 260, clientY: 280 });
  listeners.get("pointermove")({ pointerId: 1, clientX: 290, clientY: 310 });

  assert.equal(scheduled, 1);
  frameCallback();
  assert.equal(dialog.style.left, "190px");
  assert.equal(dialog.style.top, "210px");
});

test("applies the last pointer position before releasing the drag", () => {
  const api = loadModalDrag();
  const listeners = new Map();
  const root = {
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener() {}
  };
  const handle = {
    addEventListener(type, listener) { listeners.set(`handle:${type}`, listener); },
    setPointerCapture() {},
    releasePointerCapture() {}
  };
  const dialog = {
    style: {},
    classList: { add() {}, remove() {} },
    getBoundingClientRect() { return { left: 100, top: 120, width: 400, height: 300 }; }
  };

  api.attach(dialog, handle, {
    root,
    viewport: () => ({ width: 1000, height: 800 }),
    requestFrame() { return 1; },
    cancelFrame() {}
  });
  listeners.get("handle:pointerdown")({ button: 0, pointerId: 1, clientX: 200, clientY: 220, target: { closest() { return null; } }, preventDefault() {} });
  listeners.get("pointermove")({ pointerId: 1, clientX: 290, clientY: 310 });
  listeners.get("pointerup")({ pointerId: 1 });

  assert.equal(dialog.style.left, "190px");
  assert.equal(dialog.style.top, "210px");
});
