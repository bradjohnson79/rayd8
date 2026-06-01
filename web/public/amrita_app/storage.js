export function readJsonStorage(key, fallbackValue, validate = null) {
  try {
    const rawValue = window.localStorage.getItem(key);
    if (!rawValue) return fallbackValue;

    const parsedValue = JSON.parse(rawValue);
    if (validate && !validate(parsedValue)) {
      window.localStorage.removeItem(key);
      return fallbackValue;
    }

    return parsedValue;
  } catch {
    window.localStorage.removeItem(key);
    return fallbackValue;
  }
}

export function writeJsonStorage(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function removeStorageValue(key) {
  window.localStorage.removeItem(key);
}
