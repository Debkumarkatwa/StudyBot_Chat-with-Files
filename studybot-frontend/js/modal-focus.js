// modal-focus.js
// Reusable focus trap + focus restoration for the app's dialog-style modals
// (uploadOverflowModal, deleteConfirmModal, deleteModalOverlay). Escape-to-close
// is handled per modal already (each file has its own "keydown Escape" listener) —
// this module only owns two things: (1) trapping Tab/Shift+Tab inside the modal
// while it's open, and (2) putting focus back where it was once it closes.

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), ' +
  'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Per-modal state, so several modals can each be opened/closed independently
// without stepping on each other's saved focus or listeners.
const modalState = new WeakMap();

function getFocusable(modalEl) {
  return Array.from(modalEl.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null // skip anything hidden inside the modal
  );
}

/**
 * Call right after showing a modal (removing its "hidden" class).
 * - Remembers whatever had focus beforehand, so it can be restored on close.
 * - Moves focus into the modal (to `initialFocusEl` if given, else the first
 *   focusable element inside it).
 * - Traps Tab/Shift+Tab so focus cannot leave the modal while it's open.
 */
function trapModalFocus(modalEl, initialFocusEl) {
  if (!modalEl || modalState.has(modalEl)) return;

  const previouslyFocused = document.activeElement;

  const handleKeydown = (e) => {
    if (e.key !== "Tab") return;
    const focusable = getFocusable(modalEl);
    if (focusable.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  modalEl.addEventListener("keydown", handleKeydown);
  modalState.set(modalEl, { previouslyFocused, handleKeydown });

  const focusable = getFocusable(modalEl);
  const target = initialFocusEl || focusable[0];
  // Wait a tick so this runs after the "hidden" class is actually removed
  // (offsetParent checks above need the modal to already be visible).
  requestAnimationFrame(() => target?.focus());
}

/**
 * Call right after hiding a modal (adding its "hidden" class back).
 * Removes the Tab trap and returns focus to whatever triggered the modal
 * (the button that opened it, in every case in this app).
 */
function releaseModalFocus(modalEl) {
  const state = modalState.get(modalEl);
  if (!state) return;

  modalEl.removeEventListener("keydown", state.handleKeydown);
  modalState.delete(modalEl);

  // If the trigger element was removed from the DOM in the meantime, falling
  // back to the body keeps focus from silently vanishing.
  if (state.previouslyFocused && document.contains(state.previouslyFocused)) {
    state.previouslyFocused.focus();
  }
}
