import { AppState, CupCalculation, CupDraft, DrinkCategory, DrinkTemperature } from '../../models/index';
import { addonDefaultMl, beanInitialG, beanStockPercent, calculateCup, money, round1, shortBeanName, summarizeLogs, temperatureText, toDateKey } from '../../utils/calculations';
import { createId, getState, persistPhoto, saveState, subscribeState } from '../../services/storage';
import { deleteLogById, consumeAddonStock, addonStockShortage, restoreText } from '../../services/logs';

type SheetName = '' | 'more' | 'rating';

const TEMPERATURE_OPTIONS: Array<{ value: DrinkTemperature; label: string }> = [
  { value: 'hot', label: '热' },
  { value: 'room', label: '常温' },
  { value: 'iced', label: '冰' }
];

function categoryAddons(state: AppState, category: DrinkCategory | null) {
  if (!category || category.addonType === 'none') return [];
  return state.addons.filter((item) => item.type === category.addonType
    && (category.addonType !== 'custom' || !category.addonCategoryName || item.categoryName === category.addonCategoryName));
}

function addonTitle(category: DrinkCategory | null): string {
  if (!category) return '辅料';
  if (category.addonType === 'milk') return '牛奶';
  if (category.addonType === 'coconut') return '椰子水';
  return category.addonCategoryName || '辅料';
}

Page({
  data: {
    state: null as AppState | null,
    dateLabel: '',
    todayKey: '',
    todayCount: 0,
    mainCategories: [] as DrinkCategory[],
    moreCategories: [] as DrinkCategory[],
    moreActive: false,
    temperatureOptions: TEMPERATURE_OPTIONS,
    activeTemperatureText: '热',
    weekdays: ['一', '二', '三', '四', '五', '六', '日'],
    activeCategory: null as DrinkCategory | null,
    availableBeans: [] as any[],
    visibleAddons: [] as any[],
    activeAddonTitle: '',
    activeAddonName: '',
    addonUsageText: '',
    beanGramsCustom: false,
    beanGramsInput: '16.5',
    draft: { categoryId: '', temperature: 'hot', beanId: '', addonId: '', beanGrams: 16.5, addonMl: 0 } as CupDraft,
    calculation: null as CupCalculation | null,
    todayLogs: [] as any[],
    todaySummary: null as any,
    calendarDays: [] as any[],
    calendarLabel: '',
    calendarSummary: '',
    calendarYear: 0,
    calendarMonth: 0,
    canNextMonth: false,
    sheet: '' as SheetName,
    swipeLogId: '',
    rating: 0,
    photoPath: ''
  },

  onLoad() {
    const now = new Date();
    this.setData({ calendarYear: now.getFullYear(), calendarMonth: now.getMonth() + 1 });
    this._unsubscribeState = subscribeState(() => this.loadPage());
  },

  onShow() { this.loadPage(); },

  onUnload() {
    if (this._unsubscribeState) this._unsubscribeState();
    this._unsubscribeState = null;
  },

  onPullDownRefresh() {
    this.loadPage();
    wx.stopPullDownRefresh();
  },

  loadPage() {
    const state = getState();
    const available = state.beans.filter((bean) => bean.state !== 'finished' && bean.stockG > 0);
    const previous = this.data.draft;
    let categoryId = state.categories.some((item) => item.id === previous.categoryId)
      ? previous.categoryId : (state.categories[0]?.id || '');
    const category = state.categories.find((item) => item.id === categoryId) || null;
    let beanId = available.some((item) => item.id === previous.beanId)
      ? previous.beanId : (available[0]?.id || '');
    const addons = categoryAddons(state, category);
    let addonId = addons.some((item) => item.id === previous.addonId)
      ? previous.addonId : (addons[0]?.id || '');
    const selectedAddon = addons.find((item) => item.id === addonId);
    const draft: CupDraft = {
      categoryId,
      temperature: previous.temperature || 'hot',
      beanId,
      addonId,
      beanGrams: this._beanGramsEdited && previous.beanGrams > 0
        ? previous.beanGrams
        : state.settings.defaultBeanGrams,
      addonMl: category?.addonType === 'none'
        ? 0
        : addonDefaultMl(selectedAddon, state.settings)
    };
    this.applyView(state, draft);
  },

  applyView(state: AppState, draft: CupDraft) {
    const now = new Date();
    const todayKey = toDateKey(now);
    const activeCategory = state.categories.find((item) => item.id === draft.categoryId) || null;
    const availableBeans = state.beans
      .filter((bean) => bean.state !== 'finished' && bean.stockG > 0)
      .map((bean) => {
        const stockPercent = beanStockPercent(bean);
        return {
          ...bean,
          shortName: shortBeanName(bean),
          initialText: round1(beanInitialG(bean)),
          stockPercent,
          stockStyle: `width:${stockPercent.toFixed(1)}%;`
        };
      });
    const visibleAddons = categoryAddons(state, activeCategory)
      .map((item) => ({ ...item, selected: item.id === draft.addonId }));
    const todayLogs = state.logs
      .filter((log) => toDateKey(new Date(log.consumedAt)) === todayKey)
      .map((log) => ({
        ...log,
        temperatureText: temperatureText(log.temperature),
        time: this.timeText(log.consumedAt),
        costText: money(log.totalCost)
      }));
    const summary = summarizeLogs(todayLogs);
    const mainCategories = state.categories.slice(0, 3);
    const moreCategories = state.categories.slice(3);
    const calendar = this.buildCalendar(state);
    this.setData({
      state,
      dateLabel: this.fullDateText(now),
      todayKey,
      todayCount: todayLogs.length,
      mainCategories,
      moreCategories,
      moreActive: moreCategories.some((item) => item.id === draft.categoryId),
      activeTemperatureText: temperatureText(draft.temperature),
      activeCategory,
      availableBeans,
      visibleAddons,
      activeAddonTitle: addonTitle(activeCategory),
      activeAddonName: activeCategory?.addonType === 'custom'
        ? (activeCategory.addonCategoryName || '辅料')
        : activeCategory?.addonType === 'milk' ? '牛奶' : '椰子水',
      addonUsageText: draft.addonMl ? `每杯 ${draft.addonMl}ml` : '',
      beanGramsCustom: draft.beanGrams !== state.settings.defaultBeanGrams,
      beanGramsInput: String(draft.beanGrams),
      draft,
      calculation: this.calculationView(draft.beanId ? calculateCup(state, draft) : null),
      todayLogs,
      todaySummary: {
        ...summary,
        totalCostText: money(summary.totalCost),
        caffeineText: Math.round(summary.caffeineMg),
        proteinText: summary.proteinG.toFixed(1),
        fatText: summary.fatG.toFixed(1),
        sugarText: summary.sugarG.toFixed(1)
      },
      ...calendar
    });
  },

  calculationView(calculation: CupCalculation | null) {
    if (!calculation) return null;
    return {
      ...calculation,
      totalCostText: money(calculation.totalCost),
      beanCostText: money(calculation.beanCost),
      addonCostText: money(calculation.addonCost)
    };
  },

  buildCalendar(state: AppState) {
    const year = this.data.calendarYear || new Date().getFullYear();
    const month = this.data.calendarMonth || new Date().getMonth() + 1;
    const firstDay = new Date(year, month - 1, 1);
    const offset = (firstDay.getDay() + 6) % 7;
    const count = new Date(year, month, 0).getDate();
    const todayKey = toDateKey(new Date());
    const byDay: Record<string, any[]> = {};
    state.logs.forEach((log) => {
      const key = toDateKey(new Date(log.consumedAt));
      if (key.slice(0, 7) === `${year}-${String(month).padStart(2, '0')}`) {
        (byDay[key] ||= []).push(log);
      }
    });
    const calendarDays: any[] = [];
    for (let index = 0; index < offset; index += 1) calendarDays.push({ key: `blank-${index}`, blank: true });
    for (let day = 1; day <= count; day += 1) {
      const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const logs = byDay[key] || [];
      calendarDays.push({
        key,
        day,
        blank: false,
        isToday: key === todayKey,
        isFuture: key > todayKey,
        hasLog: logs.length > 0,
        hasPhoto: logs.some((log) => !!log.photoPath),
        photoPath: logs.find((log) => !!log.photoPath)?.photoPath || '',
        count: logs.length
      });
    }
    const monthLogs = Object.values(byDay).reduce((all, list) => all.concat(list), [] as any[]);
    const monthSummary = summarizeLogs(monthLogs);
    const now = new Date();
    return {
      calendarDays,
      calendarLabel: `${year} 年 ${month} 月`,
      calendarSummary: `本月 ${monthLogs.length} 杯 · ¥${money(monthSummary.totalCost)}`,
      canNextMonth: year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)
    };
  },

  selectCategory(event: any) {
    const categoryId = event.currentTarget.dataset.id as string;
    const state = this.data.state as AppState;
    const category = state.categories.find((item) => item.id === categoryId);
    if (!category) return;
    const addons = categoryAddons(state, category);
    const draft = {
      ...this.data.draft,
      categoryId,
      addonId: addons[0]?.id || '',
      addonMl: category.addonType === 'none' ? 0 : addonDefaultMl(addons[0], state.settings)
    };
    this.applyView(state, draft);
    if (this.data.sheet === 'more') this.closeSheet();
  },

  selectTemperature(event: any) {
    const temperature = event.currentTarget.dataset.value as DrinkTemperature;
    if (!TEMPERATURE_OPTIONS.some((item) => item.value === temperature)) return;
    const draft = { ...this.data.draft, temperature };
    this.applyView(this.data.state as AppState, draft);
  },

  selectBean(event: any) {
    const draft = { ...this.data.draft, beanId: event.currentTarget.dataset.id };
    this.applyView(this.data.state as AppState, draft);
  },

  selectAddon(event: any) {
    const state = this.data.state as AppState;
    const addonId = event.currentTarget.dataset.id as string;
    const addon = state.addons.find((item) => item.id === addonId);
    const draft = {
      ...this.data.draft,
      addonId,
      addonMl: addonDefaultMl(addon, state.settings)
    };
    this.applyView(state, draft);
  },

  adjustBeanGrams(event: any) {
    const step = Number(event.currentTarget.dataset.step);
    this.setBeanGrams(Number(this.data.draft.beanGrams) + step);
  },

  onBeanGramsInput(event: any) {
    this.setData({ beanGramsInput: event.detail.value });
  },

  commitBeanGrams(event: any) {
    const value = Number(event.detail.value);
    this.setBeanGrams(value > 0 ? value : (this.data.state as AppState).settings.defaultBeanGrams);
  },

  setBeanGrams(value: number) {
    const grams = Math.max(0.5, Math.min(200, Math.round(value * 10) / 10));
    this._beanGramsEdited = true;
    this.applyView(this.data.state as AppState, { ...this.data.draft, beanGrams: grams });
  },

  resetBeanGrams() {
    this._beanGramsEdited = false;
    this.applyView(this.data.state as AppState, {
      ...this.data.draft,
      beanGrams: (this.data.state as AppState).settings.defaultBeanGrams
    });
  },

  openSheet(event: any) { this.setData({ sheet: event.currentTarget.dataset.sheet }); },
  closeSheet() { this.setData({ sheet: '' }); },
  stopPropagation() {},

  onLogTouchStart(event: any) {
    const touch = event.touches?.[0];
    if (!touch) return;
    this._logTouch = {
      id: event.currentTarget.dataset.id as string,
      startX: touch.clientX,
      startY: touch.clientY,
      deltaX: 0,
      deltaY: 0
    };
  },

  onLogTouchMove(event: any) {
    const touch = event.touches?.[0];
    if (!touch || !this._logTouch) return;
    this._logTouch.deltaX = touch.clientX - this._logTouch.startX;
    this._logTouch.deltaY = touch.clientY - this._logTouch.startY;
  },

  onLogTouchEnd() {
    const info = this._logTouch;
    this._logTouch = null;
    if (!info) return;
    if (Math.abs(info.deltaY) > Math.abs(info.deltaX)) return;
    if (info.deltaX <= -40) this.setData({ swipeLogId: info.id });
    else if (this.data.swipeLogId) this.setData({ swipeLogId: '' });
  },

  deleteLog(event: any) {
    const id = event.currentTarget.dataset.id as string;
    const removed = deleteLogById(id);
    if (!removed) return;
    this.setData({ swipeLogId: '' });
    this.loadPage();
    wx.showToast({ title: restoreText(removed), icon: 'none' });
  },

  startRating() {
    const { activeCategory, visibleAddons, draft } = this.data;
    if (!draft.beanId) return wx.showToast({ title: '请先登记并选择咖啡豆', icon: 'none' });
    if (activeCategory?.addonType !== 'none' && !visibleAddons.length) {
      return wx.showToast({ title: `请先在饮品架添加${this.data.activeAddonName}`, icon: 'none' });
    }
    this.setData({ sheet: 'rating', rating: 0, photoPath: '' });
  },

  changeRating(event: any) { this.setData({ rating: Number(event.detail.value) }); },

  choosePhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (result: any) => this.setData({ photoPath: result.tempFiles?.[0]?.tempFilePath || '' })
    });
  },

  async saveCup() {
    if (this._savingCup) return;
    const state = this.data.state as AppState;
    const bean = state.beans.find((item) => item.id === this.data.draft.beanId);
    const category = state.categories.find((item) => item.id === this.data.draft.categoryId);
    const calculation = calculateCup(state, this.data.draft);
    if (!bean || !category || !calculation) return;
    if (bean.stockG < this.data.draft.beanGrams) {
      return wx.showToast({ title: `豆子仅剩 ${bean.stockG}g`, icon: 'none' });
    }
    const shortage = addonStockShortage(state, this.data.draft.addonId, this.data.draft.addonMl);
    if (shortage) {
      return wx.showToast({ title: `${shortage.brand} 仅剩 ${shortage.stockMl}ml，请先补满`, icon: 'none' });
    }
    this._savingCup = true;
    try {
      const photoPath = this.data.photoPath ? await persistPhoto(this.data.photoPath) : '';
      const now = Date.now();
      bean.stockG = Math.max(0, Math.round((bean.stockG - this.data.draft.beanGrams) * 10) / 10);
      if (bean.state === 'sealed') { bean.state = 'open'; bean.openedAt = toDateKey(new Date(now)); }
      if (bean.stockG === 0) { bean.state = 'finished'; bean.finishedAt = toDateKey(new Date(now)); }
      consumeAddonStock(state, this.data.draft.addonId, this.data.draft.addonMl);
      state.logs.unshift({
        id: createId('log'), consumedAt: now,
        categoryId: category.id, categoryName: category.name,
        temperature: this.data.draft.temperature,
        beanId: bean.id, beanName: shortBeanName(bean),
        addonType: category.addonType,
        addonId: this.data.draft.addonId,
        beanGrams: this.data.draft.beanGrams,
        addonMl: this.data.draft.addonMl,
        rating: this.data.rating,
        photoPath,
        ...calculation
      });
      saveState(state);
      this.setData({ sheet: '', rating: 0, photoPath: '' });
      this._beanGramsEdited = false;
      this.loadPage();
      wx.showToast({ title: '已保存', icon: 'success' });
    } finally {
      this._savingCup = false;
    }
  },

  shiftMonth(event: any) {
    const step = Number(event.currentTarget.dataset.step);
    if (step > 0 && !this.data.canNextMonth) return;
    let year = this.data.calendarYear;
    let month = this.data.calendarMonth + step;
    if (month < 1) { month = 12; year -= 1; }
    if (month > 12) { month = 1; year += 1; }
    this.setData({ calendarYear: year, calendarMonth: month }, () => this.applyView(this.data.state as AppState, this.data.draft));
  },

  onCalendarTouchStart(event: any) { this._touchX = event.changedTouches?.[0]?.clientX || 0; },
  onCalendarTouchEnd(event: any) {
    const end = event.changedTouches?.[0]?.clientX || 0;
    const delta = end - (this._touchX || 0);
    if (Math.abs(delta) > 50) this.shiftMonth({ currentTarget: { dataset: { step: delta < 0 ? 1 : -1 } } });
  },

  tapCalendarDay(event: any) {
    const key = event.currentTarget.dataset.key as string;
    if (!key || key.indexOf('blank') === 0) return;
    if (key > toDateKey(new Date())) return;
    wx.navigateTo({ url: `/pages/day-logs/index?date=${key}` });
  },

  fullDateText(date: Date) {
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    return `${date.getMonth() + 1}月${date.getDate()}日 ${weekdays[date.getDay()]}`;
  },

  timeText(timestamp: number) {
    const date = new Date(timestamp);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  },

  _touchX: 0,
  _logTouch: null as null | { id: string; startX: number; startY: number; deltaX: number; deltaY: number },
  _savingCup: false,
  _beanGramsEdited: false,
  _unsubscribeState: null as null | (() => void)
});
