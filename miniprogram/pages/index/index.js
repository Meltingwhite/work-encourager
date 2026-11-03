const calc = require('../../utils/calc');
const store = require('../../utils/store');

const STATUS_TEXT = {
  working: '上班中',
  lunch: '午休中',
  before: '还没上班',
  after: '已下班',
  rest: '休息日',
};

Page({
  data: {
    dateLine: '',
    statusText: '',
    state: 'working',
    paused: false,
    countdownPrefix: '',
    showCountdown: false,
    cdH: '0',
    cdM: '0',
    cdS: '0',
    earned: '0.0000',
    rateLine: '',
    goalLine: '',
    canToggle: false,
    toggleText: '',
    progressPct: '0.0%',
    progressWidth: 0,
    workedHours: '0.00',
    dailyHours: '0.00',
    monthEarned: '0.0000',
    hourlyLine: '¥0.00',
    dailyPayLine: '¥0.00',
  },

  onLoad: function () {
    this.timer = null;
    this.settings = store.loadSettings();
    this.pause = store.loadPause();
  },

  onShow: function () {
    this.settings = store.loadSettings();
    this.pause = store.loadPause();
    this.startTimer();
  },

  onHide: function () {
    this.stopTimer();
  },

  onUnload: function () {
    this.stopTimer();
  },

  startTimer: function () {
    this.stopTimer();
    this.tick();
    const self = this;
    this.timer = setInterval(function () {
      self.tick();
    }, 500);
  },

  stopTimer: function () {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  openSettings: function () {
    wx.navigateTo({ url: '/pages/settings/settings' });
  },

  toggleTimer: function () {
    const now = new Date();
    const schedule = this.getSchedule();
    const state = this.getState(now, schedule);
    if (state !== 'working' && state !== 'lunch') return;

    if (this.pause) {
      this.pause = null;
    } else {
      this.pause = {
        date: calc.dateKey(now),
        seconds: this.workSecondsAt(calc.daySeconds(now), schedule),
      };
    }
    store.savePause(this.pause);
    this.tick();
  },

  getSchedule: function () {
    const settings = this.settings;
    const start = calc.sec(settings.start);
    const end = calc.sec(settings.end);
    const lunchValid = calc.validTime(settings.lunchStart)
      && calc.validTime(settings.lunchEnd)
      && calc.sec(settings.lunchEnd) > calc.sec(settings.lunchStart);

    const lunchStart = lunchValid ? calc.sec(settings.lunchStart) : null;
    const lunchEnd = lunchValid ? calc.sec(settings.lunchEnd) : null;
    const lunchInWork = lunchValid
      ? Math.max(0, Math.min(end, lunchEnd) - Math.max(start, lunchStart))
      : 0;
    const dailySec = Math.max(0, end - start - lunchInWork);
    const rate = settings.hourly / 3600;

    return {
      start: start,
      end: end,
      lunchValid: lunchValid,
      lunchStart: lunchStart,
      lunchEnd: lunchEnd,
      dailySec: dailySec,
      rate: rate,
      dailyPay: dailySec * rate,
    };
  },

  workSecondsAt: function (t, schedule) {
    const elapsed = calc.clamp(t - schedule.start, 0, schedule.end - schedule.start);
    let lunchElapsed = 0;

    if (schedule.lunchValid) {
      const from = Math.max(schedule.start, schedule.lunchStart);
      const to = Math.min(t, schedule.end, schedule.lunchEnd);
      lunchElapsed = Math.max(0, to - from);
    }

    return calc.clamp(elapsed - lunchElapsed, 0, schedule.dailySec);
  },

  getState: function (now, schedule) {
    if (this.settings.workdays.indexOf(now.getDay()) === -1) return 'rest';

    const t = calc.daySeconds(now);
    if (t < schedule.start) return 'before';
    if (t >= schedule.end) return 'after';
    if (schedule.lunchValid && t >= schedule.lunchStart && t < schedule.lunchEnd) return 'lunch';
    return 'working';
  },

  nextWorkday: function (now) {
    for (let i = 1; i <= 7; i += 1) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      if (this.settings.workdays.indexOf(date.getDay()) !== -1) {
        const label = i === 1 ? '明天' : calc.DAY_NAMES[date.getDay()];
        return { label: label, time: this.settings.start };
      }
    }
    return null;
  },

  monthTotal: function (now, schedule, todayWorkSeconds) {
    let total = 0;
    const year = now.getFullYear();
    const month = now.getMonth();
    const today = now.getDate();

    for (let day = 1; day < today; day += 1) {
      const date = new Date(year, month, day);
      if (this.settings.workdays.indexOf(date.getDay()) !== -1) total += schedule.dailyPay;
    }

    if (this.settings.workdays.indexOf(now.getDay()) !== -1) {
      total += todayWorkSeconds * schedule.rate;
    }
    return total;
  },

  shortDuration: function (seconds) {
    const totalMinutes = Math.floor(Math.max(0, seconds) / 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h > 0 && m > 0) return h + '小时' + m + '分';
    if (h > 0) return h + '小时';
    return Math.max(1, m) + '分';
  },

  goalText: function (state, earned, schedule, paused) {
    const name = this.settings.itemName || '心愿好物';
    const price = Number(this.settings.itemPrice) || 0;

    if (paused) return '计时已暂停，恢复后每一秒都继续入账。';
    if (state === 'rest') return '休息日不谈钱，谈快乐。';
    if (state === 'before') return '还没到上班时间，先给自己泡杯咖啡。';
    if (state === 'lunch') return '午休时间，吃饱了才有力气继续赚。';

    if (state === 'after') {
      if (price > 0 && earned >= price) return '今天赚到的钱，够买' + name + '了。';
      if (price > 0) {
        return '今天赚到 ¥' + calc.money2(earned) + '，距离' + name + '还差 ¥' + calc.money2(Math.max(0, price - earned)) + '。';
      }
      return '今天辛苦了，明天继续。';
    }

    if (price <= 0) return '今天每一秒，都在为自己进账。';

    const need = price - earned;
    if (need <= 0) return '今天已经赚回' + name + '啦，继续加油。';

    if (schedule.dailyPay - earned >= need && schedule.rate > 0) {
      return '再过 ' + this.shortDuration(need / schedule.rate) + '，' + name + '就赚回来了。';
    }

    return '今天满勤可得 ¥' + calc.money2(schedule.dailyPay) + '，距离' + name + '还差 ¥' + calc.money2(need) + '。';
  },

  tick: function () {
    if (!this.settings) return;

    const now = new Date();
    const schedule = this.getSchedule();
    const state = this.getState(now, schedule);
    const today = calc.dateKey(now);

    if (this.pause && (this.pause.date !== today || state === 'before' || state === 'after' || state === 'rest')) {
      this.pause = null;
      store.savePause(null);
    }

    const paused = Boolean(this.pause);
    const onWorkday = this.settings.workdays.indexOf(now.getDay()) !== -1;
    const liveWorkSeconds = onWorkday ? this.workSecondsAt(calc.daySeconds(now), schedule) : 0;
    const workSeconds = paused
      ? calc.clamp(this.pause.seconds, 0, schedule.dailySec)
      : liveWorkSeconds;
    const earned = workSeconds * schedule.rate;
    const progress = schedule.dailySec > 0 ? (workSeconds / schedule.dailySec) * 100 : 0;

    const countdown = this.countdownData(state, now, schedule);
    const toggle = this.toggleData(state, paused);

    this.setData({
      dateLine: this.dateText(now),
      statusText: STATUS_TEXT[state],
      state: state,
      paused: paused,
      countdownPrefix: countdown.prefix,
      showCountdown: countdown.show,
      cdH: countdown.h,
      cdM: countdown.m,
      cdS: countdown.s,
      earned: calc.money4(earned),
      rateLine: '当前赚钱速度 ¥' + schedule.rate.toFixed(4) + ' / 秒',
      goalLine: this.goalText(state, earned, schedule, paused),
      canToggle: toggle.can,
      toggleText: toggle.text,
      progressPct: progress.toFixed(1) + '%',
      progressWidth: Math.min(100, progress),
      workedHours: (workSeconds / 3600).toFixed(2),
      dailyHours: (schedule.dailySec / 3600).toFixed(2),
      monthEarned: calc.money4(this.monthTotal(now, schedule, workSeconds)),
      hourlyLine: '¥' + this.settings.hourly.toFixed(2),
      dailyPayLine: '¥' + schedule.dailyPay.toFixed(2),
    });
  },

  dateText: function (now) {
    return now.getFullYear() + '-' + calc.pad(now.getMonth() + 1) + '-' + calc.pad(now.getDate())
      + ' ' + calc.DAY_NAMES[now.getDay()]
      + ' ' + calc.pad(now.getHours()) + ':' + calc.pad(now.getMinutes()) + ':' + calc.pad(now.getSeconds());
  },

  countdownData: function (state, now, schedule) {
    const t = calc.daySeconds(now);
    if (state === 'working' || state === 'lunch') {
      return this.hms(schedule.end - t, '距离下班还有 ');
    }
    if (state === 'before') {
      return this.hms(schedule.start - t, '距离上班还有 ');
    }
    if (state === 'after') {
      return { prefix: '今天的班就上到这里，辛苦了。', show: false, h: '0', m: '0', s: '0' };
    }

    const next = this.nextWorkday(now);
    return {
      prefix: next ? '今天休息 · 下一次上班：' + next.label + ' ' + next.time : '今天休息，好好放松。',
      show: false,
      h: '0',
      m: '0',
      s: '0',
    };
  },

  hms: function (seconds, prefix) {
    const total = Math.max(0, Math.floor(seconds));
    return {
      prefix: prefix,
      show: true,
      h: String(Math.floor(total / 3600)),
      m: String(Math.floor((total % 3600) / 60)),
      s: String(total % 60),
    };
  },

  toggleData: function (state, paused) {
    const working = state === 'working' || state === 'lunch';
    if (working) {
      return { can: true, text: paused ? '恢复计时器' : '关闭计时器' };
    }
    if (state === 'before') return { can: false, text: '还未到上班时间' };
    if (state === 'after') return { can: false, text: '今天已下班' };
    return { can: false, text: '休息日不打卡' };
  },
});
