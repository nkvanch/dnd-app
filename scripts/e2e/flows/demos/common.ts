// Shared helpers for the creator outreach demo recordings. These drive the REAL production screens
// (no EXPO_PUBLIC_E2E fixtures — the frozen Creator Alpha build doesn't have that screen at all), using
// the same uiautomator/adb driver (scripts/e2e/adb.ts) as the acceptance-test flows.
import { Phone } from '../../adb';
import { toTabs, toLiveHub } from '../common';

/** Opens the Android system file picker via "Choose Package File…" and picks a file from /sdcard/Download
 *  by name. The picker is outside the app (no stable resource-ids), so this matches on visible text only,
 *  exactly like the manual exploration that first proved this path works. */
export async function pickPackageFromDownloads(phone: Phone, filename: string): Promise<void> {
  await phone.tap({ text: 'Choose Package File…' });
  await phone.pause(1500);
  // The picker may default to Images/a different folder view; a text search always works regardless.
  await phone.tap({ desc: 'Search' }, ).catch(() => phone.tap({ text: 'Search' }));
  await phone.pause(600);
  const query = filename.replace('.grimoire-pack', '');
  const escaped = query.replace(/([&|;()<>'"\\$~*?#` ])/g, '\\$1');
  phone.sh(`input text ${escaped}`);
  await phone.pause(1200);
  await phone.tap({ textContains: filename });
  await phone.pause(2000);
}

/** Homebrew → Import Homebrew → Choose Package File… → pick `filename` → assert the preview, then
 *  "Import All". Leaves the app on the Homebrew screen afterward. */
export async function importDemoPack(phone: Phone, filename: string, expectName: string): Promise<void> {
  await toTabs(phone);
  await phone.tap({ id: 'tab-homebrew' });
  await phone.tap({ textContains: 'Import Homebrew' });
  await phone.pause(1000);
  await pickPackageFromDownloads(phone, filename);
  await phone.assertPresent({ text: expectName });
  await phone.pause(1200);
  await phone.tap({ text: 'Import All' });
  await phone.assertPresent({ textContains: 'Imported' }, 15000);
}

/** Builds the shared "Automation Campaign" DM preparation via the REAL (non-E2E) screens: an encounter,
 *  a public effect, a secret effect, and a change template — same content/names the acceptance tests use,
 *  built here with the production build's own UI (app/live/prepare.tsx is not E2E-gated). */
export async function buildAutomationCampaignPrep(phone: Phone): Promise<void> {
  await toTabs(phone);
  await toLiveHub(phone);
  await phone.tap({ id: 'live-open-prepare' });
  if (phone.visible({ id: 'prep-campaign-Automation Campaign' })) return;   // already built (idempotent)

  await phone.typeInto({ id: 'prep-new-name' }, 'Automation Campaign');
  await phone.tap({ id: 'prep-create' });
  await phone.assertText('Automation Campaign');

  await phone.tap({ id: 'prep-add-encounter' });
  await phone.typeInto({ id: 'prep-enc-name' }, 'Bridge Ambush');
  await phone.typeInto({ id: 'prep-enc-combatants' }, 'Bandit, Bandit Captain');
  await phone.tap({ id: 'prep-enc-save' });
  await phone.assertPresent({ id: 'prep-encounter-Bridge Ambush' });

  await phone.tap({ id: 'prep-add-effect' });
  await phone.typeInto({ id: 'prep-fx-name' }, 'Blessing');
  await phone.tap({ id: 'prep-fx-stat-save' });
  await phone.typeInto({ id: 'prep-fx-rounds' }, '10');
  await phone.tap({ id: 'prep-fx-save' });
  await phone.assertPresent({ id: 'prep-effect-Blessing' });

  await phone.tap({ id: 'prep-add-effect' });
  await phone.typeInto({ id: 'prep-fx-name' }, 'Hidden Curse' );
  await phone.tap({ id: 'prep-fx-vis-secret' });
  await phone.tap({ id: 'prep-fx-stat-ac' });
  await phone.typeInto({ id: 'prep-fx-value' }, '-1');
  await phone.tap({ id: 'prep-fx-save' });
  await phone.assertPresent({ id: 'prep-effect-Hidden Curse' });

  await phone.tap({ id: 'prep-add-template' });
  await phone.typeInto({ id: 'prep-tpl-label' }, 'Exhaustion Increase');
  await phone.tap({ id: 'prep-tpl-save' });
  await phone.assertPresent({ id: 'prep-template-Exhaustion Increase' });
}

export async function goHome(phone: Phone): Promise<void> {
  await toTabs(phone);
  await phone.tap({ id: 'tab-home' });
  await phone.pause(600);
}
