const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const fontFamilyInput = document.getElementById("fontFamilyInput");
const fontWeightInput = document.getElementById("fontWeightInput");
const strokeColorInput = document.getElementById("strokeColorInput");
const strokeWidthInput = document.getElementById("strokeWidthInput");
const strokeWidthValue = document.getElementById("strokeWidthValue");

const imageInput = document.getElementById("imageInput");
const textInput = document.getElementById("textInput");
const subtextInput = document.getElementById("subtextInput");

const fontSizeInput = document.getElementById("fontSizeInput");
const fontSizeValue = document.getElementById("fontSizeValue");
const colorInput = document.getElementById("colorInput");
const xInput = document.getElementById("xInput");
const yInput = document.getElementById("yInput");

const statusElement = document.getElementById("status");
const templateName = document.getElementById("templateName");
const templateSelect = document.getElementById("templateSelect");
const jsonInput = document.getElementById("jsonInput");

const RATIOS = {
  "1:1": [1080, 1080],
  "4:5": [1080, 1350],
  "9:16": [1080, 1920]
};

const STORAGE_KEY = "sns-card-templates-v1";

const DEFAULT_TEXTS = [
  {
    id: 1,
    content: "메인 제목",
    x: 50,
    y: 30,
    fontSize: 90,
    color: "#ffffff",
    fontFamily: "'Noto Sans KR', sans-serif",
    fontWeight: "700",
    strokeColor: "#000000",
    strokeWidth: 4
  },
  {
    id: 2,
    content: "보조 문구",
    x: 50,
    y: 18,
    fontSize: 42,
    color: "#fff4dc",
    fontFamily: "'Nanum Brush Script', cursive",
    fontWeight: "400",
    strokeColor: "#000000",
    strokeWidth: 0
  }
];

let state = {
  image: null,
  ratio: "4:5",
  texts: DEFAULT_TEXTS.map(text => ({ ...text }))
};

let selectedTemplateId = null;
let selectedTextId = 1;

// =============================
// 헬퍼
// =============================

function getTextById(id) {
  return state.texts.find(text => text.id === id);
}

function getMainText() {
  return getTextById(1);
}

function getSubText() {
  return getTextById(2);
}

function getSelectedText() {
  return getTextById(selectedTextId) || getMainText();
}

function cloneTexts(texts) {
  return texts.map(text => ({ ...text }));
}

// 이전 단일 텍스트 구조로 저장된 로컬 템플릿도 불러올 수 있게 변환한다.
function normalizeConfig(config) {
  if (!config || typeof config !== "object") {
    throw new Error("템플릿 설정값이 없습니다.");
  }

  if (Array.isArray(config.texts)) {
    return {
      ratio: RATIOS[config.ratio] ? config.ratio : "4:5",
      texts: cloneTexts(config.texts)
    };
  }

  // 구버전(flat) 템플릿 마이그레이션
  if (typeof config.text === "string") {
    const main = {
      ...DEFAULT_TEXTS[0],
      content: config.text,
      x: typeof config.x === "number" ? config.x : DEFAULT_TEXTS[0].x,
      y: typeof config.y === "number" ? config.y : DEFAULT_TEXTS[0].y,
      fontSize:
        typeof config.fontSize === "number"
          ? config.fontSize
          : DEFAULT_TEXTS[0].fontSize,
      color:
        typeof config.color === "string"
          ? config.color
          : DEFAULT_TEXTS[0].color,
      fontFamily:
        typeof config.fontFamily === "string"
          ? config.fontFamily
          : DEFAULT_TEXTS[0].fontFamily,
      fontWeight:
        typeof config.fontWeight === "string"
          ? config.fontWeight
          : DEFAULT_TEXTS[0].fontWeight,
      strokeColor:
        typeof config.strokeColor === "string"
          ? config.strokeColor
          : DEFAULT_TEXTS[0].strokeColor,
      strokeWidth:
        typeof config.strokeWidth === "number"
          ? config.strokeWidth
          : DEFAULT_TEXTS[0].strokeWidth
    };

    return {
      ratio: RATIOS[config.ratio] ? config.ratio : "4:5",
      texts: [main, { ...DEFAULT_TEXTS[1] }]
    };
  }

  throw new Error("지원하지 않는 템플릿 형식입니다.");
}

// =============================
// 상태 메시지
// =============================

function setStatus(message, error = false) {
  statusElement.textContent = message;
  statusElement.classList.toggle("error", error);
}

// =============================
// Canvas 그리기
// =============================

function drawCanvas() {
  const [width, height] = RATIOS[state.ratio];

  canvas.width = width;
  canvas.height = height;

  ctx.clearRect(0, 0, width, height);

  // 이미지가 없을 때
  if (!state.image) {
    ctx.fillStyle = "#cccccc";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#555555";
    ctx.font = "40px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillText(
      "이미지를 불러오세요",
      width / 2,
      height / 2
    );

    return;
  }

  // 이미지 Cover 방식 크롭
  const img = state.image;

  const scale = Math.max(
    width / img.width,
    height / img.height
  );

  const drawWidth = img.width * scale;
  const drawHeight = img.height * scale;
  const offsetX = (width - drawWidth) / 2;
  const offsetY = (height - drawHeight) / 2;

  ctx.drawImage(
    img,
    offsetX,
    offsetY,
    drawWidth,
    drawHeight
  );

  // 텍스트 레이어
  state.texts.forEach(textLayer => {
    const textX = width * (textLayer.x / 100);
    const textY = height * (textLayer.y / 100);

    ctx.save();

    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    ctx.fillStyle = textLayer.color;
    ctx.strokeStyle = textLayer.strokeColor;
    ctx.lineWidth = textLayer.strokeWidth;
    ctx.lineJoin = "round";

    ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
    ctx.shadowBlur = 12;

    ctx.font = `${textLayer.fontWeight} ${textLayer.fontSize}px ${textLayer.fontFamily}`;

    const lines = textLayer.content.split("\n");
    const lineHeight = textLayer.fontSize * 1.15;

    lines.forEach((line, index) => {
      const y = textY + lineHeight * index;

      if (textLayer.strokeWidth > 0) {
        ctx.strokeText(line, textX, y);
      }

      ctx.fillText(line, textX, y);
    });

    ctx.restore();
  });
}

// =============================
// 이미지 업로드
// =============================

imageInput.addEventListener("change", event => {
  const file = event.target.files[0];
  if (!file) return;

  const validTypes = [
    "image/png",
    "image/jpeg"
  ];

  // 지원하지 않는 파일은 기존 작업을 유지한 채 거부
  if (!validTypes.includes(file.type)) {
    setStatus(
      "지원하지 않는 파일입니다. PNG 또는 JPEG만 사용할 수 있습니다.",
      true
    );

    imageInput.value = "";
    return;
  }

  const url = URL.createObjectURL(file);
  const image = new Image();

  image.onload = () => {
    state.image = image;
    drawCanvas();

    setStatus(`이미지 불러오기 완료: ${file.name}`);
    URL.revokeObjectURL(url);
  };

  image.onerror = () => {
    setStatus("이미지를 읽을 수 없습니다.", true);
    URL.revokeObjectURL(url);
  };

  image.src = url;
});

// =============================
// 편집할 텍스트 레이어 선택
// 메인/보조 입력창을 클릭하면 해당 레이어가 스타일 편집 대상이 된다.
// =============================

function selectTextLayer(id) {
  selectedTextId = id;
  syncTextStyleControls();
}

textInput.addEventListener("focus", () => {
  selectTextLayer(1);
});

subtextInput.addEventListener("focus", () => {
  selectTextLayer(2);
});

// =============================
// 문구 편집
// =============================

textInput.addEventListener("input", () => {
  const mainText = getMainText();
  if (!mainText) return;

  selectedTextId = 1;
  mainText.content = textInput.value;
  drawCanvas();
});

subtextInput.addEventListener("input", () => {
  const subText = getSubText();
  if (!subText) return;

  selectedTextId = 2;
  subText.content = subtextInput.value;
  drawCanvas();
});

// =============================
// 스타일/위치 편집
// 현재 선택된 메인 또는 보조 문구에 적용
// =============================

fontSizeInput.addEventListener("input", () => {
  const target = getSelectedText();
  if (!target) return;

  target.fontSize = Number(fontSizeInput.value);
  fontSizeValue.textContent = target.fontSize;
  drawCanvas();
});

fontFamilyInput.addEventListener("input", () => {
  const target = getSelectedText();
  if (!target) return;

  target.fontFamily = fontFamilyInput.value;
  drawCanvas();
});

fontWeightInput.addEventListener("input", () => {
  const target = getSelectedText();
  if (!target) return;

  target.fontWeight = fontWeightInput.value;
  drawCanvas();
});

strokeColorInput.addEventListener("input", () => {
  const target = getSelectedText();
  if (!target) return;

  target.strokeColor = strokeColorInput.value;
  drawCanvas();
});

strokeWidthInput.addEventListener("input", () => {
  const target = getSelectedText();
  if (!target) return;

  target.strokeWidth = Number(strokeWidthInput.value);
  strokeWidthValue.textContent = target.strokeWidth;
  drawCanvas();
});

colorInput.addEventListener("input", () => {
  const target = getSelectedText();
  if (!target) return;

  target.color = colorInput.value;
  drawCanvas();
});

xInput.addEventListener("input", () => {
  const target = getSelectedText();
  if (!target) return;

  target.x = Number(xInput.value);
  drawCanvas();
});

yInput.addEventListener("input", () => {
  const target = getSelectedText();
  if (!target) return;

  target.y = Number(yInput.value);
  drawCanvas();
});

// =============================
// 화면 비율
// =============================

document
  .querySelectorAll("[data-ratio]")
  .forEach(button => {
    button.addEventListener("click", () => {
      state.ratio = button.dataset.ratio;

      document
        .querySelectorAll("[data-ratio]")
        .forEach(btn => btn.classList.remove("active"));

      button.classList.add("active");
      drawCanvas();
    });
  });

// =============================
// 이미지 다운로드
// =============================

document
  .getElementById("downloadBtn")
  .addEventListener("click", () => {
    if (!state.image) {
      setStatus("먼저 이미지를 불러오세요.", true);
      return;
    }

    canvas.toBlob(
      blob => {
        if (!blob) {
          setStatus("이미지 파일 생성에 실패했습니다.", true);
          return;
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");

        a.href = url;
        a.download = `sns_card_${state.ratio.replace(":", "x")}.png`;
        a.click();

        URL.revokeObjectURL(url);
      },
      "image/png"
    );
  });

// =============================
// 템플릿
// =============================

function getTemplates() {
  try {
    return JSON.parse(
      localStorage.getItem(STORAGE_KEY)
    ) || [];
  } catch {
    return [];
  }
}

function saveTemplates(templates) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(templates)
  );
}

function getCurrentConfig() {
  return {
    ratio: state.ratio,
    texts: cloneTexts(state.texts)
  };
}

function refreshTemplateList() {
  const templates = getTemplates();

  templateSelect.innerHTML = `
    <option value="">저장된 템플릿 선택</option>
  `;

  templates.forEach(template => {
    const option = document.createElement("option");
    option.value = template.id;
    option.textContent = template.name;
    templateSelect.appendChild(option);
  });
}

// 템플릿 저장
document
  .getElementById("saveTemplateBtn")
  .addEventListener("click", () => {
    const name = templateName.value.trim();

    if (!name) {
      setStatus("템플릿 이름을 입력하세요.", true);
      return;
    }

    const templates = getTemplates();

    const template = {
      id: crypto.randomUUID(),
      name,
      config: getCurrentConfig()
    };

    templates.push(template);
    saveTemplates(templates);
    refreshTemplateList();

    selectedTemplateId = template.id;
    templateSelect.value = template.id;

    setStatus("템플릿을 저장했습니다.");
  });

// 템플릿 불러오기
document
  .getElementById("loadTemplateBtn")
  .addEventListener("click", () => {
    const id = templateSelect.value;
    const templates = getTemplates();

    const template = templates.find(item => item.id === id);

    if (!template) {
      setStatus("불러올 템플릿을 선택하세요.", true);
      return;
    }

    try {
      const config = normalizeConfig(template.config);

      selectedTemplateId = template.id;
      state.ratio = config.ratio;
      state.texts = cloneTexts(config.texts);

      // 불러온 뒤 메인 문구를 기본 편집 대상으로 둔다.
      selectedTextId = 1;

      syncControls();
      drawCanvas();

      templateName.value = template.name;
      setStatus("템플릿을 불러왔습니다.");
    } catch (error) {
      setStatus(`템플릿 불러오기 실패: ${error.message}`, true);
    }
  });

// 템플릿 수정
document
  .getElementById("updateTemplateBtn")
  .addEventListener("click", () => {
    const id = templateSelect.value;

    if (!id) {
      setStatus("수정할 템플릿을 선택하세요.", true);
      return;
    }

    const templates = getTemplates();
    const index = templates.findIndex(item => item.id === id);

    if (index === -1) {
      setStatus("수정할 템플릿을 찾을 수 없습니다.", true);
      return;
    }

    templates[index] = {
      ...templates[index],
      name:
        templateName.value.trim() ||
        templates[index].name,
      config: getCurrentConfig()
    };

    saveTemplates(templates);
    refreshTemplateList();
    templateSelect.value = id;

    setStatus("템플릿을 수정했습니다.");
  });

// 템플릿 삭제
document
  .getElementById("deleteTemplateBtn")
  .addEventListener("click", () => {
    const id = templateSelect.value;

    if (!id) {
      setStatus("삭제할 템플릿을 선택하세요.", true);
      return;
    }

    const templates = getTemplates().filter(
      item => item.id !== id
    );

    saveTemplates(templates);
    refreshTemplateList();

    selectedTemplateId = null;
    setStatus("템플릿을 삭제했습니다.");
  });

// =============================
// JSON 내보내기
// =============================

document
  .getElementById("exportJsonBtn")
  .addEventListener("click", () => {
    const data = {
      version: 1,
      templates: getTemplates()
    };

    const blob = new Blob(
      [JSON.stringify(data, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = "sns-templates.json";
    a.click();

    URL.revokeObjectURL(url);
  });

// =============================
// JSON 가져오기
// =============================

document
  .getElementById("importJsonBtn")
  .addEventListener("click", () => {
    jsonInput.click();
  });

jsonInput.addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    // 저장 전에 전체 구조를 검증한다.
    validateJson(data);

    // 검증 성공 후에만 기존 데이터를 교체한다.
    saveTemplates(data.templates);
    refreshTemplateList();

    setStatus("JSON 템플릿 복원 완료");
  } catch (error) {
    // 실패 시 기존 localStorage는 건드리지 않는다.
    setStatus(
      `JSON 가져오기 실패: ${error.message}`,
      true
    );
  }

  jsonInput.value = "";
});

function validateJson(data) {
  if (
    !data ||
    data.version !== 1 ||
    !Array.isArray(data.templates)
  ) {
    throw new Error("올바른 템플릿 파일이 아닙니다.");
  }

  data.templates.forEach(template => {
    if (
      typeof template.id !== "string" ||
      typeof template.name !== "string" ||
      !template.config
    ) {
      throw new Error("필수 템플릿 정보가 없습니다.");
    }

    const c = template.config;

    if (
      !RATIOS[c.ratio] ||
      !Array.isArray(c.texts) ||
      c.texts.length < 2
    ) {
      throw new Error("템플릿 설정값이 올바르지 않습니다.");
    }

    const ids = new Set();

    c.texts.forEach(textLayer => {
      if (
        !Number.isInteger(textLayer.id) ||
        ids.has(textLayer.id) ||
        typeof textLayer.content !== "string" ||
        typeof textLayer.x !== "number" ||
        typeof textLayer.y !== "number" ||
        typeof textLayer.fontSize !== "number" ||
        typeof textLayer.color !== "string" ||
        typeof textLayer.fontFamily !== "string" ||
        typeof textLayer.fontWeight !== "string" ||
        typeof textLayer.strokeColor !== "string" ||
        typeof textLayer.strokeWidth !== "number"
      ) {
        throw new Error("텍스트 레이어 설정값이 올바르지 않습니다.");
      }

      ids.add(textLayer.id);
    });

    if (!ids.has(1) || !ids.has(2)) {
      throw new Error("메인 또는 보조 문구 정보가 없습니다.");
    }
  });
}

// =============================
// UI 동기화
// =============================

function syncTextStyleControls() {
  const target = getSelectedText();
  if (!target) return;

  fontSizeInput.value = target.fontSize;
  fontSizeValue.textContent = target.fontSize;

  fontFamilyInput.value = target.fontFamily;
  fontWeightInput.value = target.fontWeight;

  strokeColorInput.value = target.strokeColor;
  strokeWidthInput.value = target.strokeWidth;
  strokeWidthValue.textContent = target.strokeWidth;

  colorInput.value = target.color;
  xInput.value = target.x;
  yInput.value = target.y;
}

function syncControls() {
  const mainText = getMainText();
  const subText = getSubText();

  if (!mainText || !subText) return;

  textInput.value = mainText.content;
  subtextInput.value = subText.content;

  syncTextStyleControls();

  document
    .querySelectorAll("[data-ratio]")
    .forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.ratio === state.ratio
      );
    });
}

// =============================
// 시작
// =============================

refreshTemplateList();
syncControls();
drawCanvas();

// 웹 폰트가 늦게 로드되는 경우 Canvas를 한 번 더 그린다.
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => {
    drawCanvas();
  });
}
