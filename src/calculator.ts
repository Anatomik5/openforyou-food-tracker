import type { UserGoals } from './types';

export type Sex = 'male' | 'female';
export type Build = 'lean' | 'average' | 'high';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'high';
export type Strategy = 'lose' | 'maintain' | 'gain' | 'lowcarb';

export interface BodyProfile {
  sex: Sex;
  age: number;
  height_cm: number;
  weight_kg: number;
  build: Build;
  activity: Activity;
  strategy: Strategy;
}

export const DEFAULT_PROFILE: BodyProfile = {
  sex: 'male',
  age: 30,
  height_cm: 175,
  weight_kg: 75,
  build: 'average',
  activity: 'light',
  strategy: 'maintain',
};

const ACTIVITY_FACTOR: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
};

// Mifflin-St Jeor assumes an "average" composition. Lean mass burns more per kg
// than fat mass, so the BMR is nudged by body type.
const BUILD_FACTOR: Record<Build, number> = { lean: 1.04, average: 1, high: 0.93 };

const STRATEGY_KCAL: Record<Strategy, number> = { lose: 0.82, maintain: 1, gain: 1.15, lowcarb: 1 };
const PROTEIN_PER_KG: Record<Strategy, number> = { lose: 2.0, maintain: 1.6, gain: 1.8, lowcarb: 2.0 };
const FAT_SHARE: Record<Strategy, number> = { lose: 0.28, maintain: 0.3, gain: 0.25, lowcarb: 0 };
const LOWCARB_CARB_SHARE = 0.22;

export function calculateBmr(p: BodyProfile): number {
  const base = 10 * p.weight_kg + 6.25 * p.height_cm - 5 * p.age + (p.sex === 'male' ? 5 : -161);
  return base * BUILD_FACTOR[p.build];
}

export function calculateGoals(p: BodyProfile): UserGoals {
  const tdee = calculateBmr(p) * ACTIVITY_FACTOR[p.activity];
  const kcal = Math.max(1000, Math.round((tdee * STRATEGY_KCAL[p.strategy]) / 10) * 10);

  // With a high body-fat share protein is based on ~85% of body weight (closer to lean mass).
  const proteinWeight = p.weight_kg * (p.build === 'high' ? 0.85 : 1);
  const protein = Math.round(PROTEIN_PER_KG[p.strategy] * proteinWeight);

  let fat: number;
  let carbs: number;
  if (p.strategy === 'lowcarb') {
    carbs = Math.round((kcal * LOWCARB_CARB_SHARE) / 4);
    fat = Math.max(30, Math.round((kcal - carbs * 4 - protein * 4) / 9));
  } else {
    fat = Math.round((kcal * FAT_SHARE[p.strategy]) / 9);
    carbs = Math.max(50, Math.round((kcal - protein * 4 - fat * 9) / 4));
  }
  return { kcal, protein, fat, carbs };
}
