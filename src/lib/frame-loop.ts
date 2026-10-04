type FrameClock = {
  request: (callback: FrameRequestCallback) => number;
  cancel: (id: number) => void;
};

/** One pending callback, capped independently of 60/120/144 Hz displays.
 * Inactive renderers paint only when invalidated; hidden renderers never paint. */
export function createFrameLoop(
  paint: FrameRequestCallback,
  clock: FrameClock,
  fps = 60,
) {
  let frame: number | null = null;
  let visible = false,
    active = false,
    dirty = true,
    disposed = false;
  let previous: number | null = null;
  let interval = 1000 / fps;
  const schedule = () => {
    if (!disposed && visible && (active || dirty) && frame === null)
      frame = clock.request(tick);
  };
  const tick: FrameRequestCallback = (now) => {
    frame = null;
    if (disposed || !visible) return;
    const elapsed = previous === null ? Infinity : now - previous;
    if (dirty || elapsed >= interval - 0.1) {
      previous =
        dirty || !Number.isFinite(elapsed)
          ? now
          : now - (elapsed < interval ? 0 : elapsed % interval);
      dirty = false;
      paint(now);
    }
    schedule();
  };
  return {
    update(next: { visible: boolean; active: boolean; fps: number }) {
      if (disposed) return;
      const changed =
        visible !== next.visible ||
        active !== next.active ||
        interval !== 1000 / next.fps;
      visible = next.visible;
      active = next.active;
      interval = 1000 / next.fps;
      if (changed) {
        previous = null;
        dirty = true;
      }
      if (!visible && frame !== null) {
        clock.cancel(frame);
        frame = null;
      }
      schedule();
    },
    invalidate() {
      if (!disposed) {
        dirty = true;
        schedule();
      }
    },
    dispose() {
      disposed = true;
      if (frame !== null) clock.cancel(frame);
      frame = null;
    },
  };
}
