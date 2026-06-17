// Storage wrappers using chrome.storage.sync and chrome.storage.local
// No localStorage usage (MV3 CSP compliance)

const STORAGE_PREFIX = 'newtab01.';

/** Get a value from chrome.storage.local */
export async function getLocal<T>(key: string): Promise<T | undefined> {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_PREFIX + key, (result) => {
      const value = result[STORAGE_PREFIX + key];
      resolve(value !== undefined ? (value as T) : undefined);
    });
  });
}

/** Set a value in chrome.storage.local */
export async function setLocal<T>(key: string, value: T): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_PREFIX + key]: value }, resolve);
  });
}

/** Remove a value from chrome.storage.local */
export async function removeLocal(key: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove(STORAGE_PREFIX + key, resolve);
  });
}

/** Get a value from chrome.storage.sync */
export async function getSync<T>(key: string): Promise<T | undefined> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(STORAGE_PREFIX + key, (result) => {
      const value = result[STORAGE_PREFIX + key];
      resolve(value !== undefined ? (value as T) : undefined);
    });
  });
}

/** Set a value in chrome.storage.sync */
export async function setSync<T>(key: string, value: T): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ [STORAGE_PREFIX + key]: value }, resolve);
  });
}

/** Remove a value from chrome.storage.sync */
export async function removeSync(key: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.remove(STORAGE_PREFIX + key, resolve);
  });
}

/** Get all keys with a given prefix from chrome.storage.local */
export async function getLocalKeys(prefix: string): Promise<string[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (items) => {
      const fullPrefix = STORAGE_PREFIX + prefix;
      const keys = Object.keys(items).filter((k) => k.startsWith(fullPrefix));
      resolve(keys.map((k) => k.slice(STORAGE_PREFIX.length)));
    });
  });
}

/** Clear all newtab01 data from local storage */
export async function clearLocal(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (items) => {
      const keys = Object.keys(items).filter((k) => k.startsWith(STORAGE_PREFIX));
      if (keys.length > 0) {
        chrome.storage.local.remove(keys, resolve);
      } else {
        resolve();
      }
    });
  });
}
