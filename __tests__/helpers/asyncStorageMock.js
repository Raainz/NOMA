// In-memory AsyncStorage replacement for Jest (mapped in package.json "jest.moduleNameMapper").
const store = new Map();

const AsyncStorage = {
  getItem: async (key) => (store.has(key) ? store.get(key) : null),
  setItem: async (key, value) => {
    store.set(key, String(value));
  },
  removeItem: async (key) => {
    store.delete(key);
  },
  clear: async () => {
    store.clear();
  },
  __dump: () => Object.fromEntries(store),
};

module.exports = { __esModule: true, default: AsyncStorage };
