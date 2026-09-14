import { AppState, DrinkTemperature } from '../models/index';

const STORAGE_KEY = 'doudou_warehouse_state_v1';
type StateListener = () => void;
const stateListeners: StateListener[] = [];

const DEFAULT_STATE: AppState = {
  schemaVersion: 1,
  settings: {
    defaultBeanGrams: 16.5,
    defaultMilkMl: 250,
    defaultCoconutMl: 200,
    caffeineMgPerGram: {
      '阿拉比卡': 11,
      '罗布斯塔': 20,
      '利比里卡': 13,
      '尤金诺伊德': 6,
      '瑰夏': 11,
      '铁皮卡': 11,
      '波旁': 11,
      'SL28': 12,
      '卡杜拉': 11,
      '卡蒂姆': 14,
      '拼配': 14
    }
  },
  categories: [
    { id: 'latte', name: '拿铁', addonType: 'milk', custom: false },
    { id: 'americano', name: '美式', addonType: 'none', custom: false },
    { id: 'coconut-americano', name: '椰青美式', addonType: 'coconut', custom: false },
    { id: 'oat-latte', name: '燕麦拿铁', addonType: 'milk', custom: false }
  ],
  beans: [],
  addons: [],
  logs: []
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeTemperature(value: unknown): DrinkTemperature {
  if (value === 'room' || value === 'iced') return value;
  return 'hot';
}

function normalize(raw: Partial<AppState> | null | undefined): AppState {
  if (!raw || raw.schemaVersion !== 1) return clone(DEFAULT_STATE);
  const settings = {
    ...DEFAULT_STATE.settings,
    ...(raw.settings || {}),
    caffeineMgPerGram: {
      ...DEFAULT_STATE.settings.caffeineMgPerGram,
      ...(raw.settings?.caffeineMgPerGram || {})
    }
  };
  return {
    schemaVersion: 1,
    settings,
    categories: Array.isArray(raw.categories) && raw.categories.length ? raw.categories : clone(DEFAULT_STATE.categories),
    beans: Array.isArray(raw.beans) ? raw.beans.map((bean) => ({
      ...bean,
      initialG: bean.initialG && bean.initialG > 0 ? bean.initialG : (bean.weightG || bean.stockG || 0)
    })) : [],
    addons: Array.isArray(raw.addons) ? raw.addons.map((addon) => ({
      ...addon,
      categoryName: addon.categoryName || (addon.type === 'milk' ? '牛奶 / 奶类' : addon.type === 'coconut' ? '椰子水' : '自定义'),
      defaultMl: addon.defaultMl || (addon.type === 'milk' ? settings.defaultMilkMl : addon.type === 'coconut' ? settings.defaultCoconutMl : 100),
      stockMl: typeof addon.stockMl === 'number' && addon.stockMl >= 0
        ? Math.min(addon.stockMl, addon.volumeMl || addon.stockMl)
        : (addon.volumeMl || 0)
    })) : [],
    logs: Array.isArray(raw.logs) ? raw.logs.map((log) => ({
      ...log,
      temperature: normalizeTemperature(log.temperature)
    })) : []
  };
}

export function ensureState(): AppState {
  try {
    const stored = wx.getStorageSync(STORAGE_KEY) as AppState | undefined;
    const state = normalize(stored);
    if (!stored) wx.setStorageSync(STORAGE_KEY, state);
    return clone(state);
  } catch (error) {
    console.error('初始化本地数据失败', error);
    return clone(DEFAULT_STATE);
  }
}

export function getState(): AppState {
  return ensureState();
}

export function saveState(state: AppState): void {
  wx.setStorageSync(STORAGE_KEY, clone(state));
  stateListeners.slice().forEach((listener) => listener());
}

export function subscribeState(listener: StateListener): () => void {
  stateListeners.push(listener);
  return () => {
    const index = stateListeners.indexOf(listener);
    if (index >= 0) stateListeners.splice(index, 1);
  };
}

export function updateState(mutator: (state: AppState) => void): AppState {
  const state = getState();
  mutator(state);
  saveState(state);
  return state;
}

export function resetState(): AppState {
  const previous = getState();
  previous.logs.forEach((log) => removePhoto(log.photoPath));
  const fresh = clone(DEFAULT_STATE);
  saveState(fresh);
  return fresh;
}

export function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function persistPhoto(tempFilePath: string): Promise<string> {
  return new Promise((resolve) => {
    wx.saveFile({
      tempFilePath,
      success: (result: any) => resolve(result.savedFilePath || tempFilePath),
      fail: () => resolve(tempFilePath)
    });
  });
}

export function removePhoto(savedFilePath: string): void {
  if (!savedFilePath) return;
  try {
    wx.removeSavedFile({ filePath: savedFilePath, fail: () => {} });
  } catch (error) {
    console.warn('删除本地照片失败', error);
  }
}
