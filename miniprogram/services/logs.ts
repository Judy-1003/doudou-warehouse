import { AppState, CupDraft, DrinkTemperature } from '../models/index';
import { beanInitialG, calculateCup, toDateKey } from '../utils/calculations';
import { getState, removePhoto, saveState } from './storage';

export interface LogEdit {
  categoryId: string;
  temperature: DrinkTemperature;
  beanGrams: number;
  addonId: string;
  addonMl: number;
  rating: number;
}

function syncBeanState(state: AppState, beanId: string): void {
  const bean = state.beans.find((item) => item.id === beanId);
  if (!bean) return;
  const today = toDateKey(new Date());
  if (bean.stockG <= 0) {
    bean.stockG = 0;
    bean.state = 'finished';
    if (!bean.finishedAt) bean.finishedAt = today;
    return;
  }
  if (bean.state === 'finished') {
    bean.state = 'open';
    bean.finishedAt = '';
  }
  if (bean.state === 'sealed') {
    bean.state = 'open';
    if (!bean.openedAt) bean.openedAt = today;
  }
}

function addStock(state: AppState, beanId: string, grams: number): number {
  const bean = state.beans.find((item) => item.id === beanId);
  if (!bean) return 0;
  const initial = beanInitialG(bean);
  const before = bean.stockG;
  const next = before + grams;
  bean.stockG = Math.round(Math.max(0, initial > 0 ? Math.min(initial, next) : next) * 10) / 10;
  syncBeanState(state, beanId);
  return Math.round((bean.stockG - before) * 10) / 10;
}

function addAddonStock(state: AppState, addonId: string, ml: number): number {
  if (!addonId || !ml) return 0;
  const addon = state.addons.find((item) => item.id === addonId);
  if (!addon) return 0;
  const before = addon.stockMl || 0;
  const cap = addon.volumeMl > 0 ? addon.volumeMl : before + ml;
  addon.stockMl = Math.round(Math.max(0, Math.min(cap, before + ml)));
  return addon.stockMl - before;
}

export function consumeAddonStock(state: AppState, addonId: string, ml: number): void {
  addAddonStock(state, addonId, -ml);
}

export function addonStockShortage(state: AppState, addonId: string, ml: number): { brand: string; stockMl: number } | null {
  if (!addonId || !(ml > 0)) return null;
  const addon = state.addons.find((item) => item.id === addonId);
  if (!addon) return null;
  const stockMl = addon.stockMl || 0;
  return stockMl < ml ? { brand: addon.brand, stockMl: Math.round(stockMl) } : null;
}

export function deleteLogById(id: string): { beanGrams: number; addonMl: number } | null {
  const state = getState();
  const index = state.logs.findIndex((item) => item.id === id);
  if (index < 0) return null;
  const removed = state.logs.splice(index, 1)[0];
  const bean = state.beans.find((item) => item.id === removed.beanId);
  const beanGrams = bean ? addStock(state, bean.id, removed.beanGrams) : 0;
  const addonMl = addAddonStock(state, removed.addonId, removed.addonMl);
  saveState(state);
  removePhoto(removed.photoPath);
  return { beanGrams, addonMl };
}

export function clearAllLogs(restoreMaterials: boolean): { logs: number; beanGrams: number; addonMl: number } {
  const state = getState();
  const removed = state.logs;
  let beanGrams = 0;
  let addonMl = 0;
  if (restoreMaterials) {
    removed.forEach((log) => {
      beanGrams += addStock(state, log.beanId, log.beanGrams);
      addonMl += addAddonStock(state, log.addonId, log.addonMl);
    });
  }
  state.logs = [];
  saveState(state);
  removed.forEach((log) => removePhoto(log.photoPath));
  return {
    logs: removed.length,
    beanGrams: Math.round(beanGrams * 10) / 10,
    addonMl: Math.round(addonMl)
  };
}

export function restoreText(removed: { beanGrams: number; addonMl: number }): string {
  const parts: string[] = [];
  if (removed.beanGrams > 0) parts.push(`${removed.beanGrams}g 豆子`);
  if (removed.addonMl > 0) parts.push(`${removed.addonMl}ml 物料`);
  return parts.length ? `已删除 · 归还 ${parts.join(' + ')}` : '已删除';
}

export function updateLogById(id: string, edit: LogEdit): { ok: boolean; message?: string } {
  const state = getState();
  const log = state.logs.find((item) => item.id === id);
  if (!log) return { ok: false, message: '记录不存在' };
  const category = state.categories.find((item) => item.id === edit.categoryId);
  if (!category) return { ok: false, message: '请选择咖啡品类' };
  if (!(edit.beanGrams > 0)) return { ok: false, message: '请填写豆子用量' };
  const bean = state.beans.find((item) => item.id === log.beanId);
  const delta = Math.round((edit.beanGrams - log.beanGrams) * 10) / 10;
  if (bean && delta > 0 && bean.stockG < delta) {
    return { ok: false, message: `豆子仅剩 ${bean.stockG}g` };
  }
  const addonId = category.addonType === 'none' ? '' : edit.addonId;
  const addonMl = category.addonType === 'none' ? 0 : edit.addonMl;
  const draft: CupDraft = {
    categoryId: category.id,
    temperature: edit.temperature,
    beanId: log.beanId,
    addonId,
    addonMl,
    beanGrams: edit.beanGrams
  };
  const calculation = calculateCup(state, draft);
  if (!calculation) return { ok: false, message: '这包豆子已不在豆仓，无法修改' };
  if (bean && delta !== 0) addStock(state, bean.id, -delta);
  addAddonStock(state, log.addonId, log.addonMl);
  const shortage = addonStockShortage(state, addonId, addonMl);
  if (shortage) {
    addAddonStock(state, log.addonId, -log.addonMl);
    if (bean && delta !== 0) addStock(state, bean.id, delta);
    return { ok: false, message: `${shortage.brand} 仅剩 ${shortage.stockMl}ml` };
  }
  addAddonStock(state, addonId, -addonMl);
  log.categoryId = category.id;
  log.categoryName = category.name;
  log.temperature = edit.temperature;
  log.addonType = category.addonType;
  log.addonId = addonId;
  log.addonName = calculation.addonName;
  log.beanGrams = edit.beanGrams;
  log.addonMl = addonMl;
  log.rating = edit.rating;
  log.beanCost = calculation.beanCost;
  log.addonCost = calculation.addonCost;
  log.totalCost = calculation.totalCost;
  log.caffeineMg = calculation.caffeineMg;
  log.kcal = calculation.kcal;
  log.proteinG = calculation.proteinG;
  log.fatG = calculation.fatG;
  log.sugarG = calculation.sugarG;
  saveState(state);
  return { ok: true };
}
