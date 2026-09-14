import { getState, saveState } from '../../services/storage';

Page({
  data: {
    settings: { defaultBeanGrams: 16.5, defaultMilkMl: 250, defaultCoconutMl: 200 },
    editing: '',
    editingTitle: '',
    editingUnit: '',
    editingValue: ''
  },

  onShow() {
    const state = getState();
    this.setData({ settings: state.settings });
  },

  openEdit(event: any) {
    const key = event.currentTarget.dataset.key;
    const meta: any = {
      defaultBeanGrams: ['豆子每次扣除', 'g'],
      defaultMilkMl: ['牛奶每次用量', 'ml'],
      defaultCoconutMl: ['椰子水每次用量', 'ml']
    };
    this.setData({ editing: key, editingTitle: meta[key][0], editingUnit: meta[key][1], editingValue: String((this.data.settings as any)[key]) });
  },
  closeEdit() { this.setData({ editing: '' }); },
  onValue(event: any) { this.setData({ editingValue: event.detail.value }); },
  saveValue() {
    const value = Number(this.data.editingValue);
    if (!(value > 0)) return wx.showToast({ title: '请输入大于 0 的数值', icon: 'none' });
    const state = getState();
    (state.settings as any)[this.data.editing] = value;
    saveState(state);
    this.setData({ settings: state.settings, editing: '' });
    wx.showToast({ title: '已更新', icon: 'success' });
  },
  stopPropagation() {}
});
