import { getState, saveState } from '../../services/storage';
import { filledText, shortBeanName } from '../../utils/calculations';

Page({
  data: { beans: [] as any[], countText: '' },
  onShow() { this.loadPage(); },
  loadPage() {
    const state = getState();
    const beanIds = new Set(state.logs.map((log) => log.beanId));
    const beans = state.beans
      .filter((bean) => beanIds.has(bean.id))
      .map((bean) => {
        const cupCount = state.logs.filter((log) => log.beanId === bean.id).length;
        const brand = filledText(bean.brand);
        const stateText = bean.state === 'finished' ? ' · 已喝完' : '';
        return {
          ...bean,
          shortName: shortBeanName(bean),
          cupCount,
          ratingText: bean.rating ? bean.rating.toFixed(1) : '未评',
          stateText,
          subText: `${brand ? brand + ' · ' : ''}${cupCount} 杯${stateText}`
        };
      });
    this.setData({ beans, countText: `喝过 ${beans.length} 款 · 共 ${state.logs.length} 杯` });
  },
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
      content: `这包豆子有 ${usedCount} 条饮用记录。删除豆子后，历史记录仍会保留。`,
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
  _suppressBeanTapId: '',
  _suppressBeanTapUntil: 0
});
