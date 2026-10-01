// Deterministic fake character used by the in-process harness and the Node E2E peers.
import { CharacterAdapter, CharacterChange, CharacterSummary } from '../types';

export class FakeCharacter implements CharacterAdapter {
  revision = 1;
  hp = 20; maxHp = 20; tempHp = 0; ac = 14; exhaustion = 0;
  abilities: Record<string, number> = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  applied: string[] = [];
  constructor(readonly characterId: string, public name = characterIdToName(characterId)) {}
  getRevision(): number { return this.revision; }
  summary(): CharacterSummary { return { name: this.name, hp: this.hp, maxHp: this.maxHp, ac: this.ac }; }
  applyChanges(changes: CharacterChange[], requestId: string): number {
    for (const c of changes) {
      if (c.kind === 'exhaustion') this.exhaustion = Math.max(0, this.exhaustion + c.delta);
      else if (c.kind === 'max_hp') { this.maxHp += c.delta; this.hp = Math.min(this.hp, this.maxHp); }
      else if (c.kind === 'hp') this.hp = Math.max(0, Math.min(this.maxHp, this.hp + c.delta));
      else if (c.kind === 'temp_hp') this.tempHp = Math.max(this.tempHp, c.amount);
      else this.abilities[c.ability] += c.delta;
    }
    this.applied.push(requestId);
    this.revision += 1;
    return this.revision;
  }
  /** A local, unrelated edit (player took damage, etc.) that bumps the revision. */
  localEdit(): void { this.hp -= 1; this.revision += 1; }
}

function characterIdToName(id: string): string { return id.replace(/^char_/, ''); }

