function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map(key => [key, canonicalize((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

export function characterDraftSignature(value: unknown): string {
  return JSON.stringify(canonicalize(value)) ?? 'undefined';
}

export function snapshotCharacterDraft(value: unknown): unknown {
  return canonicalize(value);
}

export function hasUnsavedCharacterChanges(baseline: unknown, current: unknown): boolean {
  return characterDraftSignature(baseline) !== characterDraftSignature(current);
}
