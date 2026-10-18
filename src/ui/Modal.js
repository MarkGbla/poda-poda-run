/** Native focus trapping, Escape, and browser Back share one close path. */
export function modal(dialog) {
  let previousFocus;
  // Reload restores history state but not an open dialog. Clear its stale marker
  // so the next open/Back pair has distinct states.
  if (history.state?.podaModal === dialog.id) {
    const state = { ...history.state }; delete state.podaModal;
    history.replaceState(state, '', location.href);
  }
  dialog.addEventListener('close', () => {
    previousFocus?.focus();
    if (history.state?.podaModal === dialog.id) history.back();
  });
  addEventListener('popstate', () => {
    if (dialog.open && history.state?.podaModal !== dialog.id) dialog.close();
  });
  return {
    open() {
      if (dialog.open) return;
      previousFocus = document.activeElement; dialog.hidden = false; dialog.showModal();
      history.pushState({ ...history.state, podaModal: dialog.id }, '', location.href);
    },
    close() { dialog.close(); },
  };
}
