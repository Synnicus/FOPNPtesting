export const PORTRAIT_IMPORT_DIRECTORY_PREFIX = 'fallout-pnp-import-';

export interface PortraitImportDirectorySnapshot {
  uri: string;
  name: string;
  contentUris: string[];
}

export interface PortraitImportCleanupPlan {
  directoryUris: string[];
  contentUris: string[];
}

export function planPortraitImportCleanup(
  directories: readonly PortraitImportDirectorySnapshot[],
  activePortraitUris: ReadonlySet<string>,
): PortraitImportCleanupPlan {
  const directoryUris: string[] = [];
  const contentUris: string[] = [];

  for (const directory of directories) {
    if (!directory.name.startsWith(PORTRAIT_IMPORT_DIRECTORY_PREFIX)) continue;

    const hasActivePortrait = directory.contentUris.some(uri => activePortraitUris.has(uri));
    if (!hasActivePortrait) {
      directoryUris.push(directory.uri);
      continue;
    }

    contentUris.push(...directory.contentUris.filter(uri => !activePortraitUris.has(uri)));
  }

  return { directoryUris, contentUris };
}