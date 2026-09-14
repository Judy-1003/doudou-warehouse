import { AddonType } from '../../models/index';
import { createId, getState, saveState } from '../../services/storage';

Page({
  data: {
    type: 'milk' as Exclude<AddonType, 'none'>,
    form: { categoryName: '', brand: '', price: '', volumeMl: '', defaultMl: '100', kcal: '', protein: '', fat: '', sugar: '' }
  },

  onLoad(options: Record<string, string>) {
    if (options.type === 'coconut' || options.type === 'custom') this.setData({ type: options.type });
  },

  selectType(event: any) { this.setData({ type: event.currentTarget.dataset.type }); },
  onInput(event: any) { this.setData({ [`form.${event.currentTarget.dataset.field}`]: event.detail.value }); },

  saveDrink() {
    const form = this.data.form;
    const price = Number(form.price);
    const volumeMl = Number(form.volumeMl);
    const defaultMl = Number(form.defaultMl);
    if (this.data.type === 'custom' && !form.categoryName.trim()) return wx.showToast({ title: '请填写类别名称', icon: 'none' });
    if (!form.brand.trim()) return wx.showToast({ title: '请填写品牌', icon: 'none' });
    if (!(price > 0) || !(volumeMl > 0)) return wx.showToast({ title: '请正确填写价格和容量', icon: 'none' });
    if (this.data.type === 'custom' && !(defaultMl > 0)) return wx.showToast({ title: '请填写默认用量', icon: 'none' });
    const state = getState();
    state.addons.push({
      id: createId('addon'),
      type: this.data.type,
      categoryName: this.data.type === 'milk' ? '牛奶 / 奶类' : this.data.type === 'coconut' ? '椰子水' : form.categoryName.trim(),
      brand: form.brand.trim(),
      price,
      volumeMl,
      stockMl: volumeMl,
      defaultMl: this.data.type === 'milk' ? state.settings.defaultMilkMl : this.data.type === 'coconut' ? state.settings.defaultCoconutMl : defaultMl,
      kcalPer100Ml: this.data.type !== 'coconut' ? Math.max(0, Number(form.kcal) || 0) : 0,
      proteinPer100Ml: this.data.type !== 'coconut' ? Math.max(0, Number(form.protein) || 0) : 0,
      fatPer100Ml: this.data.type !== 'coconut' ? Math.max(0, Number(form.fat) || 0) : 0,
      sugarPer100Ml: Math.max(0, Number(form.sugar) || 0),
      createdAt: Date.now()
    });
    saveState(state);
    wx.showToast({ title: '已加入饮品架', icon: 'success' });
    setTimeout(() => wx.navigateBack(), 500);
  }
});
