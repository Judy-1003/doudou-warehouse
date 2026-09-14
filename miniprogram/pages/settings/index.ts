import { getState, resetState } from '../../services/storage';
import { clearAllLogs } from '../../services/logs';
import { logsInRange, money, summarizeLogs } from '../../utils/calculations';

Page({
  data: {
    categorySummary: '',
    defaultSummary: '',
    beanSummary: '',
    statsSummary: '',
    resetSummary: ''
  },

  onShow() { this.loadPage(); },

  loadPage() {
    const state = getState();
    const beanIds = new Set(state.logs.map((log) => log.beanId));
    const week = summarizeLogs(logsInRange(state.logs, 'week'));
    this.setData({
      categorySummary: `首页 ${Math.min(3, state.categories.length)} 个 · 共 ${state.categories.length} 个`,
      defaultSummary: `豆子 ${state.settings.defaultBeanGrams}g · 牛奶 ${state.settings.defaultMilkMl}ml`,
      beanSummary: `喝过 ${beanIds.size} 款 · 共 ${state.logs.length} 杯`,
      statsSummary: `本周 ${week.beanGrams.toFixed(1)}g · ¥${money(week.totalCost)}`,
      resetSummary: `${state.logs.length} 条记录 · ${state.beans.length} 包豆子 · ${state.addons.length} 个物料`
    });
  },

  openReset() {
    wx.showActionSheet({
      itemList: ['只清空咖啡记录', '全部初始化'],
      success: (result: any) => {
        if (result.tapIndex === 0) this.confirmClearLogs();
        if (result.tapIndex === 1) this.confirmResetAll();
      },
      fail: () => {}
    });
  },

  confirmClearLogs() {
    wx.showModal({
      title: '清空咖啡记录',
      content: '所有咖啡记录和照片会被删除，用掉的豆子和物料会退回余量。豆仓和饮品架保留。',
      confirmText: '清空',
      confirmColor: '#b0553c',
      success: (result: any) => {
        if (!result.confirm) return;
        const cleared = clearAllLogs(true);
        this.loadPage();
        wx.showToast({ title: `已清空 ${cleared.logs} 条记录`, icon: 'none' });
      }
    });
  },

  confirmResetAll() {
    wx.showModal({
      title: '全部初始化',
      content: '记录、豆仓、饮品架、咖啡品类和默认用量都会恢复到初始状态，无法撤销。',
      confirmText: '初始化',
      confirmColor: '#b0553c',
      success: (result: any) => {
        if (!result.confirm) return;
        resetState();
        this.loadPage();
        wx.showToast({ title: '已恢复初始状态', icon: 'success' });
      }
    });
  }
});
