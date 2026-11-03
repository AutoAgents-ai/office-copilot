/* ==========================================================================
   Office Copilot — interactive prototype
   No dependencies. All AI / search / export behaviour is scripted for demo.
   ========================================================================== */
'use strict';

/* --------------------------------------------------------------------------
   Utilities
   -------------------------------------------------------------------------- */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#${name}"/></svg>`;
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const clone = (value) => JSON.parse(JSON.stringify(value));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

let seq = 0;
const uid = (prefix = 'id') => `${prefix}-${Date.now().toString(36)}-${(seq += 1)}`;

function setPath(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = /^\d+$/.test(parts[i]) ? Number(parts[i]) : parts[i];
    cur = cur[key];
    if (!cur) return;
  }
  const last = parts[parts.length - 1];
  cur[/^\d+$/.test(last) ? Number(last) : last] = value;
}

function formatText(text) {
  const escaped = esc(text);
  const withBold = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const blocks = withBold.split(/\n{2,}/).map((block) => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    if (/^[-•]\s/m.test(trimmed)) {
      const items = trimmed.split('\n').map((line) => line.replace(/^[-•]\s*/, '')).filter(Boolean);
      return `<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>`;
    }
    return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
  }).join('');
  return blocks.replace(/\[(\d+)\]/g, '<span class="citation" title="引用来源 $1">$1</span>');
}

function toast(message, kind = 'ok') {
  const root = $('#toast-root');
  const el = document.createElement('div');
  el.className = `toast ${kind === 'warn' ? 'warn' : ''}`;
  el.innerHTML = `${icon(kind === 'warn' ? 'i-info' : 'i-check')}<span>${esc(message)}</span>`;
  root.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 220);
  }, 2400);
}

function copyText(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
}

/* --------------------------------------------------------------------------
   Data
   -------------------------------------------------------------------------- */

const TYPES = {
  word: { label: '文字文档', short: '文字', icon: 'i-word', ext: 'docx', extLabel: 'Word 文档', color: 'var(--word)' },
  ppt: { label: '演示文稿', short: '演示', icon: 'i-ppt', ext: 'pptx', extLabel: 'PowerPoint 演示文稿', color: 'var(--ppt)' },
  excel: { label: '电子表格', short: '表格', icon: 'i-excel', ext: 'xlsx', extLabel: 'Excel 工作簿', color: 'var(--excel)' },
};

const THEMES = [
  { id: 'azure', name: '经典蓝', colors: ['#2563eb', '#dbeafe', '#0f172a'], accent: '#3b82f6', soft: '#eef4ff' },
  { id: 'graphite', name: '石墨灰', colors: ['#475569', '#e2e8f0', '#0f172a'], accent: '#64748b', soft: '#f1f5f9' },
  { id: 'forest', name: '森林绿', colors: ['#15803d', '#d1fae5', '#052e16'], accent: '#22c55e', soft: '#edf8f0' },
  { id: 'ember', name: '暖橙', colors: ['#c2410c', '#ffedd5', '#431407'], accent: '#f97316', soft: '#fff3ed' },
  { id: 'noir', name: '极简黑', colors: ['#111827', '#e5e7eb', '#fafafa'], accent: '#334155', soft: '#f3f4f6' },
];

const TEMPLATES = [
  { id: 'report', name: '行业分析报告', type: 'word', scene: '研究', desc: '摘要 · 趋势 · 建议', pages: '6 页结构' },
  { id: 'weekly', name: '项目周报', type: 'word', scene: '汇报', desc: '进展 · 风险 · 计划', pages: '2 页结构' },
  { id: 'proposal', name: '项目方案', type: 'word', scene: '方案', desc: '背景 · 目标 · 排期', pages: '8 页结构' },
  { id: 'minutes', name: '会议纪要', type: 'word', scene: '协作', desc: '结论 · 待办 · 责任人', pages: '1 页结构' },
  { id: 'roadmap', name: '产品路线图', type: 'ppt', scene: '汇报', desc: '结论 · 路线 · 资源', pages: '8 页' },
  { id: 'qbr', name: '季度业务汇报', type: 'ppt', scene: '汇报', desc: '复盘 · 数据 · 规划', pages: '10 页' },
  { id: 'sales', name: '销售汇总表', type: 'excel', scene: '数据', desc: '汇总 · 同比 · 图表', pages: '3 个 Sheet' },
  { id: 'budget', name: '年度预算表', type: 'excel', scene: '财务', desc: '预算 · 使用率 · 对比', pages: '2 个 Sheet' },
];

const DOCS = [
  { id: 'doc-ai-report', type: 'word', title: 'AI 办公趋势与 Q4 产品规划', template: 'report', theme: 'azure', updated: '刚刚', starred: true },
  { id: 'doc-q4-plan', type: 'ppt', title: 'Q4 产品规划', template: 'roadmap', theme: 'azure', updated: '2 小时前', starred: false },
  { id: 'doc-q4-sales', type: 'excel', title: 'Q4 销售汇总', template: 'sales', theme: 'forest', updated: '昨天', starred: true },
  { id: 'doc-weekly-45', type: 'word', title: '项目周报 · 第 45 周', template: 'weekly', theme: 'graphite', updated: '昨天', starred: false },
  { id: 'doc-annual-review', type: 'ppt', title: '年度业务复盘', template: 'qbr', theme: 'ember', updated: '11 月 1 日', starred: false },
  { id: 'doc-budget-2026', type: 'excel', title: '2026 年度预算', template: 'budget', theme: 'azure', updated: '10 月 30 日', starred: false },
];

const MATERIALS = [
  { id: 'mat-okr', name: 'Q4 OKR.pdf', type: 'PDF', size: '1.2 MB', detail: '12 页 · 6 个关键结果', citations: 8 },
  { id: 'mat-trend', name: '2026 AI 办公趋势.pdf', type: 'PDF', size: '3.4 MB', detail: '28 页 · 行业报告', citations: 12 },
  { id: 'mat-interview', name: '客户访谈纪要.docx', type: 'Word', size: '86 KB', detail: '6 页 · 12 位客户', citations: 3 },
  { id: 'mat-sales', name: 'Q4 销售明细.xlsx', type: 'Excel', size: '240 KB', detail: '3 个 Sheet · 428 行', citations: 5 },
  { id: 'mat-budget', name: '2026 年度预算.xlsx', type: 'Excel', size: '180 KB', detail: '2 个 Sheet · 24 个科目', citations: 4 },
  { id: 'mat-competitor', name: '竞品分析（链接）', type: '链接', size: '—', detail: '网页 · 抓取于昨天', citations: 2 },
];

const STORAGE = { used: 2.6, total: 10 };

/* --------------------------------------------------------------------------
   State
   -------------------------------------------------------------------------- */

const state = {
  currentDoc: null,
  currentPage: 'overview',
  docFilter: 'all',
  tplFilter: 'all',
  docSearch: '',
  chats: {},
  attached: {},
  webEnabled: true,
  streaming: false,
  streamToken: 0,
  saveTimer: null,
  selectionText: '',
  newDoc: null,
  exportFormat: 'docx',
  exportState: 'setup',
  exportTimer: null,
  previewIndex: 0,
  menuEl: null,
};

const getAttached = (doc) => {
  if (!doc) return new Set();
  if (!state.attached[doc.id]) {
    state.attached[doc.id] = new Set(doc.type === 'excel' ? [doc.template === 'budget' ? 'mat-budget' : 'mat-sales'] : ['mat-okr', 'mat-trend']);
  }
  return state.attached[doc.id];
};

const getChat = (doc) => {
  if (!state.chats[doc.id]) state.chats[doc.id] = buildInitialChat(doc);
  return state.chats[doc.id];
};

const themeOf = (doc) => THEMES.find((theme) => theme.id === doc.theme) || THEMES[0];

/* --------------------------------------------------------------------------
   Document content — Word
   -------------------------------------------------------------------------- */

function wordContent(doc) {
  const template = doc.template;
  if (template === 'weekly') return weeklyContent(doc);
  if (template === 'minutes') return minutesContent(doc);
  if (template === 'proposal') return proposalContent(doc);
  if (template === 'blank') return blankWordContent(doc);
  return reportContent(doc);
}

function reportContent(doc) {
  return `
    <div class="doc-kicker">行业研究 · 内部资料</div>
    <h1>${esc(doc.title)}</h1>
    <p class="doc-subtitle">从对话式创作到结构化交付，下一代文档工作台的机会</p>
    <div class="doc-meta"><span class="meta-avatar">Z</span><span>产品团队</span><span>·</span><span>2026 年 11 月 2 日</span><span>·</span><span>约 8 分钟阅读</span></div>
    <hr class="doc-rule">
    <h2><span class="h2-index">01</span>市场背景</h2>
    <p>过去一年，生成式 AI 正从“帮我想”走向“帮我做”。用户不再满足于在聊天框里得到一段文字，而是希望 AI 直接进入文档、理解结构、完成可交付的结果。文档，正在成为 AI 原生办公的主界面。</p>
    <blockquote class="doc-callout"><span class="callout-label">核心判断</span><p>文档不再是一次性的输出物，而是可被 AI 持续读写、结构化演进的工作对象。</p></blockquote>
    <h3>三个正在发生的变化</h3>
    <ul>
      <li><strong>从单次生成到持续编辑。</strong>用户愿意为“改到满意”付费，而不是为“生成一次”付费。</li>
      <li><strong>从文本对话到结构化操作。</strong>“把第三页改成三栏”比“再写一版”更接近真实工作。</li>
      <li><strong>从通用助手到场景 Agent。</strong>理解模板、主题、数据与引用，才称得上办公 Copilot。</li>
    </ul>
    <h2><span class="h2-index">02</span>用户痛点</h2>
    <p>我们对 42 位知识工作者进行了访谈，最集中的抱怨并不是“AI 不会写”，而是“写完还要花更多时间搬进文档、调格式、找来源”。</p>
    <table>
      <thead><tr><th>环节</th><th>今天的体验</th><th>机会</th></tr></thead>
      <tbody>
        <tr><td>起稿</td><td>面对空白页，不知道结构怎么搭</td><td>模板 + 大纲共创</td></tr>
        <tr><td>找资料</td><td>搜索、下载、复制，来源容易丢失</td><td>联网检索 + 资料引用</td></tr>
        <tr><td>排版</td><td>AI 产出与模板风格脱节</td><td>主题变量 + 结构化 patch</td></tr>
      </tbody>
    </table>
    <h2><span class="h2-index">03</span>Q4 产品规划</h2>
    <p>Q4 的目标不是把编辑器做得更大，而是把“从想法到交付”的路径缩短。我们围绕三条产品线设计增长：智能文档守住基本盘，AI 助手贡献增量收入，协作空间提升留存。</p>
    <div class="doc-stats">
      <div><strong>3.2×</strong><span>内容产出效率</span></div>
      <div><strong>86%</strong><span>企业续约率</span></div>
      <div><strong>+38%</strong><span>AI 助手收入环比</span></div>
    </div>
    <p>下一步，团队将把模板、Copilot 与导出链路串成一条可度量的闭环，并以“周完成文档数”作为北极星指标。</p>
    <div class="doc-footer"><span>Office Copilot · 内部资料</span><span>第 1 页 / 共 3 页</span></div>
  `;
}

function weeklyContent(doc) {
  return `
    <div class="doc-kicker">项目周报 · 第 45 周</div>
    <h1>${esc(doc.title)}</h1>
    <p class="doc-subtitle">本周进展、风险与下周计划</p>
    <div class="doc-meta"><span class="meta-avatar">Z</span><span>产品团队</span><span>·</span><span>2026 年 11 月 2 日</span><span>·</span><span>同步 8 人</span></div>
    <hr class="doc-rule">
    <h2><span class="h2-index">01</span>本周进展</h2>
    <p>本周聚焦文档工作台的核心链路：新建、Copilot 生成、应用与撤销。三项关键能力已完成联调，进入体验打磨。</p>
    <table>
      <thead><tr><th>事项</th><th>负责人</th><th>状态</th></tr></thead>
      <tbody>
        <tr><td>工作台三栏布局与画布切换</td><td>设计 / 前端</td><td>已完成</td></tr>
        <tr><td>Copilot 工具调用可视化</td><td>前端</td><td>已完成</td></tr>
        <tr><td>文档导出保真度回归</td><td>后端</td><td>进行中</td></tr>
      </tbody>
    </table>
    <h2><span class="h2-index">02</span>风险与阻塞</h2>
    <ul>
      <li><strong>导出字体回退：</strong>Office 与浏览器字体不一致，长文档分页仍需人工比对。</li>
      <li><strong>大表格性能：</strong>1 万单元格以上滚动掉帧，需要虚拟化。</li>
    </ul>
    <blockquote class="doc-callout"><span class="callout-label">需要决策</span><p>导出保真度验收是否以“结构一致”为准，像素级差异允许在 V1 收敛？</p></blockquote>
    <h2><span class="h2-index">03</span>下周计划</h2>
    <ul>
      <li>完成 Word / PPT / Excel 三类导出样例与回归清单。</li>
      <li>补齐 Copilot 撤销与冲突合并的异常提示。</li>
      <li>启动模板中心的 12 套首发模板评审。</li>
    </ul>
    <div class="doc-footer"><span>Office Copilot · 产品团队</span><span>第 1 页 / 共 1 页</span></div>
  `;
}

function minutesContent(doc) {
  return `
    <div class="doc-kicker">会议纪要 · 产品评审</div>
    <h1>${esc(doc.title)}</h1>
    <p class="doc-subtitle">文档工作台 MVP 范围与验收口径</p>
    <div class="doc-meta"><span class="meta-avatar">Z</span><span>产品团队</span><span>·</span><span>2026 年 11 月 2 日</span><span>·</span><span>6 人参会</span></div>
    <hr class="doc-rule">
    <h2><span class="h2-index">01</span>结论</h2>
    <ul>
      <li>MVP 聚焦“新建 → Copilot → 应用 → 导出”闭环，不进入多人协作。</li>
      <li>PPT 首版支持文本、图片与基础形状，复杂动画后置。</li>
      <li>导出以结构一致为验收标准，字体差异记录为已知限制。</li>
    </ul>
    <h2><span class="h2-index">02</span>待办</h2>
    <table>
      <thead><tr><th>事项</th><th>负责人</th><th>截止</th></tr></thead>
      <tbody>
        <tr><td>输出导出样例与回归清单</td><td>后端</td><td>11 / 06</td></tr>
        <tr><td>补齐 Copilot 撤销交互</td><td>前端</td><td>11 / 08</td></tr>
        <tr><td>评审 12 套首发模板</td><td>设计</td><td>11 / 10</td></tr>
      </tbody>
    </table>
    <div class="doc-footer"><span>Office Copilot · 会议纪要</span><span>第 1 页 / 共 1 页</span></div>
  `;
}

function proposalContent(doc) {
  return `
    <div class="doc-kicker">项目方案 · 内部评审</div>
    <h1>${esc(doc.title)}</h1>
    <p class="doc-subtitle">用 AI 原生工作台重构文档生产链路</p>
    <div class="doc-meta"><span class="meta-avatar">Z</span><span>产品团队</span><span>·</span><span>2026 年 11 月 2 日</span><span>·</span><span>v0.1</span></div>
    <hr class="doc-rule">
    <h2><span class="h2-index">01</span>项目背景</h2>
    <p>当前文档生产分散在 Office、在线文档与 AI 聊天工具之间，用户需要在多个窗口间搬运内容，AI 也无法稳定理解文档结构。</p>
    <h2><span class="h2-index">02</span>目标与范围</h2>
    <ul>
      <li>一个工作台完成新建、编辑、预览、导出。</li>
      <li>Copilot 能读取文档、联网搜索、引用资料并结构化修改。</li>
      <li>MVP 覆盖三种文档类型，暂不进入多人协作。</li>
    </ul>
    <h2><span class="h2-index">03</span>方案设计</h2>
    <p>以平台原生 Doc Model 为事实源，前端按类型渲染画布；Copilot 通过受控工具读写文档，所有修改以 patch 形式应用并可撤销。</p>
    <h2><span class="h2-index">04</span>里程碑</h2>
    <table>
      <thead><tr><th>阶段</th><th>时间</th><th>交付</th></tr></thead>
      <tbody>
        <tr><td>M1</td><td>第 1–2 周</td><td>文档模型与三栏工作台</td></tr>
        <tr><td>M2</td><td>第 3–5 周</td><td>Copilot 工具链与生成</td></tr>
        <tr><td>M3</td><td>第 6–8 周</td><td>导出与验收</td></tr>
      </tbody>
    </table>
    <div class="doc-footer"><span>Office Copilot · 项目方案</span><span>第 1 页 / 共 2 页</span></div>
  `;
}

function blankWordContent(doc) {
  return `
    <div class="doc-kicker">新文档</div>
    <h1>${esc(doc.title)}</h1>
    <p class="doc-subtitle">从这里开始输入，或让右侧 Copilot 帮你起草。</p>
    <hr class="doc-rule">
    <h2>开始写作</h2>
    <p>你可以直接在这个页面编辑，也可以在右侧告诉 Copilot 你的目标、受众与篇幅。它会先给出结构，再按你的反馈逐段完善。</p>
    <blockquote class="doc-callout"><span class="callout-label">试试这样问</span><p>“帮我写一份面向管理层的 Q4 复盘，先给大纲，确认后再展开。”引用会标注来源，修改可以随时撤销。</p></blockquote>
    <div class="doc-footer"><span>Office Copilot</span><span>第 1 页 / 共 1 页</span></div>
  `;
}

/* --------------------------------------------------------------------------
   Document content — Word add-on sections (Copilot artifact)
   -------------------------------------------------------------------------- */

function wordSection(doc) {
  if (doc.template === 'weekly') {
    return `
      <div class="word-added" id="word-added">
        <h2><span class="h2-index">04</span>风险升级与应对</h2>
        <p>结合本周项目记录与《Q4 OKR》，我把需要管理层关注的风险收敛为三条，并按影响 × 概率排序。</p>
        <ul>
          <li><strong>导出保真度（高影响）：</strong>长文档分页与字体回退仍不稳定，建议把“结构一致”写入验收，像素差异后置。</li>
          <li><strong>大表格性能（中影响）：</strong>1 万单元格以上出现掉帧，需要在本周确认虚拟化方案。</li>
          <li><strong>模板供给（中影响）：</strong>首发 12 套模板仅完成 8 套，可能影响上线节奏。</li>
        </ul>
        <blockquote class="doc-callout"><span class="callout-label">建议决策</span><p>本周五前确认导出验收口径；若模板未齐，首发范围收敛到 8 套，其余随 V1 发布。</p></blockquote>
        <h2><span class="h2-index">05</span>下周计划</h2>
        <table>
          <thead><tr><th>事项</th><th>负责人</th><th>截止</th><th>状态</th></tr></thead>
          <tbody>
            <tr><td>输出三类文档导出样例</td><td>后端</td><td>11 / 06</td><td>进行中</td></tr>
            <tr><td>Copilot 撤销与冲突提示</td><td>前端</td><td>11 / 08</td><td>待开始</td></tr>
            <tr><td>首发模板评审</td><td>设计</td><td>11 / 10</td><td>待开始</td></tr>
          </tbody>
        </table>
      </div>
    `;
  }
  if (doc.template === 'minutes') {
    return `
      <div class="word-added" id="word-added">
        <h2><span class="h2-index">03</span>待办与责任人</h2>
        <p>我把会议中的口头结论整理成可跟踪的待办，并补上了依赖关系。</p>
        <table>
          <thead><tr><th>待办</th><th>负责人</th><th>依赖</th><th>截止</th></tr></thead>
          <tbody>
            <tr><td>导出保真度回归清单</td><td>后端</td><td>样例文档</td><td>11 / 06</td></tr>
            <tr><td>Copilot 撤销交互</td><td>前端</td><td>patch 协议</td><td>11 / 08</td></tr>
            <tr><td>模板中心首发评审</td><td>设计</td><td>版权确认</td><td>11 / 10</td></tr>
          </tbody>
        </table>
        <blockquote class="doc-callout"><span class="callout-label">下次会议</span><p>11 月 6 日 10:00，同步导出样例与模板评审结论。</p></blockquote>
      </div>
    `;
  }
  return `
    <div class="word-added" id="word-added">
      <h2><span class="h2-index">04</span>增长策略：把文档变成生产力</h2>
      <p>综合行业信号与《Q4 OKR》，Q4 的增长不应来自更多功能，而来自把“创建 → 生成 → 应用 → 导出”的闭环做顺。用户每少一次复制粘贴，就多一次留下的理由。</p>
      <div class="doc-stats">
        <div><strong>+38%</strong><span>AI 助手收入环比</span></div>
        <div><strong>2.4×</strong><span>模板复用带来的产出提升</span></div>
        <div><strong>86%</strong><span>智能文档企业续约率</span></div>
      </div>
      <h3>三个可执行动作</h3>
      <ul>
        <li><strong>模板即入口。</strong>把高频场景做成“结构 + 示例 + 主题”的可复用模板，降低第一次成功的时间。</li>
        <li><strong>Copilot 可撤销。</strong>所有生成以 patch 应用，用户敢让它直接改文档，采纳率才会上去。</li>
        <li><strong>导出即信任。</strong>把 OOXML 保真度纳入每周回归，导出失败率作为一级指标。</li>
      </ul>
      <blockquote class="doc-callout"><span class="callout-label">引用与下一步</span><p>本段引用《Q4 OKR》与 2026 AI 办公趋势报告。<span class="citation-ref">[1]</span><span class="citation-ref">[2]</span> 建议用两周完成模板与导出的联合验证，再进入规模化推广。</p></blockquote>
    </div>
  `;
}

/* --------------------------------------------------------------------------
   Document content — PPT
   -------------------------------------------------------------------------- */

function buildDeck(doc) {
  const isQbr = doc.template === 'qbr';
  if (doc.template === 'blank') {
    return [{
      layout: 'cover', eyebrow: 'NEW DECK · 2026', title: doc.title || '未命名演示文稿',
      subtitle: '从这里开始，或让右侧 Copilot 帮你生成整套内容', footLeft: 'Office Copilot', footRight: '2026.11',
      notes: '这是一份空白演示文稿，先告诉 Copilot 目标、受众与页数。',
    }];
  }
  if (isQbr) {
    return [
      {
        layout: 'cover', eyebrow: 'ANNUAL REVIEW · 2026', title: doc.title || '年度业务复盘',
        subtitle: '2026 年度回顾与 2027 展望', footLeft: '产品团队', footRight: '2026.12',
        notes: '开场 30 秒：先讲清今年做对了什么，再讲明年押注什么。',
      },
      {
        layout: 'bullets', kicker: 'EXECUTIVE SUMMARY', title: '2026 的三个判断',
        bullets: [
          { title: '增长从“席位”转向“使用”', text: 'AI 助手贡献 34% 新增收入，活跃深度比席位数更能预测续约。' },
          { title: '模板是留存的前置指标', text: '使用模板的新用户，7 日留存比空白创建高 2.1 倍。' },
          { title: '导出是信任的最后一公里', text: '导出失败率每降低 1pp，周活提升约 0.8%。' },
        ],
        stat: { label: 'ANNUAL REVENUE', value: '1.42', unit: '亿', desc: '同比增长 31%，AI 助手贡献 34% 新增收入', bars: [42, 55, 68, 84] },
        notes: '用三个判断串起全年，避免逐月流水账。',
      },
      {
        layout: 'columns', kicker: 'BUSINESS LINES', title: '三条业务线的年度表现',
        columns: [
          { no: '01', title: '智能文档', text: '以模板与结构化能力守住企业基本盘，续约率持续提升。', stat: '86', unit: '% 企业续约率' },
          { no: '02', title: 'AI 助手', text: '从功能变成入口，成为收入增量的主要来源。', stat: '4,980', unit: '万 年度收入' },
          { no: '03', title: '协作空间', text: '周活增长稳定，但激活后的深度使用仍有提升空间。', stat: '+41', unit: '% 周活增长' },
        ],
        foot: { left: '数据来源：财务系统、产品埋点' },
        notes: '强调 AI 助手是第二曲线，协作空间是下一阶段。',
      },
      {
        layout: 'chart', kicker: 'REVENUE MIX', title: '全年收入结构：AI 助手成为第二曲线',
        legend: ['2025', '2026'],
        groups: [{ label: 'Q1', bars: [36, 46] }, { label: 'Q2', bars: [41, 55] }, { label: 'Q3', bars: [47, 66] }, { label: 'Q4', bars: [52, 78] }],
        insight: { label: 'INSIGHT', title: 'AI 助手贡献 34% 新增收入', text: 'Q4 单季收入首次超过智能文档，验证“对话即入口”的判断。', chip: '+38% QoQ' },
        notes: '这张图是全年复盘的锚点，停留 40 秒。',
      },
      {
        layout: 'end', title: '从复盘到增长', subtitle: '2027，把每一次对话变成可交付的文档',
        notes: '收束到明年的核心命题。',
      },
    ];
  }

  return [
    {
      layout: 'cover', eyebrow: 'PRODUCT REVIEW · Q4 2026', title: doc.title || 'Q4 产品规划',
      subtitle: '三条产品线 · 面向管理层的季度汇报', footLeft: '产品团队', footRight: '2026.11',
      notes: '开场 30 秒：一句话说明 Q4 的三条增长主线。',
    },
    {
      layout: 'bullets', kicker: 'EXECUTIVE SUMMARY', title: '先给结论：Q4 的三个关键词',
      bullets: [
        { title: '增长：AI 助手成为第二曲线', text: 'Q4 收入目标 1,890 万，环比 +38%，重点来自模板与对话式创作。' },
        { title: '效率：模板 + Copilot 缩短首次成功', text: '从新建到首份可导出文档的中位时长压缩到 18 分钟。' },
        { title: '信任：导出与引用可追溯', text: 'OOXML 保真度纳入周回归，联网内容全部带来源。' },
      ],
      stat: { label: 'CONTENT VELOCITY', value: '3.2', unit: '×', desc: '模板 + Copilot 带来的内容产出效率提升', bars: [38, 52, 64, 82] },
      notes: '结论先行，管理层只需要记住三个词：增长、效率、信任。',
    },
    {
      layout: 'columns', kicker: 'GROWTH ENGINE', title: '三条产品线，三种增长引擎',
      columns: [
        { no: '01', title: '智能文档', text: '以模板和结构化能力守住企业基本盘，提升续约与客单。', stat: '86', unit: '% 企业续约率' },
        { no: '02', title: 'AI 助手', text: '从“功能”变成“入口”，用对话完成从想法到交付。', stat: '1,890', unit: '万 Q4 收入目标' },
        { no: '03', title: '协作空间', text: '以评论与分享提升留存，为多人协作预留空间。', stat: '+41', unit: '% 周活增长' },
      ],
      foot: { left: '数据来源：Q4 OKR、财务预测' },
      notes: '这一页是全篇核心，停 45 秒，逐条讲数字。',
    },
    {
      layout: 'chart', kicker: 'REVENUE MIX', title: '收入结构：AI 助手成为第二曲线',
      legend: ['2025', '2026'],
      groups: [{ label: 'Q1', bars: [36, 46] }, { label: 'Q2', bars: [41, 55] }, { label: 'Q3', bars: [47, 66] }, { label: 'Q4', bars: [52, 78] }],
      insight: { label: 'INSIGHT', title: 'AI 助手贡献 34% 新增收入', text: 'Q4 单季收入首次超过智能文档，验证“对话即入口”的判断。', chip: '+38% QoQ' },
      notes: '数据页只讲一个洞察，避免堆数字。',
    },
    {
      layout: 'end', title: '把文档变成生产力', subtitle: 'Thank you · Q4 产品规划',
      notes: '收束，回到“生产力”而不是“功能列表”。',
    },
  ];
}

function generatedDeck(doc) {
  const isQbr = doc.template === 'qbr';
  const baseDoc = doc.template === 'blank' ? { ...doc, template: 'roadmap' } : doc;
  const base = buildDeck(baseDoc);
  const cover = base[0];
  const summary = base[1];
  const lines = base[2];
  const chart = base[3];
  const end = base[4];

  const timeline = {
    layout: 'timeline', kicker: 'ROADMAP', title: isQbr ? '2027 路线图：两个季度一个台阶' : 'Q4 路线图：四周一个里程碑',
    items: [
      { time: isQbr ? 'H1' : 'W1–2', title: isQbr ? '模板与导出' : '模板与导出', text: isQbr ? '完成 20 套模板，导出失败率 < 0.5%' : '首发 12 套模板，导出回归清单' },
      { time: isQbr ? 'H1' : 'W3–4', title: 'Copilot 工具链', text: '联网、资料、patch 全链路稳定' },
      { time: isQbr ? 'H2' : 'W5–8', title: '协作与分享', text: '评论、链接分享、只读预览' },
      { time: isQbr ? 'H2' : 'W9–12', title: '规模化', text: '企业试点与成本优化' },
    ],
    notes: '路线图只讲四个里程碑，不展开细节。',
  };

  const table = {
    layout: 'table', kicker: 'INVESTMENT', title: isQbr ? '2027 投入与产出' : 'Q4 投入与产出：把资源放在增长点',
    columns: ['方向', '投入', isQbr ? '2027 目标' : 'Q4 目标', '优先级'],
    rows: [
      ['AI 助手', '2 个小组', isQbr ? '收入占比 45%' : '收入 1,890 万', '<span class="tag">P0</span>'],
      ['模板与主题', '1 个设计组', isQbr ? '20 套首发' : '12 套首发', '<span class="tag">P0</span>'],
      ['导出与保真', '1 个后端组', isQbr ? '失败率 < 0.3%' : '失败率 < 0.5%', '<span class="tag">P0</span>'],
      ['协作空间', '1 个前端组', isQbr ? '周活 +30%' : '评论与分享', '<span class="tag">P1</span>'],
    ],
    notes: '资源诉求要具体到组，不要只说“加大投入”。',
  };

  const risks = {
    layout: 'bullets', kicker: 'RISKS', title: '风险与应对：提前把坏消息说清楚',
    bullets: [
      { title: '导出保真度', text: 'Office 字体与分页差异，建立双端回归与降级策略。' },
      { title: '生成质量波动', text: '以黄金任务集评测，patch 应用前可预览、应用后可撤销。' },
      { title: '成本与延迟', text: '结构摘要 + 检索式上下文，超长文档走异步生成。' },
    ],
    notes: '主动暴露风险，给出可执行的应对，而不是泛泛而谈。',
  };

  return [
    { ...cover, notes: cover.notes },
    summary,
    lines,
    chart,
    timeline,
    table,
    risks,
    { ...end, notes: end.notes },
  ];
}

function slideStyle(doc) {
  const theme = themeOf(doc);
  return `--slide-accent:${theme.accent};--slide-accent-soft:${theme.soft};`;
}

function slideHTML(slide, index, doc, total = null) {
  const style = slideStyle(doc);
  const totalNum = total || (doc.slides ? doc.slides.length : 8);
  const totalLabel = String(totalNum).padStart(2, '0');
  switch (slide.layout) {
    case 'cover':
      return `<section class="ppt-slide slide-cover" style="${style}" spellcheck="false">
        <div class="slide-eyebrow" contenteditable="true" data-field="eyebrow">${esc(slide.eyebrow || '')}</div>
        <h1 contenteditable="true" data-field="title">${esc(slide.title)}</h1>
        <div class="accent-line"></div>
        <p class="slide-cover-sub" contenteditable="true" data-field="subtitle">${esc(slide.subtitle || '')}</p>
        <div class="slide-cover-foot"><b contenteditable="true" data-field="footLeft">${esc(slide.footLeft || '')}</b><span>·</span><span contenteditable="true" data-field="footRight">${esc(slide.footRight || '')}</span></div>
      </section>`;
    case 'columns':
      return `<section class="ppt-slide slide-light" style="${style}" spellcheck="false">
        <div class="slide-head">
          <div><div class="slide-kicker">${esc(slide.kicker || '')}</div><h2 contenteditable="true" data-field="title">${esc(slide.title)}</h2></div>
          <div class="slide-page">${index + 1} / ${totalLabel}</div>
        </div>
        <div class="slide-cols">
          ${(slide.columns || []).map((col, i) => `<div class="slide-col ${i === 1 ? 'hot' : ''}">
            <div class="col-no">${esc(col.no || '')}</div>
            <h3 contenteditable="true" data-field="columns.${i}.title">${esc(col.title)}</h3>
            <p contenteditable="true" data-field="columns.${i}.text">${esc(col.text)}</p>
            <div class="col-stat"><strong contenteditable="true" data-field="columns.${i}.stat">${esc(col.stat)}</strong><span contenteditable="true" data-field="columns.${i}.unit">${esc(col.unit || '')}</span></div>
          </div>`).join('')}
        </div>
        <div class="slide-foot"><span>${esc(slide.foot?.left || '')}</span><span>${esc(slide.foot?.right || `${index + 1} / ${totalLabel}`)}</span></div>
      </section>`;
    case 'bullets': {
      const hasStat = Boolean(slide.stat);
      return `<section class="ppt-slide slide-light" style="${style}" spellcheck="false">
        <div class="slide-head">
          <div><div class="slide-kicker">${esc(slide.kicker || '')}</div><h2 contenteditable="true" data-field="title">${esc(slide.title)}</h2></div>
          <div class="slide-page">${index + 1} / ${totalLabel}</div>
        </div>
        <div class="slide-bullets ${hasStat ? '' : 'single'}">
          <div class="slide-bullet-list">
            ${(slide.bullets || []).map((item, i) => `<div class="slide-bullet-item">
              <span class="b-no">${String(i + 1).padStart(2, '0')}</span>
              <div><h3 contenteditable="true" data-field="bullets.${i}.title">${esc(item.title)}</h3><p contenteditable="true" data-field="bullets.${i}.text">${esc(item.text)}</p></div>
            </div>`).join('')}
          </div>
          ${hasStat ? `<div class="slide-stat-panel">
            <div class="sp-label">${esc(slide.stat.label || '')}</div>
            <div class="sp-value" contenteditable="true" data-field="stat.value">${esc(slide.stat.value)}<small>${esc(slide.stat.unit || '')}</small></div>
            <div class="sp-desc" contenteditable="true" data-field="stat.desc">${esc(slide.stat.desc || '')}</div>
            <div class="sp-bars">${(slide.stat.bars || [40, 55, 70, 90]).map((h) => `<b style="height:${h}%"></b>`).join('')}</div>
          </div>` : ''}
        </div>
      </section>`;
    }
    case 'chart':
      return `<section class="ppt-slide slide-light" style="${style}" spellcheck="false">
        <div class="slide-head">
          <div><div class="slide-kicker">${esc(slide.kicker || '')}</div><h2 contenteditable="true" data-field="title">${esc(slide.title)}</h2></div>
          <div class="slide-page">${index + 1} / ${totalLabel}</div>
        </div>
        <div class="slide-chart-layout">
          <div class="slide-chart">
            <div class="chart-legend">${(slide.legend || []).map((label, i) => `<span><i class="${i === 0 ? 'muted' : ''}"></i>${esc(label)}</span>`).join('')}</div>
            <div class="chart-bars">
              ${(slide.groups || []).map((group) => `<div class="chart-group">${(group.bars || []).map((value, i) => `<b class="${i === (group.bars.length - 1) ? 'hi' : ''}" style="height:${value}%"></b>`).join('')}</div>`).join('')}
            </div>
            <div class="chart-labels">${(slide.groups || []).map((group) => `<span>${esc(group.label)}</span>`).join('')}</div>
          </div>
          <div class="slide-insight">
            <div class="insight-label">${esc(slide.insight?.label || 'INSIGHT')}</div>
            <h3 contenteditable="true" data-field="insight.title">${esc(slide.insight?.title || '')}</h3>
            <p contenteditable="true" data-field="insight.text">${esc(slide.insight?.text || '')}</p>
            <span class="insight-chip" contenteditable="true" data-field="insight.chip">${esc(slide.insight?.chip || '')}</span>
          </div>
        </div>
        <div class="slide-foot"><span>${esc(slide.foot?.left || '数据来自产品埋点与财务系统')}</span><span>${esc(slide.foot?.right || `${index + 1} / ${totalLabel}`)}</span></div>
      </section>`;
    case 'timeline':
      return `<section class="ppt-slide slide-light" style="${style}" spellcheck="false">
        <div class="slide-head">
          <div><div class="slide-kicker">${esc(slide.kicker || '')}</div><h2 contenteditable="true" data-field="title">${esc(slide.title)}</h2></div>
          <div class="slide-page">${index + 1} / ${totalLabel}</div>
        </div>
        <div class="slide-timeline">
          <div class="timeline-line"></div>
          <div class="timeline-items">
            ${(slide.items || []).map((item, i) => `<div class="timeline-item">
              <span class="t-dot"></span>
              <div class="t-card"><div class="t-time" contenteditable="true" data-field="items.${i}.time">${esc(item.time)}</div><h3 contenteditable="true" data-field="items.${i}.title">${esc(item.title)}</h3><p contenteditable="true" data-field="items.${i}.text">${esc(item.text)}</p></div>
            </div>`).join('')}
          </div>
        </div>
      </section>`;
    case 'table':
      return `<section class="ppt-slide slide-light" style="${style}" spellcheck="false">
        <div class="slide-head">
          <div><div class="slide-kicker">${esc(slide.kicker || '')}</div><h2 contenteditable="true" data-field="title">${esc(slide.title)}</h2></div>
          <div class="slide-page">${index + 1} / ${totalLabel}</div>
        </div>
        <div class="slide-table-layout">
          <table class="slide-table">
            <thead><tr>${(slide.columns || []).map((col) => `<th>${esc(col)}</th>`).join('')}</tr></thead>
            <tbody>${(slide.rows || []).map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
          </table>
        </div>
      </section>`;
    case 'end':
      return `<section class="ppt-slide slide-end" style="${style}">
        <div class="end-mark">${icon('i-sparkles')}</div>
        <h2 contenteditable="true" data-field="title">${esc(slide.title)}</h2>
        <p contenteditable="true" data-field="subtitle">${esc(slide.subtitle || '')}</p>
      </section>`;
    default:
      return '';
  }
}

function thumbHTML(slide, index, active) {
  const light = slide.layout !== 'cover' && slide.layout !== 'end';
  let content = `<i class="title"></i><i></i><i style="width:52%"></i>`;
  if (slide.layout === 'columns') {
    content = `<i class="title"></i><i style="width:44%"></i><div class="mini-cols"><b></b><b></b><b></b></div>`;
  } else if (slide.layout === 'chart') {
    content = `<i class="title"></i><i style="width:40%"></i><div class="bar-row"><b style="height:40%"></b><b style="height:58%"></b><b style="height:72%"></b><b style="height:92%"></b></div>`;
  } else if (slide.layout === 'timeline') {
    content = `<i class="title"></i><div class="mini-cols" style="margin-top:10px"><b></b><b></b><b></b><b></b></div>`;
  } else if (slide.layout === 'bullets') {
    content = `<i class="title"></i><i style="width:58%"></i><i style="width:48%"></i><i style="width:64%"></i>`;
  } else if (slide.layout === 'table') {
    content = `<i class="title"></i><i style="width:70%"></i><i style="width:70%"></i><i style="width:70%"></i>`;
  }
  return `<button class="ppt-thumb ${light ? 'light' : ''} ${active ? 'active' : ''}" data-slide-index="${index}" title="第 ${index + 1} 页">
    <div class="mini-slide-bg ${light ? 'light' : 'dark'}"></div>
    <div class="mini-slide-content">${content}</div>
    <span class="thumb-no">${index + 1}</span>
  </button>`;
}

/* --------------------------------------------------------------------------
   Document content — Excel
   -------------------------------------------------------------------------- */

const COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const EXCEL_ROWS = 18;

function excelSheet(doc) {
  if (doc.template === 'blank') return blankSheet(doc);
  if (doc.template === 'budget') return budgetSheet(doc);
  return salesSheet(doc);
}

function blankSheet(doc) {
  return {
    name: 'Sheet1',
    cells: {
      A1: { v: '项目', header: true }, B1: { v: '状态', header: true }, C1: { v: '负责人', header: true }, D1: { v: '截止', header: true },
      A3: { v: '' }, A4: { v: '' },
    },
    cols: COLS.length,
    rows: EXCEL_ROWS,
    selected: 'A1',
    chart: {
      title: '图表',
      labels: ['Q1', 'Q2', 'Q3', 'Q4'],
      series: [{ name: '系列 1', values: [0, 0, 0, 0] }, { name: '系列 2', values: [0, 0, 0, 0] }],
    },
  };
}

function salesSheet(doc) {
  const cells = {
    A1: { v: '产品线', header: true }, B1: { v: 'Q1', header: true }, C1: { v: 'Q2', header: true }, D1: { v: 'Q3', header: true }, E1: { v: 'Q4', header: true }, F1: { v: '全年', header: true }, G1: { v: '同比', header: true },
    A2: { v: '智能文档' }, B2: { v: 1280, num: true }, C2: { v: 1460, num: true }, D2: { v: 1690, num: true }, E2: { v: 2050, num: true }, F2: { v: 6480, f: '=SUM(B2:E2)', num: true, total: true }, G2: { v: '+32%', pct: true },
    A3: { v: 'AI 助手' }, B3: { v: 820, num: true }, C3: { v: 1050, num: true }, D3: { v: 1380, num: true }, E3: { v: 1760, num: true }, F3: { v: 5010, f: '=SUM(B3:E3)', num: true, total: true }, G3: { v: '+48%', pct: true },
    A4: { v: '协作空间' }, B4: { v: 640, num: true }, C4: { v: 720, num: true }, D4: { v: 810, num: true }, E4: { v: 940, num: true }, F4: { v: 3110, f: '=SUM(B4:E4)', num: true, total: true }, G4: { v: '+18%', pct: true },
    A5: { v: '合计', total: true }, B5: { v: 2740, num: true, total: true }, C5: { v: 3230, num: true, total: true }, D5: { v: 3880, num: true, total: true }, E5: { v: 4750, num: true, total: true }, F5: { v: 14600, f: '=SUM(F2:F4)', num: true, total: true }, G5: { v: '+31%', pct: true },
    A7: { v: '关键指标', header: true }, B7: { v: '数值', header: true }, C7: { v: '说明', header: true },
    A8: { v: 'Q4 目标' }, B8: { v: 5500, num: true }, C8: { v: '来自 Q4 OKR' },
    A9: { v: 'Q4 实际' }, B9: { v: 4750, num: true }, C9: { v: '销售明细汇总' },
    A10: { v: '完成率' }, B10: { v: '86%', pct: true }, C10: { v: '实际 / 目标' },
    A11: { v: '数据范围' }, B11: { v: '2026-10-01 至 2026-12-31' }, C11: { v: '4 个产品线' },
  };
  return {
    name: 'Q4 汇总',
    cells,
    cols: COLS.length,
    rows: EXCEL_ROWS,
    selected: 'A1',
    chart: {
      title: '季度收入趋势',
      labels: ['Q1', 'Q2', 'Q3', 'Q4'],
      series: [
        { name: '智能文档', values: [1280, 1460, 1690, 2050] },
        { name: 'AI 助手', values: [820, 1050, 1380, 1760] },
        { name: '协作空间', values: [640, 720, 810, 940] },
      ],
    },
  };
}

function budgetSheet(doc) {
  const cells = {
    A1: { v: '科目', header: true }, B1: { v: '年度预算', header: true }, C1: { v: '已使用', header: true }, D1: { v: '剩余', header: true }, E1: { v: '使用率', header: true },
    A2: { v: '人力成本' }, B2: { v: 1200000, num: true }, C2: { v: 680000, num: true }, D2: { v: 520000, num: true }, E2: { v: '57%', pct: true },
    A3: { v: '市场推广' }, B3: { v: 800000, num: true }, C3: { v: 420000, num: true }, D3: { v: 380000, num: true }, E3: { v: '53%', pct: true },
    A4: { v: '研发工具' }, B4: { v: 360000, num: true }, C4: { v: 212000, num: true }, D4: { v: 148000, num: true }, E4: { v: '59%', pct: true },
    A5: { v: '差旅与活动' }, B5: { v: 180000, num: true }, C5: { v: 96000, num: true }, D5: { v: 84000, num: true }, E5: { v: '53%', pct: true },
    A6: { v: '合计', total: true }, B6: { v: 2540000, num: true, total: true }, C6: { v: 1408000, num: true, total: true }, D6: { v: 1132000, num: true, total: true }, E6: { v: '55%', pct: true },
    A8: { v: '预算健康度', header: true }, B8: { v: '状态', header: true },
    A9: { v: 'Q4 剩余预算' }, B9: { v: 1132000, num: true },
    A10: { v: '预计年末使用率' }, B10: { v: '91%', pct: true },
    A11: { v: '风险提示' }, B11: { v: '市场推广可能超支' },
  };
  return {
    name: '年度预算',
    cells,
    cols: COLS.length,
    rows: EXCEL_ROWS,
    selected: 'A1',
    chart: {
      title: '预算使用率',
      labels: ['人力', '市场', '研发', '差旅'],
      series: [
        { name: '已使用', values: [680, 420, 212, 96] },
        { name: '剩余', values: [520, 380, 148, 84] },
      ],
    },
  };
}

function excelUpdates(doc) {
  if (doc.template === 'budget') {
    return {
      cells: {
        C2: { v: 780000, num: true, changed: true }, D2: { v: 420000, num: true, changed: true }, E2: { v: '65%', pct: true, changed: true },
        C3: { v: 520000, num: true, changed: true }, D3: { v: 280000, num: true, changed: true }, E3: { v: '65%', pct: true, changed: true },
        C4: { v: 248000, num: true, changed: true }, D4: { v: 112000, num: true, changed: true }, E4: { v: '69%', pct: true, changed: true },
        C5: { v: 118000, num: true, changed: true }, D5: { v: 62000, num: true, changed: true }, E5: { v: '66%', pct: true, changed: true },
        C6: { v: 1666000, num: true, total: true, changed: true }, D6: { v: 874000, num: true, total: true, changed: true }, E6: { v: '66%', pct: true, changed: true },
        A8: { v: 'Copilot 洞察', header: true }, B8: { v: '建议' },
        A9: { v: '市场推广使用率 65%，高于均值' }, B9: { v: '收紧 10% 预算' },
        A10: { v: '人力成本剩余 42 万' }, B10: { v: '可覆盖新增招聘' },
        A11: { v: '预计年末使用率 93%' }, B11: { v: '关注超支风险' },
      },
      chart: {
        title: '预算使用率',
        labels: ['人力', '市场', '研发', '差旅'],
        series: [
          { name: '已使用', values: [780, 520, 248, 118] },
          { name: '剩余', values: [420, 280, 112, 62] },
        ],
      },
      rows: [['科目', '调整后已用', '剩余'], ['人力成本', '780,000', '420,000'], ['市场推广', '520,000', '280,000'], ['研发工具', '248,000', '112,000'], ['差旅与活动', '118,000', '62,000']],
    };
  }
  return {
    cells: {
      E2: { v: 2150, num: true, changed: true }, F2: { v: 6580, f: '=SUM(B2:E2)', num: true, total: true, changed: true }, G2: { v: '+38%', pct: true, changed: true },
      E3: { v: 1980, num: true, changed: true }, F3: { v: 5230, f: '=SUM(B3:E3)', num: true, total: true, changed: true }, G3: { v: '+52%', pct: true, changed: true },
      E4: { v: 1020, num: true, changed: true }, F4: { v: 3190, f: '=SUM(B4:E4)', num: true, total: true, changed: true }, G4: { v: '+21%', pct: true, changed: true },
      E5: { v: 5150, num: true, total: true, changed: true }, F5: { v: 15000, f: '=SUM(F2:F4)', num: true, total: true, changed: true }, G5: { v: '+35%', pct: true, changed: true },
      A8: { v: 'Copilot 洞察', header: true }, B8: { v: '建议' }, C8: { v: '' },
      A9: { v: 'AI 助手 Q4 环比 +22%' }, B9: { v: '追加 15% 预算' }, C9: { v: 'ROI 最高' },
      A10: { v: '协作空间增速放缓' }, B10: { v: '关注激活率' }, C10: { v: 'Q1 复盘' },
      A11: { v: 'Q4 完成率 94%' }, B11: { v: '接近目标' }, C11: { v: '保持节奏' },
    },
    chart: {
      title: '季度收入趋势',
      labels: ['Q1', 'Q2', 'Q3', 'Q4'],
      series: [
        { name: '智能文档', values: [1280, 1460, 1690, 2150] },
        { name: 'AI 助手', values: [820, 1050, 1380, 1980] },
        { name: '协作空间', values: [640, 720, 810, 1020] },
      ],
    },
    rows: [['产品线', 'Q4', '全年', '同比'], ['智能文档', '2,150', '6,580', '+38%'], ['AI 助手', '1,980', '5,230', '+52%'], ['协作空间', '1,020', '3,190', '+21%']],
  };
}

/* --------------------------------------------------------------------------
   Copilot scenarios
   -------------------------------------------------------------------------- */

function buildArtifact(doc) {
  const type = doc.type;
  if (type === 'word') {
    const section = wordSection(doc);
    const isWeekly = doc.template === 'weekly';
    const isMinutes = doc.template === 'minutes';
    return {
      kind: 'word',
      title: isWeekly ? '项目周报 · 补充风险与下周计划' : isMinutes ? '会议纪要 · 待办与责任人' : '行业分析报告 · 新增第 4 节「增长策略」',
      meta: isWeekly ? '约 620 字 · 3 个风险 · 1 张表' : isMinutes ? '约 420 字 · 3 项待办 · 1 张表' : '约 1,200 字 · 3 个来源 · 3 个指标',
      action: '插入到文档末尾',
      preview: { type: 'word', html: section },
      applied: false,
    };
  }
  if (type === 'ppt') {
    const isQbr = doc.template === 'qbr';
    const slides = generatedDeck(doc);
    return {
      kind: 'ppt',
      title: isQbr ? '年度业务复盘 · 8 页幻灯片' : 'Q4 产品规划 · 8 页幻灯片',
      meta: '8 页 · 3 张数据图 · 引用 2 份资料',
      action: '替换当前幻灯片',
      preview: { type: 'ppt', slides },
      applied: false,
    };
  }
  const updates = excelUpdates(doc);
  const isBudget = doc.template === 'budget';
  return {
    kind: 'excel',
    title: isBudget ? '年度预算汇总 · 更新 24 个单元格' : 'Q4 销售汇总 · 更新 28 个单元格',
    meta: '含 6 个公式 · 1 张图表 · 2 条洞察',
    action: '写入当前工作表',
    preview: { type: 'excel', cells: updates.cells, chart: updates.chart, rows: updates.rows },
    applied: false,
  };
}

function scenarioFor(doc) {
  const type = doc.type;
  if (type === 'word') {
    if (doc.template === 'weekly') {
      return {
        prompt: '把本周的进展整理成周报，重点补风险、阻塞和下周计划。',
        response: '我读了你上传的《Q4 OKR》和本周的项目记录，按「进展 → 风险 → 下周计划」整理好了。高风险项已收敛成三条，待办都补了负责人和截止时间。引用已编号，应用后可追溯。[1]',
        artifact: buildArtifact(doc),
      };
    }
    if (doc.template === 'minutes') {
      return {
        prompt: '整理成会议纪要，提取结论、待办和责任人。',
        response: '我从会议记录里提取了 3 条结论和 3 项待办，按负责人和依赖关系排好了优先级。需要上升的决策单独标了出来。[1]',
        artifact: buildArtifact(doc),
      };
    }
    return {
      prompt: '结合我上传的《Q4 OKR》和最新的 AI 办公趋势，帮我把这份报告补完，重点写增长策略和产品规划。',
      response: '我先检索了最近的行业信号，也读完了你上传的《Q4 OKR》。你的目标里有两个关键词：文档智能化、团队协作。我按「趋势 → 机会 → 规划」补了一节，保留你现有的结构，引用已编号。[1][2]',
      artifact: buildArtifact(doc),
    };
  }
  if (type === 'ppt') {
    if (doc.template === 'qbr') {
      return {
        prompt: '帮我做一份年度业务复盘，面向管理层，8 页左右，讲清增长、问题和 2027 重点。',
        response: '已按「回顾 → 判断 → 2027 重点」搭好 8 页结构：结论先行，用三条业务线支撑，最后落到资源与风险。引用来自《Q4 OKR》和全年财务数据。[1][2]',
        artifact: buildArtifact(doc),
      };
    }
    return {
      prompt: '帮我做一份 Q4 产品规划 PPT，面向管理层，8 页左右，重点讲三条产品线的增长。',
      response: '已经按管理层视角搭好 8 页结构：结论先行、三条产品线增长、数据支撑，最后落到资源诉求。引用来自《Q4 OKR》和最新行业数据。你可以逐页让我改，比如“第 3 页改成三栏对比”。[1][2]',
      artifact: buildArtifact(doc),
    };
  }
  if (doc.template === 'budget') {
    return {
      prompt: '把年度预算整理成汇总表，补上剩余可用、使用率和部门对比图。',
      response: '已按科目完成聚合，补上剩余预算与使用率，并生成部门对比图。市场推广的使用率高于均值，我在洞察区标了出来。[1]',
      artifact: buildArtifact(doc),
    };
  }
  return {
    prompt: '把这份 Q4 销售明细整理成汇总表，按产品线汇总，补上同比和完成率，再加一个柱状图。',
    response: '已按产品线完成聚合，补充全年合计、同比与目标完成率，并生成 Q1–Q4 对比柱状图。公式保留在单元格里，导出 Excel 后还能继续计算。[1]',
    artifact: buildArtifact(doc),
  };
}

function toolsFor(doc) {
  if (doc.type === 'word') {
    return [
      { kind: 'search', name: '联网搜索', status: 'done', desc: '“2026 AI 办公趋势” · 8 条结果 · 0.9s', sources: [
        { title: '2026 AI 办公趋势报告：从生成到交付', domain: 'research.example.com' },
        { title: 'The document is the new interface', domain: 'work.example.org' },
        { title: 'AI 原生办公的五个产品信号', domain: 'insight.example.cn' },
      ] },
      { kind: 'read', name: '读取资料', status: 'done', desc: 'Q4 OKR.pdf · 12 页 · 提取 6 个关键结果', sources: [] },
      { kind: 'write', name: '生成文档 patch', status: 'done', desc: '新增第 4 节 · 约 1,200 字 · 3 个引用' },
    ];
  }
  if (doc.type === 'ppt') {
    return [
      { kind: 'search', name: '联网搜索', status: 'done', desc: '“AI 办公 产品规划 2026” · 6 条结果 · 0.8s', sources: [
        { title: '2026 AI 办公趋势报告：从生成到交付', domain: 'research.example.com' },
        { title: '管理层汇报的 7 个结构模板', domain: 'slides.example.com' },
      ] },
      { kind: 'read', name: '读取资料', status: 'done', desc: 'Q4 OKR.pdf · 收入目标与三条产品线', sources: [] },
      { kind: 'write', name: '生成幻灯片', status: 'done', desc: '8 页 · 3 张数据图 · 保留当前主题' },
    ];
  }
  return [
    { kind: 'read', name: '读取资料', status: 'done', desc: doc.template === 'budget' ? '年度预算.xlsx · 4 个科目 · 24 行' : 'Q4 销售明细.xlsx · 3 个 Sheet · 428 行', sources: [] },
    { kind: 'compute', name: '执行计算', status: 'done', desc: doc.template === 'budget' ? '聚合 4 个科目 · 生成 8 个公式' : '按产品线聚合 · 生成 6 个公式' },
    { kind: 'write', name: '写入工作表', status: 'done', desc: doc.template === 'budget' ? '更新 24 个单元格 · 1 张图表' : '更新 28 个单元格 · 1 张图表' },
  ];
}

function buildInitialChat(doc) {
  const scenario = scenarioFor(doc);
  const greeting = {
    id: uid('msg'),
    role: 'assistant',
    time: '刚刚',
    text: `你好，我是 Copilot。已读取《${doc.title}》。我可以联网检索、读取你上传的资料，也可以直接修改左侧文档。想从哪开始？`,
    suggestions: doc.type === 'word' ? ['生成完整大纲', '把结论改成表格', '检查引用与数据'] : doc.type === 'ppt' ? ['先给我大纲', '把第 3 页改成三栏', '补一页风险与应对'] : ['按季度汇总', '加一个同比列', '生成一张图表'],
  };
  const user = { id: uid('msg'), role: 'user', time: '刚刚', text: scenario.prompt };
  const assistant = {
    id: uid('msg'),
    role: 'assistant',
    time: '刚刚',
    text: scenario.response,
    tools: toolsFor(doc).filter((tool) => state.webEnabled || tool.kind !== 'search'),
    artifact: scenario.artifact,
    suggestions: doc.type === 'ppt' ? ['把第 3 页改成三栏', '补一页风险与应对'] : doc.type === 'word' ? ['扩写这一段', '把结论改成表格'] : ['加一个同比列', '生成一张图表'],
  };
  return [greeting, user, assistant];
}

/* --------------------------------------------------------------------------
   Home rendering
   -------------------------------------------------------------------------- */

function docThumb(doc) {
  if (doc.type === 'word') {
    return `<div class="thumb-page"><i class="lg"></i><i></i><i class="sm"></i><i class="accent"></i><i></i><i class="sm"></i><i></i><i class="accent"></i><i class="sm"></i></div>`;
  }
  if (doc.type === 'ppt') {
    return `<div class="thumb-slide"><i class="w"></i><i></i><i style="width:40%"></i><div class="bars"><b style="height:38%"></b><b style="height:58%"></b><b style="height:76%"></b><b style="height:96%"></b></div></div>`;
  }
  return `<div class="thumb-sheet">${Array.from({ length: 20 }, (_, i) => `<span class="${i < 4 ? 'head' : i === 9 || i === 14 ? 'hot' : ''}"></span>`).join('')}</div>`;
}

function docCard(doc) {
  const type = TYPES[doc.type];
  return `<div class="doc-card" role="button" tabindex="0" data-open-doc="${doc.id}" aria-label="打开 ${esc(doc.title)}">
    <div class="doc-thumb ${doc.type}">
      ${docThumb(doc)}
      <span class="doc-type-pill ${doc.type}">${icon(type.icon)}${type.label}</span>
    </div>
    <div class="doc-card-body">
      <div class="doc-card-title">${esc(doc.title)}</div>
      <div class="doc-card-meta"><span>${esc(doc.updated)}</span><span class="dot"></span><span>${type.short}</span></div>
      <div class="doc-card-foot">
        <div class="doc-card-people"><span>Z</span><span>L</span><span>+2</span></div>
        <button class="doc-card-star ${doc.starred ? 'on' : ''}" data-star="${doc.id}" title="收藏" aria-label="收藏">${icon('i-star')}</button>
      </div>
    </div>
  </div>`;
}

function templatePreview(tpl) {
  if (tpl.type === 'word') return `<div class="mini-doc"><i class="h"></i><i></i><i class="short"></i><i></i><i></i><i class="short"></i></div>`;
  if (tpl.type === 'ppt') return `<div class="mini-deck"><i class="h"></i><i></i><i style="width:46%"></i><div class="cols"><b></b><b></b><b></b></div></div>`;
  return `<div class="mini-grid">${Array.from({ length: 20 }, (_, i) => `<span class="${i < 4 ? 'head' : i === 9 || i === 13 ? 'hot' : ''}"></span>`).join('')}</div>`;
}

function templateCard(tpl, compact = false) {
  const type = TYPES[tpl.type];
  return `<button class="tpl-card" data-use-template="${tpl.id}" aria-label="使用模板 ${esc(tpl.name)}">
    <div class="tpl-preview ${tpl.type}">${templatePreview(tpl)}</div>
    <div class="tpl-card-body">
      <strong>${esc(tpl.name)}</strong>
      <span>${esc(tpl.desc)}</span>
      <div class="tpl-card-foot"><span class="tpl-type-tag ${tpl.type}">${type.short}</span><span class="tpl-use">使用模板 ${icon('i-arrow-right')}</span></div>
    </div>
  </button>`;
}

function countByType(items) {
  return items.reduce((counts, item) => {
    counts[item.type] = (counts[item.type] || 0) + 1;
    return counts;
  }, {});
}

function typeBreakdown(counts) {
  return Object.keys(TYPES).map((type) => `${TYPES[type].short} ${counts[type] || 0}`).join(' · ');
}

function typeBar(counts) {
  const segments = Object.keys(TYPES)
    .filter((type) => counts[type])
    .map((type) => `<i style="flex:${counts[type]};background:var(--${type})"></i>`)
    .join('');
  if (!segments) return '';
  return `<span class="stat-bar" role="img" aria-label="${esc(typeBreakdown(counts))}">${segments}</span>`;
}

function statCard({ tone, iconName, label, value, unit, meta, bar = '' }) {
  return `<div class="stat-card">
    <div class="stat-head"><span class="stat-icon ${tone}">${icon(iconName)}</span>${esc(label)}</div>
    <div class="stat-value">${esc(value)}<small>${esc(unit)}</small></div>
    ${bar}
    <div class="stat-meta">${esc(meta)}</div>
  </div>`;
}

function renderHomeStats() {
  const docCounts = countByType(DOCS);
  const tplCounts = countByType(TEMPLATES);
  const citations = MATERIALS.reduce((sum, mat) => sum + mat.citations, 0);
  const storagePct = Math.round((STORAGE.used / STORAGE.total) * 100);
  const cards = [
    { tone: 'blue', iconName: 'i-file', label: '文档总数', value: DOCS.length, unit: '份', meta: typeBreakdown(docCounts), bar: typeBar(docCounts) },
    { tone: 'orange', iconName: 'i-template', label: '模板库', value: TEMPLATES.length, unit: '套', meta: typeBreakdown(tplCounts), bar: typeBar(tplCounts) },
    { tone: 'green', iconName: 'i-link', label: '资料引用', value: citations, unit: '次', meta: `来自 ${MATERIALS.length} 份资料` },
    { tone: 'purple', iconName: 'i-chart', label: '存储空间', value: STORAGE.used, unit: 'GB', meta: `共 ${STORAGE.total} GB · 已用 ${storagePct}%`, bar: `<span class="stat-bar" role="img" aria-label="已用 ${storagePct}%"><i style="width:${storagePct}%"></i></span>` },
  ];
  $('#home-stats').innerHTML = cards.map(statCard).join('');
}

function renderRecentDocs() {
  $('#recent-docs').innerHTML = DOCS.slice(0, 4).map(docCard).join('');
  $('#nav-doc-count').textContent = String(DOCS.length);
  renderHomeStats();
}

function renderHomeTemplates() {
  $('#home-templates').innerHTML = TEMPLATES.filter((tpl) => ['report', 'roadmap', 'sales', 'qbr'].includes(tpl.id)).map((tpl) => templateCard(tpl)).join('');
}

function renderAllDocs() {
  const filter = state.docFilter;
  const query = state.docSearch.trim().toLowerCase();
  const docs = DOCS.filter((doc) => (filter === 'all' || doc.type === filter) && (!query || doc.title.toLowerCase().includes(query)));
  $('#all-docs').innerHTML = docs.map(docCard).join('');
  $('#docs-empty').hidden = docs.length !== 0;
  $('#page-docs .page-sub').textContent = `${DOCS.length} 份文档 · 最近编辑优先`;
}

function renderTemplateGrid() {
  const filter = state.tplFilter;
  const templates = TEMPLATES.filter((tpl) => filter === 'all' || tpl.type === filter);
  $('#template-grid').innerHTML = templates.map((tpl) => templateCard(tpl)).join('');
}

function renderMaterials() {
  $('#material-list').innerHTML = MATERIALS.map((mat) => `<div class="material-row">
    <div class="material-name">
      <span class="material-file-icon">${icon('i-file')}</span>
      <div><strong>${esc(mat.name)}</strong><small>${esc(mat.detail)}</small></div>
    </div>
    <span>${esc(mat.type)}</span>
    <span>${esc(mat.size)}</span>
    <span>${mat.citations} 次</span>
    <span><span class="status-pill">已就绪</span></span>
  </div>`).join('');
  renderHomeStats();
}

/* --------------------------------------------------------------------------
   Navigation
   -------------------------------------------------------------------------- */

function setHash(hash) {
  try {
    history.replaceState(null, '', `#/${hash}`);
  } catch (error) {
    /* file:// may restrict history; hash assignment is a harmless fallback */
    location.hash = `#/${hash}`;
  }
}

function showView(view) {
  const isWorkbench = view === 'workbench';
  $('#app-header').hidden = isWorkbench;
  $('#wb-header').hidden = !isWorkbench;
  $('#view-home').hidden = isWorkbench;
  $('#view-workbench').hidden = !isWorkbench;
  document.body.classList.remove('preview-word', 'preview-excel');
  $('#preview-exit').hidden = true;
}

function showHomePage(page, updateHash = true) {
  state.currentPage = page;
  document.body.dataset.theme = 'azure';
  showView('home');
  $$('.home-page').forEach((el) => { el.hidden = el.id !== `page-${page}`; });
  $$('.nav-item[data-page]').forEach((item) => item.classList.toggle('active', item.dataset.page === page));
  if (page === 'docs') renderAllDocs();
  if (page === 'templates') renderTemplateGrid();
  if (page === 'materials') renderMaterials();
  if (page === 'overview') renderRecentDocs();
  $('.home-content').scrollTop = 0;
  document.title = 'Office Copilot · 文档工作台原型';
  if (updateHash) setHash(page === 'overview' ? 'home' : page);
}

function openDocById(id) {
  const doc = DOCS.find((item) => item.id === id);
  if (!doc) return;
  openWorkbench(doc);
}

function openWorkbench(doc, updateHash = true) {
  cancelStream();
  ensureDoc(doc);
  state.currentDoc = doc;
  state.selectionText = '';
  document.body.dataset.theme = doc.theme;
  $('#doc-title').value = doc.title;
  $('#doc-type-label').textContent = TYPES[doc.type].label;
  renderToolbar();
  renderCanvas();
  renderStatus();
  renderCopilot();
  updateContext();
  showView('workbench');
  document.title = `${doc.title} · Office Copilot`;
  if (updateHash) setHash(`doc/${doc.type}`);
  requestAnimationFrame(() => {
    scrollChat(true);
    const input = $('#copilot-input');
    if (input) autoGrow(input);
  });
}

function ensureDoc(doc) {
  if (doc.type === 'word' && !doc.html) doc.html = wordContent(doc);
  if (doc.type === 'ppt' && !doc.slides) doc.slides = buildDeck(doc);
  if (doc.type === 'excel' && !doc.sheet) doc.sheet = excelSheet(doc);
  if (doc.type === 'ppt' && doc.activeSlide === undefined) doc.activeSlide = doc.template === 'blank' ? 0 : 2;
  if (doc.type === 'excel' && !doc.selectedCell) doc.selectedCell = 'A1';
  doc.undoStack = doc.undoStack || [];
  doc.redoStack = doc.redoStack || [];
}

/* --------------------------------------------------------------------------
   Workbench rendering
   -------------------------------------------------------------------------- */

function tbGroup(html) {
  return `<div class="tb-group">${html}</div>`;
}

function tbBtn(cmd, inner, title, extra = '') {
  return `<button class="tb-btn ${extra}" data-cmd="${cmd}" title="${esc(title)}" aria-label="${esc(title)}">${inner}</button>`;
}

function renderToolbar() {
  const doc = state.currentDoc;
  const bar = $('#editor-toolbar');
  const undoRedo = `${tbBtn('undo', icon('i-undo'), '撤销')}${tbBtn('redo', icon('i-redo'), '重做')}`;
  const themeBtn = tbBtn('theme', `${icon('i-sparkles')}<span>主题</span>`, '切换主题', 'accent');
  if (doc.type === 'word') {
    bar.innerHTML = `
      ${tbGroup(undoRedo)}
      <div class="tb-divider"></div>
      <select class="tb-select" data-tb="style" title="段落样式">
        <option value="p">正文</option><option value="h1">标题 1</option><option value="h2">标题 2</option><option value="h3">标题 3</option>
      </select>
      <select class="tb-select" data-tb="size" title="字号">
        <option value="3">12</option><option value="4" selected>14</option><option value="5">16</option><option value="6">18</option><option value="7">24</option>
      </select>
      <div class="tb-divider"></div>
      ${tbGroup(
        tbBtn('bold', '<span class="txt-b">B</span>', '加粗') +
        tbBtn('italic', '<span class="txt-i">I</span>', '斜体') +
        tbBtn('underline', '<span class="txt-u">U</span>', '下划线') +
        tbBtn('strike', '<span style="text-decoration:line-through;font-weight:600">S</span>', '删除线')
      )}
      <div class="tb-divider"></div>
      ${tbGroup(
        tbBtn('ul', icon('i-list'), '无序列表') +
        tbBtn('align-left', '<span style="font-size:15px">≡</span>', '左对齐') +
        tbBtn('align-center', '<span style="font-size:15px">☰</span>', '居中') +
        tbBtn('link', icon('i-link'), '插入链接') +
        tbBtn('table', icon('i-table'), '插入表格') +
        tbBtn('image', icon('i-image'), '插入图片')
      )}
      <div class="tb-spacer"></div>
      ${themeBtn}
      ${tbBtn('preview', `${icon('i-eye')}<span>预览</span>`, '阅读视图', 'preview-btn')}
    `;
  } else if (doc.type === 'ppt') {
    bar.innerHTML = `
      ${tbGroup(undoRedo)}
      <div class="tb-divider"></div>
      ${tbBtn('layout', `${icon('i-layout')}<span>版式</span>`, '切换版式')}
      ${tbBtn('text', `${icon('i-type')}<span>文本</span>`, '插入文本')}
      ${tbBtn('image', icon('i-image'), '插入图片')}
      ${tbBtn('shape', '<span style="width:13px;height:13px;border:1.8px solid currentColor;border-radius:3px;display:inline-block"></span>', '插入形状')}
      ${tbBtn('table', icon('i-table'), '插入表格')}
      <div class="tb-spacer"></div>
      ${themeBtn}
      ${tbBtn('present', `${icon('i-play')}<span>放映</span>`, '从头放映', 'preview-btn')}
    `;
  } else {
    bar.innerHTML = `
      ${tbGroup(undoRedo)}
      <div class="tb-divider"></div>
      ${tbBtn('bold', '<span class="txt-b">B</span>', '加粗')}
      ${tbBtn('italic', '<span class="txt-i">I</span>', '斜体')}
      ${tbBtn('fill', '<span style="width:14px;height:14px;border-radius:3px;background:#fde68a;display:inline-block"></span>', '填充颜色')}
      ${tbBtn('border', '<span style="width:14px;height:14px;border:1.8px solid currentColor;display:inline-block"></span>', '边框')}
      <div class="tb-divider"></div>
      ${tbBtn('currency', '<span style="font-size:13px">¥</span>', '货币格式')}
      ${tbBtn('percent', '<span style="font-size:13px">%</span>', '百分比格式')}
      ${tbBtn('fx', icon('i-fx'), '插入函数')}
      ${tbBtn('chart', icon('i-chart'), '插入图表')}
      <div class="tb-spacer"></div>
      ${themeBtn}
      ${tbBtn('preview', `${icon('i-eye')}<span>预览</span>`, '只读预览', 'preview-btn')}
    `;
  }
}

function renderCanvas() {
  const doc = state.currentDoc;
  $('#canvas-word').hidden = doc.type !== 'word';
  $('#canvas-ppt').hidden = doc.type !== 'ppt';
  $('#canvas-excel').hidden = doc.type !== 'excel';
  if (doc.type === 'word') renderWord();
  if (doc.type === 'ppt') renderPpt();
  if (doc.type === 'excel') renderExcel();
}

function renderWord() {
  const doc = state.currentDoc;
  $('#canvas-word').innerHTML = `<div class="word-stage"><article class="word-page" id="word-page" contenteditable="true" spellcheck="false">${doc.html}</article></div>`;
  const page = $('#word-page');
  page.addEventListener('input', () => {
    doc.html = page.innerHTML;
    renderStatus();
    scheduleSave();
  });
}

function renderPpt() {
  const doc = state.currentDoc;
  doc.activeSlide = clamp(doc.activeSlide || 0, 0, doc.slides.length - 1);
  const slide = doc.slides[doc.activeSlide];
  $('#canvas-ppt').innerHTML = `<div class="ppt-stage">
    <div class="ppt-thumbs">${doc.slides.map((item, index) => thumbHTML(item, index, index === doc.activeSlide)).join('')}</div>
    <div class="ppt-main">
      <div class="ppt-slide-wrap">${slideHTML(slide, doc.activeSlide, doc)}</div>
      <div class="ppt-notes"><span class="notes-label">备注</span><span>${esc(slide.notes || '暂无备注')}</span></div>
    </div>
  </div>`;
  const pane = $('#canvas-ppt');
  pane.onclick = (event) => {
    const thumb = event.target.closest('[data-slide-index]');
    if (thumb) {
      doc.activeSlide = Number(thumb.dataset.slideIndex);
      renderPpt();
      renderStatus();
    }
  };
  pane.oninput = (event) => {
    const field = event.target.closest('[data-field]');
    if (!field) return;
    setPath(slide, field.dataset.field, field.textContent.trim());
    scheduleSave();
  };
}

function renderExcel() {
  const doc = state.currentDoc;
  const sheet = doc.sheet;
  const selected = doc.selectedCell || 'A1';
  const chart = sheet.chart;
  const max = Math.max(1, ...chart.series.flatMap((series) => series.values));
  const colgroup = `<colgroup>${COLS.map(() => '<col>').join('')}</colgroup>`;
  let header = '<thead><tr><th></th>';
  COLS.forEach((col) => { header += `<th>${col}</th>`; });
  header += '</tr></thead>';
  let body = '';
  for (let row = 1; row <= EXCEL_ROWS; row += 1) {
    body += `<tr><th>${row}</th>`;
    COLS.forEach((col) => {
      const ref = `${col}${row}`;
      const cell = sheet.cells[ref] || {};
      const classes = [
        cell.header ? 'header' : '',
        cell.num ? 'num' : '',
        cell.pct ? 'pct' : '',
        cell.total ? 'total' : '',
        cell.note ? 'note' : '',
        cell.bold ? 'bold' : '',
        cell.changed ? 'changed' : '',
        ref === selected ? 'selected' : '',
      ].filter(Boolean).join(' ');
      const value = cell.v === undefined || cell.v === null ? '' : cell.v;
      const display = typeof value === 'number' ? value.toLocaleString('en-US') : value;
      body += `<td class="${classes}" data-cell="${ref}" contenteditable="true" spellcheck="false" title="${esc(cell.f || display)}">${esc(display)}</td>`;
    });
    body += '</tr>';
  }
  const chartHTML = chart ? `<div class="excel-chart" aria-label="图表">
    <div class="chart-title">${esc(chart.title)}<span>柱状图</span></div>
    <div class="ech-bars">
      ${chart.labels.map((label, index) => `<div class="ech-group">${chart.series.map((series, sIndex) => `<b class="b${sIndex + 1}" style="height:${Math.max(8, Math.round((series.values[index] / max) * 100))}%"></b>`).join('')}</div>`).join('')}
    </div>
    <div class="ech-labels">${chart.labels.map((label) => `<span>${esc(label)}</span>`).join('')}</div>
    <div class="ech-legend">${chart.series.map((series, index) => `<span><i class="b${index + 1}"></i>${esc(series.name)}</span>`).join('')}</div>
  </div>` : '';
  $('#canvas-excel').innerHTML = `<div class="excel-stage">
    <div class="excel-formula"><span class="cell-ref" id="cell-ref">${selected}</span><span class="fx">fx</span><div class="formula-value" id="formula-value">${esc(cellFormula(sheet, selected))}</div></div>
    <div class="excel-grid-wrap">
      <table class="excel-grid">${colgroup}${header}<tbody>${body}</tbody></table>
      ${chartHTML}
    </div>
    <div class="excel-tabs">
      <button class="sheet-tab active">${esc(sheet.name)}</button>
      <button class="sheet-tab" data-sheet="明细">明细</button>
      <button class="sheet-tab" data-sheet="目标">目标</button>
      <button class="add-sheet" title="新增 Sheet">${icon('i-plus')}</button>
      <span class="excel-status" id="excel-status">就绪</span>
    </div>
  </div>`;
  const pane = $('#canvas-excel');
  pane.onclick = (event) => {
    const cell = event.target.closest('td[data-cell]');
    if (cell) selectExcelCell(cell.dataset.cell);
    const tab = event.target.closest('[data-sheet]');
    if (tab) toast(`切换到「${tab.dataset.sheet}」Sheet（原型演示）`, 'warn');
  };
  pane.onfocusin = (event) => {
    const cell = event.target.closest('td[data-cell]');
    if (cell) selectExcelCell(cell.dataset.cell);
  };
  pane.oninput = (event) => {
    const cell = event.target.closest('td[data-cell]');
    if (!cell) return;
    const ref = cell.dataset.cell;
    const raw = cell.textContent.trim();
    const current = sheet.cells[ref] || {};
    const numeric = /^-?\d+(\.\d+)?$/.test(raw.replace(/,/g, ''));
    sheet.cells[ref] = { ...current, v: numeric ? Number(raw.replace(/,/g, '')) : raw, num: numeric || current.num, f: undefined };
    $('#formula-value').textContent = raw;
    scheduleSave();
  };
}

function cellFormula(sheet, ref) {
  const cell = sheet.cells[ref];
  if (!cell) return '';
  if (cell.f) return cell.f;
  if (typeof cell.v === 'number') return cell.v.toLocaleString('en-US');
  return cell.v || '';
}

function selectExcelCell(ref) {
  const doc = state.currentDoc;
  doc.selectedCell = ref;
  $$('#canvas-excel td.selected').forEach((td) => td.classList.remove('selected'));
  const td = $(`#canvas-excel td[data-cell="${ref}"]`);
  if (td) {
    td.classList.add('selected');
    $('#cell-ref').textContent = ref;
    const formula = cellFormula(doc.sheet, ref);
    $('#formula-value').textContent = formula;
    const status = $('#excel-status');
    if (status) status.textContent = `已选择 ${ref}`;
  }
  renderStatus();
}

function renderStatus() {
  const doc = state.currentDoc;
  if (!doc) return;
  const bar = $('#editor-status');
  const right = `<span class="right"><span class="status-live">Copilot 已读取</span><span>100%</span></span>`;
  if (doc.type === 'word') {
    const text = $('#word-page')?.innerText || '';
    const count = text.replace(/\s+/g, '').length;
    bar.innerHTML = `<span>字数 ${count.toLocaleString('en-US')}</span><span>第 1 / 3 页</span>${right}`;
  } else if (doc.type === 'ppt') {
    bar.innerHTML = `<span>第 ${doc.activeSlide + 1} / ${doc.slides.length} 页</span><span>16:9</span><span>主题：${themeOf(doc).name}</span>${right}`;
  } else {
    const sheet = doc.sheet;
    const count = Object.keys(sheet.cells).length;
    bar.innerHTML = `<span>${count} 个单元格</span><span>已选择 ${doc.selectedCell}</span><span>${sheet.name}</span>${right}`;
  }
}

/* --------------------------------------------------------------------------
   Copilot rendering
   -------------------------------------------------------------------------- */

function renderCopilot() {
  const doc = state.currentDoc;
  if (!doc) return;
  const chat = getChat(doc);
  $('#copilot-messages').innerHTML = chat.map(messageHTML).join('');
  scrollChat(true);
  updateSendButton();
  updateContext();
  updateComposerChips();
}

function messageHTML(msg) {
  const isUser = msg.role === 'user';
  const tools = msg.tools && msg.tools.length ? toolsHTML(msg.tools) : '';
  const artifact = msg.artifact ? artifactHTML(msg) : '';
  const suggestions = msg.suggestions && msg.suggestions.length ? `<div class="copilot-suggestions">${msg.suggestions.map((text) => `<button class="suggest-btn" data-suggest="${esc(text)}">${esc(text)}</button>`).join('')}</div>` : '';
  return `<div class="msg ${isUser ? 'user' : 'assistant'}" data-msg-id="${msg.id}">
    <div class="msg-head">
      <span class="msg-avatar ${isUser ? 'user' : 'ai'}">${isUser ? 'Z' : icon('i-sparkles')}</span>
      <span class="msg-name">${isUser ? '你' : 'Copilot'}</span>
      <span class="msg-time">${esc(msg.time || '刚刚')}</span>
      ${isUser ? '' : `<span class="msg-actions"><button class="icon-btn" data-copy-msg="${msg.id}" title="复制">${icon('i-copy')}</button><button class="icon-btn" data-regen-msg="${msg.id}" title="重新生成">${icon('i-refresh')}</button></span>`}
    </div>
    ${tools}
    <div class="msg-body" data-msg-body>${formatText(msg.text)}${msg.streaming ? '<span class="stream-caret"></span>' : ''}</div>
    ${artifact}
    ${suggestions}
  </div>`;
}

function toolsHTML(tools) {
  return `<div class="tool-calls">${tools.map((tool) => {
    const statusText = tool.status === 'running' ? '进行中' : tool.status === 'error' ? '失败' : '完成';
    const ico = tool.kind === 'search' ? 'i-globe' : tool.kind === 'read' ? 'i-file' : tool.kind === 'write' ? 'i-sparkles' : 'i-fx';
    const sources = tool.sources && tool.sources.length ? `<div class="tool-sources">${tool.sources.map((source, index) => `<div class="source-item"><span class="src-index">${index + 1}</span><div><a href="#" onclick="return false">${esc(source.title)}</a> <span class="src-domain">· ${esc(source.domain)}</span></div></div>`).join('')}</div>` : '';
    return `<div class="tool-call ${tool.open ? 'open' : ''}">
      <div class="tool-call-head" data-tool-toggle>
        <span class="tool-ico">${icon(ico)}</span>
        <div class="tool-main">
          <div class="tool-name">${esc(tool.name)}<span class="tool-status ${tool.status === 'running' ? 'running' : tool.status === 'error' ? 'error' : ''}">${statusText}</span></div>
          <div class="tool-desc">${esc(tool.desc)}</div>
        </div>
        ${sources ? `<span class="tool-caret">${icon('i-chevron-down')}</span>` : ''}
      </div>
      ${sources}
    </div>`;
  }).join('')}</div>`;
}

function artifactHTML(msg) {
  const artifact = msg.artifact;
  const kind = artifact.kind;
  const typeIcon = kind === 'word' ? 'i-word' : kind === 'ppt' ? 'i-ppt' : 'i-excel';
  const ext = TYPES[kind].ext;
  const preview = artifact.preview;
  let previewHTML = '';
  if (kind === 'ppt') {
    previewHTML = `<div class="artifact-preview">${(preview.slides || []).slice(0, 3).map((slide) => `<div class="ap-slide" style="background:${slide.layout === 'cover' || slide.layout === 'end' ? '' : '#f7f9fc'}"></div>`).join('')}</div>`;
  } else if (kind === 'word') {
    previewHTML = `<div class="artifact-preview word-preview"><div class="ap-line lg"></div><div class="ap-line"></div><div class="ap-line short"></div><div class="ap-line"></div></div>`;
  } else {
    previewHTML = `<div class="artifact-preview sheet-preview">${Array.from({ length: 12 }, (_, i) => `<span class="${i < 4 ? 'head' : i === 6 || i === 9 ? 'hot' : ''}"></span>`).join('')}</div>`;
  }
  const actions = artifact.applied
    ? `<button class="btn btn-preview" data-artifact-action="preview" data-msg-id="${msg.id}">${icon('i-eye')}查看</button>
       <span class="applied-pill">${icon('i-check')}已应用</span>
       <button class="undo-link" data-artifact-action="undo" data-msg-id="${msg.id}">${icon('i-undo')}撤销</button>`
    : `<button class="btn btn-preview" data-artifact-action="preview" data-msg-id="${msg.id}">${icon('i-eye')}预览</button>
       <button class="btn btn-apply" data-artifact-action="apply" data-msg-id="${msg.id}">${icon('i-sparkles')}应用到文档</button>
       <button class="icon-btn" data-artifact-action="regen" data-msg-id="${msg.id}" title="重新生成">${icon('i-refresh')}</button>`;
  return `<div class="artifact-card">
    <div class="artifact-head">
      <span class="artifact-icon">${icon(typeIcon)}</span>
      <div>
        <div class="artifact-title">${esc(artifact.title)}</div>
        <div class="artifact-meta">${esc(artifact.meta)} · ${ext}</div>
      </div>
    </div>
    ${previewHTML}
    <div class="artifact-actions">${actions}</div>
  </div>`;
}

function updateContext() {
  const doc = state.currentDoc;
  if (!doc) return;
  const attached = getAttached(doc);
  const selection = state.selectionText;
  $('#copilot-context').innerHTML = `
    <button class="ctx-chip accent" data-ctx="doc" title="Copilot 已读取当前文档">${icon('i-file')}当前文档</button>
    ${selection ? `<button class="ctx-chip" data-ctx="selection" title="已选中的内容">${icon('i-cursor')}选中 ${esc(selection.slice(0, 9))}${selection.length > 9 ? '…' : ''}</button>` : ''}
    <button class="ctx-chip" data-ctx="materials" title="查看资料">${icon('i-folder')}资料 ${attached.size}</button>
    <span class="ctx-web ${state.webEnabled ? '' : 'off'}">${state.webEnabled ? '联网已开启' : '联网已关闭'}</span>
  `;
}

function updateComposerChips() {
  const doc = state.currentDoc;
  if (!doc) return;
  const attached = getAttached(doc);
  const chips = $('#composer-chips');
  if (!attached.size) {
    chips.innerHTML = '';
    return;
  }
  const names = [...attached].map((id) => MATERIALS.find((mat) => mat.id === id)?.name).filter(Boolean);
  chips.innerHTML = `<span class="composer-chip">${icon('i-paperclip')}${esc(names.slice(0, 2).join('、'))}${names.length > 2 ? ` 等 ${names.length} 份` : ''}<button data-remove-material="all" title="移除资料">${icon('i-close')}</button></span>`;
}

function updateSendButton() {
  const btn = $('#btn-send');
  if (!btn) return;
  if (state.streaming) {
    btn.classList.add('stop');
    btn.disabled = false;
    btn.innerHTML = icon('i-stop');
    btn.title = '停止生成';
  } else {
    btn.classList.remove('stop');
    btn.disabled = !$('#copilot-input')?.value.trim();
    btn.innerHTML = icon('i-send');
    btn.title = '发送 (⌘↵)';
  }
}

function scrollChat(force = false) {
  const box = $('#copilot-messages');
  if (!box) return;
  if (force || box.scrollHeight - box.scrollTop - box.clientHeight < 160) {
    box.scrollTop = box.scrollHeight;
  }
}

function scheduleSave() {
  const el = $('#save-state');
  if (!el) return;
  el.classList.add('saving');
  el.innerHTML = `${icon('i-refresh')}<span>保存中…</span>`;
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => {
    el.classList.remove('saving');
    el.innerHTML = `${icon('i-check')}<span>已保存</span>`;
  }, 900);
}

/* --------------------------------------------------------------------------
   Copilot interaction
   -------------------------------------------------------------------------- */

function autoGrow(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = `${Math.min(textarea.scrollHeight, 132)}px`;
}

function sendMessage(text) {
  const doc = state.currentDoc;
  const value = (text || '').trim();
  if (!doc || !value) return;
  if (state.streaming) {
    stopStreaming();
    return;
  }
  const chat = getChat(doc);
  const userMsg = { id: uid('msg'), role: 'user', text: value, time: '刚刚' };
  const assistant = { id: uid('msg'), role: 'assistant', text: '', time: '刚刚', tools: [], artifact: null, streaming: true };
  chat.push(userMsg, assistant);
  $('#copilot-input').value = '';
  autoGrow($('#copilot-input'));
  state.streaming = true;
  updateSendButton();
  renderCopilot();
  const token = ++state.streamToken;
  simulateResponse(doc, assistant, token);
}

async function simulateResponse(doc, msg, token) {
  const scenario = scenarioFor(doc);
  const tools = (state.webEnabled ? toolsFor(doc) : toolsFor(doc).filter((tool) => tool.kind !== 'search')).map((tool) => ({ ...tool, status: 'running', open: false }));
  msg.tools = tools;
  renderCopilot();
  await sleep(350);
  for (let i = 0; i < tools.length; i += 1) {
    if (token !== state.streamToken) return;
    tools[i].status = 'running';
    renderCopilot();
    await sleep(520 + i * 160);
    if (token !== state.streamToken) return;
    tools[i].status = 'done';
    renderCopilot();
  }
  await sleep(260);
  if (token !== state.streamToken) return;
  const full = state.webEnabled ? scenario.response : `（未联网）${scenario.response}`;
  msg.streaming = true;
  for (let i = 2; i <= full.length; i += 2) {
    if (token !== state.streamToken) return;
    msg.text = full.slice(0, i);
    const body = document.querySelector(`[data-msg-id="${msg.id}"] [data-msg-body]`);
    if (body) body.innerHTML = formatText(msg.text) + '<span class="stream-caret"></span>';
    scrollChat();
    await sleep(12);
  }
  if (token !== state.streamToken) return;
  msg.text = full;
  msg.streaming = false;
  msg.artifact = buildArtifact(doc);
  msg.tools = tools;
  msg.suggestions = doc.type === 'ppt' ? ['把第 3 页改成三栏', '补一页风险与应对'] : doc.type === 'word' ? ['扩写这一段', '把结论改成表格'] : ['加一个同比列', '生成一张图表'];
  state.streaming = false;
  renderCopilot();
  scrollChat(true);
}

function stopStreaming() {
  state.streamToken += 1;
  state.streaming = false;
  const doc = state.currentDoc;
  if (doc) {
    const chat = getChat(doc);
    const streaming = chat.find((msg) => msg.streaming);
    if (streaming) {
      streaming.streaming = false;
      if (!streaming.text) streaming.text = '已停止生成。';
    }
  }
  renderCopilot();
  toast('已停止生成', 'warn');
}

function cancelStream() {
  state.streamToken += 1;
  state.streaming = false;
  if (state.currentDoc) {
    const chat = state.chats[state.currentDoc.id] || [];
    chat.forEach((msg) => { msg.streaming = false; });
  }
}

function regenMessage(msgId) {
  const doc = state.currentDoc;
  if (!doc || state.streaming) return;
  const chat = getChat(doc);
  const index = chat.findIndex((msg) => msg.id === msgId);
  if (index < 0) return;
  const userMessage = [...chat].slice(0, index).reverse().find((msg) => msg.role === 'user');
  if (!userMessage) return;
  chat.splice(index);
  const assistant = { id: uid('msg'), role: 'assistant', text: '', time: '刚刚', tools: [], artifact: null, streaming: true };
  chat.push(assistant);
  state.streaming = true;
  renderCopilot();
  simulateResponse(doc, assistant, ++state.streamToken);
}

/* --------------------------------------------------------------------------
   Artifacts: apply / undo
   -------------------------------------------------------------------------- */

function syncCurrentEdit() {
  const doc = state.currentDoc;
  if (!doc) return;
  if (doc.type === 'word') {
    const page = $('#word-page');
    if (page) doc.html = page.innerHTML;
  }
}

function snapshot(doc) {
  if (doc.type === 'word') return { html: doc.html };
  if (doc.type === 'ppt') return { slides: clone(doc.slides) };
  return { sheet: clone(doc.sheet) };
}

function restoreSnapshot(doc, snap) {
  if (doc.type === 'word') doc.html = snap.html;
  if (doc.type === 'ppt') doc.slides = clone(snap.slides);
  if (doc.type === 'excel') doc.sheet = clone(snap.sheet);
}

function applyArtifact(msgId) {
  const doc = state.currentDoc;
  if (!doc) return;
  syncCurrentEdit();
  const chat = getChat(doc);
  const msg = chat.find((item) => item.id === msgId);
  if (!msg || !msg.artifact || msg.artifact.applied) return;
  const artifact = msg.artifact;
  doc.undoStack.push({ snap: snapshot(doc), msgId });
  doc.redoStack = [];
  if (doc.type === 'word') {
    const section = artifact.preview.html;
    const footerIndex = doc.html.lastIndexOf('<div class="doc-footer"');
    doc.html = footerIndex >= 0 ? `${doc.html.slice(0, footerIndex)}${section}${doc.html.slice(footerIndex)}` : `${doc.html}${section}`;
    renderWord();
    requestAnimationFrame(() => {
      const added = $('#word-added');
      if (added) added.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  } else if (doc.type === 'ppt') {
    doc.slides = clone(artifact.preview.slides);
    doc.activeSlide = 0;
    renderPpt();
  } else {
    Object.assign(doc.sheet.cells, artifact.preview.cells);
    doc.sheet.chart = clone(artifact.preview.chart);
    renderExcel();
  }
  artifact.applied = true;
  doc.lastArtifactMsgId = msgId;
  renderCopilot();
  renderStatus();
  scheduleSave();
  toast('已应用 Copilot 修改 · 可撤销');
}

function undoArtifact() {
  const doc = state.currentDoc;
  if (!doc || !doc.undoStack.length) {
    toast('没有可撤销的 AI 修改', 'warn');
    return;
  }
  const entry = doc.undoStack.pop();
  doc.redoStack.push({ snap: snapshot(doc), msgId: entry.msgId });
  restoreSnapshot(doc, entry.snap);
  const msg = getChat(doc).find((item) => item.id === entry.msgId);
  if (msg && msg.artifact) msg.artifact.applied = false;
  renderCanvas();
  renderCopilot();
  renderStatus();
  scheduleSave();
  toast('已撤销 Copilot 修改');
}

function redoArtifact() {
  const doc = state.currentDoc;
  if (!doc || !doc.redoStack.length) return;
  const entry = doc.redoStack.pop();
  doc.undoStack.push({ snap: snapshot(doc), msgId: entry.msgId });
  restoreSnapshot(doc, entry.snap);
  const msg = getChat(doc).find((item) => item.id === entry.msgId);
  if (msg && msg.artifact) msg.artifact.applied = true;
  renderCanvas();
  renderCopilot();
  renderStatus();
  scheduleSave();
  toast('已重做 Copilot 修改');
}

/* --------------------------------------------------------------------------
   Modals — generic
   -------------------------------------------------------------------------- */

function openModal(html, size = '') {
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-backdrop" data-backdrop><div class="modal ${size}">${html}</div></div>`;
}

function closeModal() {
  $('#modal-root').innerHTML = '';
  clearTimeout(state.exportTimer);
}

/* --------------------------------------------------------------------------
   New document modal
   -------------------------------------------------------------------------- */

function openNewDoc(type = 'word', templateId = null) {
  const templates = TEMPLATES.filter((tpl) => tpl.type === type);
  const preselected = templates.find((tpl) => tpl.id === templateId);
  state.newDoc = {
    type,
    template: preselected ? preselected.id : 'blank',
    theme: 'azure',
    title: '',
  };
  renderNewDocModal();
}

function renderNewDocModal() {
  const data = state.newDoc;
  if (!data) return;
  const type = TYPES[data.type];
  const templates = TEMPLATES.filter((tpl) => tpl.type === data.type);
  const chosenTemplate = templates.find((tpl) => tpl.id === data.template);
  const chosenTheme = THEMES.find((theme) => theme.id === data.theme) || THEMES[0];
  const typeCards = Object.entries(TYPES).map(([key, meta]) => `<button class="type-card ${key} ${data.type === key ? 'selected' : ''}" data-type="${key}">
    <span class="type-icon">${icon(meta.icon)}</span>
    <span><strong>${meta.label}</strong><span>.${meta.ext} · ${key === 'word' ? '报告 / 周报' : key === 'ppt' ? '汇报 / 提案' : '数据 / 预算'}</span></span>
    <span class="selected-check">${icon('i-check')}</span>
  </button>`).join('');
  const templateOptions = `<button class="template-option ${data.template === 'blank' ? 'selected' : ''}" data-template="blank">
      <span class="tp-mini blank">${icon('i-plus')}</span>
      <span class="tp-copy"><strong>空白文档</strong><span>从零开始</span></span>
    </button>` + templates.map((tpl) => `<button class="template-option ${data.template === tpl.id ? 'selected' : ''}" data-template="${tpl.id}">
      <span class="tp-mini ${tpl.type}">${tpl.type === 'word' ? '<i class="h"></i><i></i><i class="s"></i><i></i>' : tpl.type === 'ppt' ? '<i class="h"></i><i></i><div class="bars"><b style="height:40%"></b><b style="height:60%"></b><b style="height:80%"></b><b style="height:95%"></b></div>' : Array.from({ length: 9 }, (_, i) => `<span class="${i < 3 ? 'head' : ''}"></span>`).join('')}</span>
      <span class="tp-copy"><strong>${esc(tpl.name)}</strong><span>${esc(tpl.desc)}</span></span>
    </button>`).join('') + `<button class="template-option" data-more-templates>
      <span class="tp-mini blank">${icon('i-template')}</span>
      <span class="tp-copy"><strong>更多模板</strong><span>去模板中心浏览全部</span></span>
    </button>`;
  const themeOptions = THEMES.map((theme) => `<button class="theme-option ${data.theme === theme.id ? 'selected' : ''}" data-theme-id="${theme.id}">
    <span class="theme-swatches">${theme.colors.map((color) => `<i style="background:${color}"></i>`).join('')}</span>
    <span>${theme.name}</span>
  </button>`).join('');
  openModal(`
    <div class="modal-head">
      <div><h2>新建文档</h2><p>选择类型、模板与主题，进入左侧工作台 + 右侧 Copilot。</p></div>
      <button class="modal-close" data-close aria-label="关闭">${icon('i-close')}</button>
    </div>
    <div class="modal-body">
      <div class="field-label">01 · 选择类型</div>
      <div class="type-cards">${typeCards}</div>
      <div class="newdoc-grid">
        <div class="newdoc-left">
          <div class="field-label">02 · 从空白或模板开始</div>
          <div class="template-options">${templateOptions}</div>
        </div>
        <div class="newdoc-right">
          <div class="field-label">03 · 主题与标题</div>
          <div class="theme-options">${themeOptions}</div>
          <div class="title-field"><input id="newdoc-title" type="text" maxlength="80" placeholder="给文档起个名字（可选）" value="${esc(data.title)}" aria-label="文档标题"></div>
          <div class="newdoc-summary">
            <span class="sum-icon">${icon(type.icon)}</span>
            <div><strong>${esc(chosenTemplate ? chosenTemplate.name : '空白文档')} · ${chosenTheme.name}</strong><span>${esc(data.title || type.label)} · 进入后可直接对话生成</span></div>
          </div>
        </div>
      </div>
    </div>
    <div class="modal-foot">
      <span class="foot-hint">${icon('i-sparkles')}创建后可随时用 Copilot 调整结构与风格</span>
      <div class="modal-foot-actions"><button class="btn btn-ghost" data-close>取消</button><button class="btn btn-primary" data-create-doc>创建并进入工作台 ${icon('i-arrow-right')}</button></div>
    </div>
  `);
  const titleInput = $('#newdoc-title');
  titleInput?.addEventListener('input', (event) => {
    state.newDoc.title = event.target.value;
    const summary = $('.newdoc-summary div span');
    if (summary) summary.textContent = `${event.target.value || type.label} · 进入后可直接对话生成`;
  });
  titleInput?.focus();
}

function createDocument() {
  const data = state.newDoc;
  if (!data) return;
  const type = TYPES[data.type];
  const template = TEMPLATES.find((tpl) => tpl.id === data.template);
  const title = data.title.trim() || (template ? template.name : `未命名${type.label}`);
  const doc = {
    id: uid('doc'),
    type: data.type,
    title,
    template: data.template,
    theme: data.theme,
    updated: '刚刚',
    starred: false,
  };
  DOCS.unshift(doc);
  ensureDoc(doc);
  renderRecentDocs();
  renderAllDocs();
  closeModal();
  state.newDoc = null;
  openWorkbench(doc);
  toast('文档已创建，Copilot 已读取');
}

/* --------------------------------------------------------------------------
   Export modal
   -------------------------------------------------------------------------- */

function openExportModal() {
  const doc = state.currentDoc;
  if (!doc) return;
  state.exportFormat = TYPES[doc.type].ext;
  state.exportState = 'setup';
  renderExportModal();
}

function exportFileName() {
  const doc = state.currentDoc;
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const safe = doc.title.replace(/[\\/:*?"<>|]/g, '-').slice(0, 60);
  return `${safe}-${stamp}.${state.exportFormat}`;
}

function renderExportModal() {
  const doc = state.currentDoc;
  if (!doc) return;
  const type = TYPES[doc.type];
  const setup = `<div class="modal-body" id="export-body">
    <div class="field-label">导出格式</div>
    <div class="export-formats" style="grid-template-columns:repeat(2,1fr)">
      <button class="format-card ${doc.type} selected" data-export-format="${type.ext}">
        <span class="fmt-icon">${icon(type.icon)}</span>
        <span><strong>${type.ext.toUpperCase()}</strong><span>${type.extLabel} · 可继续编辑</span></span>
      </button>
      <button class="format-card pdf" data-export-format="pdf">
        <span class="fmt-icon">${icon('i-file')}</span>
        <span><strong>PDF</strong><span>适合分享与打印 · V1</span></span>
      </button>
    </div>
    <div class="field-label">导出范围</div>
    <label class="export-option"><input type="radio" name="export-range" value="all" checked><span><strong>全文</strong><span>导出当前文档的全部内容</span></span></label>
    <label class="export-option"><input type="radio" name="export-range" value="current"><span><strong>当前页 / 当前工作表</strong><span>${doc.type === 'ppt' ? `第 ${doc.activeSlide + 1} 页` : doc.type === 'excel' ? doc.sheet.name : '第 1 页'}</span></span></label>
    <label class="export-option"><input type="checkbox" id="export-citations" checked><span><strong>附加引用来源</strong><span>在文末生成来源列表，保留可追溯链接</span></span></label>
    <div class="field-label">文件名</div>
    <div class="export-name"><input id="export-filename" value="${esc(exportFileName())}" aria-label="文件名"><span>.${state.exportFormat}</span></div>
    <div class="proto-callout">${icon('i-info')}<span>原型演示：这里模拟服务端生成 OOXML 的进度，不会下载真实文件。真实实现见 PRD 第 7.2 节（EXP-01/02）与第 12 节。</span></div>
  </div>
  <div class="modal-foot"><span class="foot-hint">${icon('i-lock')}导出文件通过短期鉴权链接下载</span><div class="modal-foot-actions"><button class="btn btn-ghost" data-close>取消</button><button class="btn btn-primary" data-export-start>${icon('i-download')}开始导出</button></div></div>`;
  const progress = `<div class="modal-body"><div class="export-progress">
      <div class="progress-icon">${icon('i-refresh')}</div>
      <h3>正在生成 ${state.exportFormat.toUpperCase()} 文件</h3>
      <p>服务端正在把文档结构转换为 OOXML，并校验字体与图表…</p>
      <div class="progress-track"><i id="export-progress-bar"></i></div>
    </div></div>`;
  const success = `<div class="modal-body"><div class="export-success">
      <div class="success-icon">${icon('i-check')}</div>
      <h3>导出完成</h3>
      <p>文件已生成，可直接下载或继续编辑。</p>
      <div class="export-file">
        <span class="file-icon">${icon(type.icon)}</span>
        <div><strong id="export-success-name">${esc(exportFileName())}</strong><span>${doc.type === 'ppt' ? '8 页' : doc.type === 'excel' ? '1 个工作表' : '3 页'} · 约 1.8 MB</span></div>
        <button data-export-download>下载</button>
      </div>
    </div>
    <div class="proto-callout">${icon('i-info')}<span>原型中不会生成真实文件。实现后由导出服务生成可在 Office 中打开的 OOXML 文件。</span></div>
  </div>
  <div class="modal-foot"><span class="foot-hint">${icon('i-check')}导出使用点击瞬间的快照</span><div class="modal-foot-actions"><button class="btn btn-primary" data-close>完成</button></div></div>`;
  const body = state.exportState === 'progress' ? progress : state.exportState === 'success' ? success : setup;
  const foot = state.exportState === 'progress' ? `<div class="modal-foot"><span class="foot-hint">${icon('i-sparkles')}可继续编辑，导出使用快照</span></div>` : state.exportState === 'success' ? '' : '';
  openModal(`<div class="modal-head"><div><h2>导出文档</h2><p>${esc(doc.title)} · ${esc(type.label)}</p></div><button class="modal-close" data-close aria-label="关闭">${icon('i-close')}</button></div>${body}${state.exportState === 'setup' ? '' : foot}`, 'sm');
}

function startExport() {
  if (state.exportState !== 'setup') return;
  state.exportState = 'progress';
  renderExportModal();
  const bar = $('#export-progress-bar');
  let progress = 0;
  clearInterval(state.exportTimer);
  state.exportTimer = setInterval(() => {
    progress += 11 + Math.random() * 13;
    if (bar) bar.style.width = `${Math.min(progress, 96)}%`;
    if (progress >= 100) {
      clearInterval(state.exportTimer);
      clearTimeout(state.exportTimer);
      setTimeout(() => {
        if (!$('.modal')) return;
        state.exportState = 'success';
        renderExportModal();
      }, 350);
    }
  }, 180);
}

/* --------------------------------------------------------------------------
   Material modal
   -------------------------------------------------------------------------- */

function openMaterialModal(tab = 'mine') {
  const doc = state.currentDoc;
  const selected = new Set(doc ? getAttached(doc) : []);
  const render = () => {
    const body = tab === 'mine' ? `<div class="material-pick-list">${MATERIALS.map((mat) => `<label class="material-pick ${selected.has(mat.id) ? 'selected' : ''}">
        <input type="checkbox" data-mat-id="${mat.id}" ${selected.has(mat.id) ? 'checked' : ''}>
        <span class="mp-icon">${icon('i-file')}</span>
        <span class="mp-info"><strong>${esc(mat.name)}</strong><span>${esc(mat.type)} · ${esc(mat.detail)}</span></span>
        <span class="status-pill">已就绪</span>
      </label>`).join('')}</div>` : `<div class="upload-drop">${icon('i-upload')}<strong>拖拽文件到这里，或点击选择文件</strong><span>支持 PDF、Word、PPT、Excel、TXT、Markdown，单个文件不超过 50 MB</span><div style="margin-top:14px"><button class="btn btn-ghost" data-material-upload>${icon('i-plus')}选择文件（演示）</button></div></div>`;
    openModal(`<div class="modal-head"><div><h2>添加资料</h2><p>Copilot 会读取资料并标注引用，资料仅用于当前对话与文档。</p></div><button class="modal-close" data-close aria-label="关闭">${icon('i-close')}</button></div>
      <div class="modal-body">
        <div class="material-tabs"><button class="material-tab ${tab === 'mine' ? 'active' : ''}" data-material-tab="mine">我的资料</button><button class="material-tab ${tab === 'upload' ? 'active' : ''}" data-material-tab="upload">上传文件</button></div>
        ${body}
      </div>
      <div class="modal-foot"><span class="foot-hint" id="mat-count">${icon('i-check')}已选择 ${selected.size} 份资料</span><div class="modal-foot-actions"><button class="btn btn-ghost" data-close>取消</button><button class="btn btn-primary" data-material-confirm>添加资料</button></div></div>`, 'md');
    $$('#modal-root input[data-mat-id]').forEach((input) => {
      input.addEventListener('change', () => {
        if (input.checked) selected.add(input.dataset.matId);
        else selected.delete(input.dataset.matId);
        input.closest('.material-pick')?.classList.toggle('selected', input.checked);
        const count = $('#mat-count');
        if (count) count.innerHTML = `${icon('i-check')}已选择 ${selected.size} 份资料`;
      });
    });
    $$('#modal-root [data-material-tab]').forEach((button) => {
      button.addEventListener('click', () => {
        tab = button.dataset.materialTab;
        render();
      });
    });
    $('#modal-root [data-material-upload]')?.addEventListener('click', () => {
      const mat = { id: uid('mat'), name: `团队资料-${MATERIALS.length + 1}.pdf`, type: 'PDF', size: '1.0 MB', detail: '8 页 · 刚刚上传', citations: 0 };
      MATERIALS.unshift(mat);
      selected.add(mat.id);
      renderMaterials();
      render();
      toast('资料已解析完成');
    });
    $('#modal-root [data-material-confirm]')?.addEventListener('click', () => {
      if (doc) {
        state.attached[doc.id] = selected;
        closeModal();
        updateContext();
        updateComposerChips();
        toast(`已添加 ${selected.size} 份资料`);
      } else {
        closeModal();
        toast(`已加入资料库：${selected.size} 份资料`);
      }
    });
  };
  render();
}

/* --------------------------------------------------------------------------
   Share / theme / more menu
   -------------------------------------------------------------------------- */

function openShareModal() {
  const doc = state.currentDoc;
  if (!doc) return;
  const link = `https://office.example.com/doc/${doc.id}`;
  openModal(`<div class="modal-head"><div><h2>分享文档</h2><p>分享给团队成员，或控制链接访问权限。</p></div><button class="modal-close" data-close aria-label="关闭">${icon('i-close')}</button></div>
    <div class="modal-body">
      <div class="share-row"><div class="share-link">${icon('i-link')}<span>${link}</span></div><button class="btn btn-primary" data-share-copy="${link}">复制链接</button></div>
      <div class="access-row"><div class="who"><span class="mini-avatar a1">Z</span><div><strong>邹鹏飞（你）</strong><span>所有者</span></div></div><select class="access-select"><option>可编辑</option><option>可查看</option><option>仅自己</option></select></div>
      <div class="access-row"><div class="who"><span class="mini-avatar a2">L</span><div><strong>林小满</strong><span>产品设计</span></div></div><select class="access-select"><option>可评论</option><option>可编辑</option><option>可查看</option></select></div>
      <div class="proto-callout">${icon('i-info')}<span>原型演示：分享与权限为界面示意，未连接后端。</span></div>
    </div>
    <div class="modal-foot"><span class="foot-hint">${icon('i-lock')}链接访问需登录企业账号</span><div class="modal-foot-actions"><button class="btn btn-primary" data-close>完成</button></div></div>`, 'sm');
}

function openThemeModal() {
  const doc = state.currentDoc;
  if (!doc) return;
  openModal(`<div class="modal-head"><div><h2>切换主题</h2><p>主题会同步更新字体、配色与图表色板；Copilot 生成时也会遵循当前主题。</p></div><button class="modal-close" data-close aria-label="关闭">${icon('i-close')}</button></div>
    <div class="modal-body"><div class="theme-grid">${THEMES.map((theme) => `<button class="theme-card ${doc.theme === theme.id ? 'selected' : ''}" data-apply-theme="${theme.id}">
      <span class="theme-preview">${theme.colors.map((color) => `<i style="background:${color}"></i>`).join('')}</span>
      <span><strong>${theme.name}</strong><span>${theme.id === 'azure' ? '默认 · 清晰专业' : theme.id === 'graphite' ? '克制 · 咨询风' : theme.id === 'forest' ? '自然 · 稳健' : theme.id === 'ember' ? '活力 · 市场向' : '极简 · 高级感'}</span></span>
    </button>`).join('')}</div>
    <div class="proto-callout">${icon('i-info')}<span>主题为全局变量，切换后当前文档的标题、强调色与图表配色会即时更新。</span></div></div>
    <div class="modal-foot"><span class="foot-hint">${icon('i-sparkles')}Copilot 会读取当前主题</span><div class="modal-foot-actions"><button class="btn btn-ghost" data-close>取消</button><button class="btn btn-primary" data-close>完成</button></div></div>`, 'md');
}

function openArtifactPreview(msgId) {
  const doc = state.currentDoc;
  if (!doc) return;
  const msg = getChat(doc).find((item) => item.id === msgId);
  if (!msg || !msg.artifact) return;
  const artifact = msg.artifact;
  const preview = artifact.preview;
  let body = '';
  if (preview.type === 'ppt') {
    const slide = preview.slides[0];
    body = `<div class="artifact-deck-preview" style="${slideStyle(doc)}">${slideHTML(slide, 0, doc, preview.slides.length)}</div>
      <div class="artifact-page-list">${preview.slides.map((item, index) => `<div class="artifact-page-item"><span>${String(index + 1).padStart(2, '0')}</span><strong>${esc(item.title || '幻灯片')}</strong><small>${esc(item.layout)}</small></div>`).join('')}</div>`;
  } else if (preview.type === 'word') {
    body = `<div class="artifact-word-preview"><article class="word-page artifact-preview-paper">${preview.html}</article></div>`;
  } else {
    body = `<div class="artifact-excel-preview"><table><thead><tr>${preview.rows[0].map((cell) => `<th>${esc(cell)}</th>`).join('')}</tr></thead><tbody>${preview.rows.slice(1).map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  const applyButton = artifact.applied ? '' : `<button class="btn btn-primary" data-artifact-action="apply" data-msg-id="${msgId}">${icon('i-sparkles')}应用到文档</button>`;
  openModal(`<div class="modal-head"><div><h2>预览生成结果</h2><p>${esc(artifact.title)}</p></div><button class="modal-close" data-close aria-label="关闭">${icon('i-close')}</button></div>
    <div class="modal-body artifact-preview-body">${body}</div>
    <div class="modal-foot"><span class="foot-hint">${icon('i-info')}预览不修改文档，点击应用后写入</span><div class="modal-foot-actions"><button class="btn btn-ghost" data-close>关闭</button>${applyButton}</div></div>`, 'md');
}

function showMoreMenu(anchor) {
  closeMenu();
  const menu = document.createElement('div');
  menu.className = 'dropdown-menu';
  menu.innerHTML = `
    <button data-menu="preview">${icon('i-eye')}预览文档</button>
    <button data-menu="theme">${icon('i-sparkles')}切换主题</button>
    <button data-menu="share">${icon('i-share')}分享</button>
    <div class="menu-divider"></div>
    <button data-menu="copy">${icon('i-copy')}复制文档链接</button>
    <button class="danger" data-menu="delete">${icon('i-trash')}删除文档</button>`;
  document.body.appendChild(menu);
  const rect = anchor.getBoundingClientRect();
  menu.style.top = `${rect.bottom + 6}px`;
  menu.style.right = `${Math.max(12, window.innerWidth - rect.right)}px`;
  state.menuEl = menu;
  menu.addEventListener('click', (event) => {
    const item = event.target.closest('[data-menu]');
    if (!item) return;
    closeMenu();
    const action = item.dataset.menu;
    if (action === 'preview') togglePreview();
    if (action === 'theme') openThemeModal();
    if (action === 'share') openShareModal();
    if (action === 'copy') {
      copyText(`https://office.example.com/doc/${state.currentDoc?.id || ''}`);
      toast('文档链接已复制');
    }
    if (action === 'delete') toast('原型中不执行删除', 'warn');
  });
  setTimeout(() => document.addEventListener('click', outsideMenu), 0);
}

function outsideMenu(event) {
  if (state.menuEl && !state.menuEl.contains(event.target)) closeMenu();
}

function closeMenu() {
  if (state.menuEl) {
    state.menuEl.remove();
    state.menuEl = null;
    document.removeEventListener('click', outsideMenu);
  }
}

/* --------------------------------------------------------------------------
   Preview
   -------------------------------------------------------------------------- */

function togglePreview() {
  const doc = state.currentDoc;
  if (!doc) return;
  if (doc.type === 'ppt') {
    openPptPreview();
    return;
  }
  const cls = doc.type === 'word' ? 'preview-word' : 'preview-excel';
  const on = document.body.classList.toggle(cls);
  $('#preview-exit').hidden = !on;
  toast(on ? '已进入预览 · Esc 退出' : '已退出预览');
}

function exitPreview() {
  document.body.classList.remove('preview-word', 'preview-excel');
  $('#preview-exit').hidden = true;
}

function openPptPreview(index = null) {
  const doc = state.currentDoc;
  if (!doc) return;
  state.previewIndex = clamp(index === null ? doc.activeSlide : index, 0, doc.slides.length - 1);
  renderPptPreview();
}

function renderPptPreview() {
  const doc = state.currentDoc;
  const slide = doc.slides[state.previewIndex];
  $('#preview-root').innerHTML = `<div class="preview-overlay" data-preview-overlay>
    <div class="preview-overlay-head">
      <span class="pv-title">${esc(doc.title)}</span>
      <span class="pv-count">${state.previewIndex + 1} / ${doc.slides.length}</span>
      <button data-pv-close title="退出放映">${icon('i-close')}</button>
    </div>
    <div class="preview-overlay-body">
      <button class="pv-nav prev" data-pv-prev title="上一页">${icon('i-chevron-left')}</button>
      <div class="ppt-slide-wrap" style="${slideStyle(doc)}">${slideHTML(slide, state.previewIndex, doc)}</div>
      <button class="pv-nav next" data-pv-next title="下一页">${icon('i-chevron-right')}</button>
    </div>
    ${slide.notes ? `<div class="preview-notes">${esc(slide.notes)}</div>` : ''}
    <div class="preview-overlay-foot">${doc.slides.map((_, index) => `<span class="pv-dot ${index === state.previewIndex ? 'active' : ''}" data-pv-dot="${index}"></span>`).join('')}</div>
  </div>`;
}

function closePptPreview() {
  $('#preview-root').innerHTML = '';
}

function previewStep(delta) {
  const doc = state.currentDoc;
  if (!doc) return;
  state.previewIndex = clamp(state.previewIndex + delta, 0, doc.slides.length - 1);
  renderPptPreview();
}

/* --------------------------------------------------------------------------
   Selection awareness
   -------------------------------------------------------------------------- */

function selectionInCanvas() {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount || selection.isCollapsed) return '';
  const node = selection.anchorNode;
  if (!node) return '';
  const el = node.nodeType === 3 ? node.parentElement : node;
  if (!el) return '';
  if (el.closest('.copilot, .modal, .preview-overlay')) return '';
  const canvas = el.closest('.word-page, .ppt-slide, td[data-cell]');
  if (!canvas) return '';
  return selection.toString().trim().slice(0, 60);
}

/* --------------------------------------------------------------------------
   Global events
   -------------------------------------------------------------------------- */

function bindEvents() {
  document.addEventListener('click', (event) => {
    const target = event.target;

    if (target.closest('[data-close]') || target.classList.contains('modal-backdrop')) {
      closeModal();
      return;
    }

    const star = target.closest('[data-star]');
    if (star) {
      event.stopPropagation();
      const doc = DOCS.find((item) => item.id === star.dataset.star);
      if (doc) {
        doc.starred = !doc.starred;
        renderRecentDocs();
        renderAllDocs();
      }
      return;
    }

    const openDoc = target.closest('[data-open-doc]');
    if (openDoc) {
      openDocById(openDoc.dataset.openDoc);
      return;
    }

    const newType = target.closest('[data-new-type]');
    if (newType) {
      openNewDoc(newType.dataset.newType);
      return;
    }

    const gotoPage = target.closest('[data-goto-page]');
    if (gotoPage) {
      showHomePage(gotoPage.dataset.gotoPage);
      return;
    }

    const navItem = target.closest('.nav-item[data-page]');
    if (navItem) {
      showHomePage(navItem.dataset.page);
      return;
    }

    const useTemplate = target.closest('[data-use-template]');
    if (useTemplate) {
      const tpl = TEMPLATES.find((item) => item.id === useTemplate.dataset.useTemplate);
      if (tpl) openNewDoc(tpl.type, tpl.id);
      return;
    }

    const docFilter = target.closest('[data-doc-filter]');
    if (docFilter) {
      state.docFilter = docFilter.dataset.docFilter;
      $$('.chip[data-doc-filter]').forEach((chip) => chip.classList.toggle('active', chip === docFilter));
      renderAllDocs();
      return;
    }

    const tplFilter = target.closest('[data-tpl-filter]');
    if (tplFilter) {
      state.tplFilter = tplFilter.dataset.tplFilter;
      $$('.chip[data-tpl-filter]').forEach((chip) => chip.classList.toggle('active', chip === tplFilter));
      renderTemplateGrid();
      return;
    }

    if (target.closest('[data-type]')) {
      state.newDoc.type = target.closest('[data-type]').dataset.type;
      state.newDoc.template = 'blank';
      state.newDoc.title = '';
      renderNewDocModal();
      return;
    }

    if (target.closest('[data-template]')) {
      state.newDoc.template = target.closest('[data-template]').dataset.template;
      renderNewDocModal();
      return;
    }

    if (target.closest('[data-theme-id]')) {
      state.newDoc.theme = target.closest('[data-theme-id]').dataset.themeId;
      renderNewDocModal();
      return;
    }

    if (target.closest('[data-more-templates]')) {
      closeModal();
      showHomePage('templates');
      return;
    }

    if (target.closest('[data-create-doc]')) {
      createDocument();
      return;
    }

    if (target.closest('[data-apply-theme]')) {
      const doc = state.currentDoc;
      if (doc) {
        doc.theme = target.closest('[data-apply-theme]').dataset.applyTheme;
        document.body.dataset.theme = doc.theme;
        renderCanvas();
        renderStatus();
        closeModal();
        toast(`已切换主题：${themeOf(doc).name}`);
      }
      return;
    }

    if (target.closest('[data-export-format]')) {
      const card = target.closest('[data-export-format]');
      state.exportFormat = card.dataset.exportFormat;
      $$('.format-card').forEach((el) => el.classList.toggle('selected', el === card));
      const suffix = $('.export-name span');
      if (suffix) suffix.textContent = `.${state.exportFormat}`;
      const name = $('#export-filename');
      if (name) name.value = exportFileName();
      return;
    }

    if (target.closest('[data-export-start]')) {
      startExport();
      return;
    }

    if (target.closest('[data-export-download]')) {
      toast('原型演示：真实文件由服务端导出服务生成', 'warn');
      return;
    }

    if (target.closest('[data-material-confirm]')) {
      return;
    }

    const artifactAction = target.closest('[data-artifact-action]');
    if (artifactAction) {
      const msgId = artifactAction.dataset.msgId;
      const action = artifactAction.dataset.artifactAction;
      if (action === 'apply') {
        closeModal();
        applyArtifact(msgId);
      }
      if (action === 'preview') openArtifactPreview(msgId);
      if (action === 'undo') undoArtifact();
      if (action === 'regen') regenMessage(msgId);
      return;
    }

    const suggestion = target.closest('[data-suggest]');
    if (suggestion) {
      sendMessage(suggestion.dataset.suggest);
      return;
    }

    const copyMsg = target.closest('[data-copy-msg]');
    if (copyMsg) {
      const doc = state.currentDoc;
      const msg = getChat(doc).find((item) => item.id === copyMsg.dataset.copyMsg);
      if (msg) {
        copyText(msg.text);
        toast('已复制消息');
      }
      return;
    }

    const regen = target.closest('[data-regen-msg]');
    if (regen) {
      regenMessage(regen.dataset.regenMsg);
      return;
    }

    const toolHead = target.closest('[data-tool-toggle]');
    if (toolHead) {
      toolHead.closest('.tool-call')?.classList.toggle('open');
      return;
    }

    const ctx = target.closest('[data-ctx]');
    if (ctx) {
      if (ctx.dataset.ctx === 'materials') openMaterialModal();
      if (ctx.dataset.ctx === 'doc') toast('Copilot 已读取当前文档结构');
      if (ctx.dataset.ctx === 'selection') toast('Copilot 已理解选中内容');
      return;
    }

    if (target.closest('[data-attach-open]')) {
      openMaterialModal();
      return;
    }

    const shareCopy = target.closest('[data-share-copy]');
    if (shareCopy) {
      copyText(shareCopy.dataset.shareCopy);
      toast('分享链接已复制');
      return;
    }

    const removeMaterial = target.closest('[data-remove-material]');
    if (removeMaterial) {
      const doc = state.currentDoc;
      if (doc) {
        getAttached(doc).clear();
        updateComposerChips();
        updateContext();
        toast('已移除对话资料');
      }
      return;
    }

    if (target.closest('[data-pv-close]')) {
      closePptPreview();
      return;
    }
    if (target.closest('[data-pv-prev]')) {
      previewStep(-1);
      return;
    }
    if (target.closest('[data-pv-next]')) {
      previewStep(1);
      return;
    }
    const pvDot = target.closest('[data-pv-dot]');
    if (pvDot) {
      state.previewIndex = Number(pvDot.dataset.pvDot);
      renderPptPreview();
      return;
    }

    if (target.closest('#preview-exit')) {
      exitPreview();
      return;
    }

    if (target.closest('#btn-back') || target.closest('#brand-home')) {
      cancelStream();
      closePptPreview();
      exitPreview();
      showHomePage('overview');
      return;
    }

    if (target.closest('#btn-share')) {
      openShareModal();
      return;
    }
    if (target.closest('#btn-export')) {
      openExportModal();
      return;
    }
    if (target.closest('#btn-more')) {
      showMoreMenu(target.closest('#btn-more'));
      return;
    }
    if (target.closest('#btn-attach')) {
      openMaterialModal();
      return;
    }
    if (target.closest('#btn-collapse')) {
      $('#wb-body').classList.add('copilot-collapsed');
      $('#copilot-fab').hidden = false;
      return;
    }
    if (target.closest('#copilot-fab')) {
      $('#wb-body').classList.remove('copilot-collapsed');
      $('#copilot-fab').hidden = true;
      return;
    }
    if (target.closest('#btn-new-chat')) {
      const doc = state.currentDoc;
      if (doc) {
        cancelStream();
        state.chats[doc.id] = [{
          id: uid('msg'), role: 'assistant', time: '刚刚',
          text: '新对话已开始。我仍然能读取当前文档、你的资料，也可以联网搜索。',
          suggestions: doc.type === 'ppt' ? ['先给我大纲', '把第 3 页改成三栏'] : doc.type === 'word' ? ['生成完整大纲', '检查引用与数据'] : ['按季度汇总', '生成一张图表'],
        }];
        renderCopilot();
        toast('已开始新对话');
      }
      return;
    }
    if (target.closest('#btn-web')) {
      state.webEnabled = !state.webEnabled;
      $('#btn-web').classList.toggle('active', state.webEnabled);
      updateContext();
      toast(state.webEnabled ? '已开启联网搜索' : '已关闭联网搜索');
      return;
    }
    if (target.closest('#btn-send')) {
      if (state.streaming) stopStreaming();
      else sendMessage($('#copilot-input').value);
      return;
    }

    const cmd = target.closest('[data-cmd]');
    if (cmd) {
      handleCommand(cmd.dataset.cmd);
      return;
    }

    const tplUpload = target.closest('#tpl-upload');
    if (tplUpload) {
      toast('上传模板能力规划中（P1）', 'warn');
      return;
    }
    if (target.closest('#material-upload')) {
      openMaterialModal('upload');
      return;
    }
  });

  // Keep text selection inside the editor when clicking formatting buttons.
  $('#editor-toolbar').addEventListener('mousedown', (event) => {
    if (event.target.closest('[data-cmd]')) event.preventDefault();
  });

  $('#editor-toolbar').addEventListener('change', (event) => {
    const select = event.target.closest('[data-tb]');
    if (!select) return;
    const cmd = select.dataset.tb;
    if (cmd === 'style') document.execCommand('formatBlock', false, select.value);
    if (cmd === 'size') document.execCommand('fontSize', false, select.value);
    scheduleSave();
  });

  $('#copilot-input').addEventListener('input', (event) => {
    autoGrow(event.target);
    updateSendButton();
  });

  $('#copilot-input').addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      sendMessage(event.target.value);
    }
  });

  $('#doc-title').addEventListener('input', (event) => {
    const doc = state.currentDoc;
    if (!doc) return;
    doc.title = event.target.value;
    document.title = `${doc.title || '未命名文档'} · Office Copilot`;
    scheduleSave();
  });
  $('#doc-title').addEventListener('blur', (event) => {
    const doc = state.currentDoc;
    if (!doc) return;
    if (!event.target.value.trim()) {
      doc.title = `未命名${TYPES[doc.type].label}`;
      event.target.value = doc.title;
    }
    renderRecentDocs();
  });

  document.addEventListener('selectionchange', () => {
    const text = selectionInCanvas();
    if (text !== state.selectionText) {
      state.selectionText = text;
      if (state.currentDoc) updateContext();
    }
  });

  document.addEventListener('keydown', (event) => {
    const key = event.key;
    if (key === 'Escape') {
      if ($('[data-preview-overlay]')) {
        closePptPreview();
        return;
      }
      if (document.body.classList.contains('preview-word') || document.body.classList.contains('preview-excel')) {
        exitPreview();
        return;
      }
      if (state.menuEl) {
        closeMenu();
        return;
      }
      if ($('#modal-root').innerHTML.trim()) {
        closeModal();
        return;
      }
    }
    if ($('[data-preview-overlay]')) {
      if (key === 'ArrowRight') {
        previewStep(1);
        event.preventDefault();
      }
      if (key === 'ArrowLeft') {
        previewStep(-1);
        event.preventDefault();
      }
    }
    if ((event.metaKey || event.ctrlKey) && key.toLowerCase() === 's') {
      event.preventDefault();
      scheduleSave();
      toast('已保存');
    }
    if ((event.metaKey || event.ctrlKey) && key.toLowerCase() === 'k') {
      event.preventDefault();
      const search = $('#global-search');
      if (search && !$('#view-home').hidden) search.focus();
    }
  });

  $('#global-search').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      state.docSearch = event.target.value;
      showHomePage('docs');
      $('#doc-search').value = event.target.value;
      renderAllDocs();
    }
  });

  $('#doc-search').addEventListener('input', (event) => {
    state.docSearch = event.target.value;
    renderAllDocs();
  });

  // Resizable Copilot panel
  const resizer = $('#panel-resizer');
  const body = $('#wb-body');
  let dragging = false;
  resizer.addEventListener('mousedown', (event) => {
    dragging = true;
    resizer.classList.add('dragging');
    document.body.style.userSelect = 'none';
    event.preventDefault();
  });
  window.addEventListener('mousemove', (event) => {
    if (!dragging) return;
    const width = clamp(window.innerWidth - event.clientX, 320, 560);
    body.style.setProperty('--copilot-w', `${width}px`);
  });
  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    resizer.classList.remove('dragging');
    document.body.style.userSelect = '';
  });

  $$('.doc-card').forEach((card) => {
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openDocById(card.dataset.openDoc);
      }
    });
  });
}

function handleCommand(cmd) {
  const doc = state.currentDoc;
  if (!doc) return;
  if (cmd === 'undo') {
    if (doc.undoStack.length) undoArtifact();
    else document.execCommand('undo');
    return;
  }
  if (cmd === 'redo') {
    if (doc.redoStack.length) redoArtifact();
    else document.execCommand('redo');
    return;
  }
  if (cmd === 'theme') {
    openThemeModal();
    return;
  }
  if (cmd === 'preview') {
    togglePreview();
    return;
  }
  if (cmd === 'present') {
    openPptPreview(0);
    return;
  }
  if (doc.type === 'word') {
    const map = { bold: 'bold', italic: 'italic', underline: 'underline', strike: 'strikeThrough', ul: 'insertUnorderedList', 'align-left': 'justifyLeft', 'align-center': 'justifyCenter' };
    if (map[cmd]) {
      document.execCommand(map[cmd], false, null);
      scheduleSave();
      return;
    }
    if (cmd === 'link') {
      document.execCommand('createLink', false, 'https://example.com');
      return;
    }
    if (cmd === 'table') {
      document.execCommand('insertHTML', false, '<table><thead><tr><th>列 1</th><th>列 2</th></tr></thead><tbody><tr><td>内容</td><td>内容</td></tr></tbody></table><p><br></p>');
      scheduleSave();
      return;
    }
  }
  if (doc.type === 'excel' && (cmd === 'bold' || cmd === 'italic')) {
    const ref = doc.selectedCell;
    const cell = doc.sheet.cells[ref] || { v: '' };
    cell[cmd] = !cell[cmd];
    doc.sheet.cells[ref] = cell;
    const td = $(`#canvas-excel td[data-cell="${ref}"]`);
    if (td) td.classList.toggle(cmd, cell[cmd]);
    scheduleSave();
    return;
  }
  const labels = {
    image: '插入图片', layout: '切换版式', text: '插入文本', shape: '插入形状', table: '插入表格',
    fill: '填充颜色', border: '边框', currency: '货币格式', percent: '百分比格式', fx: '插入函数', chart: '插入图表',
  };
  toast(`${labels[cmd] || '该操作'}：原型演示`, 'warn');
}

/* --------------------------------------------------------------------------
   Routing + init
   -------------------------------------------------------------------------- */

function routeFromHash() {
  const hash = location.hash.replace(/^#\/?/, '');
  if (hash.startsWith('doc/')) {
    const type = hash.split('/')[1];
    const doc = DOCS.find((item) => item.type === type);
    if (doc) {
      openWorkbench(doc, false);
      return;
    }
  }
  if (['docs', 'templates', 'materials', 'trash'].includes(hash)) {
    showHomePage(hash, false);
    return;
  }
  showHomePage('overview', false);
}

function init() {
  renderRecentDocs();
  renderHomeTemplates();
  renderAllDocs();
  renderTemplateGrid();
  renderMaterials();
  bindEvents();
  routeFromHash();
}

document.addEventListener('DOMContentLoaded', init);
window.addEventListener('hashchange', routeFromHash);
