export const loadFromLocalStorage = <T>(key: string, defaultValue: T): T => {
  try {
    const value = localStorage.getItem(key);

    if (value) {
      return JSON.parse(value);
    }
  } catch(e) {
    console.error(`Unable to load key ${key} from localStorage`);
  }

  return defaultValue;
};

export const storeToLocalStorage = (key: string, value: unknown) => {
  localStorage.setItem(key, JSON.stringify(value));
};

export const removeFromLocalStorage = (key: string) => {
  localStorage.removeItem(key);
};