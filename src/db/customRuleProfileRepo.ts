import { Platform } from 'react-native';
import { CustomRuleProfile } from '../engine/types';
import { getDb } from './db';
export async function saveCustomRuleProfile(profile: CustomRuleProfile): Promise<void> { if (Platform.OS === 'web') return; await getDb().runAsync('INSERT INTO custom_rule_profiles (id,data,updatedAt) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, updatedAt=excluded.updatedAt',[profile.id,JSON.stringify(profile),profile.updatedAt]); }
export async function loadCustomRuleProfiles(): Promise<CustomRuleProfile[]> { if (Platform.OS === 'web') return []; const rows=await getDb().getAllAsync<{data:string}>('SELECT data FROM custom_rule_profiles ORDER BY updatedAt DESC'); return rows.flatMap(row=>{try{return [JSON.parse(row.data) as CustomRuleProfile]}catch{return []}}); }
export async function deleteCustomRuleProfile(id:string):Promise<void>{if(Platform.OS==='web')return;await getDb().runAsync('DELETE FROM custom_rule_profiles WHERE id = ?',[id]);}
