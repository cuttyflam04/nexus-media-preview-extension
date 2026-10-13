(() => {
  const DEFAULT_MARGIN = 12;
  const MIN_VISIBLE_WIDTH = 72;
  const MIN_VISIBLE_HEIGHT = 48;

  function clampPosition({
    left,
    top,
    width,
    height,
    viewportWidth,
    viewportHeight,
    margin = DEFAULT_MARGIN,
    minVisibleWidth = MIN_VISIBLE_WIDTH,
    minVisibleHeight = MIN_VISIBLE_HEIGHT
  }) {
    const minLeft = margin + minVisibleWidth - width;
    const maxLeft = viewportWidth - margin - minVisibleWidth;
    const minTop = margin + minVisibleHeight - height;
    const maxTop = viewportHeight - margin - minVisibleHeight;
    return {
      left: Math.round(Math.min(Math.max(left, minLeft), maxLeft)),
      top: Math.round(Math.min(Math.max(top, minTop), maxTop))
    };
  }

  function attach(dialog, handle, options = {}) {
    if (!dialog || !handle?.addEventListener) return () => {};

    const root = options.root || document;
    const getViewport = options.viewport || (() => ({
      width: window.innerWidth,
      height: window.innerHeight
    }));
    const requestFrame = options.requestFrame || (
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame.bind(globalThis)
        : (callback) => callback()
    );
    const cancelFrame = options.cancelFrame || (
      typeof cancelAnimationFrame === "function"
        ? cancelAnimationFrame.bind(globalThis)
        : () => {}
    );
    const margin = Number.isFinite(options.margin) ? options.margin : DEFAULT_MARGIN;
    let drag = null;

    function isIgnoredTarget(target) {
      return Boolean(target?.closest?.(
        "button, a, input, textarea, select, option, [data-nmp-no-drag]"
      ));
    }

    function matchesPointer(event) {
      return drag && (drag.pointerId == null || event.pointerId == null || event.pointerId === drag.pointerId);
    }

    function stop(event) {
      if (!matchesPointer(event)) return;
      if (drag?.frame) cancelFrame(drag.frame);
      applyMove();
      if (drag?.pointerId != null) handle.releasePointerCapture?.(drag.pointerId);
      drag = null;
      dialog.classList?.remove?.("is-dragging");
    }

    function applyMove() {
      if (!drag) return;
      drag.frame = 0;
      const position = clampPosition({
        left: drag.originLeft + drag.latestX - drag.startX,
        top: drag.originTop + drag.latestY - drag.startY,
        width: drag.width,
        height: drag.height,
        viewportWidth: drag.viewport.width,
        viewportHeight: drag.viewport.height,
        margin
      });
      dialog.style.left = `${position.left}px`;
      dialog.style.top = `${position.top}px`;
      dialog.style.transform = "none";
    }

    function move(event) {
      if (!matchesPointer(event)) return;
      drag.latestX = event.clientX;
      drag.latestY = event.clientY;
      if (!drag.frame) drag.frame = requestFrame(applyMove);
    }

    function start(event) {
      if (event.button != null && event.button !== 0) return;
      if (isIgnoredTarget(event.target)) return;

      const rect = dialog.getBoundingClientRect();
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originLeft: rect.left,
        originTop: rect.top,
        width: rect.width,
        height: rect.height,
        viewport: getViewport(),
        latestX: event.clientX,
        latestY: event.clientY,
        frame: 0
      };
      dialog.classList?.add?.("is-dragging");
      handle.setPointerCapture?.(event.pointerId);
      event.preventDefault?.();
    }

    handle.addEventListener("pointerdown", start);
    root.addEventListener("pointermove", move);
    root.addEventListener("pointerup", stop);
    root.addEventListener("pointercancel", stop);

    return () => {
      handle.removeEventListener?.("pointerdown", start);
      root.removeEventListener?.("pointermove", move);
      root.removeEventListener?.("pointerup", stop);
      root.removeEventListener?.("pointercancel", stop);
      stop({ pointerId: drag?.pointerId });
    };
  }

  function reset(dialog) {
    if (!dialog?.style) return;
    dialog.style.left = "";
    dialog.style.top = "";
    dialog.style.transform = "";
  }

  globalThis.NexusMediaPreviewModalDrag = { attach, clampPosition, reset };
})();
