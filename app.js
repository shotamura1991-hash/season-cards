/* ===========================================================
   きせつカード  アプリ本体（ゲームのうごき）
   ながれ：
     1. えを みて「なまえ」を 4たくから えらぶ
     2. せいかいしたら「きせつ（はる/なつ/あき/ふゆ）」を えらぶ
     3. せいかいしたら つぎの カードへ
   ※ まちがえても、せいかいするまで チャレンジできます
   =========================================================== */

// ---- 画面・部品をまとめて取得 ----
const screens = {
  start: document.getElementById("start-screen"),
  quiz: document.getElementById("quiz-screen"),
  result: document.getElementById("result-screen"),
};
const el = {
  cardArt: document.getElementById("card-art"),
  cardName: document.getElementById("card-name"),
  question: document.getElementById("question"),
  choices: document.getElementById("choices"),
  feedback: document.getElementById("feedback"),
  progressFill: document.getElementById("progress-fill"),
  progressText: document.getElementById("progress-text"),
  soundBtn: document.getElementById("sound-btn"),
  resultDetail: document.getElementById("result-detail"),
  resultStars: document.getElementById("result-stars"),
};

// きせつの ならび順（クイズの きせつボタンは いつも この順）
const SEASON_ORDER = ["haru", "natsu", "aki", "fuyu"];

// ---- ゲームの じょうたい ----
let state = {
  deck: [],          // 出題するカードの ならび（シャッフル後）
  pos: 0,            // いま なんまいめか
  stage: 1,          // 1=なまえ, 2=きせつ
  cleanThisCard: true, // このカードを ノーミスで こたえたか
  perfect: 0,        // ノーミス枚数
  filter: "all",
  count: 20,         // 出題する まい数（"all"=ぜんぶ）
  locked: false,     // 演出中の クリックぼうし
};

let soundOn = true;
try { soundOn = localStorage.getItem("kisetsu-sound") !== "off"; } catch (e) { /* file:// などで使えない場合 */ }
updateSoundBtn();

// =================== 画面きりかえ ===================
function show(screenName) {
  Object.values(screens).forEach((s) => s.classList.add("hidden"));
  screens[screenName].classList.remove("hidden");
}

// =================== スタート画面 ===================
document.querySelectorAll(".filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    state.filter = btn.dataset.filter;
  });
});

document.querySelectorAll(".count-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".count-btn").forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    state.count = btn.dataset.count === "all" ? "all" : Number(btn.dataset.count);
  });
});

document.getElementById("start-btn").addEventListener("click", startGame);
document.getElementById("home-btn").addEventListener("click", () => show("start"));
document.getElementById("again-btn").addEventListener("click", startGame);
document.getElementById("back-btn").addEventListener("click", () => show("start"));
el.soundBtn.addEventListener("click", toggleSound);

// =================== ゲーム開始 ===================
function startGame() {
  let pool = CARDS;
  if (state.filter !== "all") {
    pool = CARDS.filter((c) => c.season === state.filter);
  }
  const shuffled = shuffle(pool.slice());
  const n = state.count === "all" ? shuffled.length : Math.min(state.count, shuffled.length);
  state.deck = shuffled.slice(0, n);
  state.pos = 0;
  state.perfect = 0;
  show("quiz");
  renderCard();
}

// =================== カードを ひょうじ ===================
function renderCard() {
  const card = state.deck[state.pos];
  state.stage = 1;
  state.cleanThisCard = true;
  state.locked = false;

  // え と なまえ（art が なければ emoji を つかう）
  el.cardArt.innerHTML = card.art
    ? card.art
    : '<div class="art-emoji">' + (card.emoji || "❓") + "</div>";
  el.cardName.textContent = card.name;
  el.cardName.classList.remove("show");

  // しんちょく
  const ratio = ((state.pos) / state.deck.length) * 100;
  el.progressFill.style.width = ratio + "%";
  el.progressText.textContent = (state.pos + 1) + " / " + state.deck.length;

  el.feedback.textContent = "";
  el.feedback.className = "feedback";

  askName(card);
}

// ---- ステージ1：なまえを えらぶ ----
function askName(card) {
  el.question.textContent = "これは なに？";

  // せいかい1つ ＋ ほかのカードから 3つ
  const others = shuffle(CARDS.filter((c) => c.name !== card.name))
    .slice(0, 3)
    .map((c) => c.name);
  const options = shuffle([card.name, ...others]);

  el.choices.innerHTML = "";
  options.forEach((name) => {
    const btn = document.createElement("button");
    btn.className = "choice-btn";
    btn.type = "button";
    btn.textContent = name;
    btn.addEventListener("click", () => {
      if (state.locked) return;
      if (name === card.name) {
        markCorrect(btn);
        el.cardName.classList.add("show"); // なまえを見せる
        playCorrect();
        feedback(true, "せいかい！");
        state.locked = true;
        setTimeout(() => askSeason(card), 850);
      } else {
        handleWrong(btn);
      }
    });
    el.choices.appendChild(btn);
  });
}

// ---- ステージ2：きせつを えらぶ ----
function askSeason(card) {
  state.stage = 2;
  state.locked = false;
  el.question.textContent = "いつの きせつ？";
  el.feedback.textContent = "";
  el.feedback.className = "feedback";

  el.choices.innerHTML = "";
  SEASON_ORDER.forEach((key) => {
    const s = SEASONS[key];
    const btn = document.createElement("button");
    btn.className = "choice-btn season-" + key;
    btn.type = "button";
    btn.innerHTML = s.label + '<span class="kanji">' + s.kanji + "</span>";
    btn.addEventListener("click", () => {
      if (state.locked) return;
      if (key === card.season) {
        markCorrect(btn);
        playCorrect();
        if (state.cleanThisCard) state.perfect++;
        feedback(true, pickPraise());
        state.locked = true;
        setTimeout(nextCard, 950);
      } else {
        handleWrong(btn);
      }
    });
    el.choices.appendChild(btn);
  });
}

// ---- まちがえたとき（せいかいするまで チャレンジ）----
function handleWrong(btn) {
  state.cleanThisCard = false;
  playWrong();
  feedback(false, "ちがうよ、もういちど！");
  btn.classList.add("wrong");
  btn.disabled = true;                 // まちがえた えらびしは けす
  setTimeout(() => btn.classList.remove("wrong"), 400);
}

function markCorrect(btn) {
  btn.classList.add("correct");
}

// =================== つぎのカード / けっか ===================
function nextCard() {
  state.pos++;
  if (state.pos >= state.deck.length) {
    showResult();
  } else {
    renderCard();
  }
}

function showResult() {
  el.progressFill.style.width = "100%";
  show("result");
  const n = state.deck.length;
  el.resultDetail.textContent =
    "ノーミス：" + state.perfect + " / " + n + " まい";
  // ノーミスの わりあいで ★を 1〜3こ
  const rate = state.perfect / n;
  const stars = rate >= 0.9 ? 3 : rate >= 0.6 ? 2 : 1;
  el.resultStars.textContent = "⭐".repeat(stars) + "☆".repeat(3 - stars);
  playFanfare();
}

// =================== ひょうげん（文字）===================
function feedback(good, text) {
  el.feedback.className = "feedback " + (good ? "good" : "bad");
  el.feedback.innerHTML =
    '<span class="mark">' + (good ? "〇" : "✕") + "</span>" + text;
}

const PRAISE = ["せいかい！", "やったね！", "すごい！", "じょうずだね！", "ピンポン！"];
function pickPraise() {
  return PRAISE[Math.floor(Math.random() * PRAISE.length)];
}

// =================== おと（WebAudio：ファイル不要）===================
let audioCtx = null;
function ac() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  return audioCtx;
}
function beep(freq, start, dur, type = "sine", vol = 0.18) {
  const ctx = ac();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, ctx.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + dur);
}
function playCorrect() { if (!soundOn) return; beep(660, 0, 0.12); beep(880, 0.1, 0.16); }
function playWrong()   { if (!soundOn) return; beep(200, 0, 0.22, "square", 0.12); }
function playFanfare() {
  if (!soundOn) return;
  [523, 659, 784, 1047].forEach((f, i) => beep(f, i * 0.12, 0.2));
}

function toggleSound() {
  soundOn = !soundOn;
  try { localStorage.setItem("kisetsu-sound", soundOn ? "on" : "off"); } catch (e) {}
  updateSoundBtn();
  if (soundOn) playCorrect();
}
function updateSoundBtn() {
  el.soundBtn.textContent = soundOn ? "🔊" : "🔇";
}

// =================== どうぐ ===================
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// さいしょは スタート画面
show("start");
