export function celsiusToFahrenheit(value: number): number {
  return (value * 9) / 5 + 32;
}

export function formatFahrenheit(
  value: number | null | undefined,
  digits = 0,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }

  return `${celsiusToFahrenheit(value).toFixed(digits)}°F`;
}

export function temperatureFahrenheitValue(
  value: number | null | undefined,
): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }

  return Math.round(celsiusToFahrenheit(value));
}
