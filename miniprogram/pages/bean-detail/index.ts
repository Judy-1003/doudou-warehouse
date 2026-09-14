import { addDays, beanInitialG, beanStatus, beanStockPercent, beanUnitPrice, daysBetween, filledText, forecastDays, joinFilled, money, round1, shortBeanName, temperatureText, toDateKey } from '../../utils/calculations';
import { getState, saveState } from '../../services/storage';

Page({
  data: {
    id: '', bean: null as any, timeline: [] as any[], logs: [] as any[], cupCount: 0, spentText: '0.00',
    noteEditing: false, noteDraft: '', ratingDraft: 0,
    stockEditing: false, stockDraft: '', stockMaxText: ''
  },
  onLoad(options: Record<string, string>) { this.setData({ id: options.id || '' }); },
  onShow() { this.loadPage(); },
  loadPage() {
    const state = getState();
    const bean = state.beans.find((item) => item.id === this.data.id);
    if (!bean) { wx.showToast({ title: '没有找到这包豆子', icon: 'none' }); return; }
    const status = beanStatus(bean);
    const logs = state.logs
      .filter((log) => log.beanId === bean.id)
      .map((log) => ({
        ...log,
        temperatureText: temperatureText(log.temperature),
        dateKey: toDateKey(new Date(log.consumedAt)),
        totalCostText: money(log.totalCost)
      }));
    const spent = logs.reduce((sum, log) => sum + log.totalCost, 0);
    const forecast = forecastDays(bean, state.logs);
    const today = toDateKey(new Date());
    const sinceRoast = Math.max(0, daysBetween(bean.roastedAt, today));
    const view = {
      ...bean,
      shortName: shortBeanName(bean), statusLabel: status.label, statusTone: status.tone,
      brandText: filledText(bean.brand),
      roastText: filledText(bean.roastLevel),
      metaText: joinFilled([bean.origin, bean.process, bean.species]),
      stockPercent: beanStockPercent(bean),
      initialText: round1(beanInitialG(bean)),
      unitPriceText: money(beanUnitPrice(bean)),
      cupCostText: money(beanUnitPrice(bean) * state.settings.defaultBeanGrams),
      forecastText: forecast === null ? '还没有消耗数据' : `约 ${forecast} 天喝完`,
      openedDaysText: bean.openedAt ? `${Math.max(0, daysBetween(bean.openedAt, today))} 天` : '未开封',
      sinceRoastText: `${sinceRoast} 天`,
      ratingText: bean.rating ? bean.rating.toFixed(1) : '未评'
    };
    const timeline = [
      ['烘焙日', bean.roastedAt], ['配送到手', bean.deliveredAt], ['开封', bean.openedAt],
      [`养豆 ${bean.restDays} 天结束`, addDays(bean.roastedAt, bean.restDays)],
      ['最佳赏味期至', addDays(bean.roastedAt, bean.restDays + bean.bestDays)],
      ['喝完', bean.finishedAt]
    ].map(([label, date]) => ({ label, date: date || '—', done: !!date && date <= today }));
    this.setData({ bean: view, timeline, logs, cupCount: logs.length, spentText: money(spent), ratingDraft: bean.rating, noteDraft: bean.note });
  },
  changeRating(event: any) {
    const rating = Number(event.detail.value);
    const state = getState();
    const bean = state.beans.find((item) => item.id === this.data.id);
    if (!bean) return;
    bean.rating = rating; saveState(state); this.setData({ ratingDraft: rating }); this.loadPage();
  },
  openNote() { this.setData({ noteEditing: true, noteDraft: this.data.bean.note || '' }); },
  closeNote() { this.setData({ noteEditing: false }); },
  noteInput(event: any) { this.setData({ noteDraft: event.detail.value }); },
  saveNote() {
    const state = getState(); const bean = state.beans.find((item) => item.id === this.data.id);
    if (!bean) return; bean.note = this.data.noteDraft.trim(); saveState(state); this.setData({ noteEditing: false }); this.loadPage(); wx.showToast({ title: '已保存', icon: 'success' });
  },
  openDay(event: any) {
    wx.navigateTo({ url: `/pages/day-logs/index?date=${event.currentTarget.dataset.date}` });
  },

  setStorage(event: any) {
    const mode = event.currentTarget.dataset.mode as '常温' | '冷冻';
    const state = getState();
    const bean = state.beans.find((item) => item.id === this.data.id);
    if (!bean || bean.storageMode === mode) return;
    bean.storageMode = mode;
    saveState(state);
    this.loadPage();
    wx.showToast({ title: `已转${mode}保存`, icon: 'none' });
  },

  openStock() {
    const bean = this.data.bean;
    if (!bean) return;
    this.setData({
      stockEditing: true,
      stockDraft: String(bean.stockG),
      stockMaxText: `入库时 ${bean.initialText}g，可填 0 ~ ${bean.initialText}`
    });
  },

  closeStock() { this.setData({ stockEditing: false }); },
  onStockInput(event: any) { this.setData({ stockDraft: event.detail.value }); },

  saveStock() {
    const value = Number(this.data.stockDraft);
    if (!(value >= 0)) return wx.showToast({ title: '请填写余量', icon: 'none' });
    const state = getState();
    const bean = state.beans.find((item) => item.id === this.data.id);
    if (!bean) return;
    const initial = beanInitialG(bean);
    if (initial > 0 && value > initial) {
      return wx.showToast({ title: `不能超过入库量 ${round1(initial)}g`, icon: 'none' });
    }
    const today = toDateKey(new Date());
    bean.stockG = Math.round(value * 10) / 10;
    if (bean.stockG === 0) {
      bean.state = 'finished';
      if (!bean.finishedAt) bean.finishedAt = today;
    } else {
      if (bean.state === 'finished') { bean.state = 'open'; bean.finishedAt = ''; }
      if (bean.state === 'sealed' && bean.stockG < initial) {
        bean.state = 'open';
        if (!bean.openedAt) bean.openedAt = today;
      }
    }
    saveState(state);
    this.setData({ stockEditing: false });
    this.loadPage();
    wx.showToast({ title: '余量已更新', icon: 'success' });
  },

  stopPropagation() {}
});
