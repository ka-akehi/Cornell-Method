"use client";

export type DesktopDirtyController = {
  isDirty: () => boolean;
  save: () => Promise<boolean>;
  discard?: () => boolean | void;
};

export const DESKTOP_CLOSE_REQUEST_EVENT = "cornell:desktop-close-request";

const dirtyControllers = new Map<symbol, DesktopDirtyController>();

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
    save: async () => {
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
