// app/live/e2e.tsx
// TEST-ONLY fixtures for deterministic Android automation. Renders nothing unless the app was
// built with EXPO_PUBLIC_E2E=1 (see src/session/e2e.ts). It seeds data; it never bypasses
// role authorization, and it is not linked from any production screen.
import { useState } from 'react';
import { getSessionRuntime } from '../../src/session/runtime';
import { E2E_ENABLED } from '../../src/session/e2e';
import { AUTOMATION_CAMPAIGN_ID, AUTOMATION_CAMPAIGN_NAME, applyAutomationFixture } from '../../src/session/fixtures';
import { makeEmptyEntity, useCharacterStore, DEFAULT_RULES } from '../../src/store/characterStore';
import { recomputeDerived } from '../../src/engine/pipeline';
import { LiveScreen, Section, Btn, Muted, Body } from '../../src/components/live/LiveUi';

export default function E2eFixtures() {
  const [log, setLog] = useState<string[]>([]);
  const say = (m: string) => setLog(l => [...l, m]);
  if (!E2E_ENABLED) return null;

  async function seedCampaign() {
    const rt = getSessionRuntime();
    if (await rt.prep.load(AUTOMATION_CAMPAIGN_ID)) { say('campaign already present'); return; }
    await rt.prep.create(AUTOMATION_CAMPAIGN_ID, AUTOMATION_CAMPAIGN_NAME);
    await rt.prep.edit(AUTOMATION_CAMPAIGN_ID, applyAutomationFixture);
    say('campaign seeded');
  }

  async function seedCharacter(id: string, name: string) {
    const store = useCharacterStore.getState();
    // Fixtures are always rebuilt from scratch so every run starts from a known state. Only this exact
    // fixture id is ever replaced; no other character is touched.
    if (store.characters.some(c => c.id === id)) { store.deleteCharacter(id); await new Promise(r => setTimeout(r, 400)); }
    const e = makeEmptyEntity(id);
    const entity = recomputeDerived({
      ...e, identity: { ...e.identity, name, level: 3 },
      resources: { ...e.resources, hp: { current: 24, maximum: 24, temp: 0 } },
    }, DEFAULT_RULES);
    const ok = await store.importCharacter(entity);
    say(ok ? `${name} created` : `${name} FAILED`);
  }

  async function wipe() {
    const rt = getSessionRuntime();
    await rt.leave();
    for (const k of await rt.kv.keys('session.')) await rt.kv.delete(k);
    say('session data wiped');
  }

  return (
    <LiveScreen title="E2E fixtures" subtitle="Test builds only">
      <Section title="Fixtures">
        <Btn label="Seed Automation Campaign" onPress={() => { void seedCampaign(); }} testID="e2e-seed-campaign" />
        <Btn label="Seed character: Fixture Hero" onPress={() => { void seedCharacter('char_e2e_hero', 'Fixture Hero'); }} testID="e2e-seed-hero" />
        <Btn label="Wipe live-session data" kind="danger" onPress={() => { void wipe(); }} testID="e2e-wipe" />
      </Section>
      <Section title="Log">
        {log.map((l, i) => <Body key={i}>{l}</Body>)}
        {log.length === 0 && <Muted>Nothing yet.</Muted>}
      </Section>
    </LiveScreen>
  );
}
