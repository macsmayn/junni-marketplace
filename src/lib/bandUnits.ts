const FR_UNITS: [string, string][] = [
  [" days",   " jours"],
  [" day",    " jour"],
  [" months", " mois"],
  [" month",  " mois"],
  [" years",  " ans"],
  [" year",   " an"],
];

export function translateBandUnits(band: string | null, lang: string): string | null {
  if (!band || lang !== "fr") return band;
  let result = band;
  for (const [en, fr] of FR_UNITS) {
    result = result.split(en).join(fr);
  }
  return result;
}
