const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

function loadNotificationMedia() {
  const context = { globalThis: {} };
  vm.runInNewContext(fs.readFileSync("src/notification-media.js", "utf8"), context);
  return context.globalThis.NexusMediaPreviewNotificationMedia;
}

function node({ textContent = "", className = "", parentElement = null } = {}) {
  return {
    textContent,
    className,
    parentElement,
    getAttribute() { return null; }
  };
}

test("recognizes grouped image notifications and leaves single-media notifications eligible", () => {
  const api = loadNotificationMedia();
  const panel = node({ textContent: "Notifications" });
  const grouped = node({
    textContent: "Azurarimjobber published 2 images",
    className: "activity-entry",
    parentElement: panel
  });
  const unique = node({
    textContent: "Azurarimjobber published an image",
    className: "activity-entry",
    parentElement: panel
  });

  assert.equal(api.isGroupedMediaNotification(grouped), true);
  assert.equal(api.isGroupedMediaNotification(unique), false);
});

test("recognizes grouped video and media counts written as words", () => {
  const api = loadNotificationMedia();
  const panel = node({ textContent: "Notifications" });
  const grouped = node({
    textContent: "Creator added three videos",
    className: "notification-item",
    parentElement: panel
  });

  assert.equal(api.isGroupedMediaNotification(grouped), true);
});

test("does not classify unrelated page text as a grouped notification", () => {
  const api = loadNotificationMedia();
  const page = node({ textContent: "This mod supports 2 images" });

  assert.equal(api.isGroupedMediaNotification(page), false);
});

test("finds grouped media text in an unmarked row inside a notification panel", () => {
  const api = loadNotificationMedia();
  const panel = node({ className: "notifications-panel", textContent: "Notifications" });
  const row = node({
    textContent: "Azurarimjobber published 2 images",
    parentElement: panel
  });

  assert.equal(api.isGroupedMediaNotification(row), true);
});
