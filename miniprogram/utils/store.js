const calc = require('./calc');

const SETTINGS_KEY = 'work-encourager.settings.v1';
const PAUSE_KEY = 'work-encourager.pause.v1';

function copyDefaults() {
  const copy = {};
  Object.keys(calc.DEFAULTS).forEach(function (key) {
    copy[key] = key === 'workdays' ? calc.DEFAULTS.workdays.slice() : calc.DEFAULTS[key];
  });
  return copy;
}

function loadSettings() {
  let raw;
  try {
    raw = wx.getStorageSync(SETTINGS_KEY);
  } catch (error) {
    return copyDefaults();
  }
  if (!raw || typeof raw !== 'object') return copyDefaults();

  const merged = Object.assign(copyDefaults(), raw);
  const timesOk = calc.validTime(merged.start)
    && calc.validTime(merged.end)
    && calc.sec(merged.end) > calc.sec(merged.start);
  if (!timesOk) {
    merged.start = calc.DEFAULTS.start;
    merged.end = calc.DEFAULTS.end;
  }

  const rawHasLunch = Object.prototype.hasOwnProperty.call(raw, 'lunchStart')
    || Object.prototype.hasOwnProperty.call(raw, 'lunchEnd');
  const lunchEmpty = merged.lunchStart === '' && merged.lunchEnd === '';
  const lunchOk = calc.validTime(merged.lunchStart)
    && calc.validTime(merged.lunchEnd)
    && calc.sec(merged.lunchEnd) > calc.sec(merged.lunchStart)
    && calc.sec(merged.lunchStart) >= calc.sec(merged.start)
    && calc.sec(merged.lunchEnd) <= calc.sec(merged.end);

  if (rawHasLunch && lunchEmpty) {
    merged.lunchStart = '';
    merged.lunchEnd = '';
  } else if (!lunchOk) {
    merged.lunchStart = calc.DEFAULTS.lunchStart;
    merged.lunchEnd = calc.DEFAULTS.lunchEnd;
  }

  merged.hourly = Number(merged.hourly);
  if (!isFinite(merged.hourly) || merged.hourly <= 0) merged.hourly = calc.DEFAULTS.hourly;

  merged.itemPrice = Number(merged.itemPrice);
  if (!isFinite(merged.itemPrice) || merged.itemPrice < 0) merged.itemPrice = calc.DEFAULTS.itemPrice;

  merged.itemName = typeof merged.itemName === 'string' && merged.itemName.trim()
    ? merged.itemName.trim()
    : calc.DEFAULTS.itemName;

  const days = Array.isArray(merged.workdays)
    ? merged.workdays
      .map(Number)
      .filter(function (day, index, list) {
        return Number.isInteger(day) && day >= 0 && day <= 6 && list.indexOf(day) === index;
      })
    : [];
  merged.workdays = days.length ? calc.orderDays(days) : calc.DEFAULTS.workdays.slice();

  return merged;
}

function saveSettings(settings) {
  try {
    wx.setStorageSync(SETTINGS_KEY, settings);
  } catch (error) {
    /* 存储不可用时仅保留内存中的设置 */
  }
}

function loadPause() {
  let raw;
  try {
    raw = wx.getStorageSync(PAUSE_KEY);
  } catch (error) {
    return null;
  }
  if (raw && typeof raw.date === 'string' && isFinite(Number(raw.seconds))) {
    return { date: raw.date, seconds: Math.max(0, Number(raw.seconds)) };
  }
  return null;
}

function savePause(pause) {
  try {
    if (pause) wx.setStorageSync(PAUSE_KEY, pause);
    else wx.removeStorageSync(PAUSE_KEY);
  } catch (error) {
    /* 存储不可用 */
  }
}

module.exports = {
  loadSettings: loadSettings,
  saveSettings: saveSettings,
  loadPause: loadPause,
  savePause: savePause,
};
