/** Convert hex to HSL hue (0-360), saturation (0-1), lightness (0-1) */
export function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l]; // achromatic
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}

/** Sort colors by hue (rainbow order), neutrals (low saturation) at the end */
export function sortByHue<T extends { hex: string }>(colors: T[]): T[] {
  return [...colors].sort((a, b) => {
    const [hA, sA, lA] = hexToHsl(a.hex);
    const [hB, sB, lB] = hexToHsl(b.hex);
    const isNeutralA = sA < 0.1;
    const isNeutralB = sB < 0.1;
    if (isNeutralA && !isNeutralB) return 1;
    if (!isNeutralA && isNeutralB) return -1;
    if (isNeutralA && isNeutralB) return lA - lB; // dark to light for neutrals
    return hA - hB;
  });
}

export const COLOR_PRESETS = [
  { name: "Red",    hex: "#ef5350" },
  { name: "Orange", hex: "#ff9800" },
  { name: "Yellow", hex: "#ffee58" },
  { name: "Lime",   hex: "#9ccc65" },
  { name: "Green",  hex: "#4caf50" },
  { name: "Teal",   hex: "#26a69a" },
  { name: "Cyan",   hex: "#26c6da" },
  { name: "Blue",   hex: "#42a5f5" },
  { name: "Indigo", hex: "#5c6bc0" },
  { name: "Purple", hex: "#ab47bc" },
  { name: "Pink",   hex: "#ec407a" },
  { name: "Brown",  hex: "#8d6e63" },
  { name: "Black",  hex: "#212121" },
  { name: "Gray",   hex: "#9e9e9e" },
  { name: "White",  hex: "#fafafa" },
  { name: "Gold",   hex: "#ffd54f" },
  { name: "Silver", hex: "#cfd8dc" },
];
