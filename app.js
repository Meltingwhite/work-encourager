(() => {
  'use strict';

  const SETTINGS_KEY = 'work-encourager.settings.v1';
  const PAUSE_KEY = 'work-encourager.pause.v1';
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

  const STATUS_TEXT = {
    working: '上班中',
    lunch: '午休中',
    before: '还没上班',
    after: '已下班',
    rest: '休息日',
  };

  const el = {
    dateLine: document.getElementById('dateLine'),
    status: document.getElementById('status'),
    pauseChip: document.getElementById('pauseChip'),
    countdown: document.getElementById('countdown'),
    earned: document.getElementById('earned'),
    rateLine: document.getElementById('rateLine'),
    goalLine: document.getElementById('goalLine'),
    toggleTimer: document.getElementById('toggleTimer'),
    progressPct: document.getElementById('progressPct'),
    workedLine: document.getElementById('workedLine'),
    progressTrack: document.querySelector('.track'),
    progressFill: document.getElementById('progressFill'),
    monthEarned: document.getElementById('monthEarned'),
    hourlyLine: document.getElementById('hourlyLine'),
    dailyPayLine: document.getElementById('dailyPayLine'),
    openSettings: document.getElementById('openSettings'),
    overlay: document.getElementById('settingsOverlay'),
    form: document.getElementById('settingsForm'),
    closeSettings: document.getElementById('closeSettings'),
    cancelSettings: document.getElementById('cancelSettings'),
    resetSettings: document.getElementById('resetSettings'),
    formError: document.getElementById('formError'),
    dayRow: document.getElementById('dayRow'),
    start: document.getElementById('start'),
    end: document.getElementById('end'),
    lunchStart: document.getElementById('lunchStart'),
    lunchEnd: document.getElementById('lunchEnd'),
    hourly: document.getElementById('hourly'),
    itemName: document.getElementById('itemName'),
    itemPrice: document.getElementById('itemPrice'),
  };

  let settings = loadSettings();
  let pause = loadPause();
  let draftDays = new Set(settings.workdays);
  let lastFocus = null;

  init();

  function init() {
    el.openSettings.addEventListener('click', openSettings);
    el.closeSettings.addEventListener('click', closeSettings);
    el.cancelSettings.addEventListener('click', closeSettings);
    el.resetSettings.addEventListener('click', () => syncForm(DEFAULTS));
    el.overlay.addEventListener('click', (event) => {
      if (event.target === el.overlay) closeSettings();
    });
    el.dayRow.addEventListener('click', onDayClick);
    el.form.addEventListener('submit', onSaveSettings);
    el.toggleTimer.addEventListener('click', onToggleTimer);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !el.overlay.hidden) closeSettings();
    });
    document.addEventListener('visibilitychange', tick);

    tick();
    setInterval(tick, 250);
  }

  /* ---------- core time & money math ---------- */

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function validTime(value) {
    return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  }

  function sec(hhmm) {
    if (!validTime(hhmm)) return null;
    const [h, m] = hhmm.split(':').map(Number);
    return h * 3600 + m * 60;
  }

  function daySeconds(date) {
    return date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
  }

  function dateKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function getSchedule() {
    const start = sec(settings.start);
    const end = sec(settings.end);
    const lunchValid = validTime(settings.lunchStart)
      && validTime(settings.lunchEnd)
      && sec(settings.lunchEnd) > sec(settings.lunchStart);

    const lunchStart = lunchValid ? sec(settings.lunchStart) : null;
    const lunchEnd = lunchValid ? sec(settings.lunchEnd) : null;
    const lunchInWork = lunchValid
      ? Math.max(0, Math.min(end, lunchEnd) - Math.max(start, lunchStart))
      : 0;
    const dailySec = Math.max(0, end - start - lunchInWork);
    const rate = settings.hourly / 3600;

    return {
      start,
      end,
      lunchValid,
      lunchStart,
      lunchEnd,
      dailySec,
      rate,
      dailyPay: dailySec * rate,
    };
  }

  function workSecondsAt(t, schedule) {
    const elapsed = clamp(t - schedule.start, 0, schedule.end - schedule.start);
    let lunchElapsed = 0;

    if (schedule.lunchValid) {
      const from = Math.max(schedule.start, schedule.lunchStart);
      const to = Math.min(t, schedule.end, schedule.lunchEnd);
      lunchElapsed = Math.max(0, to - from);
    }

    return clamp(elapsed - lunchElapsed, 0, schedule.dailySec);
  }

  function getState(now, schedule) {
    if (!settings.workdays.includes(now.getDay())) return 'rest';

    const t = daySeconds(now);
    if (t < schedule.start) return 'before';
    if (t >= schedule.end) return 'after';
    if (schedule.lunchValid && t >= schedule.lunchStart && t < schedule.lunchEnd) return 'lunch';
    return 'working';
  }

  /* ---------- formatting ---------- */

  function money4(value) {
    return Math.max(0, value).toFixed(4);
  }

  function money2(value) {
    return Math.max(0, value).toFixed(2);
  }

  function hmsHTML(seconds) {
    const t = Math.max(0, Math.floor(seconds));
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = t % 60;
    return `<b>${h}</b>小时<b>${m}</b>分<b>${s}</b>秒`;
  }

  function shortDuration(seconds) {
    const totalMinutes = Math.floor(Math.max(0, seconds) / 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h > 0 && m > 0) return `${h}小时${m}分`;
    if (h > 0) return `${h}小时`;
    return `${Math.max(1, m)}分`;
  }

  function nextWorkday(now) {
    for (let i = 1; i <= 7; i += 1) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      if (settings.workdays.includes(date.getDay())) {
        const label = i === 1 ? '明天' : DAY_NAMES[date.getDay()];
        return { label, time: settings.start };
      }
    }
    return null;
  }

  /* ---------- render ---------- */

  function tick() {
    const now = new Date();
    const schedule = getSchedule();
    const state = getState(now, schedule);
    const today = dateKey(now);

    if (pause && (pause.date !== today || state === 'before' || state === 'after' || state === 'rest')) {
      pause = null;
      persistPause();
    }

    const paused = Boolean(pause);
    const onWorkday = settings.workdays.includes(now.getDay());
    const liveWorkSeconds = onWorkday ? workSecondsAt(daySeconds(now), schedule) : 0;
    const workSeconds = paused ? clamp(pause.seconds, 0, schedule.dailySec) : liveWorkSeconds;
    const earned = workSeconds * schedule.rate;
    const progress = schedule.dailySec > 0 ? (workSeconds / schedule.dailySec) * 100 : 0;

    el.dateLine.textContent = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${DAY_NAMES[now.getDay()]} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    el.status.textContent = STATUS_TEXT[state];
    el.status.dataset.state = state;
    el.pauseChip.hidden = !paused;
    el.countdown.innerHTML = countdownHTML(state, now, schedule);
    el.earned.textContent = money4(earned);
    el.rateLine.textContent = `当前赚钱速度 ¥${schedule.rate.toFixed(4)} / 秒`;
    el.goalLine.textContent = goalText(state, earned, schedule, paused);

    renderToggle(state, paused);

    el.progressPct.textContent = `${progress.toFixed(1)}%`;
    el.workedLine.innerHTML = `已工作 <b>${(workSeconds / 3600).toFixed(2)}</b> / ${(schedule.dailySec / 3600).toFixed(2)} 小时`;
    el.progressFill.style.width = `${Math.min(100, progress).toFixed(1)}%`;
    el.progressTrack.setAttribute('aria-valuenow', Math.round(progress));

    el.monthEarned.textContent = money4(monthTotal(now, schedule, workSeconds));
    el.hourlyLine.textContent = `¥${settings.hourly.toFixed(2)}`;
    el.dailyPayLine.textContent = `¥${schedule.dailyPay.toFixed(2)}`;
  }

  function countdownHTML(state, now, schedule) {
    const t = daySeconds(now);

    if (state === 'working' || state === 'lunch') {
      return `距离下班还有 ${hmsHTML(schedule.end - t)}`;
    }
    if (state === 'before') {
      return `距离上班还有 ${hmsHTML(schedule.start - t)}`;
    }
    if (state === 'after') {
      return '今天的班就上到这里，辛苦了。';
    }

    const next = nextWorkday(now);
    return next
      ? `今天休息 · 下一次上班：${next.label} ${next.time}`
      : '今天休息，好好放松。';
  }

  function goalText(state, earned, schedule, paused) {
    const name = settings.itemName || '心愿好物';
    const price = Number(settings.itemPrice) || 0;

    if (paused) return '计时已暂停，恢复后每一秒都继续入账。';
    if (state === 'rest') return '休息日不谈钱，谈快乐。';
    if (state === 'before') return '还没到上班时间，先给自己泡杯咖啡。';
    if (state === 'lunch') return '午休时间，吃饱了才有力气继续赚。';

    if (state === 'after') {
      if (price > 0 && earned >= price) return `今天赚到的钱，够买${name}了。`;
      if (price > 0) {
        return `今天赚到 ¥${money2(earned)}，距离${name}还差 ¥${money2(Math.max(0, price - earned))}。`;
      }
      return '今天辛苦了，明天继续。';
    }

    if (price <= 0) return '今天每一秒，都在为自己进账。';

    const need = price - earned;
    if (need <= 0) return `今天已经赚回${name}啦，继续加油。`;

    if (schedule.dailyPay - earned >= need && schedule.rate > 0) {
      return `再过 ${shortDuration(need / schedule.rate)}，${name}就赚回来了。`;
    }

    return `今天满勤可得 ¥${money2(schedule.dailyPay)}，距离${name}还差 ¥${money2(need)}。`;
  }

  function renderToggle(state, paused) {
    const working = state === 'working' || state === 'lunch';
    el.toggleTimer.disabled = !working;

    if (working) {
      el.toggleTimer.textContent = paused ? '恢复计时器' : '关闭计时器';
      return;
    }
    if (state === 'before') {
      el.toggleTimer.textContent = '还未到上班时间';
    } else if (state === 'after') {
      el.toggleTimer.textContent = '今天已下班';
    } else {
      el.toggleTimer.textContent = '休息日不打卡';
    }
  }

  function monthTotal(now, schedule, todayWorkSeconds) {
    let total = 0;
    const year = now.getFullYear();
    const month = now.getMonth();
    const today = now.getDate();

    for (let day = 1; day < today; day += 1) {
      const date = new Date(year, month, day);
      if (settings.workdays.includes(date.getDay())) total += schedule.dailyPay;
    }

    if (settings.workdays.includes(now.getDay())) {
      total += todayWorkSeconds * schedule.rate;
    }
    return total;
  }

  /* ---------- actions ---------- */

  function onToggleTimer() {
    const now = new Date();
    const schedule = getSchedule();
    const state = getState(now, schedule);
    if (state !== 'working' && state !== 'lunch') return;

    if (pause) {
      pause = null;
    } else {
      pause = {
        date: dateKey(now),
        seconds: workSecondsAt(daySeconds(now), schedule),
      };
    }
    persistPause();
    tick();
  }

  function onDayClick(event) {
    const button = event.target.closest('.day');
    if (!button) return;

    const day = Number(button.dataset.day);
    if (draftDays.has(day)) draftDays.delete(day);
    else draftDays.add(day);
    paintDays();
    hideError();
  }

  function openSettings() {
    lastFocus = document.activeElement;
    syncForm(settings);
    el.overlay.hidden = false;
    document.body.classList.add('modal-open');
    setTimeout(() => el.start.focus(), 30);
  }

  function closeSettings() {
    el.overlay.hidden = true;
    document.body.classList.remove('modal-open');
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  function syncForm(data) {
    el.start.value = data.start;
    el.end.value = data.end;
    el.lunchStart.value = data.lunchStart || '';
    el.lunchEnd.value = data.lunchEnd || '';
    el.hourly.value = String(data.hourly);
    el.itemName.value = data.itemName || '';
    el.itemPrice.value = String(data.itemPrice);
    draftDays = new Set(data.workdays);
    paintDays();
    hideError();
  }

  function paintDays() {
    el.dayRow.querySelectorAll('.day').forEach((button) => {
      const active = draftDays.has(Number(button.dataset.day));
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function showError(message) {
    el.formError.textContent = message;
    el.formError.hidden = false;
  }

  function hideError() {
    el.formError.hidden = true;
    el.formError.textContent = '';
  }

  function onSaveSettings(event) {
    event.preventDefault();

    const next = {
      start: el.start.value,
      end: el.end.value,
      lunchStart: el.lunchStart.value,
      lunchEnd: el.lunchEnd.value,
      hourly: Number.parseFloat(el.hourly.value),
      itemName: el.itemName.value.trim() || '心愿好物',
      itemPrice: Number.parseFloat(el.itemPrice.value),
      workdays: orderDays([...draftDays]),
    };

    const error = validateSettings(next);
    if (error) {
      showError(error);
      return;
    }

    settings = next;
    persistSettings();
    pause = null;
    persistPause();
    closeSettings();
    tick();
  }

  function validateSettings(data) {
    if (!validTime(data.start) || !validTime(data.end)) return '请填写有效的上下班时间。';
    if (sec(data.end) <= sec(data.start)) return '下班时间需要晚于上班时间。';

    const hasLunch = data.lunchStart !== '' || data.lunchEnd !== '';
    if (hasLunch) {
      if (!validTime(data.lunchStart) || !validTime(data.lunchEnd)) {
        return '午休需要同时填写开始和结束；不午休请都留空。';
      }
      if (sec(data.lunchEnd) <= sec(data.lunchStart)) return '午休结束需要晚于开始时间。';
      if (sec(data.lunchStart) < sec(data.start) || sec(data.lunchEnd) > sec(data.end)) {
        return '午休需要安排在上下班时间之内。';
      }
    }

    if (!Number.isFinite(data.hourly) || data.hourly <= 0) return '请填写大于 0 的时薪。';
    if (!Number.isFinite(data.itemPrice) || data.itemPrice < 0) return '请填写有效的愿望价格（可填 0）。';
    if (!data.workdays.length) return '请至少选择一个工作日。';
    return '';
  }

  function orderDays(days) {
    return days.sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));
  }

  /* ---------- persistence ---------- */

  function copyDefaults() {
    return { ...DEFAULTS, workdays: [...DEFAULTS.workdays] };
  }

  function loadSettings() {
    try {
      const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY));
      if (!raw || typeof raw !== 'object') return copyDefaults();

      const merged = { ...copyDefaults(), ...raw };
      const timesOk = validTime(merged.start) && validTime(merged.end) && sec(merged.end) > sec(merged.start);
      if (!timesOk) {
        merged.start = DEFAULTS.start;
        merged.end = DEFAULTS.end;
      }

      const rawHasLunch = Object.prototype.hasOwnProperty.call(raw, 'lunchStart')
        || Object.prototype.hasOwnProperty.call(raw, 'lunchEnd');
      const lunchEmpty = merged.lunchStart === '' && merged.lunchEnd === '';
      const lunchOk = validTime(merged.lunchStart)
        && validTime(merged.lunchEnd)
        && sec(merged.lunchEnd) > sec(merged.lunchStart)
        && sec(merged.lunchStart) >= sec(merged.start)
        && sec(merged.lunchEnd) <= sec(merged.end);

      if (rawHasLunch && lunchEmpty) {
        merged.lunchStart = '';
        merged.lunchEnd = '';
      } else if (!lunchOk) {
        merged.lunchStart = DEFAULTS.lunchStart;
        merged.lunchEnd = DEFAULTS.lunchEnd;
      }

      merged.hourly = Number(merged.hourly);
      if (!Number.isFinite(merged.hourly) || merged.hourly <= 0) merged.hourly = DEFAULTS.hourly;

      merged.itemPrice = Number(merged.itemPrice);
      if (!Number.isFinite(merged.itemPrice) || merged.itemPrice < 0) {
        merged.itemPrice = DEFAULTS.itemPrice;
      }

      merged.itemName = typeof merged.itemName === 'string' && merged.itemName.trim()
        ? merged.itemName.trim()
        : DEFAULTS.itemName;

      const days = Array.isArray(merged.workdays)
        ? [...new Set(merged.workdays.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))]
        : [];
      merged.workdays = days.length ? orderDays(days) : [...DEFAULTS.workdays];

      return merged;
    } catch {
      return copyDefaults();
    }
  }

  function persistSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* storage unavailable — keep running in memory */
    }
  }

  function loadPause() {
    try {
      const raw = JSON.parse(localStorage.getItem(PAUSE_KEY));
      if (raw && typeof raw.date === 'string' && Number.isFinite(Number(raw.seconds))) {
        return { date: raw.date, seconds: Math.max(0, Number(raw.seconds)) };
      }
    } catch {
      /* ignore corrupt state */
    }
    return null;
  }

  function persistPause() {
    try {
      if (pause) localStorage.setItem(PAUSE_KEY, JSON.stringify(pause));
      else localStorage.removeItem(PAUSE_KEY);
    } catch {
      /* storage unavailable */
    }
  }
})();
