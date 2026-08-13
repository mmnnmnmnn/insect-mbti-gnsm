"use strict";

// =========================
// 0. 운영 설정
// =========================
const CONFIG = {
  EVENT_ID: "insect-mbti-2026-09",
  // Google Apps Script를 웹앱으로 배포한 뒤 /exec URL로 교체하세요.
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbzdLxE1yc1qpdsRUq0kimd5d5r-vVupYfrcs3b-_IWQ8g_sThg4IJzf_yeTL-A_TLp5Rw/exec",
  MAX_RETRY_COUNT: 1,
  RETRY_DELAY_MS: 1000,
  REQUEST_TIMEOUT_MS: 10000,
  COUNT_RETEST_AS_NEW: true
};

const PARTICIPATION_ID_KEY = `${CONFIG.EVENT_ID}_participationId`;
const SUBMISSION_STATUS_KEY = `${CONFIG.EVENT_ID}_resultSubmitted`;
let fallbackParticipationId = null;

// =========================
// 1. 확정 데이터
// =========================
const insects = {
  rhinocerosBeetle: { name: "장수풍뎅이", personality: "든든한 리더", keywords: ["리더십", "책임감", "든든함"], exhibitZone: "육상곤충존", image: "assets/results/1.webp", representativeAnswer: { questionId: 1, optionId: 1 } },
  stagBeetle: { name: "넓적사슴벌레", personality: "용감한 승부사", keywords: ["용기", "승부욕", "자신감"], exhibitZone: "육상곤충존", image: "assets/results/2.webp", representativeAnswer: { questionId: 2, optionId: 1 } },
  jewelBug: { name: "큰광대노린재", personality: "당당한 인기쟁이", keywords: ["개성", "당당함", "친화력"], exhibitZone: "육상곤충존", image: "assets/results/3.webp", representativeAnswer: { questionId: 3, optionId: 1 } },
  grasshopper: { name: "풀무치", personality: "씩씩한 행동대장", keywords: ["행동력", "씩씩함", "추진력"], exhibitZone: "육상곤충존", image: "assets/results/4.webp", representativeAnswer: { questionId: 6, optionId: 1 } },
  whiteSpottedFlowerChafer: { name: "흰점박이꽃무지", personality: "다정한 조력자", keywords: ["배려", "친절", "도움"], exhibitZone: "육상곤충존", image: "assets/results/5.webp", representativeAnswer: { questionId: 3, optionId: 3 } },
  riceGrasshopper: { name: "벼메뚜기", personality: "활기 넘치는 에너자이저", keywords: ["활력", "긍정", "적극성"], exhibitZone: "육상곤충존", image: "assets/results/6.webp", representativeAnswer: { questionId: 4, optionId: 1 } },
  divingBeetle: { name: "물방개", personality: "호기심 많은 탐험가", keywords: ["호기심", "모험심", "탐구력"], exhibitZone: "수서곤충존", image: "assets/results/7.webp", representativeAnswer: { questionId: 7, optionId: 1 } },
  waterBug: { name: "물자라", personality: "믿음직한 보호자", keywords: ["보호", "책임감", "신뢰"], exhibitZone: "수서곤충존", image: "assets/results/8.webp", representativeAnswer: { questionId: 5, optionId: 3 } },
  dragonflyNymph: { name: "왕잠자리수채", personality: "용의주도한 전략가", keywords: ["계획", "집중력", "판단력"], exhibitZone: "수서곤충존", image: "assets/results/9.webp", representativeAnswer: { questionId: 1, optionId: 3 } },
  waterScorpion: { name: "장구애비", personality: "침착한 사색가", keywords: ["침착함", "관찰력", "깊은 생각"], exhibitZone: "수서곤충존", image: "assets/results/10.webp", representativeAnswer: { questionId: 5, optionId: 2 } },
  bumblebee: { name: "서양뒤영벌", personality: "부지런한 협력가", keywords: ["협동", "성실함", "부지런함"], exhibitZone: "꿀벌존", image: "assets/results/11.webp", representativeAnswer: { questionId: 6, optionId: 2 } },
  cabbageButterfly: { name: "배추흰나비", personality: "낭만적인 여행가", keywords: ["자유", "낭만", "새로운 경험"], exhibitZone: "파브르정원", image: "assets/results/12.webp", representativeAnswer: { questionId: 7, optionId: 3 } },
  southernEmperorButterfly: { name: "남방오색나비", personality: "자유로운 예술가", keywords: ["창의력", "감수성", "개성"], exhibitZone: "파브르정원", image: "assets/results/13.webp", representativeAnswer: { questionId: 8, optionId: 2 } }
};

const questions = [
  { id: 1, image: "assets/questions/q1.webp", imageAlt: "모둠 활동에서 친구들이 무엇을 해야 할지 몰라 머뭇거리는 모습", question: "모둠 활동이 시작됐는데, 친구들이 무엇을 해야 할지 몰라 머뭇거리고 있다. 나의 행동은?", options: [
    { id: 1, text: "내가 먼저 나서서 역할을 정하고 활동을 시작한다.", scores: { rhinocerosBeetle: 2 } },
    { id: 2, text: "친구들과 이야기를 나누며 각자 잘하는 역할을 찾는다.", scores: { bumblebee: 2, grasshopper: 1, whiteSpottedFlowerChafer: 1 } },
    { id: 3, text: "먼저 해야 할 일을 차근차근 정리한 뒤 친구들에게 알려준다.", scores: { dragonflyNymph: 2, whiteSpottedFlowerChafer: 1, bumblebee: 1 } }
  ]},
  { id: 2, image: "assets/questions/q2.webp", imageAlt: "초등학교 운동회 반 대항 경기에 참여하는 모습", question: "운동회에서 반 대항 경기에 나가게 되었다. 나의 마음은?", options: [
    { id: 1, text: "이왕 나간다면 꼭 이길 수 있도록 최선을 다한다.", scores: { stagBeetle: 2, riceGrasshopper: 1, rhinocerosBeetle: 1 } },
    { id: 2, text: "승패와 상관없이 경기를 즐기고, 운동회의 신나는 분위기를 마음껏 누린다.", scores: { cabbageButterfly: 2, jewelBug: 1 } },
    { id: 3, text: "이길 가능성을 높이기 위해 경기 방법과 순서를 먼저 생각한다.", scores: { dragonflyNymph: 2, waterScorpion: 1 } }
  ]},
  { id: 3, image: "assets/questions/q3.webp", imageAlt: "학급 발표를 준비하며 여러 역할을 나누는 모습", question: "학급 발표를 준비할 때 내가 가장 하고 싶은 역할은?", options: [
    { id: 1, text: "친구들 앞에서 자신 있게 발표하며 분위기를 이끈다.", scores: { jewelBug: 2, rhinocerosBeetle: 1 } },
    { id: 2, text: "그림이나 소품을 활용해 독특하고 재미있는 발표를 만든다.", scores: { southernEmperorButterfly: 2, jewelBug: 1 } },
    { id: 3, text: "필요한 자료를 꼼꼼히 정리하고 친구들이 발표를 잘하도록 돕는다.", scores: { whiteSpottedFlowerChafer: 2, bumblebee: 1, waterBug: 1 } }
  ]},
  { id: 4, image: "assets/questions/q4.webp", imageAlt: "주말 자유 시간에 다양한 활동을 선택하는 모습", question: "주말에 자유 시간이 생겼다. 무엇을 할까?", options: [
    { id: 1, text: "운동하거나 신나게 몸을 움직이며 논다.", scores: { riceGrasshopper: 2, stagBeetle: 1 } },
    { id: 2, text: "가보지 않은 장소나 새로운 체험을 찾아 나선다.", scores: { divingBeetle: 2, cabbageButterfly: 1 } },
    { id: 3, text: "그림을 그리거나 만들기를 하며 나만의 작품을 만든다.", scores: { southernEmperorButterfly: 2 } }
  ]},
  { id: 5, image: "assets/questions/q5.webp", imageAlt: "집 근처 공원에서 외계인을 만난 모습", question: "집 근처 공원에서 외계인을 만났다! 어떻게 할까?", options: [
    { id: 1, text: "가까이 다가가 말을 걸어본다.", scores: { divingBeetle: 2, cabbageButterfly: 1 } },
    { id: 2, text: "위험할 수 있으니 거리를 두고 행동을 관찰한다.", scores: { waterScorpion: 2, dragonflyNymph: 1 } },
    { id: 3, text: "곧바로 어른이나 경찰에게 알려 모두가 안전하도록 한다.", scores: { waterBug: 2, rhinocerosBeetle: 1 } }
  ]},
  { id: 6, image: "assets/questions/q6.webp", imageAlt: "친구들과 숲속을 탐험하다 길을 잃은 모습", question: "친구들과 깊은 숲속을 탐험하다가 길을 잃었다! 어떻게 할까?", options: [
    { id: 1, text: "친구들이 당황하지 않도록 격려하고 용기를 북돋아 준다.", scores: { grasshopper: 2, rhinocerosBeetle: 1 } },
    { id: 2, text: "친구들과 역할을 나누고, 서로 도와가며 함께 길을 찾는다.", scores: { bumblebee: 2, whiteSpottedFlowerChafer: 1 } },
    { id: 3, text: "용감하게 앞장서 새로운 길을 개척한다.", scores: { stagBeetle: 2, riceGrasshopper: 1 } }
  ]},
  { id: 7, image: "assets/questions/q7.webp", imageAlt: "가족과 생태공원에서 여가를 보내는 모습", question: "주말에 가족들과 넓은 생태공원에 놀러 왔다. 무엇을 할까?", options: [
    { id: 1, text: "가보지 않은 길과 숨겨진 장소를 찾아 탐험한다.", scores: { divingBeetle: 2, stagBeetle: 1 } },
    { id: 2, text: "들판을 이리저리 누비며 신나게 뛰어논다.", scores: { riceGrasshopper: 2 } },
    { id: 3, text: "돗자리에 앉아 풍경을 감상하며 느긋하게 시간을 보낸다.", scores: { cabbageButterfly: 2, waterScorpion: 1 } }
  ]},
  { id: 8, image: "assets/questions/q8.webp", imageAlt: "숲속에서 신비한 씨앗을 발견한 모습", question: "숲속에서 무엇이든 한 가지를 키울 수 있는 신비한 씨앗을 발견했다!", options: [
    { id: 1, text: "사람과 동물이 모두 따 먹을 수 있는 열매가 열리는 나무를 키운다.", scores: { whiteSpottedFlowerChafer: 2 } },
    { id: 2, text: "세상에서 가장 아름다운 꽃으로 키운다.", scores: { southernEmperorButterfly: 2, jewelBug: 1 } },
    { id: 3, text: "친구들이 모두 모여 함께 놀 수 있는 커다란 나무 놀이터로 키운다.", scores: { grasshopper: 2, bumblebee: 1 } }
  ]},
  { id: 9, image: "assets/questions/q9.webp", imageAlt: "방송 크리에이터, 천재 과학자, 슈퍼히어로를 상상하는 모습", question: "다음 중 한 사람이 될 수 있다면?", options: [
    { id: 1, text: "인기있는 방송 크리에이터", scores: { jewelBug: 2 } },
    { id: 2, text: "세상의 비밀을 밝혀내는 천재 과학자", scores: { waterScorpion: 2, dragonflyNymph: 1 } },
    { id: 3, text: "위험한 순간에 나타나 사람들을 구하는 슈퍼히어로", scores: { waterBug: 2, rhinocerosBeetle: 1 } }
  ]}
];

const resultPriority = {
  waterBug: 1,
  grasshopper: 2,
  dragonflyNymph: 3,
  waterScorpion: 4,
  riceGrasshopper: 5,
  cabbageButterfly: 6,
  stagBeetle: 7,
  bumblebee: 8,
  whiteSpottedFlowerChafer: 9,
  rhinocerosBeetle: 10,
  jewelBug: 11,
  divingBeetle: 12,
  southernEmperorButterfly: 13
};

// =========================
// 2. 결과 계산 로직
// =========================
function calculateResult(answerIds) {
  if (!Array.isArray(answerIds) || answerIds.length !== questions.length) {
    throw new Error(`응답은 ${questions.length}개 문항의 선택지 번호 배열이어야 합니다.`);
  }

  const scores = Object.fromEntries(Object.keys(insects).map(id => [id, 0]));
  const plusTwoCounts = Object.fromEntries(Object.keys(insects).map(id => [id, 0]));

  questions.forEach((question, index) => {
    const answerId = Number(answerIds[index]);
    const option = question.options.find(item => item.id === answerId);
    if (!option) throw new Error(`Q${question.id}의 응답값 ${answerIds[index]}은 유효하지 않습니다. 1, 2, 3 중 하나를 입력하세요.`);

    Object.entries(option.scores).forEach(([insectId, point]) => {
      scores[insectId] += point;
      if (point === 2) plusTwoCounts[insectId] += 1;
    });
  });

  const highestScore = Math.max(...Object.values(scores));
  const initialTopCandidates = Object.keys(scores).filter(id => scores[id] === highestScore);

  const tieBreakSteps = [{ step: "총점", candidates: [...initialTopCandidates], highestScore }];
  let candidates = [...initialTopCandidates];

  if (candidates.length > 1) {
    const representativeMatches = candidates.filter(id => {
      const representative = insects[id].representativeAnswer;
      return Number(answerIds[representative.questionId - 1]) === representative.optionId;
    });
    if (representativeMatches.length > 0) candidates = representativeMatches;
    tieBreakSteps.push({ step: "대표 선택지", candidates: [...candidates], matchedCandidates: representativeMatches });
  }

  if (candidates.length > 1) {
    const highestPlusTwoCount = Math.max(...candidates.map(id => plusTwoCounts[id]));
    candidates = candidates.filter(id => plusTwoCounts[id] === highestPlusTwoCount);
    tieBreakSteps.push({ step: "+2점 획득 횟수", candidates: [...candidates], highestPlusTwoCount });
  }

  if (candidates.length > 1) {
    candidates.sort((a, b) => resultPriority[a] - resultPriority[b]);
    candidates = [candidates[0]];
    tieBreakSteps.push({ step: "확정 우선순위", candidates: [...candidates], priority: resultPriority[candidates[0]] });
  }

  return {
    resultId: candidates[0],
    scores,
    plusTwoCounts,
    initialTopCandidates,
    representativeCandidates: tieBreakSteps.find(item => item.step === "대표 선택지")?.candidates ?? [...initialTopCandidates],
    plusTwoCandidates: tieBreakSteps.find(item => item.step === "+2점 획득 횟수")?.candidates ?? candidates,
    priorityCandidates: tieBreakSteps.find(item => item.step === "확정 우선순위")?.candidates ?? candidates,
    tieBreakSteps
  };
}

function analyzeAllCombinations() {
  const counts = Object.fromEntries(Object.keys(insects).map(id => [id, 0]));
  const total = 3 ** questions.length;

  for (let number = 0; number < total; number += 1) {
    let value = number;
    const answers = [];
    for (let i = 0; i < questions.length; i += 1) {
      answers.push((value % 3) + 1);
      value = Math.floor(value / 3);
    }
    counts[calculateResult(answers).resultId] += 1;
  }

  const rows = Object.entries(counts)
    .map(([id, count]) => ({
      id,
      곤충명: insects[id].name,
      성향명: insects[id].personality,
      결과횟수: count,
      비율: `${((count / total) * 100).toFixed(2)}%`
    }))
    .sort((a, b) => b.결과횟수 - a.결과횟수);

  console.table(rows);
  console.log(`전체 조합: ${total.toLocaleString()}개 / 결과 합계: ${Object.values(counts).reduce((a, b) => a + b, 0).toLocaleString()}개`);
  return { total, counts, rows };
}

window.calculateResult = calculateResult;
window.analyzeAllCombinations = analyzeAllCombinations;
window.insects = insects;
window.questions = questions;

// =========================
// 3. 화면 로직
// =========================
const screens = {
  start: document.getElementById("start-screen"),
  question: document.getElementById("question-screen"),
  loading: document.getElementById("loading-screen"),
  result: document.getElementById("result-screen")
};

const elements = {
  startButton: document.getElementById("start-button"),
  homeButton: document.getElementById("home-button"),
  prevButton: document.getElementById("prev-button"),
  nextButton: document.getElementById("next-button"),
  restartButton: document.getElementById("restart-button"),
  shareButton: document.getElementById("share-button"),
  downloadButton: document.getElementById("download-button"),
  progressCurrent: document.getElementById("progress-current"),
  progressTotal: document.getElementById("progress-total"),
  progressFill: document.getElementById("progress-fill"),
  progressBug: document.getElementById("progress-bug"),
  questionNumber: document.getElementById("question-number"),
  questionText: document.getElementById("question-text"),
  questionVisual: document.getElementById("question-visual"),
  questionImage: document.getElementById("question-image"),
  optionsContainer: document.getElementById("options-container"),
  resultImage: document.getElementById("result-image"),
  keywordList: document.getElementById("keyword-list"),
  exhibitName: document.getElementById("exhibit-name"),
  exhibitParticle: document.getElementById("exhibit-particle"),
  exhibitZone: document.getElementById("exhibit-zone"),
  participantCountPanel: document.getElementById("participant-count-panel"),
  participantCountText: document.getElementById("participant-count-text"),
  toast: document.getElementById("toast"),
  debugPanel: document.getElementById("debug-panel"),
  debugOutput: document.getElementById("debug-output")
};

let currentQuestionIndex = 0;
let answers = Array(questions.length).fill(null);
let isCalculating = false;
let lastResult = null;
const debugMode = new URLSearchParams(window.location.search).get("debug") === "1";

elements.progressTotal.textContent = String(questions.length);

function showScreen(name) {
  Object.entries(screens).forEach(([key, screen]) => {
    const active = key === name;
    screen.hidden = !active;
    screen.classList.toggle("is-active", active);
  });
  window.scrollTo({ top: 0, behavior: "auto" });
}

function resetTest() {
  currentQuestionIndex = 0;
  answers = Array(questions.length).fill(null);
  isCalculating = false;
  lastResult = null;
  elements.toast.textContent = "";
  setParticipantCountState("hidden");
}

function startTest() {
  resetTest();
  // v4: 완료 1회 = 참여 1건. 이전 완료 기록이 있으면 새 참여 ID를 발급합니다.
  const existingStatus = getSubmissionStatus();
  if (existingStatus?.submitted) {
    resetForNewParticipant();
  } else {
    getOrCreateParticipationId();
  }
  renderQuestion();
  showScreen("question");
}

function preloadQuestionImage(index) {
  const question = questions[index];
  if (!question) return;
  const image = new Image();
  image.src = question.image;
}

function renderQuestion() {
  const question = questions[currentQuestionIndex];
  const selectedAnswer = answers[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  elements.progressCurrent.textContent = String(currentQuestionIndex + 1);
  elements.progressFill.style.width = `${progress}%`;
  elements.progressBug.style.left = `${progress}%`;
  elements.questionNumber.textContent = `QUESTION ${question.id}`;
  elements.questionText.textContent = question.question;
  elements.questionImage.src = question.image;
  elements.questionImage.alt = question.imageAlt;
  preloadQuestionImage(currentQuestionIndex + 1);
  elements.optionsContainer.innerHTML = "";

  question.options.forEach(option => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `option-card${selectedAnswer === option.id ? " is-selected" : ""}`;
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", selectedAnswer === option.id ? "true" : "false");
    button.innerHTML = `
      <span class="option-index">${option.id}</span>
      <span class="option-text">${option.text}</span>
      <span class="option-check" aria-hidden="true">✓</span>
    `;
    button.addEventListener("click", () => selectAnswer(option.id));
    elements.optionsContainer.appendChild(button);
  });

  elements.prevButton.disabled = currentQuestionIndex === 0;
  elements.nextButton.disabled = selectedAnswer === null;
  elements.nextButton.textContent = currentQuestionIndex === questions.length - 1 ? "결과 보기" : "다음";
}

function selectAnswer(optionId) {
  answers[currentQuestionIndex] = optionId;
  renderQuestion();
}

function goPrevious() {
  if (currentQuestionIndex === 0) return;
  currentQuestionIndex -= 1;
  renderQuestion();
}

function goNext() {
  if (answers[currentQuestionIndex] === null || isCalculating) return;
  if (currentQuestionIndex < questions.length - 1) {
    currentQuestionIndex += 1;
    renderQuestion();
    return;
  }
  showCalculatedResult();
}

function showCalculatedResult() {
  isCalculating = true;
  elements.nextButton.disabled = true;
  lastResult = calculateResult(answers);
  showScreen("loading");

  window.setTimeout(() => {
    renderResult(lastResult);
    showScreen("result");
    submitFinalResult(lastResult.resultId);
    isCalculating = false;
  }, 1350);
}

function hasFinalConsonant(word) {
  const lastCharacter = String(word).trim().slice(-1);
  if (!lastCharacter) return false;
  const code = lastCharacter.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

function getObjectParticle(word) {
  return hasFinalConsonant(word) ? "을" : "를";
}

function renderResult(result) {
  const insect = insects[result.resultId];
  elements.resultImage.src = insect.image;
  elements.resultImage.alt = `${insect.name}, ${insect.personality} 결과 카드`;
  elements.keywordList.innerHTML = insect.keywords.map(keyword => `<span class="keyword-chip">${keyword}</span>`).join("");
  elements.exhibitName.textContent = insect.name;
  elements.exhibitParticle.textContent = getObjectParticle(insect.name);
  elements.exhibitZone.textContent = insect.exhibitZone;

  if (debugMode) {
    elements.debugPanel.hidden = false;
    elements.debugOutput.textContent = JSON.stringify({
      응답: answers,
      곤충별총점: result.scores,
      곤충별Plus2획득횟수: result.plusTwoCounts,
      최초최고점후보: result.initialTopCandidates,
      대표선택지적용후후보: result.representativeCandidates,
      Plus2횟수적용후후보: result.plusTwoCandidates,
      우선순위적용후후보: result.priorityCandidates,
      최종선정결과: { id: result.resultId, name: insect.name, personality: insect.personality },
      동점처리과정: result.tieBreakSteps
    }, null, 2);
  } else {
    elements.debugPanel.hidden = true;
  }
}


// =========================
// 4. 참여 결과 저장 및 참여자 수 표시
// =========================
function isStorageConfigured() {
  return /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?.*)?$/.test(CONFIG.APPS_SCRIPT_URL);
}

function safeStorageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    console.warn("localStorage를 읽지 못했습니다.", error);
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn("localStorage에 저장하지 못했습니다.", error);
    return false;
  }
}

function safeStorageRemove(key) {
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    console.warn("localStorage 값을 삭제하지 못했습니다.", error);
  }
}

function createParticipationId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `participant-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function getOrCreateParticipationId() {
  const storedId = safeStorageGet(PARTICIPATION_ID_KEY);
  if (storedId) return storedId;

  const newId = createParticipationId();
  fallbackParticipationId = newId;
  safeStorageSet(PARTICIPATION_ID_KEY, newId);
  return newId;
}

function getSubmissionStatus() {
  const raw = safeStorageGet(SUBMISSION_STATUS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && parsed.eventId === CONFIG.EVENT_ID ? parsed : null;
  } catch {
    return null;
  }
}

function saveSubmissionStatus(payload) {
  safeStorageSet(SUBMISSION_STATUS_KEY, JSON.stringify({
    eventId: CONFIG.EVENT_ID,
    submitted: true,
    participantNumber: payload.participantNumber,
    totalParticipants: payload.totalParticipants,
    savedAt: new Date().toISOString()
  }));
}

function setParticipantCountState(state, totalParticipants = null) {
  if (!elements.participantCountPanel || !elements.participantCountText) return;

  if (state === "hidden") {
    elements.participantCountPanel.hidden = true;
    elements.participantCountPanel.classList.remove("is-loading", "is-error");
    elements.participantCountText.textContent = "";
    return;
  }

  elements.participantCountPanel.hidden = false;
  elements.participantCountPanel.classList.toggle("is-loading", state === "loading");
  elements.participantCountPanel.classList.toggle("is-error", state === "error");

  if (state === "loading") {
    elements.participantCountText.textContent = "참여 현황을 불러오는 중이에요.";
  } else if (state === "success" && Number.isFinite(Number(totalParticipants))) {
    const formatted = Number(totalParticipants).toLocaleString("ko-KR");
    elements.participantCountText.textContent = `지금까지 ${formatted}명이 나만의 곤충 부캐를 찾았어요.`;
  } else if (state === "error") {
    elements.participantCountText.textContent = "참여자 수를 불러오지 못했습니다.";
  }
}

function delay(milliseconds) {
  return new Promise(resolve => window.setTimeout(resolve, milliseconds));
}

async function requestJson(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, redirect: "follow" });
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("INVALID_JSON_RESPONSE");
    }
    if (!response.ok || data.success !== true) {
      throw new Error(data.error || `HTTP_${response.status}`);
    }
    return data;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function sendResultRequest(payload) {
  return requestJson(CONFIG.APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
}

async function sendWithRetry(payload) {
  let lastError;
  for (let attempt = 0; attempt <= CONFIG.MAX_RETRY_COUNT; attempt += 1) {
    try {
      return await sendResultRequest(payload);
    } catch (error) {
      lastError = error;
      if (attempt < CONFIG.MAX_RETRY_COUNT) await delay(CONFIG.RETRY_DELAY_MS);
    }
  }
  throw lastError;
}

async function loadParticipantCount() {
  if (!isStorageConfigured()) {
    setParticipantCountState("hidden");
    return;
  }

  const url = new URL(CONFIG.APPS_SCRIPT_URL);
  url.searchParams.set("action", "count");
  url.searchParams.set("eventId", CONFIG.EVENT_ID);

  try {
    const data = await requestJson(url.toString(), { method: "GET" });
    setParticipantCountState("success", data.totalParticipants);
    const currentStatus = getSubmissionStatus();
    if (currentStatus) saveSubmissionStatus({ ...currentStatus, totalParticipants: data.totalParticipants });
  } catch (error) {
    console.error("참여자 수 조회 실패", error);
    setParticipantCountState("error");
  }
}

async function submitFinalResult(resultId) {
  if (!isStorageConfigured()) {
    console.warn("CONFIG.APPS_SCRIPT_URL에 운영용 /exec URL을 입력해야 결과가 저장됩니다.");
    setParticipantCountState("hidden");
    return;
  }

  const existingStatus = getSubmissionStatus();
  if (existingStatus?.submitted && !CONFIG.COUNT_RETEST_AS_NEW) {
    if (Number.isFinite(Number(existingStatus.totalParticipants))) {
      setParticipantCountState("success", existingStatus.totalParticipants);
    } else {
      setParticipantCountState("loading");
    }
    await loadParticipantCount();
    return;
  }

  setParticipantCountState("loading");
  const payload = {
    eventId: CONFIG.EVENT_ID,
    participationId: getOrCreateParticipationId() || fallbackParticipationId,
    resultId
  };

  try {
    const data = await sendWithRetry(payload);
    saveSubmissionStatus(data);
    setParticipantCountState("success", data.totalParticipants);
  } catch (error) {
    console.error("최종 결과 저장 실패", error);
    setParticipantCountState("error");
  }
}

// 향후 ‘다른 참여자가 테스트하기’ 버튼을 추가할 때 사용할 초기화 함수입니다.
function resetForNewParticipant() {
  safeStorageRemove(PARTICIPATION_ID_KEY);
  safeStorageRemove(SUBMISSION_STATUS_KEY);
  fallbackParticipationId = null;
  return getOrCreateParticipationId();
}

window.createParticipationId = createParticipationId;
window.getOrCreateParticipationId = getOrCreateParticipationId;
window.resetForNewParticipant = resetForNewParticipant;

function cleanShareUrl() {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  return url.toString();
}

async function shareResult() {
  if (!lastResult) return;
  const insect = insects[lastResult.resultId];
  const text = `나의 곤충 부캐는 ‘${insect.personality} ${insect.name}’예요!\n당신의 곤충 부캐도 찾아보세요.`;
  const url = cleanShareUrl();

  try {
    if (navigator.share) {
      await navigator.share({ title: "INSECT MBTI", text, url });
      elements.toast.textContent = "공유 화면을 열었습니다.";
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      elements.toast.textContent = "결과 문구와 주소를 복사했습니다.";
    } else {
      fallbackCopy(`${text}\n${url}`);
      elements.toast.textContent = "결과 문구와 주소를 복사했습니다.";
    }
  } catch (error) {
    if (error?.name !== "AbortError") elements.toast.textContent = "공유하지 못했습니다. 결과 이미지 저장하기를 이용해주세요.";
  }
}

async function downloadResultImage() {
  if (!lastResult) return;
  const insect = insects[lastResult.resultId];
  const filename = `INSECT-MBTI_${insect.name}.webp`;

  try {
    const response = await fetch(insect.image, { cache: "no-store" });
    if (!response.ok) throw new Error(`이미지 요청 실패: ${response.status}`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    elements.toast.textContent = "결과 이미지 저장을 시작했습니다.";
  } catch (error) {
    console.error("결과 이미지 저장 실패", error);
    // 일부 모바일 브라우저에서는 download 동작이 제한될 수 있어 원본 이미지를 새 탭으로 엽니다.
    window.open(insect.image, "_blank", "noopener,noreferrer");
    elements.toast.textContent = "이미지를 새 화면에서 열었습니다. 길게 눌러 저장해주세요.";
  }
}

function fallbackCopy(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

elements.startButton.addEventListener("click", startTest);
elements.homeButton.addEventListener("click", () => { resetTest(); showScreen("start"); });
elements.prevButton.addEventListener("click", goPrevious);
elements.nextButton.addEventListener("click", goNext);
elements.restartButton.addEventListener("click", startTest);
elements.shareButton.addEventListener("click", shareResult);
elements.downloadButton.addEventListener("click", downloadResultImage);

// 새로고침 또는 재접속 시 항상 시작 화면으로 초기화합니다.
resetTest();
showScreen("start");
