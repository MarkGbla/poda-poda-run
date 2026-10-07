(function (root, factory) {
  const EventBus = factory();
  if (typeof module === 'object' && module.exports) module.exports = EventBus;
  if (root) root.PODA_EventBus = EventBus;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  return class EventBus {
    constructor() { this.listeners = new Map(); }
    on(type, listener) {
      const group = this.listeners.get(type) || new Set();
      group.add(listener); this.listeners.set(type, group);
      return () => group.delete(listener);
    }
    emit(type, payload) {
      for (const listener of this.listeners.get(type) || []) listener(payload);
    }
  };
});
