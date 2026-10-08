// src/hooks/useOfficialContentVersion.ts
// Re-renders a screen when the official content changes (a pack is installed, updated or removed), so a list that reads the
// official catalog while rendering shows the new content without leaving and re-entering the screen.
import { useEffect, useState } from 'react';
import { onOfficialPacksChanged } from '../content/officialPackService';
import { officialContentVersion } from '../content/officialSource';

export function useOfficialContentVersion(): number {
  const [version, setVersion] = useState(officialContentVersion());
  useEffect(() => onOfficialPacksChanged(() => setVersion(officialContentVersion())), []);
  return version;
}
