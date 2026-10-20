export interface AxonAppearance {
  theme: 'light' | 'dark';
  fontSize: number;
}

export function normalizeAppearance(input: unknown): AxonAppearance {
  const value = input && typeof input === 'object' ? input as Partial<AxonAppearance> : {};
  const size = value.fontSize;
  return {
    theme: value.theme === 'dark' ? 'dark' : 'light',
    fontSize: typeof size === 'number' && Number.isInteger(size) && size >= 12 && size <= 20 ? size : 14,
  };
}

export function applyAppearance(input: unknown, root = document.documentElement) {
  const value = normalizeAppearance(input);
  root.dataset.theme = value.theme;
  root.style.setProperty('--axon-font-size', `${value.fontSize}px`);
  return value;
}
