/* =========================================================
   0. 공통 도구
   ========================================================= */
// localStorage 저장/불러오기 (새로고침해도 데이터 유지)
function load(key, fallback) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch (e) {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    /* 저장이 막힌 환경이면 넘어감 */
  }
}

// Date → "2026-11-14"
function dateKey(d = new Date()) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// "2026-11-14" → "11월 14일 (토)"
function prettyDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  const day = ["일", "월", "화", "수", "목", "금", "토"][new Date(y, m - 1, d).getDay()];
  return `${y}년 ${m}월 ${d}일 (${day})`;
}

// 분 → "1h 30m"
function formatMinutes(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

// 태그 등을 글자 그대로 보이게 (입력값을 innerHTML에 넣을 때 안전하게)
function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// 화면 아래 잠깐 뜨는 알림
const toastEl = document.getElementById("toast");
let toastTimer = null;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1800);
}

/* =========================================================
   1. 페이지 전환 (라우터)
   - 주소 끝의 #todo, #diary 등을 보고 해당 페이지만 보여줌
   - 뒤로가기/새로고침해도 보던 페이지 유지
   ========================================================= */
const PAGE_TITLES = {
  dashboard: "Ｃａｌｅｎｄａｒ",
  todo: "☑️ 𝑇𝑜 𝐷𝑜 𝐿𝑖𝑠𝑡",
  pomodoro: "⏱️ 𝑃𝑜𝑚𝑜𝑑𝑜𝑟𝑜",
  youtube: "🎵 𝑃𝑙𝑎𝑦𝑙𝑖𝑠𝑡",
  "study-log": "📚 𝑆𝑡𝑢𝑑𝑦",
  diary: "📔 𝐷𝑖𝑎𝑟𝑦",
};

const pages = document.querySelectorAll(".page");
const navItems = document.querySelectorAll(".nav-item");
const pageTitle = document.getElementById("page-title");

function showPage(name) {
  if (!PAGE_TITLES[name]) name = "dashboard"; // 없는 주소면 대시보드로

  pages.forEach((page) => {
    page.classList.toggle("active", page.id === `page-${name}`);
  });
  navItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.page === name);
  });

  pageTitle.textContent = PAGE_TITLES[name];
  window.scrollTo(0, 0);

  // 대시보드로 올 때마다 최신 내용으로 갱신
  if (name === "dashboard") renderDashboard();
}

// 메뉴(<a href="#todo">) 클릭 → 주소가 바뀜 → hashchange 발생 → 페이지 전환
window.addEventListener("hashchange", () => {
  showPage(location.hash.slice(1));
});

/* =========================================================
   2. 헤더 날짜
   ========================================================= */
document.getElementById("today-date").textContent = new Date().toLocaleDateString("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
});

/* =========================================================
   3. 투두리스트
   ========================================================= */
const todoForm = document.getElementById("todo-form");
const todoInput = document.getElementById("todo-input");
const todoList = document.getElementById("todo-list");
const filterBtns = document.querySelectorAll("#todo-filters [data-filter]");
const clearDoneBtn = document.getElementById("clear-done");

let todos = load("todos", []); // [{ id, text, done }]
let todoFilter = "all";

// 할 일 하나를 <li>로 만들기 (투두 페이지·대시보드에서 같이 사용)
function createTodoItem(todo, withDelete) {
  const li = document.createElement("li");
  li.className = "todo-item" + (todo.done ? " done" : "");

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.id = `${withDelete ? "t" : "dt"}-${todo.id}`;
  checkbox.checked = todo.done;
  checkbox.addEventListener("change", () => toggleTodo(todo.id));

  const label = document.createElement("label");
  label.htmlFor = checkbox.id;
  label.textContent = todo.text;

  li.append(checkbox, label);

  if (withDelete) {
    const del = document.createElement("button");
    del.className = "btn-delete";
    del.setAttribute("aria-label", "삭제");
    del.textContent = "✕";
    del.addEventListener("click", () => deleteTodo(todo.id));
    li.appendChild(del);
  }
  return li;
}

function renderTodos() {
  const shown = todos.filter((t) => {
    if (todoFilter === "active") return !t.done;
    if (todoFilter === "done") return t.done;
    return true;
  });

  todoList.innerHTML = "";
  if (shown.length === 0) {
    todoList.innerHTML = `<li class="empty">해당하는 할 일이 없어요 ✨</li>`;
  }
  shown.forEach((t) => todoList.appendChild(createTodoItem(t, true)));

  save("todos", todos);
  renderDashboard();
}

function toggleTodo(id) {
  todos = todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
  renderTodos();
}

function deleteTodo(id) {
  todos = todos.filter((t) => t.id !== id);
  renderTodos();
}

todoForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = todoInput.value.trim();
  if (!text) return;
  todos.push({ id: Date.now(), text, done: false });
  todoInput.value = "";
  todoInput.focus();
  renderTodos();
});

filterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    todoFilter = btn.dataset.filter;
    filterBtns.forEach((b) => b.classList.toggle("active", b === btn));
    renderTodos();
  });
});

clearDoneBtn.addEventListener("click", () => {
  if (!todos.some((t) => t.done)) return;
  todos = todos.filter((t) => !t.done);
  renderTodos();
  toast("완료한 할 일을 지웠어요");
});

/* =========================================================
   4. 공부 기록
   ========================================================= */
const logForm = document.getElementById("log-form");
const logSubject = document.getElementById("log-subject");
const logMinutes = document.getElementById("log-minutes");
const logList = document.getElementById("log-list");
const weekChart = document.getElementById("week-chart");
const weekTotal = document.getElementById("week-total");

// { "2026-11-14": [{ id, subject, minutes }] }
let studyLogs = load("studyLogs", {});

function todayLogs() {
  return studyLogs[dateKey()] || [];
}

function createLogItem(log, withDelete) {
  const li = document.createElement("li");
  li.className = "log-item";
  li.innerHTML = `
    <span>${escapeHTML(log.subject)}</span>
    <div class="log-right">
      <span class="log-time">${formatMinutes(log.minutes)}</span>
    </div>`;

  if (withDelete) {
    const del = document.createElement("button");
    del.className = "btn-delete";
    del.setAttribute("aria-label", "삭제");
    del.textContent = "✕";
    del.addEventListener("click", () => deleteLog(log.id));
    li.querySelector(".log-right").appendChild(del);
  }
  return li;
}

function renderLogs() {
  const today = todayLogs();
  logList.innerHTML = "";
  if (today.length === 0) {
    logList.innerHTML = `<li class="empty">오늘 공부 기록이 아직 없어요 📖</li>`;
  }
  today.forEach((l) => logList.appendChild(createLogItem(l, true)));

  renderWeekChart();
  save("studyLogs", studyLogs);
  renderDashboard();
}

// 최근 7일 막대 그래프
function renderWeekChart() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dateKey(d);
    const total = (studyLogs[key] || []).reduce((s, l) => s + l.minutes, 0);
    days.push({ key, total, label: ["일", "월", "화", "수", "목", "금", "토"][d.getDay()], today: i === 0 });
  }

  const max = Math.max(60, ...days.map((d) => d.total)); // 최소 기준 60분
  weekChart.innerHTML = days
    .map(
      (d) => `
      <div class="bar-col ${d.today ? "today" : ""}">
        <span class="bar-value">${d.total ? formatMinutes(d.total) : ""}</span>
        <div class="bar" style="height:${(d.total / max) * 80}%"></div>
        <span class="bar-label">${d.label}</span>
      </div>`
    )
    .join("");

  const sum = days.reduce((s, d) => s + d.total, 0);
  weekTotal.textContent = `이번 7일 동안 총 ${formatMinutes(sum)} 공부했어요`;
}

function addLog(subject, minutes) {
  const key = dateKey();
  if (!studyLogs[key]) studyLogs[key] = [];
  const same = studyLogs[key].find((l) => l.subject === subject);
  if (same) same.minutes += minutes;
  else studyLogs[key].push({ id: Date.now(), subject, minutes });
  renderLogs();
}

function deleteLog(id) {
  const key = dateKey();
  studyLogs[key] = todayLogs().filter((l) => l.id !== id);
  renderLogs();
}

logForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const subject = logSubject.value.trim();
  const minutes = parseInt(logMinutes.value, 10);
  if (!subject || !minutes || minutes <= 0) return;
  addLog(subject, minutes);
  logSubject.value = "";
  logMinutes.value = "";
});

/* =========================================================
   5. 뽀모도로 타이머
   - 페이지를 이동해도 계속 돌아감
   - 대시보드의 작은 타이머와 같이 움직임
   ========================================================= */
const MODES = {
  focus: { min: 25, name: "집중" },
  short: { min: 5, name: "짧은 휴식" },
  long: { min: 15, name: "긴 휴식" },
};

const timerDisplay = document.getElementById("timer-display");
const btnStart = document.getElementById("btn-start");
const btnPause = document.getElementById("btn-pause");
const btnReset = document.getElementById("btn-reset");
const modeTabs = document.querySelectorAll(".mode-tab");
const pomoCountEl = document.getElementById("pomo-count");

let currentMode = "focus";
let remaining = MODES.focus.min * 60;
let timerId = null;
let endTime = null;

const pomoData = load("pomoCount", {});
let pomoCount = pomoData[dateKey()] || 0;

function renderTimer() {
  const m = String(Math.floor(remaining / 60)).padStart(2, "0");
  const s = String(remaining % 60).padStart(2, "0");
  const text = `${m}:${s}`;

  timerDisplay.textContent = text;
  pomoCountEl.textContent = pomoCount;

  const running = timerId !== null;
  const started = remaining !== MODES[currentMode].min * 60;
  btnStart.textContent = running ? "진행 중" : started ? "계속" : "시작";
  btnStart.disabled = running;

  document.title = running ? `${text} | My Planner` : "My Planner | 나만의 일정 관리";
}

function tick() {
  remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
  renderTimer();
  if (remaining === 0) finishTimer();
}

function startTimer() {
  if (timerId) return;
  endTime = Date.now() + remaining * 1000;
  timerId = setInterval(tick, 250);
  renderTimer();
}

function pauseTimer() {
  clearInterval(timerId);
  timerId = null;
  renderTimer();
}

function resetTimer() {
  clearInterval(timerId);
  timerId = null;
  remaining = MODES[currentMode].min * 60;
  renderTimer();
}

function setMode(mode) {
  currentMode = mode;
  modeTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.mode === mode));
  resetTimer();
}

function finishTimer() {
  clearInterval(timerId);
  timerId = null;
  playBeep();

  if (currentMode === "focus") {
    pomoCount++;
    pomoData[dateKey()] = pomoCount;
    save("pomoCount", pomoData);
    addLog("뽀모도로 집중", MODES.focus.min);
    toast("🍅 집중 완료! 잠깐 쉬어가요");
    setMode(pomoCount % 4 === 0 ? "long" : "short");
  } else {
    toast("휴식 끝! 다시 집중해 볼까요?");
    setMode("focus");
  }
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1);
  } catch (e) {}
}

btnStart.addEventListener("click", startTimer);
btnPause.addEventListener("click", pauseTimer);
btnReset.addEventListener("click", resetTimer);
modeTabs.forEach((tab) => tab.addEventListener("click", () => setMode(tab.dataset.mode)));

/* =========================================================
   6. 공부 영상 (유튜브) + 상단 미니 플레이어
   ========================================================= */
const youtubeForm = document.getElementById("youtube-form");
const youtubeInput = document.getElementById("youtube-input");
const videoWrapper = document.getElementById("video-wrapper");
const ytToggle = document.getElementById("yt-toggle");
const ytStatus = document.getElementById("yt-status");

let ytIframe = null;   // 지금 재생 중인 영상 iframe
let ytPlaying = false;
let ytTitle = "";

function getYoutubeId(url) {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

function getPlaylistId(url) {
  const match = url.match(/[?&]list=([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

// 상단 미니 플레이어 표시 갱신
function renderYtMini() {
  ytToggle.textContent = ytPlaying ? "❚❚" : "▶";
  ytToggle.setAttribute("aria-label", ytPlaying ? "일시정지" : "재생");
  if (ytIframe) {
    ytStatus.textContent = ytTitle || (ytPlaying ? "재생 중" : "일시정지됨");
  } else {
    ytStatus.textContent = load("lastVideo", "") ? "마지막 영상 이어 듣기" : "링크를 넣어 주세요";
  }
}

// 유튜브 플레이어에 명령 보내기 (playVideo / pauseVideo)
function ytCommand(func) {
  if (!ytIframe) return;
  ytIframe.contentWindow.postMessage(JSON.stringify({ event: "command", func, args: [] }), "*");
}

function playVideo(url) {
  const videoId = getYoutubeId(url);
  const listId = getPlaylistId(url);

  // enablejsapi=1 → 상단 버튼으로 재생/정지를 조종할 수 있게 해 줌
  const common = "autoplay=1&enablejsapi=1";
  let src = "";
  if (videoId) {
    src = `https://www.youtube.com/embed/${videoId}?${common}` + (listId ? `&list=${listId}` : "");
  } else if (listId) {
    src = `https://www.youtube.com/embed/videoseries?list=${listId}&${common}`;
  } else {
    videoWrapper.innerHTML = `<p class="placeholder">올바른 유튜브 링크가 아니에요 😢</p>`;
    toast("올바른 유튜브 링크가 아니에요");
    return;
  }

  videoWrapper.innerHTML = "";
  const iframe = document.createElement("iframe");
  iframe.src = src;
  iframe.title = "YouTube video player";
  iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.allowFullscreen = true;
  // 영상이 로드되면 "상태 알려줘" 요청 → 재생/정지 상태와 제목을 받아옴
  iframe.addEventListener("load", () => {
    iframe.contentWindow.postMessage(JSON.stringify({ event: "listening", id: "planner" }), "*");
  });
  videoWrapper.appendChild(iframe);

  ytIframe = iframe;
  ytPlaying = true;
  ytTitle = "";
  save("lastVideo", url);
  renderYtMini();
}

// 유튜브가 보내 주는 상태 메시지 받기
window.addEventListener("message", (e) => {
  if (!String(e.origin).includes("youtube")) return;
  let data;
  try {
    data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
  } catch (err) {
    return;
  }
  const info = data && data.info;
  if (!info) return;
  if (typeof info.playerState === "number") {
    ytPlaying = info.playerState === 1 || info.playerState === 3; // 1=재생, 3=버퍼링
  }
  if (info.videoData && info.videoData.title) {
    ytTitle = info.videoData.title;
  }
  renderYtMini();
});

// 상단 ▶ 버튼
ytToggle.addEventListener("click", () => {
  if (!ytIframe) {
    const last = load("lastVideo", "");
    if (last) {
      playVideo(last); // 마지막으로 본 영상 이어서 재생
    } else {
      location.hash = "#youtube";
      toast("먼저 유튜브 링크를 넣어 주세요");
    }
    return;
  }
  ytCommand(ytPlaying ? "pauseVideo" : "playVideo");
  ytPlaying = !ytPlaying;
  renderYtMini();
});

youtubeForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const url = youtubeInput.value.trim();
  if (url) playVideo(url);
});

/* =========================================================
   7. 다이어리
   ========================================================= */
const diaryDate = document.getElementById("diary-date");
const moodPicker = document.getElementById("mood-picker");
const moodBtns = moodPicker.querySelectorAll(".mood");
const diaryTitle = document.getElementById("diary-title");
const diaryContent = document.getElementById("diary-content");
const diaryInfo = document.getElementById("diary-info");
const diarySave = document.getElementById("diary-save");
const diaryDelete = document.getElementById("diary-delete");
const diaryList = document.getElementById("diary-list");

// { "2026-11-14": { mood, title, content, updated } }
let diaries = load("diaries", {});
let selectedMood = "";

function setMood(mood) {
  selectedMood = mood;
  moodBtns.forEach((b) => b.classList.toggle("selected", b.dataset.mood === mood));
}

// 선택한 날짜의 일기를 편집창에 불러오기
function openDiary(key) {
  diaryDate.value = key;
  const entry = diaries[key];

  diaryTitle.value = entry ? entry.title : "";
  diaryContent.value = entry ? entry.content : "";
  setMood(entry ? entry.mood : "");
  diaryInfo.textContent = entry
    ? `마지막 저장: ${new Date(entry.updated).toLocaleString("ko-KR")}`
    : "아직 작성하지 않은 날이에요";
  diaryDelete.disabled = !entry;

  renderDiaryList();
}

function saveDiary() {
  const key = diaryDate.value;
  const title = diaryTitle.value.trim();
  const content = diaryContent.value.trim();
  if (!key) return;
  if (!title && !content) {
    toast("제목이나 내용을 입력해 주세요");
    return;
  }

  diaries[key] = { mood: selectedMood, title, content, updated: Date.now() };
  save("diaries", diaries);
  toast("일기를 저장했어요 📔");
  openDiary(key);
  renderDashboard();
}

function deleteDiary() {
  const key = diaryDate.value;
  if (!diaries[key]) return;
  if (!confirm(`${prettyDate(key)} 일기를 삭제할까요?`)) return;

  delete diaries[key];
  save("diaries", diaries);
  toast("일기를 삭제했어요");
  openDiary(key);
  renderDashboard();
}

function renderDiaryList() {
  const keys = Object.keys(diaries).sort().reverse(); // 최신순
  diaryList.innerHTML = "";

  if (keys.length === 0) {
    diaryList.innerHTML = `<li class="empty">아직 쓴 일기가 없어요 ✍️</li>`;
    return;
  }

  keys.forEach((key) => {
    const entry = diaries[key];
    const li = document.createElement("li");
    li.className = "diary-item" + (key === diaryDate.value ? " current" : "");
    li.innerHTML = `
      <span class="d-mood">${entry.mood || "📝"}</span>
      <div class="d-body">
        <p class="d-date">${prettyDate(key)}</p>
        <p class="d-title">${escapeHTML(entry.title || "(제목 없음)")}</p>
      </div>`;
    li.addEventListener("click", () => openDiary(key));
    diaryList.appendChild(li);
  });
}

moodBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    // 같은 기분을 다시 누르면 선택 해제
    setMood(selectedMood === btn.dataset.mood ? "" : btn.dataset.mood);
  });
});
diaryDate.addEventListener("change", () => openDiary(diaryDate.value));
diarySave.addEventListener("click", saveDiary);
diaryDelete.addEventListener("click", deleteDiary);

// Ctrl + S (Mac은 Cmd + S)로도 저장
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "s" && location.hash === "#diary") {
    e.preventDefault();
    saveDiary();
  }
});

/* =========================================================
   8. 대시보드: 요약 숫자
   ========================================================= */
function renderDashboard() {
  const left = todos.filter((t) => !t.done).length;
  const studyMin = todayLogs().reduce((s, l) => s + l.minutes, 0);
  document.getElementById("dash-todo-count").textContent = left;
  document.getElementById("dash-study-total").textContent =
    `${Math.floor(studyMin / 60)}h ${String(studyMin % 60).padStart(2, "0")}m`;
}

/* =========================================================
   9. 캘린더
   ========================================================= */
const calTitle = document.getElementById("cal-title");
const calGrid = document.getElementById("cal-grid");
const dayTitle = document.getElementById("day-title");
const dayEvents = document.getElementById("day-events");
const catList = document.getElementById("cat-list");
const catForm = document.getElementById("cat-form");
const catNameInput = document.getElementById("cat-name");
const catColorInput = document.getElementById("cat-color");

// 기본 분류 (처음 한 번만 사용, 이후엔 저장된 값 사용)
const DEFAULT_CATS = [
  { id: "c1", name: "수업", color: "#6c63ff" },
  { id: "c2", name: "과제", color: "#ff6b6b" },
  { id: "c3", name: "시험", color: "#ffa94d" },
  { id: "c4", name: "약속", color: "#20c997" },
  { id: "c5", name: "개인", color: "#4dabf7" },
];

let categories = load("categories", DEFAULT_CATS);
let events = load("events", []); // [{ id, title, start, end, time, cat, memo }]
let hiddenCats = load("hiddenCats", []); // 숨긴 분류 id 목록

let viewYear = new Date().getFullYear();
let viewMonth = new Date().getMonth(); // 0 = 1월
let selectedDate = dateKey();

function getCat(id) {
  return categories.find((c) => c.id === id) || { id: "", name: "분류 없음", color: "#adb5bd" };
}

// 특정 날짜에 보여줄 일정 (기간 일정 포함, 숨긴 분류 제외, 시간순)
function eventsOn(key) {
  return events
    .filter((ev) => !hiddenCats.includes(ev.cat))
    .filter((ev) => key >= ev.start && key <= (ev.end || ev.start))
    .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
}

function renderCalendar() {
  calTitle.textContent = `${viewYear}년 ${viewMonth + 1}월`;

  // 달력 첫 칸 = 이번 달 1일이 있는 주의 일요일
  const first = new Date(viewYear, viewMonth, 1);
  const start = new Date(viewYear, viewMonth, 1 - first.getDay());
  const maxChips = window.innerHeight < 850 ? 2 : 3; // 화면이 낮으면 칸당 2개까지

  calGrid.innerHTML = "";
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = dateKey(d);
    const list = eventsOn(key);

    const cell = document.createElement("div");
    cell.className = "cal-cell";
    if (d.getMonth() !== viewMonth) cell.classList.add("other");
    if (key === dateKey()) cell.classList.add("today");
    if (key === selectedDate) cell.classList.add("selected");
    if (d.getDay() === 0) cell.classList.add("sun-col");
    if (d.getDay() === 6) cell.classList.add("sat-col");

    cell.innerHTML = `<span class="cal-num">${d.getDate()}</span>`;

    // PC: 일정 막대
    list.slice(0, maxChips).forEach((ev) => {
      const chip = document.createElement("div");
      chip.className = "ev-chip";
      chip.style.background = getCat(ev.cat).color;
      chip.textContent = (ev.time ? ev.time + " " : "") + ev.title;
      chip.title = ev.title;
      chip.addEventListener("click", (e) => {
        e.stopPropagation(); // 칸 클릭(날짜 선택)과 구분
        openEventModal(ev);
      });
      cell.appendChild(chip);
    });
    if (list.length > maxChips) {
      cell.insertAdjacentHTML("beforeend", `<span class="ev-more">+${list.length - maxChips}개</span>`);
    }

    // 휴대폰: 색 점
    if (list.length) {
      const dots = list
        .slice(0, 3)
        .map((ev) => `<span class="ev-dot" style="background:${getCat(ev.cat).color}"></span>`)
        .join("");
      cell.insertAdjacentHTML("beforeend", `<div class="ev-dots">${dots}</div>`);
    }

    cell.addEventListener("click", () => selectDate(key));
    cell.addEventListener("dblclick", () => openEventModal(null, key)); // 더블클릭 = 바로 추가
    calGrid.appendChild(cell);
  }

  renderDayEvents();
}

function selectDate(key) {
  selectedDate = key;
  const [y, m] = key.split("-").map(Number);
  // 다른 달 날짜를 누르면 그 달로 이동
  if (y !== viewYear || m - 1 !== viewMonth) {
    viewYear = y;
    viewMonth = m - 1;
  }
  renderCalendar();
}

// 오른쪽: 선택한 날짜의 일정 목록
function renderDayEvents() {
  dayTitle.textContent = prettyDate(selectedDate).replace(/^\d+년 /, "");
  const list = eventsOn(selectedDate);
  dayEvents.innerHTML = "";

  if (list.length === 0) {
    dayEvents.innerHTML = `<li class="empty">일정이 없어요<br><span class="small">날짜를 두 번 누르면 바로 추가돼요</span></li>`;
    return;
  }

  list.forEach((ev) => {
    const cat = getCat(ev.cat);
    const period = ev.end && ev.end !== ev.start ? ` · ${ev.start.slice(5)} ~ ${ev.end.slice(5)}` : "";
    const li = document.createElement("li");
    li.className = "day-event";
    li.innerHTML = `
      <span class="bar-mark" style="background:${cat.color}"></span>
      <div class="e-body">
        <p class="e-title">${escapeHTML(ev.title)}</p>
        <p class="e-meta">${ev.time || "종일"} · ${escapeHTML(cat.name)}${period}</p>
        ${ev.memo ? `<p class="e-meta">${escapeHTML(ev.memo)}</p>` : ""}
      </div>`;
    li.addEventListener("click", () => openEventModal(ev));
    dayEvents.appendChild(li);
  });
}

document.getElementById("cal-prev").addEventListener("click", () => {
  viewMonth--;
  if (viewMonth < 0) { viewMonth = 11; viewYear--; }
  renderCalendar();
});
document.getElementById("cal-next").addEventListener("click", () => {
  viewMonth++;
  if (viewMonth > 11) { viewMonth = 0; viewYear++; }
  renderCalendar();
});
document.getElementById("cal-today").addEventListener("click", () => selectDate(dateKey()));
document.getElementById("cal-add").addEventListener("click", () => openEventModal(null, selectedDate));
document.getElementById("day-add").addEventListener("click", () => openEventModal(null, selectedDate));

// 창 크기가 바뀌면 칸당 일정 개수 다시 계산
let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(renderCalendar, 150);
});

/* ----- 분류(카테고리) ----- */
function renderCategories() {
  catList.innerHTML = "";
  categories.forEach((cat) => {
    const li = document.createElement("li");
    li.className = "cat-item" + (hiddenCats.includes(cat.id) ? " off" : "");

    // 색 동그라미 → 누르면 색 선택창
    const color = document.createElement("input");
    color.type = "color";
    color.value = cat.color;
    color.title = "색 변경";
    color.addEventListener("input", () => {
      cat.color = color.value;
      save("categories", categories);
      renderCalendar(); // 바꾸는 즉시 캘린더에 반영
    });

    // 이름 → 누르면 캘린더에서 숨기기/보이기
    const name = document.createElement("span");
    name.className = "cat-name";
    name.textContent = cat.name;
    name.title = "눌러서 숨기기/보이기";
    name.addEventListener("click", () => {
      hiddenCats = hiddenCats.includes(cat.id)
        ? hiddenCats.filter((id) => id !== cat.id)
        : [...hiddenCats, cat.id];
      save("hiddenCats", hiddenCats);
      renderCategories();
      renderCalendar();
    });

    const del = document.createElement("button");
    del.className = "cat-del";
    del.textContent = "✕";
    del.title = "분류 삭제";
    del.addEventListener("click", () => deleteCategory(cat.id));

    li.append(color, name, del);
    catList.appendChild(li);
  });
}

function deleteCategory(id) {
  if (categories.length <= 1) {
    toast("분류는 최소 1개 있어야 해요");
    return;
  }
  const cat = getCat(id);
  const used = events.filter((ev) => ev.cat === id).length;
  const msg = used
    ? `'${cat.name}' 분류를 삭제할까요?\n이 분류의 일정 ${used}개는 '${categories.find((c) => c.id !== id).name}'(으)로 옮겨져요.`
    : `'${cat.name}' 분류를 삭제할까요?`;
  if (!confirm(msg)) return;

  categories = categories.filter((c) => c.id !== id);
  events = events.map((ev) => (ev.cat === id ? { ...ev, cat: categories[0].id } : ev));
  hiddenCats = hiddenCats.filter((h) => h !== id);
  save("categories", categories);
  save("events", events);
  save("hiddenCats", hiddenCats);
  renderCategories();
  renderCalendar();
}

catForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = catNameInput.value.trim();
  if (!name) return;
  categories.push({ id: "c" + Date.now(), name, color: catColorInput.value });
  save("categories", categories);
  catNameInput.value = "";
  renderCategories();
  toast(`'${name}' 분류를 추가했어요`);
});

/* ----- 일정 추가/수정 모달 ----- */
const modal = document.getElementById("event-modal");
const eventForm = document.getElementById("event-form");
const modalTitle = document.getElementById("modal-title");
const evTitle = document.getElementById("ev-title");
const evStart = document.getElementById("ev-start");
const evEnd = document.getElementById("ev-end");
const evTime = document.getElementById("ev-time");
const evMemo = document.getElementById("ev-memo");
const evCatPicker = document.getElementById("ev-cat-picker");
const evDelete = document.getElementById("ev-delete");

let editingId = null; // null이면 새 일정
let pickedCat = null;

function renderCatPicker() {
  evCatPicker.innerHTML = "";
  categories.forEach((cat) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cat-option" + (cat.id === pickedCat ? " selected" : "");
    btn.style.color = cat.id === pickedCat ? cat.color : "";
    btn.innerHTML = `<span class="dot" style="background:${cat.color}"></span>${escapeHTML(cat.name)}`;
    btn.addEventListener("click", () => {
      pickedCat = cat.id;
      renderCatPicker();
    });
    evCatPicker.appendChild(btn);
  });
}

function openEventModal(ev, key) {
  editingId = ev ? ev.id : null;
  modalTitle.textContent = ev ? "일정 수정" : "일정 추가";
  evTitle.value = ev ? ev.title : "";
  evStart.value = ev ? ev.start : key || dateKey();
  evEnd.value = ev ? ev.end || "" : "";
  evTime.value = ev ? ev.time || "" : "";
  evMemo.value = ev ? ev.memo || "" : "";
  pickedCat = ev ? ev.cat : categories[0].id;
  evDelete.style.visibility = ev ? "visible" : "hidden";

  renderCatPicker();
  modal.hidden = false;
  setTimeout(() => evTitle.focus(), 50);
}

function closeEventModal() {
  modal.hidden = true;
}

eventForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const title = evTitle.value.trim();
  const start = evStart.value;
  let end = evEnd.value;
  if (!title || !start) return;
  if (end && end < start) {
    toast("종료일이 시작일보다 빨라요");
    return;
  }
  if (end === start) end = "";

  const data = { title, start, end, time: evTime.value, cat: pickedCat, memo: evMemo.value.trim() };
  if (editingId) {
    events = events.map((ev) => (ev.id === editingId ? { ...ev, ...data } : ev));
    toast("일정을 수정했어요");
  } else {
    events.push({ id: Date.now(), ...data });
    toast("일정을 추가했어요 📅");
  }
  save("events", events);
  closeEventModal();
  selectDate(start);
});

evDelete.addEventListener("click", () => {
  if (!editingId || !confirm("이 일정을 삭제할까요?")) return;
  events = events.filter((ev) => ev.id !== editingId);
  save("events", events);
  closeEventModal();
  renderCalendar();
  toast("일정을 삭제했어요");
});

document.getElementById("ev-cancel").addEventListener("click", closeEventModal);
// 바깥 어두운 부분을 누르거나 ESC를 누르면 닫기
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeEventModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modal.hidden) closeEventModal();
});

/* =========================================================
   10. 처음 열었을 때
   ========================================================= */
renderTodos();
renderLogs();
renderTimer();
openDiary(dateKey());
renderCategories();
renderCalendar();
renderYtMini();

const lastVideo = load("lastVideo", "");
if (lastVideo) youtubeInput.value = lastVideo;

showPage(location.hash.slice(1) || "dashboard");