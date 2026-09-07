// Fake artwork: deterministic gradients keyed by the fixture's posterPath/backdropPath so every
// title has a distinct, stable "poster" without any network image.
const PALETTE = [
  ['#7C5CFF', '#4D8DFF'],
  ['#FF4FA3', '#7C5CFF'],
  ['#FF6B6B', '#FF4FA3'],
  ['#4D8DFF', '#1CC8D8'],
  ['#7C5CFF', '#FF6B6B'],
  ['#1CC8D8', '#4D8DFF'],
  ['#FFC24B', '#FF6B6B'],
  ['#4D8DFF', '#7C5CFF']
];

function hashKey(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h;
}

export function posterStyle(key: string): string {
  const [a, b] = PALETTE[hashKey(key) % PALETTE.length];
  return `background-image: linear-gradient(160deg, ${a}, ${b} 70%);`;
}

export function backdropStyle(key: string): string {
  const [a, b] = PALETTE[(hashKey(key) + 3) % PALETTE.length];
  return `background-image: linear-gradient(120deg, ${a}, ${b});`;
}
