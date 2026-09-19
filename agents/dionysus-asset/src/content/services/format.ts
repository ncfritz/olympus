export const ts = (ms: number): string => {
  const milliseconds = Math.floor((ms % 1000) / 100)
    .toString()
    .padStart(3, "0");
  const seconds = Math.floor((ms / 1000) % 60)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor((ms / (1000 * 60)) % 60)
    .toString()
    .padStart(2, "0");
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24)
    .toString()
    .padStart(2, "0");

  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
};
