const calc = require('../../utils/calc');
const store = require('../../utils/store');

const DAY_ITEMS = [
  { value: 1, label: '一' },
  { value: 2, label: '二' },
  { value: 3, label: '三' },
  { value: 4, label: '四' },
  { value: 5, label: '五' },
  { value: 6, label: '六' },
  { value: 0, label: '日' },
];

Page({
  data: {
    start: calc.DEFAULTS.start,
    end: calc.DEFAULTS.end,
    lunchEnabled: true,
    lunchStart: calc.DEFAULTS.lunchStart,
    lunchEnd: calc.DEFAULTS.lunchEnd,
    hourly: String(calc.DEFAULTS.hourly),
    itemName: calc.DEFAULTS.itemName,
    itemPrice: String(calc.DEFAULTS.itemPrice),
    days: DAY_ITEMS.map(function (item) {
      return {
        value: item.value,
        label: item.label,
        active: calc.DEFAULTS.workdays.indexOf(item.value) !== -1,
      };
    }),
    error: '',
  },

  onLoad: function () {
    this.syncForm(store.loadSettings());
  },

  syncForm: function (settings) {
    const lunchEnabled = settings.lunchStart !== '' && settings.lunchEnd !== '';
    this.setData({
      start: settings.start,
      end: settings.end,
      lunchEnabled: lunchEnabled,
      lunchStart: settings.lunchStart || calc.DEFAULTS.lunchStart,
      lunchEnd: settings.lunchEnd || calc.DEFAULTS.lunchEnd,
      hourly: String(settings.hourly),
      itemName: settings.itemName,
      itemPrice: String(settings.itemPrice),
      days: DAY_ITEMS.map(function (item) {
        return {
          value: item.value,
          label: item.label,
          active: settings.workdays.indexOf(item.value) !== -1,
        };
      }),
      error: '',
    });
  },

  onStartChange: function (event) {
    this.setData({ start: event.detail.value, error: '' });
  },

  onEndChange: function (event) {
    this.setData({ end: event.detail.value, error: '' });
  },

  onLunchChange: function (event) {
    this.setData({ lunchEnabled: event.detail.value, error: '' });
  },

  onLunchStartChange: function (event) {
    this.setData({ lunchStart: event.detail.value, error: '' });
  },

  onLunchEndChange: function (event) {
    this.setData({ lunchEnd: event.detail.value, error: '' });
  },

  onHourlyInput: function (event) {
    this.setData({ hourly: event.detail.value, error: '' });
  },

  onItemNameInput: function (event) {
    this.setData({ itemName: event.detail.value });
  },

  onItemPriceInput: function (event) {
    this.setData({ itemPrice: event.detail.value, error: '' });
  },

  onDayTap: function (event) {
    const value = Number(event.currentTarget.dataset.value);
    const days = this.data.days.map(function (item) {
      return item.value === value ? { value: item.value, label: item.label, active: !item.active } : item;
    });
    this.setData({ days: days, error: '' });
  },

  onReset: function () {
    this.syncForm(calc.DEFAULTS);
  },

  onSave: function () {
    const workdays = this.data.days
      .filter(function (item) { return item.active; })
      .map(function (item) { return item.value; });
    const next = {
      start: this.data.start,
      end: this.data.end,
      lunchStart: this.data.lunchEnabled ? this.data.lunchStart : '',
      lunchEnd: this.data.lunchEnabled ? this.data.lunchEnd : '',
      hourly: parseFloat(this.data.hourly),
      itemName: this.data.itemName.trim() || '心愿好物',
      itemPrice: parseFloat(this.data.itemPrice),
      workdays: calc.orderDays(workdays),
    };

    const error = calc.validateSettings(next);
    if (error) {
      this.setData({ error: error });
      return;
    }

    store.saveSettings(next);
    store.savePause(null);
    wx.showToast({ title: '已保存', icon: 'success' });
    setTimeout(function () {
      wx.navigateBack();
    }, 350);
  },
});
