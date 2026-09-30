import { createAdminClient } from '../supabase/admin';
import { EnvironmentManager } from '../environment/manager';
import { fetchNwsWeather, fetchUSGSWaterData, fetchMarineConditions } from '../fetchers/environmental';

export interface ProCatchResult {
  catchId: string;
  xpEarned: number;
  newLevel: number;
  achievementsUnlocked: string[];
  snapshot: any;
}

export class ProLogger {
  static async logCatchPro(userId: string, catchData: any) {
    // 1. SENSOR INTEGRATION: Capture Environmental Snapshot
    const snapshot = await this.captureSnapshot(catchData.latitude, catchData.longitude, catchData.spot_id);
    
    // 2. DATABASE: Save the catch with the snapshot
    const admin = createAdminClient(); const { data: catchRecord, error: catchError } = await admin
      .from('catches')
      .insert([{
        ...catchData,
        user_id: userId,
        is_public: false,
        weather_snapshot: snapshot,
      }])
      .select()
      .single();

    if (catchError) throw catchError;

    // 3. GAMIFICATION: Calculate XP and Update Profile
    const xpEarned = this.calculateXP(catchData.species, catchData.weight_lbs);
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .update({ 
        xp: (await this.getCurrentXP(userId)) + xpEarned,
      })
      .eq('id', userId)
      .select()
      .single();

    if (profileError) console.error('XP Update Error:', profileError);

    // 4. GAMIFICATION: Check Achievements
    const unlocked = await this.checkAchievements(userId, catchData.species);

    return {
      catchId: catchRecord?.id,
      xpEarned,
      newLevel: profile?.level || 1,
      achievementsUnlocked: unlocked,
      snapshot,
    };
  }

  private static async captureSnapshot(lat: number, lng: number, spotId?: string) {
    const [nws, marine] = await Promise.all([
      fetchNwsWeather(lat, lng),
      fetchMarineConditions(lat, lng)
    ]);

    // Handle water data if spotId is available
    let waterData = null;
    if (spotId) {
      // Note: In a real scenario, we'd look up the site_id from the spots table first
      // For this implementation, we'll assume a helper exists or use a default
    }

    const baroTrend = await EnvironmentManager.getBarometricTrend(1013.25); // Default pressure, in real use we'd fetch actual

    return {
      air_temp: nws?.air_temp_c,
      wind_speed: nws?.wind_speed_ms,
      water_temp: marine?.sea_surface_temp_c,
      baro_trend: baroTrend.trend,
      baro_advice: baroTrend.advice,
      timestamp: new Date().toISOString()
    };
  }

  private static calculateXP(species: string, weight?: number): number {
    let baseXP = 50;
    // Bonus for larger fish
    if (weight && weight > 10) baseXP += 50;
    if (weight && weight > 20) baseXP += 100;
    
    // Bonus for specific "Trophy" species
    const trophySpecies = ['Marlin', 'Sturgeon', 'Trophy Bass'];
    if (trophySpecies.some(s => species.toLowerCase().includes(s.toLowerCase()))) {
      baseXP += 200;
    }
    
    return baseXP;
  }

  private static async getCurrentXP(userId: string): Promise<number> {
    const admin = createAdminClient(); const { data } = await admin.from('profiles').select('xp').eq('id', userId).single();
    return data?.xp || 0;
  }

  private static async checkAchievements(userId: string, species: string): Promise<string[]> {
    const unlocked: string[] = [];
    
    // Example: "First Catch" achievement
    const admin = createAdminClient(); const { data: catches } = await admin.from('catches').select('id').eq('user_id', userId);
    if (catches && catches.length === 1) {
      await this.grantBadge(userId, 'first_catch');
      unlocked.push('first_catch');
    }
    
    return unlocked;
  }

  private static async grantBadge(userId: string, achievementId: string) {
    const admin = createAdminClient(); await admin.from('user_badges').insert({ user_id: userId, achievement_id: achievementId });
  }
}
