interface StarView { half: number; full: number; percent: number; }

Component({
  properties: {
    value: { type: Number, value: 0, observer: 'syncStars' },
    size: { type: Number, value: 52 },
    readonly: { type: Boolean, value: false }
  },
  data: {
    stars: [] as StarView[]
  },
  lifetimes: {
    attached() { this.syncStars(this.data.value); }
  },
  methods: {
    syncStars(value: number) {
      const stars: StarView[] = [];
      for (let i = 1; i <= 5; i += 1) {
        stars.push({
          half: i - 0.5,
          full: i,
          percent: Math.max(0, Math.min(100, (Number(value || 0) - i + 1) * 100))
        });
      }
      this.setData({ stars });
    },
    onPick(event: any) {
      if (this.data.readonly) return;
      const value = Number(event.currentTarget.dataset.value);
      this.triggerEvent('change', { value });
    }
  }
});
