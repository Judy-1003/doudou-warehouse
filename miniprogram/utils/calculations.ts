import {
  AddonProduct,
  AppState,
  BrewLog,
  CoffeeBean,
  CupCalculation,
  CupDraft,
  DrinkTemperature,
  UserSettings
} from '../models/index';

export type StatsRange = 'week' | 'month' | 'year';

export function round1(value: number): number { return Math.round(value * 10) / 10; }
export function round2(value: number): number { return Math.round(value * 100) / 100; }
export function money(value: number): string { return round2(value).toFixed(2); }

export function temperatureText(value: DrinkTemperature): string {
  if (value === 'room') return '常温';
  if (value === 'iced') return '冰';
  return '热';
}

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function parseDateKey(value: string): Date {
  const parts = value.split('-').map(Number);
  return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
}

export function addDays(value: string, days: number): string {
  const date = parseDateKey(value);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

export function daysBetween(from: string, to: string): number {
  const day = 24 * 60 * 60 * 1000;
  return Math.floor((parseDateKey(to).getTime() - parseDateKey(from).getTime()) / day);
}

export function beanUnitPrice(bean: CoffeeBean): number {
  return bean.weightG > 0 ? bean.price / bean.weightG : 0;
}

export function beanInitialG(bean: CoffeeBean): number {
  if (bean.initialG > 0) return bean.initialG;
  if (bean.weightG > 0) return bean.weightG;
  return bean.stockG;
}

export function beanStockPercent(bean: CoffeeBean): number {
  const initial = beanInitialG(bean);
  if (!(initial > 0)) return 0;
  return Math.max(0, Math.min(100, bean.stockG / initial * 100));
}

export function shortBeanName(bean: CoffeeBean): string {
  const parts = bean.name.split('·');
  return (parts[parts.length - 1] || bean.name).trim();
}

export function filledText(value: string | undefined): string {
  const text = (value || '').trim();
  return text === '未填写' ? '' : text;
}

export function joinFilled(values: Array<string | undefined>, separator = ' · '): string {
  return values.map(filledText).filter(Boolean).join(separator);
}

export function addonDefaultMl(addon: AddonProduct | undefined, settings: UserSettings): number {
  if (addon?.defaultMl && addon.defaultMl > 0) return addon.defaultMl;
  if (addon?.type === 'milk') return settings.defaultMilkMl;
  if (addon?.type === 'coconut') return settings.defaultCoconutMl;
  return 100;
}

export function calculateCup(state: AppState, draft: CupDraft): CupCalculation | null {
  const bean = state.beans.find((item) => item.id === draft.beanId);
  const category = state.categories.find((item) => item.id === draft.categoryId);
  if (!bean || !category) return null;

  const beanCost = draft.beanGrams * beanUnitPrice(bean);
  const result: CupCalculation = {
    beanCost: round2(beanCost),
    addonCost: 0,
    totalCost: round2(beanCost),
    caffeineMg: round1(draft.beanGrams * (state.settings.caffeineMgPerGram[bean.species] || 11)),
    kcal: 0,
    proteinG: 0,
    fatG: 0,
    sugarG: 0,
    addonName: ''
  };

  if (category.addonType !== 'none' && draft.addonId) {
    const addon = state.addons.find((item) => item.id === draft.addonId);
    if (addon) {
      result.addonName = addon.brand;
      result.addonCost = round2(draft.addonMl * addon.price / addon.volumeMl);
      result.totalCost = round2(result.beanCost + result.addonCost);
      result.kcal = round1(addon.kcalPer100Ml * draft.addonMl / 100);
      result.proteinG = round1(addon.proteinPer100Ml * draft.addonMl / 100);
      result.fatG = round1(addon.fatPer100Ml * draft.addonMl / 100);
      result.sugarG = round1(addon.sugarPer100Ml * draft.addonMl / 100);
    }
  }
  return result;
}

export function beanStatus(bean: CoffeeBean, now = new Date()): { label: string; tone: string } {
  if (bean.state === 'finished') return { label: '已喝完', tone: 'muted-badge' };
  const today = toDateKey(now);
  const sinceRoast = Math.max(0, daysBetween(bean.roastedAt, today));
  const bestLeft = bean.restDays + bean.bestDays - sinceRoast;
  if (bean.state === 'sealed') {
    return sinceRoast < bean.restDays
      ? { label: `养豆第 ${sinceRoast} 天`, tone: 'warning' }
      : { label: `未启封 · ${bean.storageMode}`, tone: '' };
  }
  if (sinceRoast < bean.restDays) return { label: `养豆第 ${sinceRoast} 天`, tone: 'warning' };
  if (bestLeft <= 0) return { label: '已过赏味期', tone: 'danger' };
  if (bestLeft <= 7) return { label: `赏味剩 ${bestLeft} 天`, tone: 'warning' };
  return { label: '正值赏味期', tone: '' };
}

export function forecastDays(bean: CoffeeBean, logs: BrewLog[], now = new Date()): number | null {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).getTime();
  const total = logs
    .filter((log) => log.beanId === bean.id && log.consumedAt >= start)
    .reduce((sum, log) => sum + log.beanGrams, 0);
  const daily = total / 7;
  return daily > 0 ? Math.max(0, Math.floor(bean.stockG / daily)) : null;
}

export function volumeText(ml: number): string {
  return ml >= 1000 ? `${round1(ml / 1000)} L` : `${Math.round(ml)} ml`;
}

export function rangeStart(range: StatsRange, now = new Date()): Date {
  if (range === 'week') {
    const day = (now.getDay() + 6) % 7;
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
  }
  if (range === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  return new Date(now.getFullYear(), 0, 1);
}

export function logsInRange(logs: BrewLog[], range: StatsRange, now = new Date()): BrewLog[] {
  const start = rangeStart(range, now).getTime();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  return logs.filter((log) => log.consumedAt >= start && log.consumedAt < end);
}

export function summarizeLogs(logs: BrewLog[]) {
  return logs.reduce((sum, log) => {
    sum.cups += 1;
    sum.beanGrams += log.beanGrams;
    sum.milkMl += log.addonType === 'milk' ? log.addonMl : 0;
    sum.coconutMl += log.addonType === 'coconut' ? log.addonMl : 0;
    sum.beanCost += log.beanCost;
    sum.milkCost += log.addonType === 'milk' ? log.addonCost : 0;
    sum.coconutCost += log.addonType === 'coconut' ? log.addonCost : 0;
    sum.totalCost += log.totalCost;
    sum.caffeineMg += log.caffeineMg;
    sum.proteinG += log.proteinG;
    sum.fatG += log.fatG;
    sum.sugarG += log.sugarG;
    return sum;
  }, {
    cups: 0, beanGrams: 0, milkMl: 0, coconutMl: 0,
    beanCost: 0, milkCost: 0, coconutCost: 0, totalCost: 0,
    caffeineMg: 0, proteinG: 0, fatG: 0, sugarG: 0
  });
}

export function findAddon(addons: AddonProduct[], id: string): AddonProduct | undefined {
  return addons.find((item) => item.id === id);
}
