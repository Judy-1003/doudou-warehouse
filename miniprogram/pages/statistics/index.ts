import { getState } from '../../services/storage';
import { logsInRange, money, parseDateKey, rangeStart, StatsRange, summarizeLogs, toDateKey, volumeText } from '../../utils/calculations';

Page({
  data: { range: 'week' as StatsRange, rangeTitle: '本周', rangeNote: '', stats: null as any, all: null as any, days: [] as any[] },
  onShow() { this.loadPage(); },
  selectRange(event: any) { this.setData({ range: event.currentTarget.dataset.range }, () => this.loadPage()); },
  loadPage() {
    const state = getState(); const now = new Date(); const range = this.data.range as StatsRange;
    const logs = logsInRange(state.logs, range, now); const stats = summarizeLogs(logs); const all = summarizeLogs(state.logs);
    const start = rangeStart(range, now); const days = Math.max(1, Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - start.getTime()) / 86400000) + 1);
    const labels: any = { week: ['本周', `${start.getMonth() + 1}.${String(start.getDate()).padStart(2, '0')} 起`], month: ['本月', `${now.getMonth() + 1} 月`], year: ['本年', `${now.getFullYear()} 年`] };
    this.setData({
      rangeTitle: labels[range][0], rangeNote: labels[range][1],
      stats: { ...stats, totalCostText: money(stats.totalCost), beanGramsText: stats.beanGrams.toFixed(1), milkText: volumeText(stats.milkMl), dailyText: (stats.beanGrams / days).toFixed(1), bagsText: (stats.beanGrams / 227).toFixed(1) },
      all: { beanText: `${all.beanGrams.toFixed(1)} g`, beanCostText: money(all.beanCost), milkCostText: money(all.milkCost), milkText: volumeText(all.milkMl) },
      days: this.buildDays(logs)
    });
  },

  buildDays(logs: any[]) {
    const groups: Record<string, any[]> = {};
    logs.forEach((log) => {
      const key = toDateKey(new Date(log.consumedAt));
      (groups[key] ||= []).push(log);
    });
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return Object.keys(groups).sort().reverse().map((key) => {
      const summary = summarizeLogs(groups[key]);
      const date = parseDateKey(key);
      const names = groups[key]
        .map((log) => log.categoryName)
        .filter((name, index, list) => list.indexOf(name) === index);
      return {
        key,
        dateText: `${date.getMonth() + 1}月${date.getDate()}日 周${weekdays[date.getDay()]}`,
        cups: groups[key].length,
        categoryText: names.join('、'),
        costText: money(summary.totalCost)
      };
    });
  },

  openDay(event: any) {
    wx.navigateTo({ url: `/pages/day-logs/index?date=${event.currentTarget.dataset.key}` });
  }
});
