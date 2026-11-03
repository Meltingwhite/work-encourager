const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const DEFAULTS = {
  start: '09:30',
  end: '18:00',
  lunchStart: '12:00',
  lunchEnd: '13:00',
  hourly: 17.24,
  itemName: '一件T恤',
  itemPrice: 129,
  workdays: [1, 2, 3, 4, 5],
};

function pad(value) {
  return String(value).padStart(2, '0');
}

function validTime(value) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function sec(hhmm) {
  if (!validTime(hhmm)) return null;
  const parts = hhmm.split(':').map(Number);
  return parts[0] * 3600 + parts[1] * 60;
}

function daySeconds(date) {
  return date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
}

function dateKey(date) {
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function money2(value) {
  return Math.max(0, value).toFixed(2);
}

function money4(value) {
  return Math.max(0, value).toFixed(4);
}

function orderDays(days) {
  return days.slice().sort(function (a, b) {
    return (a === 0 ? 7 : a) - (b === 0 ? 7 : b);
  });
}

function validateSettings(data) {
  if (!validTime(data.start) || !validTime(data.end)) return '请填写有效的上下班时间。';
  if (sec(data.end) <= sec(data.start)) return '下班时间需要晚于上班时间。';

  const hasLunch = data.lunchStart !== '' || data.lunchEnd !== '';
  if (hasLunch) {
    if (!validTime(data.lunchStart) || !validTime(data.lunchEnd)) {
      return '午休需要同时填写开始和结束；不午休请关闭午休开关。';
    }
    if (sec(data.lunchEnd) <= sec(data.lunchStart)) return '午休结束需要晚于开始时间。';
    if (sec(data.lunchStart) < sec(data.start) || sec(data.lunchEnd) > sec(data.end)) {
      return '午休需要安排在上下班时间之内。';
    }
  }

  if (!isFinite(data.hourly) || data.hourly <= 0) return '请填写大于 0 的时薪。';
  if (!isFinite(data.itemPrice) || data.itemPrice < 0) return '请填写有效的愿望价格（可填 0）。';
  if (!data.workdays.length) return '请至少选择一个工作日。';
  return '';
}

module.exports = {
  DAY_NAMES: DAY_NAMES,
  DEFAULTS: DEFAULTS,
  pad: pad,
  validTime: validTime,
  sec: sec,
  daySeconds: daySeconds,
  dateKey: dateKey,
  clamp: clamp,
  money2: money2,
  money4: money4,
  orderDays: orderDays,
  validateSettings: validateSettings,
};
