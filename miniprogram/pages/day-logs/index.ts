import { AppState, DrinkCategory, DrinkTemperature } from '../../models/index';
import { addonDefaultMl, money, parseDateKey, summarizeLogs, temperatureText, toDateKey } from '../../utils/calculations';
import { deleteLogById, restoreText, updateLogById } from '../../services/logs';
import { getState } from '../../services/storage';

const TEMPERATURE_OPTIONS: Array<{ value: DrinkTemperature; label: string }> = [
  { value: 'hot', label: '热' },
  { value: 'room', label: '常温' },
  { value: 'iced', label: '冰' }
];

function categoryAddons(state: AppState, category: DrinkCategory | undefined) {
  if (!category || category.addonType === 'none') return [];
  return state.addons.filter((item) => item.type === category.addonType
    && (category.addonType !== 'custom' || !category.addonCategoryName || item.categoryName === category.addonCategoryName));
}

Page({
  data: {
    dateKey: '',
    dateLabel: '',
    logs: [] as any[],
    summaryText: '',
    swipeLogId: '',
    temperatureOptions: TEMPERATURE_OPTIONS,
    categories: [] as DrinkCategory[],
    editing: false,
    editingId: '',
    editCategoryId: '',
    editTemperature: 'hot' as DrinkTemperature,
    editBeanGrams: '',
    editAddonId: '',
    editAddonMl: '',
    editRating: 0,
    editAddons: [] as any[],
    editAddonLabel: ''
  },

  onLoad(options: Record<string, string>) {
    const dateKey = options.date || toDateKey(new Date());
    this.setData({ dateKey, dateLabel: this.dateText(dateKey) });
  },

  onShow() { this.loadPage(); },

  loadPage() {
    const state = getState();
    const logs = state.logs
      .filter((log) => toDateKey(new Date(log.consumedAt)) === this.data.dateKey)
      .sort((a, b) => b.consumedAt - a.consumedAt)
      .map((log) => ({
        ...log,
        temperatureText: temperatureText(log.temperature),
        timeText: this.timeText(log.consumedAt),
        costText: money(log.totalCost)
      }));
    const summary = summarizeLogs(logs);
    this.setData({
      logs,
      categories: state.categories,
      summaryText: logs.length ? `${logs.length} 杯 · ¥${money(summary.totalCost)} · 豆子 ${summary.beanGrams.toFixed(1)}g` : ''
    });
  },

  dateText(dateKey: string) {
    const date = parseDateKey(dateKey);
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日 ${weekdays[date.getDay()]}`;
  },

  timeText(timestamp: number) {
    const date = new Date(timestamp);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  },

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

  openEdit(event: any) {
    const id = event.currentTarget.dataset.id as string;
    const log = this.data.logs.find((item: any) => item.id === id);
    if (!log) return;
    this.setData({
      swipeLogId: '',
      editing: true,
      editingId: id,
      editCategoryId: log.categoryId,
      editTemperature: log.temperature,
      editBeanGrams: String(log.beanGrams),
      editAddonId: log.addonId || '',
      editAddonMl: String(log.addonMl || ''),
      editRating: log.rating || 0
    }, () => this.refreshEditAddons());
  },

  refreshEditAddons() {
    const state = getState();
    const category = state.categories.find((item) => item.id === this.data.editCategoryId);
    const addons = categoryAddons(state, category);
    const editAddonId = addons.some((item) => item.id === this.data.editAddonId)
      ? this.data.editAddonId : (addons[0]?.id || '');
    const selected = addons.find((item) => item.id === editAddonId);
    const currentMl = Number(this.data.editAddonMl);
    this.setData({
      editAddons: addons.map((item) => ({ ...item, selected: item.id === editAddonId })),
      editAddonId,
      editAddonMl: category?.addonType === 'none'
        ? ''
        : String(currentMl > 0 ? currentMl : addonDefaultMl(selected, state.settings)),
      editAddonLabel: category?.addonType === 'milk' ? '牛奶'
        : category?.addonType === 'coconut' ? '椰子水'
          : category?.addonType === 'custom' ? (category.addonCategoryName || '辅料') : ''
    });
  },

  selectEditCategory(event: any) {
    this.setData({ editCategoryId: event.currentTarget.dataset.id, editAddonId: '', editAddonMl: '' }, () => this.refreshEditAddons());
  },

  selectEditTemperature(event: any) {
    this.setData({ editTemperature: event.currentTarget.dataset.value });
  },

  selectEditAddon(event: any) {
    this.setData({ editAddonId: event.currentTarget.dataset.id, editAddonMl: '' }, () => this.refreshEditAddons());
  },

  onEditGrams(event: any) { this.setData({ editBeanGrams: event.detail.value }); },
  onEditAddonMl(event: any) { this.setData({ editAddonMl: event.detail.value }); },
  changeEditRating(event: any) { this.setData({ editRating: Number(event.detail.value) }); },
  closeEdit() { this.setData({ editing: false, editingId: '' }); },
  stopPropagation() {},

  saveEdit() {
    const grams = Number(this.data.editBeanGrams);
    if (!(grams > 0)) return wx.showToast({ title: '请填写豆子用量', icon: 'none' });
    const category = this.data.categories.find((item: any) => item.id === this.data.editCategoryId);
    if (category && category.addonType !== 'none' && !this.data.editAddons.length) {
      return wx.showToast({ title: `请先在饮品架添加${this.data.editAddonLabel || '辅料'}`, icon: 'none' });
    }
    const result = updateLogById(this.data.editingId, {
      categoryId: this.data.editCategoryId,
      temperature: this.data.editTemperature,
      beanGrams: Math.round(grams * 10) / 10,
      addonId: this.data.editAddonId,
      addonMl: Math.max(0, Math.round(Number(this.data.editAddonMl) || 0)),
      rating: this.data.editRating
    });
    if (!result.ok) return wx.showToast({ title: result.message || '修改失败', icon: 'none' });
    this.setData({ editing: false, editingId: '' });
    this.loadPage();
    wx.showToast({ title: '已修改', icon: 'success' });
  },

  _logTouch: null as null | { id: string; startX: number; startY: number; deltaX: number; deltaY: number }
});
