"use client";

export type DesktopDirtyController = {
  isDirty: () => boolean;
  save: () => Promise<boolean>;
  discard?: () => boolean | void;
};

export const DESKTOP_CLOSE_REQUEST_EVENT = "cornell:desktop-close-request";
export const DESKTOP_CLOSE_BRIDGE_READY_FRAGMENT =
  "cornell-desktop-close-bridge-ready=";
export const DESKTOP_CLOSE_BRIDGE_NOT_READY_FRAGMENT =
  "cornell-desktop-close-bridge-not-ready=";

const dirtyControllers = new Map<symbol, DesktopDirtyController>();
let dirtyControllersSaveInFlight: Promise<boolean> | null = null;
let nextDesktopCloseBridgeGeneration = 0;

export function createDesktopCloseBridgeGeneration() {
  nextDesktopCloseBridgeGeneration += 1;
  return `${Date.now().toString(36)}-${nextDesktopCloseBridgeGeneration.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function isDesktopCloseBridgeLocation() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.location.protocol === "http:" &&
    window.location.hostname === "127.0.0.1" &&
    window.location.port !== ""
  );
}

function sendDesktopCloseBridgeSignal(fragment: string, generation: string) {
  if (!isDesktopCloseBridgeLocation() || generation.length === 0) {
    return false;
  }

  try {
    // The local runtime is an external loopback URL, so it intentionally does
    // not receive the Tauri global API. Rust consumes this transient fragment
    // in WebviewWindowBuilder::on_navigation and cancels the navigation.
    window.location.hash = `${fragment}${generation}`;
    return true;
  } catch {
    return false;
  }
}

export function sendDesktopCloseBridgeReady(generation: string) {
  return sendDesktopCloseBridgeSignal(
    DESKTOP_CLOSE_BRIDGE_READY_FRAGMENT,
    generation,
  );
}

export function sendDesktopCloseBridgeNotReady(generation: string) {
  return sendDesktopCloseBridgeSignal(
    DESKTOP_CLOSE_BRIDGE_NOT_READY_FRAGMENT,
    generation,
  );
}

export function registerDesktopDirtyController(
  nextController: DesktopDirtyController,
) {
  const owner = Symbol("desktop-dirty-owner");
  dirtyControllers.set(owner, nextController);

  return () => {
    if (dirtyControllers.get(owner) === nextController) {
      dirtyControllers.delete(owner);
    }
  };
}

export function getDesktopDirtyController() {
  if (dirtyControllers.size === 0) {
    return null;
  }

  return {
    isDirty: () => {
      for (const controller of dirtyControllers.values()) {
        try {
          if (controller.isDirty()) {
            return true;
          }
        } catch {
          // An unreachable or partially unmounted owner must not be treated as
          // clean. AppChrome will keep the close dialog open until the owner
          // can confirm a successful save or the user explicitly discards it.
          return true;
        }
      }
      return false;
    },
    save: () => {
      if (dirtyControllersSaveInFlight) {
        return dirtyControllersSaveInFlight;
      }

      const nextSave = (async () => {
        const savedOwners = new Set<symbol>();

        while (true) {
          let nextOwner: [symbol, DesktopDirtyController] | null = null;

          for (const [owner, controller] of dirtyControllers.entries()) {
            if (
              savedOwners.has(owner) ||
              dirtyControllers.get(owner) !== controller
            ) {
              continue;
            }

            if (controller.isDirty()) {
              nextOwner = [owner, controller];
              break;
            }
            savedOwners.add(owner);
          }

          if (!nextOwner) {
            return true;
          }

          const [owner, controller] = nextOwner;
          savedOwners.add(owner);
          if (!(await controller.save())) {
            return false;
          }
        }
      })();
      dirtyControllersSaveInFlight = nextSave;
      const clearInFlightSave = () => {
        if (dirtyControllersSaveInFlight === nextSave) {
          dirtyControllersSaveInFlight = null;
        }
      };
      void nextSave.then(clearInFlightSave, clearInFlightSave);
      return nextSave;
    },
    discard: () => {
      let discarded = true;
      for (const controller of dirtyControllers.values()) {
        if (controller.discard?.() === false) {
          discarded = false;
          break;
        }
      }
      return discarded;
    },
  } satisfies DesktopDirtyController;
}

export async function sendDesktopCloseDecision(
  decision: "save" | "discard" | "cancel" | "clean",
) {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    // The local runtime is an external loopback URL, so it intentionally does
    // not receive the Tauri global API. Rust consumes this transient fragment
    // in WebviewWindowBuilder::on_navigation and cancels the navigation.
    window.location.hash = `cornell-desktop-close=${decision}`;
    return true;
  } catch {
    return false;
  }
}
