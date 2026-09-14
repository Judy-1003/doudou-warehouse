import { BeanSpecies, BeanState, StorageMode } from '../../models/index';
import { createId, getState, saveState } from '../../services/storage';
import { toDateKey } from '../../utils/calculations';

Page({
  data: {
    speciesOptions: ['阿拉比卡', '罗布斯塔', '利比里卡', '尤金诺伊德', '瑰夏', '铁皮卡', '波旁', 'SL28', '卡杜拉', '卡蒂姆', '拼配'],
    roastOptions: ['极浅烘', '浅烘', '中浅烘', '中烘', '中深烘', '深烘'],
    speciesIndex: 0,
    roastIndex: 3,
    form: {
      name: '', brand: '', origin: '', process: '', flavors: '',
      price: '', weightG: '', stockG: '', roastedAt: '', deliveredAt: '',
      restDays: '7', bestDays: '30', state: 'sealed', storageMode: '常温'
    }
  },

  onLoad() {
    const today = toDateKey(new Date());
    this.setData({ 'form.roastedAt': today, 'form.deliveredAt': today });
  },

  onInput(event: any) { this.setData({ [`form.${event.currentTarget.dataset.field}`]: event.detail.value }); },
  onSpecies(event: any) { this.setData({ speciesIndex: Number(event.detail.value) }); },
  onRoast(event: any) { this.setData({ roastIndex: Number(event.detail.value) }); },
  onDate(event: any) { this.setData({ [`form.${event.currentTarget.dataset.field}`]: event.detail.value }); },
  selectState(event: any) { this.setData({ 'form.state': event.currentTarget.dataset.value }); },
  selectStorage(event: any) { this.setData({ 'form.storageMode': event.currentTarget.dataset.value }); },

  saveBean() {
    const form = this.data.form;
    const price = Number(form.price);
    const weightG = Number(form.weightG);
    const restDays = Number(form.restDays);
    const bestDays = Number(form.bestDays);
    const stockInput = form.stockG.trim() ? Number(form.stockG) : weightG;
    if (!form.name.trim()) return wx.showToast({ title: '请填写豆子名称', icon: 'none' });
    if (!(price > 0) || !(weightG > 0)) return wx.showToast({ title: '请正确填写价格和规格', icon: 'none' });
    if (!(stockInput > 0) || stockInput > weightG) return wx.showToast({ title: '当前余量需大于 0 且不超过规格', icon: 'none' });
    if (!(restDays >= 0) || !(bestDays > 0)) return wx.showToast({ title: '请正确填写赏味天数', icon: 'none' });
    const state = getState();
    const today = toDateKey(new Date());
    const beanState = form.state as BeanState;
    state.beans.unshift({
      id: createId('bean'),
      name: form.name.trim(),
      brand: form.brand.trim(),
      species: this.data.speciesOptions[this.data.speciesIndex] as BeanSpecies,
      origin: form.origin.trim(),
      process: form.process.trim(),
      roastLevel: this.data.roastOptions[this.data.roastIndex],
      flavors: form.flavors.split(/[,，]/).map((item) => item.trim()).filter(Boolean),
      price,
      weightG,
      stockG: stockInput,
      initialG: stockInput,
      rating: 0,
      note: '',
      roastedAt: form.roastedAt,
      deliveredAt: form.deliveredAt,
      openedAt: beanState === 'open' ? today : '',
      finishedAt: '',
      restDays,
      bestDays,
      state: beanState,
      storageMode: form.storageMode as StorageMode,
      createdAt: Date.now()
    });
    saveState(state);
    wx.showToast({ title: '已加入豆仓', icon: 'success' });
    setTimeout(() => wx.navigateBack(), 500);
  }
});
