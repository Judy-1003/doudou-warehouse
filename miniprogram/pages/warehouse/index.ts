import { AppState, CoffeeBean } from '../../models/index';
import { beanInitialG, beanStatus, beanStockPercent, beanUnitPrice, filledText, forecastDays, joinFilled, money, round1, shortBeanName, toDateKey, volumeText } from '../../utils/calculations';
import { getState, saveState } from '../../services/storage';

Page({
  data: {
    tab: 'bean',
    openBeans: [] as any[],
    sealedBeans: [] as any[],
    finishedBeans: [] as any[],
    milkAddons: [] as any[],
    coconutAddons: [] as any[],
    customAddonGroups: [] as any[],
    beanSummary: '',
    snackbarVisible: false,
    snackbarText: ''
  },

  onShow() { this.loadPage(); },
  onUnload() { if (this._snackbarTimer) clearTimeout(this._snackbarTimer); },

  loadPage() {
    const state = getState();
    const beans = state.beans.map((bean) => this.beanView(bean, state));
    const addonView = (addon: any) => {
      const defaultMl = addon.defaultMl || (addon.type === 'milk' ? state.settings.defaultMilkMl : addon.type === 'coconut' ? state.settings.defaultCoconutMl : 100);
      const stockMl = Math.max(0, Math.round(addon.stockMl || 0));
      const capacity = addon.volumeMl > 0 ? addon.volumeMl : stockMl;
      return {
        ...addon,
        unitPriceText: money(addon.price / addon.volumeMl * 100),
        volumeText: volumeText(addon.volumeMl),
        defaultMl,
        defaultCostText: money(defaultMl * addon.price / addon.volumeMl),
        stockMl,
        stockText: volumeText(stockMl),
        stockPercent: capacity > 0 ? Math.max(0, Math.min(100, stockMl / capacity * 100)) : 0,
        cupsLeft: defaultMl > 0 ? Math.floor(stockMl / defaultMl) : 0
      };
    };
    const openBeans = beans.filter((bean) => bean.state === 'open');
    const sealedBeans = beans.filter((bean) => bean.state === 'sealed');
    const finishedBeans = beans.filter((bean) => bean.state === 'finished');
    const totalStock = state.beans.reduce((sum, bean) => sum + bean.stockG, 0);
    const customAddonGroups = state.addons
      .filter((item) => item.type === 'custom')
      .map(addonView)
      .reduce((groups: any[], addon: any) => {
        let group = groups.find((item) => item.name === addon.categoryName);
        if (!group) {
          group = { name: addon.categoryName, items: [] };
          groups.push(group);
        }
        group.items.push(addon);
        return groups;
      }, []);
    this.setData({
      openBeans,
      sealedBeans,
      finishedBeans,
      milkAddons: state.addons.filter((item) => item.type === 'milk').map(addonView),
      coconutAddons: state.addons.filter((item) => item.type === 'coconut').map(addonView),
      customAddonGroups,
      beanSummary: `${openBeans.length} 包在喝 · ${sealedBeans.length} 包未启封 · 共 ${Math.round(totalStock)}g`
    });
  },

  beanView(bean: CoffeeBean, state: AppState) {
    const status = beanStatus(bean);
    const days = forecastDays(bean, state.logs);
    return {
      ...bean,
      shortName: shortBeanName(bean),
      brandText: filledText(bean.brand),
      roastText: filledText(bean.roastLevel),
      metaText: joinFilled([bean.origin, bean.process]),
      storageAction: bean.storageMode === '冷冻' ? 'room' : 'freeze',
      storageActionText: bean.storageMode === '冷冻' ? '转常温' : '转冷冻',
      statusLabel: status.label,
      statusTone: status.tone,
      stockPercent: beanStockPercent(bean),
      initialText: round1(beanInitialG(bean)),
      unitPriceText: money(beanUnitPrice(bean)),
      ratingText: bean.rating ? bean.rating.toFixed(1) : '未评分',
      forecastText: bean.state === 'open' && days !== null ? `约 ${days} 天喝完` : ''
    };
  },

  switchTab(event: any) { this.setData({ tab: event.currentTarget.dataset.tab }); },

  openBean(event: any) {
    if (this._suppressBeanTapId === event.currentTarget.dataset.id && Date.now() < this._suppressBeanTapUntil) {
      this._suppressBeanTapId = '';
      this._suppressBeanTapUntil = 0;
      return;
    }
    wx.navigateTo({ url: `/pages/bean-detail/index?id=${event.currentTarget.dataset.id}` });
  },

  deleteBean(event: any) {
    const id = event.currentTarget.dataset.id as string;
    const state = getState();
    const bean = state.beans.find((item) => item.id === id);
    if (!bean) return;
    this._suppressBeanTapId = id;
    this._suppressBeanTapUntil = Date.now() + 700;
    const usedCount = state.logs.filter((log) => log.beanId === id).length;
    wx.showModal({
      title: `删除“${shortBeanName(bean)}”`,
      content: usedCount
        ? `这包豆子有 ${usedCount} 条饮用记录。删除豆子后，历史记录仍会保留。`
        : '删除后无法恢复，确定要删除这包咖啡豆吗？',
      confirmText: '删除',
      confirmColor: '#b0553c',
      success: (result: any) => {
        if (!result.confirm) return;
        const latest = getState();
        latest.beans = latest.beans.filter((item) => item.id !== id);
        saveState(latest);
        this.loadPage();
        wx.showToast({ title: '已删除', icon: 'none' });
      }
    });
  },

  deleteAddon(event: any) {
    const id = event.currentTarget.dataset.id as string;
    const state = getState();
    const addon = state.addons.find((item) => item.id === id);
    if (!addon) return;
    const usedCount = state.logs.filter((log) => log.addonId === id).length;
    wx.showModal({
      title: `删除“${addon.brand}”`,
      content: usedCount
        ? `这个物料有 ${usedCount} 条饮用记录。删除物料后，历史记录仍会保留。`
        : '删除后无法恢复，确定要删除这个物料吗？',
      confirmText: '删除',
      confirmColor: '#b0553c',
      success: (result: any) => {
        if (!result.confirm) return;
        const latest = getState();
        latest.addons = latest.addons.filter((item) => item.id !== id);
        saveState(latest);
        this.loadPage();
        wx.showToast({ title: '已删除', icon: 'none' });
      }
    });
  },

  restockAddon(event: any) {
    const id = event.currentTarget.dataset.id as string;
    if (this._suppressRestockId === id && Date.now() < this._suppressRestockUntil) {
      this._suppressRestockId = '';
      return;
    }
    const state = getState();
    const addon = state.addons.find((item) => item.id === id);
    if (!addon) return;
    if (!(addon.volumeMl > 0)) return wx.showToast({ title: '这个物料没有填容量', icon: 'none' });
    addon.stockMl = addon.volumeMl;
    saveState(state);
    this.loadPage();
    wx.showToast({ title: `${addon.brand} 已补满`, icon: 'none' });
  },

  suppressRestock(event: any) {
    this._suppressRestockId = event.currentTarget.dataset.id as string;
    this._suppressRestockUntil = Date.now() + 700;
  },

  stopPropagation() {},

  beanAction(event: any) {
    const id = event.currentTarget.dataset.id as string;
    const action = event.currentTarget.dataset.action as string;
    const state = getState();
    const bean = state.beans.find((item) => item.id === id);
    if (!bean) return;
    const previous = JSON.parse(JSON.stringify(bean)) as CoffeeBean;
    const today = toDateKey(new Date());
    let text = '';
    if (action === 'open') {
      bean.state = 'open';
      bean.openedAt = today;
      text = `${shortBeanName(bean)} 已启封`;
    } else if (action === 'finish') {
      const stock = bean.stockG;
      bean.state = 'finished';
      bean.stockG = 0;
      bean.finishedAt = today;
      text = `${shortBeanName(bean)} 已标记喝完${stock > 0 ? `，${Math.round(stock)}g 已清零` : ''}`;
    } else if (action === 'room') {
      bean.storageMode = '常温';
      text = `${shortBeanName(bean)} 转常温`;
    } else if (action === 'freeze') {
      bean.storageMode = '冷冻';
      text = `${shortBeanName(bean)} 转冷冻`;
    }
    saveState(state);
    this._undo = { id, previous };
    this.setData({ snackbarVisible: true, snackbarText: text });
    this.loadPage();
    if (this._snackbarTimer) clearTimeout(this._snackbarTimer);
    this._snackbarTimer = setTimeout(() => {
      this._undo = null;
      this.setData({ snackbarVisible: false });
    }, 5000);
  },

  undoAction() {
    if (!this._undo) return;
    const state = getState();
    const index = state.beans.findIndex((item) => item.id === this._undo?.id);
    if (index >= 0) state.beans[index] = this._undo.previous;
    saveState(state);
    this._undo = null;
    if (this._snackbarTimer) clearTimeout(this._snackbarTimer);
    this.setData({ snackbarVisible: false });
    this.loadPage();
    wx.showToast({ title: '已撤销', icon: 'none' });
  },

  _undo: null as null | { id: string; previous: CoffeeBean },
  _suppressBeanTapId: '',
  _suppressBeanTapUntil: 0,
  _suppressRestockId: '',
  _suppressRestockUntil: 0,
  _snackbarTimer: 0 as any
});
