import { DEFAULT_RULES } from '../../../store/characterStore';
import { instantiatePreparedEncounter } from '../../../engine/preparedEncounter';
import { pressureVaultEncounter, PRESSURE_VAULT_ID } from '../pressureVault';
import { BUILTIN_HOMEBREW } from '../../builtinHomebrew';

describe('The Pressure Vault prepared encounter', () => {
  const vault = pressureVaultEncounter(1);

  it('is a reusable template (no campaign), ready but not started or completed', () => {
    expect(vault.id).toBe(PRESSURE_VAULT_ID);
    expect(vault.campaignId).toBeUndefined();
    expect(vault.status).toBe('ready');
    expect(vault.lastStartedAt).toBeUndefined();
    expect(vault.completedAt).toBeUndefined();
  });

  it('has one public effect, one secret effect, and a DM-only motive note', () => {
    expect(vault.environment.map(e => [e.label, e.visibility])).toEqual([
      ['Unstable Pressure', 'public'],
      ['Resonant Fracture (secret)', 'secret'],
    ]);
    expect(vault.dmNotes).toMatch(/WHAT THE GLASSBACK WANTS/);
  });

  it('instantiates the built-in Glassback with its Pressure pool, independently each time', () => {
    const a = instantiatePreparedEncounter(vault, DEFAULT_RULES, BUILTIN_HOMEBREW.monsters);
    const b = instantiatePreparedEncounter(vault, DEFAULT_RULES, BUILTIN_HOMEBREW.monsters);
    expect(a).toHaveLength(1);
    expect(a[0].resources.custom.find(r => r.id === 'glassback_pressure')).toMatchObject({ current: 2, maximum: 3 });
    expect(a[0]).not.toBe(b[0]);
    expect(a[0].resources.hp.maximum).toBe(119);
  });
});
