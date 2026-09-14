import { AddonType, DrinkCategory } from '../../models/index';
import { createId, getState, saveState } from '../../services/storage';

type EditMode = '' | 'add' | 'edit';

Page({
  data: {
    categories: [] as any[],
    customAddonCategories: [] as string[],
    draggingId: '',
    editMode: '' as EditMode,
    editingId: '',
    formName: '',
    formAddonType: 'none' as AddonType,
    formAddonCategoryName: ''
  },

  onShow() { this.loadPage(); },

  loadPage() {
    const state = getState();
    const categories = this.categoryViews(state.categories);
    const customAddonCategories = state.addons
      .filter((item) => item.type === 'custom')
      .map((item) => item.categoryName)
      .filter((name, index, names) => !!name && names.indexOf(name) === index);
    this.setData({ categories, customAddonCategories });
  },

  categoryViews(categories: DrinkCategory[]) {
    return categories.map((item, index) => ({
      ...item,
      position: index + 1,
      homeVisible: index < 3,
      addonLabel: this.addonLabel(item)
    }));
  },

  addonLabel(category: DrinkCategory): string {
    if (category.addonType === 'milk') return '牛奶';
    if (category.addonType === 'coconut') return '椰子水';
    if (category.addonType === 'custom') return category.addonCategoryName || '自定义辅料';
    return '不加辅料';
  },

  startCategoryDrag(event: any) {
    const id = event.currentTarget.dataset.id as string;
    const touch = event.touches?.[0] || event.changedTouches?.[0];
    if (!id || !touch) return;
    this._draggingId = id;
    this._dragStartY = touch.clientY;
    this._dragRects = [];
    this._dragOrder = this.data.categories.map((item: any) => item.id);
    this.setData({ draggingId: id }, () => {
      wx.createSelectorQuery().in(this).selectAll('.category-card').boundingClientRect((rects: any[]) => {
        if (this._draggingId !== id || !Array.isArray(rects)) return;
        this._dragRects = rects;
        const index = this.data.categories.findIndex((item: any) => item.id === id);
        const rect = rects[index];
        this._dragOffsetY = rect ? this._dragStartY - rect.top : 0;
        this._dragHeight = rect?.height || 0;
      }).exec();
    });
  },

  dragCategory(event: any) {
    if (!this._draggingId || !this._dragRects.length) return;
    const touch = event.touches?.[0] || event.changedTouches?.[0];
    if (!touch) return;
    const centers = this._dragRects.map((rect: any) => rect.top + rect.height / 2);
    const draggedCenter = touch.clientY - this._dragOffsetY + this._dragHeight / 2;
    let target = 0;
    for (let index = 0; index < centers.length - 1; index += 1) {
      if (draggedCenter > (centers[index] + centers[index + 1]) / 2) target = index + 1;
    }
    const current = this._dragOrder.indexOf(this._draggingId);
    if (current < 0 || current === target) return;
    const currentViews = this.data.categories.slice();
    const viewById: Record<string, any> = {};
    currentViews.forEach((item: any) => { viewById[item.id] = item; });
    const order = this._dragOrder.slice();
    const movedId = order.splice(current, 1)[0];
    order.splice(target, 0, movedId);
    this._dragOrder = order;
    const categories = order.map((categoryId) => viewById[categoryId]).filter((item) => !!item);
    this.setData({ categories: this.categoryViews(categories) });
  },

  finishCategoryDrag() {
    if (!this._draggingId) return;
    const state = getState();
    const ordered: DrinkCategory[] = [];
    this.data.categories.forEach((item: any) => {
      const category = state.categories.find((candidate) => candidate.id === item.id);
      if (category) ordered.push(category);
    });
    if (ordered.length === state.categories.length) {
      state.categories = ordered;
      saveState(state);
    }
    this._draggingId = '';
    this._dragRects = [];
    this._dragOrder = [];
    this.setData({ draggingId: '' });
    this.loadPage();
  },

  openAdd() {
    this.setData({ editMode: 'add', editingId: '', formName: '', formAddonType: 'none', formAddonCategoryName: '' });
  },

  openEdit(event: any) {
    const id = event.currentTarget.dataset.id as string;
    const category = getState().categories.find((item) => item.id === id);
    if (!category) return;
    this.setData({
      editMode: 'edit', editingId: id, formName: category.name,
      formAddonType: category.addonType,
      formAddonCategoryName: category.addonCategoryName || ''
    });
  },

  closeEditor() { this.setData({ editMode: '', editingId: '' }); },
  stopPropagation() {},
  onNameInput(event: any) { this.setData({ formName: event.detail.value }); },
  selectAddon(event: any) {
    this.setData({ formAddonType: event.currentTarget.dataset.type, formAddonCategoryName: event.currentTarget.dataset.category || '' });
  },

  saveCategory() {
    const name = this.data.formName.trim();
    if (!name) return wx.showToast({ title: '请填写品类名称', icon: 'none' });
    if (this.data.formAddonType === 'custom' && !this.data.formAddonCategoryName) {
      return wx.showToast({ title: '请选择自定义辅料', icon: 'none' });
    }
    if (this.data.editMode !== 'add' && this.data.editMode !== 'edit') return;
    const state = getState();
    const duplicate = state.categories.some((item) => item.name === name && item.id !== this.data.editingId);
    if (duplicate) return wx.showToast({ title: '这个品类已存在', icon: 'none' });
    if (this.data.editMode === 'edit') {
      const category = state.categories.find((item) => item.id === this.data.editingId);
      if (!category) return;
      category.name = name;
      category.addonType = this.data.formAddonType;
      category.addonCategoryName = this.data.formAddonType === 'custom' ? this.data.formAddonCategoryName : '';
    } else {
      state.categories.push({
        id: createId('category'), name,
        addonType: this.data.formAddonType,
        addonCategoryName: this.data.formAddonType === 'custom' ? this.data.formAddonCategoryName : '',
        custom: true
      });
    }
    saveState(state);
    this.setData({ editMode: '' });
    this.loadPage();
    wx.showToast({ title: '已保存', icon: 'success' });
  },

  deleteCategory(event: any) {
    const id = event.currentTarget.dataset.id as string;
    const state = getState();
    const category = state.categories.find((item) => item.id === id);
    if (!category) return;
    if (state.categories.length <= 1) return wx.showToast({ title: '至少保留一个品类', icon: 'none' });
    const usedCount = state.logs.filter((log) => log.categoryId === id).length;
    wx.showModal({
      title: `删除“${category.name}”`,
      content: usedCount ? `已有 ${usedCount} 条历史记录使用该品类。删除后历史记录仍保留。` : '删除后首页将不再展示该品类。',
      confirmText: '删除',
      confirmColor: '#b0553c',
      success: (result: any) => {
        if (!result.confirm) return;
        const latest = getState();
        if (latest.categories.length <= 1) return;
        latest.categories = latest.categories.filter((item) => item.id !== id);
        saveState(latest);
        this.loadPage();
      }
    });
  },

  _draggingId: '',
  _dragStartY: 0,
  _dragOffsetY: 0,
  _dragHeight: 0,
  _dragRects: [] as any[],
  _dragOrder: [] as string[]
});
