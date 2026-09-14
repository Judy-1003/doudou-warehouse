export type AddonType = 'none' | 'milk' | 'coconut' | 'custom';
export type BeanState = 'sealed' | 'open' | 'finished';
export type StorageMode = '常温' | '冷冻';
export type BeanSpecies = '阿拉比卡' | '罗布斯塔' | '利比里卡' | '尤金诺伊德' | '瑰夏' | '铁皮卡' | '波旁' | 'SL28' | '卡杜拉' | '卡蒂姆' | '拼配';
export type DrinkTemperature = 'hot' | 'room' | 'iced';

export interface DrinkCategory {
  id: string;
  name: string;
  addonType: AddonType;
  addonCategoryName?: string;
  custom: boolean;
}

export interface CoffeeBean {
  id: string;
  brand: string;
  name: string;
  species: BeanSpecies;
  origin: string;
  process: string;
  roastLevel: string;
  flavors: string[];
  weightG: number;
  price: number;
  stockG: number;
  initialG: number;
  rating: number;
  note: string;
  roastedAt: string;
  deliveredAt: string;
  openedAt: string;
  finishedAt: string;
  restDays: number;
  bestDays: number;
  state: BeanState;
  storageMode: StorageMode;
  createdAt: number;
}

export interface AddonProduct {
  id: string;
  type: Exclude<AddonType, 'none'>;
  categoryName: string;
  brand: string;
  price: number;
  volumeMl: number;
  stockMl: number;
  defaultMl: number;
  kcalPer100Ml: number;
  proteinPer100Ml: number;
  fatPer100Ml: number;
  sugarPer100Ml: number;
  createdAt: number;
}

export interface BrewLog {
  id: string;
  consumedAt: number;
  categoryId: string;
  categoryName: string;
  temperature: DrinkTemperature;
  beanId: string;
  beanName: string;
  addonType: AddonType;
  addonId: string;
  addonName: string;
  beanGrams: number;
  addonMl: number;
  rating: number;
  photoPath: string;
  beanCost: number;
  addonCost: number;
  totalCost: number;
  caffeineMg: number;
  kcal: number;
  proteinG: number;
  fatG: number;
  sugarG: number;
}

export interface UserSettings {
  defaultBeanGrams: number;
  defaultMilkMl: number;
  defaultCoconutMl: number;
  caffeineMgPerGram: Record<BeanSpecies, number>;
}

export interface AppState {
  schemaVersion: number;
  settings: UserSettings;
  categories: DrinkCategory[];
  beans: CoffeeBean[];
  addons: AddonProduct[];
  logs: BrewLog[];
}

export interface CupDraft {
  categoryId: string;
  temperature: DrinkTemperature;
  beanId: string;
  addonId: string;
  beanGrams: number;
  addonMl: number;
}

export interface CupCalculation {
  beanCost: number;
  addonCost: number;
  totalCost: number;
  caffeineMg: number;
  kcal: number;
  proteinG: number;
  fatG: number;
  sugarG: number;
  addonName: string;
}
