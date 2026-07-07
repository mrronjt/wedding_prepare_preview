const STORAGE_KEY = "wedding-planner-workbench-v2";
const currency = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  maximumFractionDigits: 0,
});
const checklistCore = window.ExecutionChecklistCore;
const recommendationConfig = window.ExecutionChecklistRecommendationConfig;

const DECISION_STATUSES = ["信息收集中", "对比中", "待拍板", "已决定", "已转任务", "暂缓"];
const OPEN_DECISION_STATUSES = ["信息收集中", "对比中", "待拍板", "已决定"];
const DONE_DECISION_STATUSES = ["已转任务", "暂缓"];
const DEFAULT_COMPARISON_CRITERIA = ["预算/成本", "体验/价值", "风险/执行"];
const MAX_DECISION_OPTIONS = 5;
const MAX_DECISION_CRITERIA = 8;

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

const nodeTemplates = [
  {
    id: "profile",
    name: "婚礼档案",
    type: "核心",
    locked: true,
    owner: "双方一起",
    description: "婚期、预算、人数、场景边界，是整张备婚地图的输入。",
    budgetNote: "总预算用于给每个场景设置红线。",
    tasks: [
      ["确认婚期、城市和主场地", "双方一起", -180, true],
      ["确认三段式婚礼是否都保留", "双方一起", -150, false],
    ],
    outputs: ["婚礼基础档案将作为所有节点的前置信息。"],
    packageItems: ["婚期、主场地、预算和宾客规模需要写入执行包首页。"],
  },
  {
    id: "budget",
    name: "总预算",
    type: "核心",
    locked: true,
    owner: "新郎",
    description: "用预算红线约束场景、商家、宾客规模和 After Party 强度。",
    budgetNote: "建议先分出仪式、晚宴、影像、After Party 和备用金。",
    tasks: [
      ["拆分草坪仪式、室内晚宴、After Party 预算", "新郎", -130, false],
      ["预留 8%-12% 应急预算", "新郎", -120, false],
    ],
    decisions: [
      {
        title: "预算优先级怎么排",
        question: "当预算超支时，优先保仪式氛围、宾客体验，还是 After Party 体验？",
        type: "预算",
        owner: "双方一起",
        participants: "新郎、新娘",
        dueOffset: -120,
        status: "对比中",
        options: [
          {
            name: "仪式氛围优先",
            notes: {
              预算影响: "花艺、座椅、仪式区投入更高",
              体验价值: "照片和仪式感更强",
              执行风险: "户外条件依赖更强",
            },
          },
          {
            name: "宾客体验优先",
            notes: {
              预算影响: "餐标、酒水和服务占比更高",
              体验价值: "长辈和大多数宾客感受更稳",
              执行风险: "相对稳定",
            },
          },
          {
            name: "After Party 优先",
            notes: {
              预算影响: "酒水、场地、音乐和住宿预算上升",
              体验价值: "核心朋友记忆点强",
              执行风险: "噪音、交通、收尾要管",
            },
          },
        ],
        criteria: ["预算影响", "体验价值", "执行风险"],
        gaps: ["各商家报价还未完全确认", "备用金比例未拍板"],
        finalChoice: "",
        conclusion: "",
        followUps: [
          ["把未选优先级对应的预算项标记为可砍项", "新郎", -110],
          ["给每个场景设置不可突破预算", "双方一起", -105],
        ],
      },
    ],
    outputs: ["输出各场景预算红线、可砍项和备用金比例。"],
    packageItems: ["执行包需要列出尾款、备用金和当天可能产生的现金支出。"],
  },
  {
    id: "guests",
    name: "宾客名单",
    type: "核心",
    locked: true,
    owner: "新娘",
    description: "管理出席、分组、桌数，以及是否参加别墅 After Party。",
    budgetNote: "宾客人数会影响餐标、酒水、喜糖和交通。",
    tasks: [
      ["建立宾客名单和亲友分组", "双方一起", -100, false],
      ["标记 After Party 邀请范围", "新娘", -70, false],
      ["确认老人、小孩和需要特殊照顾的宾客", "新娘", -45, false],
    ],
    decisions: [
      {
        title: "After Party 邀请范围如何定",
        question: "After Party 是开放给所有宾客，还是只邀请核心朋友？",
        type: "宾客",
        owner: "新娘",
        participants: "新郎、新娘、朋友代表",
        dueOffset: -70,
        status: "信息收集中",
        options: [
          {
            name: "只邀请核心朋友",
            notes: {
              氛围: "更松弛，互动质量高",
              成本: "酒水、交通和住宿可控",
              风险: "需要解释邀请边界",
            },
          },
          {
            name: "开放给年轻宾客",
            notes: {
              氛围: "热闹，参与感强",
              成本: "人数不确定，成本上浮",
              风险: "交通、秩序和噪音压力上升",
            },
          },
          {
            name: "不主动邀请，到场自愿",
            notes: {
              氛围: "轻量",
              成本: "难以预估",
              风险: "物资和交通准备容易失准",
            },
          },
        ],
        criteria: ["氛围", "成本", "风险"],
        gaps: ["核心朋友名单未定", "别墅可容纳人数未确认"],
        finalChoice: "",
        conclusion: "",
        followUps: [
          ["给 After Party 宾客打标签", "新娘", -62],
          ["确认 After Party 交通和返程方案", "朋友协助", -50],
        ],
      },
    ],
    outputs: ["输出宾客分组、After Party 名单和特殊照顾备注。"],
    packageItems: ["执行包需要列出每个分组的确认负责人和特殊宾客备注。"],
  },
  {
    id: "lawn",
    name: "草坪仪式",
    type: "场景推荐",
    owner: "新娘",
    description: "管理户外仪式区、雨备、座椅、音响、电源、入场动线和宾客体验。",
    budgetNote: "草坪仪式常见额外成本：花艺、椅子、地毯、音响、电源、雨备。",
    tasks: [
      ["确认草坪仪式区容量和动线", "新娘", -120, false],
      ["确认草坪座椅、地毯、花艺和音响报价", "新郎", -95, false],
      ["准备雨天仪式流程版本", "当天负责人", -30, false],
    ],
    decisions: [
      {
        title: "草坪仪式是否成立",
        question: "是否选择草坪仪式，还是改成室内仪式或室内仪式+户外拍照？",
        type: "流程",
        owner: "双方一起",
        participants: "新郎、新娘、双方父母",
        dueOffset: -140,
        status: "待拍板",
        options: [
          {
            name: "草坪仪式 + 室内晚宴",
            notes: {
              预算: "布置和雨备成本上升",
              体验: "仪式感和照片效果最好",
              风险: "天气、蚊虫、音响和转场",
            },
          },
          {
            name: "全室内婚礼",
            notes: {
              预算: "较可控",
              体验: "稳定，对长辈友好",
              风险: "氛围感较弱",
            },
          },
          {
            name: "室内仪式 + 户外拍照",
            notes: {
              预算: "中等",
              体验: "保留户外照片",
              风险: "户外仪式感弱",
            },
          },
        ],
        criteria: ["预算", "体验", "风险"],
        gaps: ["雨备场地是否免费未确认", "草坪音响电源条件未确认"],
        finalChoice: "草坪仪式 + 室内晚宴",
        conclusion: "保留户外仪式感，但晚宴回到室内保证稳定。",
        followUps: [
          ["确认雨备触发条件和切换负责人", "当天负责人", -45],
          ["请场地方报价草坪仪式额外费用", "新郎", -90],
          ["请柬提醒宾客户外仪式着装和鞋子", "新娘", -35],
        ],
      },
      {
        title: "雨备方案触发条件怎么定",
        question: "下雨、暴晒或大风时，什么时候切换到室内雨备？谁有最终决定权？",
        type: "风险",
        owner: "当天负责人",
        participants: "新人、场地方、主持",
        dueOffset: -45,
        status: "信息收集中",
        options: [
          {
            name: "婚礼前一天 18:00 决定",
            notes: {
              稳定性: "布置团队好安排",
              成本: "降低临时切换成本",
              体验: "可能提前放弃好天气窗口",
            },
          },
          {
            name: "当天上午决定",
            notes: {
              稳定性: "时间紧",
              成本: "布置和人员调度成本更高",
              体验: "更贴近实际天气",
            },
          },
          {
            name: "双方案同步搭建",
            notes: {
              稳定性: "最稳",
              成本: "费用最高",
              体验: "切换无感",
            },
          },
        ],
        criteria: ["稳定性", "成本", "体验"],
        gaps: ["场地方是否允许双方案搭建", "雨备厅是否同等可用"],
        finalChoice: "",
        conclusion: "",
        followUps: [
          ["把雨备触发条件写进执行包", "当天负责人", -30],
          ["通知摄影摄像准备两套机位方案", "当天负责人", -20],
        ],
      },
    ],
    outputs: ["输出户外仪式流程、雨备切换条件和宾客提醒。"],
    packageItems: ["14:30 草坪仪式区布置确认；16:00 仪式开始；雨备切换由当天负责人拍板。"],
  },
  {
    id: "dinner",
    name: "室内晚宴/自助餐",
    type: "场景推荐",
    owner: "新郎",
    description: "管理菜单、桌型、酒水、取餐动线、长辈舒适度和主持流程。",
    budgetNote: "餐标、酒水、甜品和服务人员会随人数快速变化。",
    tasks: [
      ["确认室内动线和取餐区位置", "新郎", -90, false],
      ["试菜并确认菜单、酒水和甜品", "双方一起", -60, false],
      ["确认主持流程是否适合自助餐节奏", "新娘", -35, false],
    ],
    decisions: [
      {
        title: "室内晚宴是围桌还是自助餐",
        question: "晚宴采取传统围桌、半自助，还是完整自助餐？",
        type: "流程",
        owner: "双方一起",
        participants: "新人、父母、酒店",
        dueOffset: -95,
        status: "对比中",
        options: [
          {
            name: "传统围桌",
            notes: {
              长辈体验: "最稳妥",
              动线: "简单",
              氛围: "仪式感强但不够松弛",
            },
          },
          {
            name: "半自助",
            notes: {
              长辈体验: "主菜稳定，甜品酒水灵活",
              动线: "需要规划取餐区",
              氛围: "正式和松弛兼顾",
            },
          },
          {
            name: "完整自助餐",
            notes: {
              长辈体验: "可能不习惯",
              动线: "要求最高",
              氛围: "轻松，适合年轻宾客",
            },
          },
        ],
        criteria: ["长辈体验", "动线", "氛围"],
        gaps: ["酒店是否能提供半自助方案", "父母是否接受自助形式"],
        finalChoice: "",
        conclusion: "",
        followUps: [
          ["让酒店出半自助动线图和服务人员配置", "新郎", -75],
          ["确认父母对晚宴形式的底线", "双方一起", -70],
        ],
      },
      {
        title: "是否设置迎宾酒/Cocktail Hour",
        question: "草坪仪式和室内晚宴之间是否设置一段迎宾酒或轻食过渡？",
        type: "体验",
        owner: "新娘",
        participants: "新人、酒店、摄影摄像",
        dueOffset: -70,
        status: "信息收集中",
        options: [
          {
            name: "设置迎宾酒",
            notes: {
              体验: "转场更自然，照片素材更丰富",
              成本: "酒水和轻食成本增加",
              执行: "需要服务人员和区域布置",
            },
          },
          {
            name: "只安排合影",
            notes: {
              体验: "流程紧凑",
              成本: "较低",
              执行: "宾客等待体验一般",
            },
          },
          {
            name: "直接入席",
            notes: {
              体验: "对长辈友好",
              成本: "最低",
              执行: "摄影素材减少",
            },
          },
        ],
        criteria: ["体验", "成本", "执行"],
        gaps: ["酒店是否有合适过渡区", "摄影摄像是否需要这段素材"],
        finalChoice: "",
        conclusion: "",
        followUps: [
          ["确认迎宾酒区域和服务时间", "新娘", -55],
          ["把转场提醒加入主持词和执行包", "当天负责人", -30],
        ],
      },
    ],
    outputs: ["输出晚宴形式、菜单酒水、转场动线和主持节奏。"],
    packageItems: ["18:00 室内晚宴开始；如设置迎宾酒，需单独写明服务区域和撤场时间。"],
  },
  {
    id: "villa",
    name: "别墅 After Party",
    type: "场景推荐",
    owner: "朋友协助",
    description: "管理邀请范围、交通、酒水、音乐、住宿、噪音限制和收尾清洁。",
    budgetNote: "主要成本来自场地、酒水、夜宵、交通、住宿、清洁和设备。",
    tasks: [
      ["确认别墅容量、噪音、酒水和过夜规则", "朋友协助", -75, false],
      ["确认 After Party 到达和返程方式", "朋友协助", -45, false],
      ["安排收尾清洁和安全负责人", "当天负责人", -20, false],
    ],
    decisions: [
      {
        title: "别墅是否允许音乐、酒水、过夜",
        question: "别墅规则是否支持 After Party 的真实玩法？",
        type: "场地",
        owner: "朋友协助",
        participants: "新人、别墅管家、朋友代表",
        dueOffset: -75,
        status: "待拍板",
        options: [
          {
            name: "原别墅可承接",
            notes: {
              便利性: "无需换场地",
              成本: "可控",
              风险: "需要明确噪音和清洁责任",
            },
          },
          {
            name: "换专业派对场地",
            notes: {
              便利性: "规则更适配",
              成本: "可能更高",
              风险: "距离主场地可能更远",
            },
          },
          {
            name: "缩小为酒店房间 after talk",
            notes: {
              便利性: "最稳",
              成本: "低",
              风险: "氛围和人数受限",
            },
          },
        ],
        criteria: ["便利性", "成本", "风险"],
        gaps: ["噪音截止时间未确认", "是否允许自带酒水未确认", "是否可过夜未确认"],
        finalChoice: "",
        conclusion: "",
        followUps: [
          ["把别墅规则截图归档", "朋友协助", -65],
          ["确认夜宵、酒水和清洁预算", "新郎", -55],
          ["指定 After Party 安全负责人", "当天负责人", -30],
        ],
      },
      {
        title: "摄影摄像是否覆盖 After Party",
        question: "影像团队是否继续跟拍 After Party，还是交给朋友记录？",
        type: "商家",
        owner: "新娘",
        participants: "新人、摄影摄像、朋友",
        dueOffset: -55,
        status: "信息收集中",
        options: [
          {
            name: "专业团队覆盖",
            notes: {
              画面: "质量稳定",
              成本: "加时费用明显",
              执行: "需确认收工时间和交通",
            },
          },
          {
            name: "朋友记录",
            notes: {
              画面: "真实但不稳定",
              成本: "低",
              执行: "需要指定人和设备",
            },
          },
          {
            name: "只拍入场前 30 分钟",
            notes: {
              画面: "保留关键记忆",
              成本: "中等",
              执行: "时间点要卡准",
            },
          },
        ],
        criteria: ["画面", "成本", "执行"],
        gaps: ["影像团队加时报价未确认", "朋友设备未确认"],
        finalChoice: "",
        conclusion: "",
        followUps: [
          ["询问摄影摄像 After Party 加时报价", "新娘", -48],
          ["如朋友记录，指定设备和云相册", "朋友协助", -35],
        ],
      },
    ],
    outputs: ["输出 After Party 邀请名单、场地规则、交通和收尾负责人。"],
    packageItems: ["21:30 转场至别墅 After Party；需明确交通、噪音截止和收尾负责人。"],
  },
  {
    id: "vendors",
    name: "商家管理",
    type: "支撑",
    locked: true,
    owner: "新郎",
    description: "跟进场地、酒店、花艺、影像、化妆、主持、酒水、别墅等供应商状态。",
    budgetNote: "记录报价、定金、尾款、合同和到场时间。",
    tasks: [
      ["建立供应商推进表", "新郎", -110, false],
      ["确认每个商家的当天对接人", "当天负责人", -28, false],
      ["确认尾款支付时间和付款方式", "新郎", -14, false],
    ],
    decisions: [
      {
        title: "哪些事项交给专业人员，哪些托付朋友",
        question: "没有婚策时，哪些环节必须找专业人员，哪些可以交给朋友执行？",
        type: "交接",
        owner: "双方一起",
        participants: "新人、当天负责人、朋友",
        dueOffset: -45,
        status: "对比中",
        options: [
          {
            name: "关键环节都给专业人员",
            notes: {
              稳定性: "最高",
              成本: "最高",
              朋友压力: "低",
            },
          },
          {
            name: "专业人员 + 朋友分工",
            notes: {
              稳定性: "较稳",
              成本: "可控",
              朋友压力: "中等",
            },
          },
          {
            name: "尽量朋友执行",
            notes: {
              稳定性: "不确定",
              成本: "低",
              朋友压力: "高",
            },
          },
        ],
        criteria: ["稳定性", "成本", "朋友压力"],
        gaps: ["朋友当天是否有空未确认", "专业统筹单日费用未确认"],
        finalChoice: "",
        conclusion: "",
        followUps: [
          ["列出必须专业人员执行的任务", "双方一起", -38],
          ["给朋友任务设置备份人", "当天负责人", -25],
        ],
      },
    ],
    outputs: ["输出供应商联系人、到场时间、尾款和当天对接人。"],
    packageItems: ["执行包需要列出供应商联系人、到场时间、尾款和负责人。"],
  },
  {
    id: "handoff",
    name: "负责人/交接",
    type: "执行",
    locked: true,
    owner: "当天负责人",
    description: "没有婚策时，提前把当天事项交给一个总负责人和若干朋友分工。",
    budgetNote: "交接本身不花钱，但失误成本很高。",
    tasks: [
      ["确定当天总负责人", "双方一起", -45, false],
      ["把每个场景的负责人和联系方式写入执行包", "当天负责人", -20, false],
      ["婚礼前一周完成负责人 briefing", "当天负责人", -7, false],
    ],
    decisions: [
      {
        title: "当天总负责人由谁担任",
        question: "没有婚策时，谁可以在当天替新人拍板和协调？",
        type: "交接",
        owner: "双方一起",
        participants: "新人、候选负责人",
        dueOffset: -45,
        status: "待拍板",
        options: [
          {
            name: "亲密朋友",
            notes: {
              信任: "高",
              专业度: "中低",
              压力: "朋友压力较大",
            },
          },
          {
            name: "单日统筹",
            notes: {
              信任: "需提前磨合",
              专业度: "高",
              压力: "新人和朋友压力低",
            },
          },
          {
            name: "酒店/场地方对接人",
            notes: {
              信任: "流程内事务靠谱",
              专业度: "只覆盖场地相关",
              压力: "跨商家协调不足",
            },
          },
        ],
        criteria: ["信任", "专业度", "压力"],
        gaps: ["候选朋友是否愿意承担未确认", "单日统筹报价未确认"],
        finalChoice: "",
        conclusion: "",
        followUps: [
          ["确认总负责人权限和可拍板事项", "双方一起", -38],
          ["准备当天负责人交接清单", "当天负责人", -21],
        ],
      },
    ],
    outputs: ["输出总负责人、分工表、可拍板权限和应急联系人。"],
    packageItems: ["当天负责人需要拿到流程表、供应商表、雨备方案和应急联系人。"],
  },
  {
    id: "package",
    name: "婚礼执行包",
    type: "输出",
    locked: true,
    owner: "双方一起",
    description: "从各节点汇总当天流程、负责人、风险预案、供应商和决策结果。",
    budgetNote: "执行包应同步尾款和备用金。",
    tasks: [
      ["生成第一版婚礼执行包", "双方一起", -14, false],
      ["婚礼前一周更新终版执行包", "当天负责人", -7, false],
    ],
    outputs: ["执行包是工作台的最终输出，不是单独填写的文档。"],
    packageItems: ["最终交给当天负责人和关键朋友。"],
  },
];

let activeView = "map";
let selectedNodeId = "lawn";
let decisionFilter = "all";
let activeTaskNodeId = selectedNodeId;
let toastTimer = null;
let checklistStatusFilter = "all";
let checklistOwnerFilter = "all";
let checklistStageFilter = "all";
let checklistStatusSavingItemId = "";
let checklistFormState = null;
let checklistSortDraft = null;
let checklistSortDragState = null;
let decisionDialogState = null;
let pendingConfirmResolver = null;
const checklistDrafts = new Map();
let checklistDraftTimer = null;
const state = loadState();

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function daysBetween(dateLike) {
  const today = new Date();
  const target = new Date(dateLike);
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / 86400000);
}

function formatDate(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.valueOf())) return "--";
  return date.toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  });
}

function formatFullDate(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.valueOf())) return "--";
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHTML(value).replaceAll("\n", " ");
}

function makeDefaultState() {
  const weddingDate = isoDate(addDays(new Date(), 120));
  const profile = {
    groom: "陈亦川",
    bride: "林予安",
    date: weddingDate,
    city: "上海",
    venue: "湖畔花园宴会厅 + 近郊别墅",
    budget: 180000,
    guestCount: 110,
  };

  const nodes = nodeTemplates.map((template, index) => ({
    id: template.id,
    name: template.name,
    type: template.type,
    locked: Boolean(template.locked),
    enabled: true,
    order: index,
    owner: template.owner,
    description: template.description,
    budgetNote: template.budgetNote,
    outputs: template.outputs.map((text, outputIndex) => ({
      id: `${template.id}-output-${outputIndex}`,
      text,
      sourceDecisionId: "",
    })),
    packageItems: [...template.packageItems],
  }));

  const tasks = [];
  const decisions = [];
  nodeTemplates.forEach((template) => {
    template.tasks.forEach(([title, owner, dueOffset, done], taskIndex) => {
      tasks.push({
        id: `${template.id}-task-${taskIndex}`,
        nodeId: template.id,
        title,
        owner,
        dueOffset,
        done,
        sourceDecisionId: "",
      });
    });

    (template.decisions || []).forEach((decision, decisionIndex) => {
      decisions.push({
        ...deepClone(decision),
        id: `${template.id}-decision-${decisionIndex}`,
        linkedTaskIds: [],
        nodeId: template.id,
        outputGenerated: false,
      });
    });
  });

  const defaultState = {
    version: 2,
    profile,
    nodes,
    tasks,
    decisions,
    customNodeCount: 0,
  };
  normalizeAppState(defaultState);
  checklistCore.ensureExecutionChecklistState(defaultState);
  return defaultState;
}

function normalizeAppState(project) {
  project.tasks = Array.isArray(project.tasks) ? project.tasks : [];
  project.decisions = Array.isArray(project.decisions) ? project.decisions : [];
  project.decisions.forEach((decision) => {
    decision.title = decision.title || "未命名决策";
    decision.question = decision.question || "补充需要拍板的问题。";
    decision.type = decision.type || "自定义";
    decision.owner = decision.owner || "双方一起";
    decision.participants = decision.participants || "新人";
    decision.status = DECISION_STATUSES.includes(decision.status) ? decision.status : "信息收集中";
    decision.options = Array.isArray(decision.options) ? decision.options : [];
    decision.criteria = Array.isArray(decision.criteria) && decision.criteria.length ? decision.criteria : [...DEFAULT_COMPARISON_CRITERIA];
    decision.gaps = Array.isArray(decision.gaps) ? decision.gaps : [];
    decision.finalChoice = decision.finalChoice || "";
    decision.conclusion = decision.conclusion || "";
    decision.followUps = Array.isArray(decision.followUps) ? decision.followUps : [];
    decision.linkedTaskIds = Array.isArray(decision.linkedTaskIds) ? decision.linkedTaskIds : [];
    decision.outputGenerated = Boolean(decision.outputGenerated || decision.status === "已转任务");
  });
  return project;
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.version >= 2) {
        normalizeAppState(parsed);
        checklistCore.ensureExecutionChecklistState(parsed);
        return parsed;
      }
    }
  } catch (error) {
    console.warn(error);
  }
  return makeDefaultState();
}

function saveState() {
  normalizeAppState(state);
  checklistCore.ensureExecutionChecklistState(state);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function enabledNodes() {
  return state.nodes
    .filter((node) => node.enabled)
    .sort((a, b) => a.order - b.order);
}

function getNode(nodeId) {
  return state.nodes.find((node) => node.id === nodeId);
}

function activeOwners() {
  return checklistCore.activeOwners(state);
}

function ownerSelectOptions(selectedOwnerId = "") {
  return activeOwners()
    .map((owner) => `<option value="${owner.ownerId}" ${owner.ownerId === selectedOwnerId ? "selected" : ""}>${escapeHTML(owner.name)}</option>`)
    .join("");
}

function ownerNameOptions(selectedName = "") {
  return activeOwners()
    .map((owner) => `<option value="${escapeAttribute(owner.name)}" ${owner.name === selectedName ? "selected" : ""}>${escapeHTML(owner.name)}</option>`)
    .join("");
}

function ownerNameFromIds(ownerIds) {
  return checklistCore.ownerNames(state, ownerIds);
}

function firstOwnerIdByName(name) {
  return activeOwners().find((owner) => owner.name === name)?.ownerId || activeOwners()[0]?.ownerId || "";
}

function taskOwnerText(task) {
  if (Array.isArray(task.ownerIds) && task.ownerIds.length) {
    return ownerNameFromIds(task.ownerIds);
  }
  return task.owner || "未填写";
}

function nodeTasks(nodeId) {
  return state.tasks.filter((task) => task.nodeId === nodeId);
}

function nodeDecisions(nodeId) {
  return state.decisions.filter((decision) => decision.nodeId === nodeId);
}

function taskById(taskId) {
  return state.tasks.find((task) => task.id === taskId);
}

function linkedTasksForDecision(decision) {
  return (decision.linkedTaskIds || [])
    .map(taskById)
    .filter(Boolean);
}

function taskDueDate(task) {
  if (Number.isFinite(task.dueOffset)) {
    return isoDate(addDays(new Date(state.profile.date), task.dueOffset));
  }
  return task.dueDate;
}

function decisionDueDate(decision) {
  if (Number.isFinite(decision.dueOffset)) {
    return isoDate(addDays(new Date(state.profile.date), decision.dueOffset));
  }
  return decision.dueDate;
}

function decisionDueDateForForm(decision) {
  return decisionDueDate(decision) || isoDate(addDays(new Date(), 7));
}

function decisionStatusOptions(selectedStatus) {
  return DECISION_STATUSES
    .map((status) => `<option value="${escapeAttribute(status)}" ${selectedStatus === status ? "selected" : ""}>${escapeHTML(status)}</option>`)
    .join("");
}

function defaultDecisionOptions() {
  return [
    { name: "方案 A", notes: { "预算/成本": "待补充", "体验/价值": "待补充", "风险/执行": "待补充" } },
    { name: "方案 B", notes: { "预算/成本": "待补充", "体验/价值": "待补充", "风险/执行": "待补充" } },
    { name: "方案 C", notes: { "预算/成本": "待补充", "体验/价值": "待补充", "风险/执行": "待补充" } },
  ];
}

function normalizedDecisionComparison(decision = {}) {
  const criteria = Array.isArray(decision.criteria) && decision.criteria.length
    ? decision.criteria
    : [...DEFAULT_COMPARISON_CRITERIA];
  const sourceOptions = Array.isArray(decision.options) && decision.options.length
    ? decision.options
    : defaultDecisionOptions();
  const options = sourceOptions.slice(0, MAX_DECISION_OPTIONS).map((option, index) => ({
    name: option.name || `方案 ${index + 1}`,
    notes: criteria.reduce((notes, criterion) => {
      notes[criterion] = option.notes?.[criterion] || "";
      return notes;
    }, {}),
  }));
  return { criteria, options };
}

function renderDecisionComparisonEditor(decision) {
  const container = document.getElementById("decisionComparisonEditor");
  const { criteria, options } = normalizedDecisionComparison(decision);
  const optionColumns = options
    .map((option, optionIndex) => `
      <div class="decision-compare-cell decision-compare-head" data-decision-option-index="${optionIndex}">
        <input data-decision-option-name value="${escapeAttribute(option.name)}" placeholder="方案名称" autocomplete="off" />
        <button class="icon-button danger" data-remove-decision-option="${optionIndex}" type="button" aria-label="删除方案">×</button>
      </div>
    `)
    .join("");
  const rows = criteria
    .map((criterion, criterionIndex) => `
      <div class="decision-compare-row" data-decision-criterion-index="${criterionIndex}">
        <div class="decision-compare-cell decision-compare-criterion">
          <input data-decision-criterion-name value="${escapeAttribute(criterion)}" placeholder="对比项，例如：预算/成本" autocomplete="off" />
          <button class="icon-button danger" data-remove-decision-criterion="${criterionIndex}" type="button" aria-label="删除对比项">×</button>
        </div>
        ${options
          .map((option, optionIndex) => `
            <div class="decision-compare-cell">
              <textarea data-decision-comparison-value data-option-index="${optionIndex}" data-criterion-index="${criterionIndex}" rows="3" placeholder="填写纯文字说明">${escapeHTML(option.notes?.[criterion] || "")}</textarea>
            </div>
          `)
          .join("")}
      </div>
    `)
    .join("");
  container.innerHTML = `
    <div class="decision-compare-table" style="--decision-option-count: ${options.length}">
      <div class="decision-compare-row decision-compare-header">
        <div class="decision-compare-cell decision-compare-corner">对比项</div>
        ${optionColumns}
      </div>
      ${rows}
    </div>
  `;
}

function readDecisionComparisonEditor() {
  const criterionInputs = [...document.querySelectorAll("#decisionComparisonEditor [data-decision-criterion-name]")]
    .slice(0, MAX_DECISION_CRITERIA);
  const seenCriteria = new Map();
  const criteria = criterionInputs.map((input, index) => {
    const baseName = input.value.trim() || `对比项 ${index + 1}`;
    const count = seenCriteria.get(baseName) || 0;
    seenCriteria.set(baseName, count + 1);
    return count ? `${baseName} ${count + 1}` : baseName;
  });
  const options = [...document.querySelectorAll("#decisionComparisonEditor [data-decision-option-index]")]
    .slice(0, MAX_DECISION_OPTIONS)
    .map((node, optionIndex) => {
      const name = node.querySelector("[data-decision-option-name]")?.value.trim() || `方案 ${optionIndex + 1}`;
      const notes = {};
      criteria.forEach((criterion, criterionIndex) => {
        const control = [...document.querySelectorAll("#decisionComparisonEditor [data-decision-comparison-value]")]
          .find((item) => Number(item.dataset.optionIndex) === optionIndex && Number(item.dataset.criterionIndex) === criterionIndex);
        notes[criterion] = control?.value.trim() || "";
      });
      return { name, notes };
    });
  return {
    criteria: criteria.length ? criteria : [...DEFAULT_COMPARISON_CRITERIA],
    options: options.length ? options : defaultDecisionOptions(),
  };
}

function overdueTasks() {
  return state.tasks.filter((task) => {
    const node = getNode(task.nodeId);
    return node?.enabled && !task.done && daysBetween(taskDueDate(task)) < 0;
  });
}

function overdueDecisions() {
  return state.decisions.filter((decision) => {
    const node = getNode(decision.nodeId);
    return (
      node?.enabled &&
      OPEN_DECISION_STATUSES.includes(decision.status) &&
      daysBetween(decisionDueDate(decision)) < 0
    );
  });
}

function nodeStatus(nodeId) {
  const tasks = nodeTasks(nodeId);
  const decisions = nodeDecisions(nodeId);
  const hasRisk =
    tasks.some((task) => !task.done && daysBetween(taskDueDate(task)) < 0) ||
    decisions.some(
      (decision) =>
        OPEN_DECISION_STATUSES.includes(decision.status) &&
        daysBetween(decisionDueDate(decision)) < 0,
    );
  if (hasRisk) return { key: "risk", label: "有风险" };

  const hasBlockingDecision = decisions.some((decision) =>
    ["信息收集中", "对比中", "待拍板", "已决定"].includes(decision.status),
  );
  if (hasBlockingDecision) return { key: "decision", label: "待决策" };

  const openTasks = tasks.filter((task) => !task.done);
  if (openTasks.length) {
    const doneTasks = tasks.filter((task) => task.done);
    return doneTasks.length ? { key: "progress", label: "进行中" } : { key: "todo", label: "待执行" };
  }

  return { key: "ready", label: "已就绪" };
}

function readinessScore() {
  const nodes = enabledNodes();
  if (!nodes.length) return 0;
  const points = nodes.reduce((sum, node) => {
    const status = nodeStatus(node.id).key;
    if (status === "ready") return sum + 1;
    if (status === "progress") return sum + 0.55;
    if (status === "todo") return sum + 0.35;
    if (status === "decision") return sum + 0.25;
    return sum + 0.1;
  }, 0);
  return Math.round((points / nodes.length) * 100);
}

function openDecisions() {
  return state.decisions.filter((decision) => {
    const node = getNode(decision.nodeId);
    return node?.enabled && OPEN_DECISION_STATUSES.includes(decision.status);
  });
}

function openTasks() {
  return state.tasks.filter((task) => {
    const node = getNode(task.nodeId);
    return node?.enabled && !task.done;
  });
}

function renderProfile() {
  const form = document.getElementById("profileForm");
  Object.entries(state.profile).forEach(([key, value]) => {
    const input = form.elements[key];
    if (input) input.value = value;
  });

  const days = daysBetween(state.profile.date);
  document.getElementById("daysLeft").textContent =
    days >= 0 ? `${days} 天` : `已过 ${Math.abs(days)} 天`;

  const readiness = readinessScore();
  document.getElementById("readinessText").textContent = `${readiness}%`;
  document.getElementById("readinessMeter").style.width = `${readiness}%`;
  document.getElementById("readinessHint").textContent = readiness >= 80
    ? "关键节点已经接近可执行，重点检查风险和交接。"
    : "先处理待拍板决策和逾期事项，就绪度会明显上升。";
}

function renderTabs() {
  document.querySelectorAll(".tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === activeView);
  });
  document.querySelectorAll(".view-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `${activeView}View`);
  });
}

function renderStats() {
  const enabled = enabledNodes();
  const riskCount = overdueTasks().length + overdueDecisions().length;
  document.getElementById("enabledNodeStat").textContent = enabled.length;
  document.getElementById("decisionStat").textContent = openDecisions().length;
  document.getElementById("taskStat").textContent = openTasks().length;
  document.getElementById("riskStat").textContent = riskCount;
}

function renderMap() {
  const map = document.getElementById("nodeMap");
  map.innerHTML = enabledNodes()
    .map((node) => {
      const status = nodeStatus(node.id);
      const tasks = nodeTasks(node.id);
      const decisions = nodeDecisions(node.id);
      const openTaskCount = tasks.filter((task) => !task.done).length;
      const openDecisionCount = decisions.filter((decision) =>
        OPEN_DECISION_STATUSES.includes(decision.status),
      ).length;
      return `
        <article class="node-dot status-${status.key} ${node.id === selectedNodeId ? "selected" : ""}" data-node-id="${node.id}">
          <div class="node-pin" aria-hidden="true"></div>
          <div>
            <h3>${escapeHTML(node.name)}</h3>
            <p>${escapeHTML(node.description)}</p>
          </div>
          <div class="node-meta">
            <span class="badge ${status.key}">${status.label}</span>
            <span class="badge">${escapeHTML(node.type)}</span>
            <span class="badge">${openDecisionCount} 决策</span>
            <span class="badge">${openTaskCount} 待办</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderTemplateGrid() {
  const grid = document.getElementById("templateGrid");
  grid.innerHTML = state.nodes
    .map((node) => {
      const status = nodeStatus(node.id);
      const canToggle = !node.locked;
      return `
        <article class="template-card ${node.enabled ? "" : "disabled"}">
          <div class="template-actions">
            <span class="badge ${status.key}">${node.enabled ? status.label : "未启用"}</span>
            <button
              class="${canToggle ? "ghost-button" : "ghost-button"}"
              data-toggle-node="${node.id}"
              type="button"
              ${canToggle ? "" : "disabled"}
            >
              ${canToggle ? (node.enabled ? "隐藏" : "启用") : "核心"}
            </button>
          </div>
          <div>
            <h3>${escapeHTML(node.name)}</h3>
            <p>${escapeHTML(node.description)}</p>
          </div>
          <div class="node-meta">
            <span class="badge">${escapeHTML(node.type)}</span>
            <span class="badge">${escapeHTML(node.owner)}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderNodeSelectors() {
  if (!getNode(selectedNodeId)?.enabled) {
    selectedNodeId = enabledNodes()[0]?.id || "profile";
  }

  const options = enabledNodes()
    .map((node) => `<option value="${node.id}" ${node.id === selectedNodeId ? "selected" : ""}>${escapeHTML(node.name)}</option>`)
    .join("");
  document.getElementById("nodeSelect").innerHTML = options;
  const decisionDialogNodeSelect = document.getElementById("decisionDialogNodeSelect");
  if (decisionDialogNodeSelect && !decisionDialogNodeSelect.matches(":focus")) {
    const current = decisionDialogNodeSelect.value || selectedNodeId;
    decisionDialogNodeSelect.innerHTML = enabledNodes()
      .map((node) => `<option value="${node.id}" ${node.id === current ? "selected" : ""}>${escapeHTML(node.name)}</option>`)
      .join("");
  }
  const decisionOwnerSelect = document.querySelector("#decisionDialogForm select[name='owner']");
  if (decisionOwnerSelect && !decisionOwnerSelect.matches(":focus")) {
    const current = decisionOwnerSelect.value || "双方一起";
    decisionOwnerSelect.innerHTML = ownerNameOptions(current);
  }
}

function renderNodeDetail() {
  const node = getNode(selectedNodeId) || enabledNodes()[0];
  if (!node) return;
  selectedNodeId = node.id;
  const status = nodeStatus(node.id);
  const tasks = nodeTasks(node.id);
  const decisions = nodeDecisions(node.id);
  const doneTasks = tasks.filter((task) => task.done).length;

  document.getElementById("nodeTitle").textContent = node.name;
  document.getElementById("nodeSummary").innerHTML = `
    <div class="section-heading">
      <span>${escapeHTML(node.name)}</span>
      <span class="badge ${status.key}">${status.label}</span>
    </div>
    <p>${escapeHTML(node.description)}</p>
    <div class="summary-line"><span>负责人</span><strong>${escapeHTML(node.owner)}</strong></div>
    <div class="summary-line"><span>节点类型</span><strong>${escapeHTML(node.type)}</strong></div>
    <div class="summary-line"><span>任务进度</span><strong>${doneTasks} / ${tasks.length}</strong></div>
    <div class="summary-line"><span>决策数量</span><strong>${decisions.length}</strong></div>
    <div class="summary-line"><span>预算影响</span><strong>${escapeHTML(node.budgetNote)}</strong></div>
  `;

  renderNodeTasks(node.id);
  renderNodeDecisions(node.id);
  renderNodeOutputs(node.id);
  renderNodeCandidates(node.id);
}

function renderNodeTasks(nodeId) {
  const list = document.getElementById("nodeTaskList");
  const tasks = nodeTasks(nodeId).sort((a, b) => new Date(taskDueDate(a)) - new Date(taskDueDate(b)));
  list.innerHTML = tasks.length
    ? tasks
        .map((task) => {
          const due = taskDueDate(task);
          const days = daysBetween(due);
          const dueLabel = days >= 0 ? `${days} 天后` : `逾期 ${Math.abs(days)} 天`;
          const joinedItem = checklistCore.findActiveItemBySource(state, {
            sourceType: "task",
            sourceTaskId: task.id,
          });
          const joinButton = task.done
            ? joinedItem
              ? `<button class="ghost-button" data-open-checklist-item="${joinedItem.id}" type="button">查看执行清单项</button>`
              : `<button class="ghost-button" data-join-task="${task.id}" type="button">记录结果并加入执行清单</button>`
            : "";
          return `
            <article class="task-row ${task.done ? "done" : ""}">
              <input class="task-check" type="checkbox" data-task-id="${task.id}" ${task.done ? "checked" : ""} aria-label="切换任务状态" />
              <div>
                <p class="row-title">${escapeHTML(task.title)}</p>
                <p class="row-meta">${formatDate(due)} · ${escapeHTML(taskOwnerText(task))} · ${dueLabel}</p>
              </div>
              <div class="checklist-row-actions">
                ${joinButton}
                <button class="delete-button" data-delete-task="${task.id}" type="button" aria-label="删除任务">×</button>
              </div>
            </article>
          `;
        })
        .join("")
    : `<p class="subtle">这个节点还没有任务。</p>`;
}

function renderNodeDecisions(nodeId) {
  const list = document.getElementById("nodeDecisionList");
  const decisions = nodeDecisions(nodeId);
  list.innerHTML = decisions.length
    ? decisions
        .map((decision) => renderDecisionSummaryCard(decision, "node"))
        .join("")
    : `<p class="subtle">这个节点还没有决策 item。</p>`;
}

function renderNodeOutputs(nodeId) {
  const list = document.getElementById("nodeOutputList");
  const node = getNode(nodeId);
  list.innerHTML = node.outputs.length
    ? node.outputs
        .map((output) => `
          <article class="output-row">
            <div>
              <p class="row-title">${escapeHTML(output.text)}</p>
              <p class="row-meta">${output.sourceDecisionId ? "来自决策生成" : "模板素材"}</p>
            </div>
            <span class="badge ready">执行包素材</span>
          </article>
        `)
        .join("")
    : `<p class="subtle">这里会展示自动汇总到执行包的节点素材；决策生成后续任务后也会补充到这里。</p>`;
}

function decisionMatchesFilter(decision) {
  if (decisionFilter === "all") return true;
  if (decisionFilter === "open") return ["信息收集中", "对比中"].includes(decision.status);
  if (decisionFilter === "blocked") return ["待拍板", "已决定"].includes(decision.status);
  if (decisionFilter === "done") return DONE_DECISION_STATUSES.includes(decision.status);
  return true;
}

function renderDecisionBoard() {
  const board = document.getElementById("decisionBoard");
  document.querySelectorAll("#decisionFilter button").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === decisionFilter);
  });

  const decisions = state.decisions
    .filter((decision) => getNode(decision.nodeId)?.enabled)
    .filter(decisionMatchesFilter);

  board.innerHTML = decisions.length
    ? decisions
        .map((decision) => renderDecisionSummaryCard(decision, "center"))
        .join("")
    : `<p class="subtle">当前筛选下没有决策 item。</p>`;
}

function renderDecisionSummaryCard(decision, context = "center") {
  const view = makeDecisionViewModel(decision);
  const joinedItem = checklistCore.findActiveItemBySource(state, {
    sourceType: "decision_item",
    sourceDecisionId: view.id,
  });
  const canJoinChecklist = ["已决定", "已转任务"].includes(view.status);
  const joinChecklistButton = canJoinChecklist
    ? joinedItem
      ? `<button class="ghost-button" data-decision-action="open-checklist-item" data-checklist-item-id="${joinedItem.id}" type="button">查看执行清单项</button>`
      : `<button class="ghost-button" data-decision-action="join-checklist" data-decision-id="${view.id}" type="button">加入执行清单</button>`
    : "";
  const linkedTaskText = view.linkedTaskCount ? `${view.linkedTaskCount} 个关联任务` : "未关联任务";
  const outputButton = view.outputGenerated
    ? `<button class="ghost-button" type="button" disabled>已生成后续任务</button>`
    : `<button class="primary-button" data-decision-action="output" data-decision-id="${view.id}" type="button">生成后续任务</button>`;

  return `
    <article class="decision-card ${context === "node" ? "node-decision-card" : ""}" data-decision-id="${view.id}">
      <div class="decision-top">
        <div>
          <div class="node-meta">
            <span class="badge">${escapeHTML(view.nodeName)}</span>
            <span class="badge">${escapeHTML(view.type)}</span>
            <span class="badge ${view.isOverdue ? "risk" : "progress"}">${view.dueDateLabel} · ${view.dueDistanceLabel}</span>
            <span class="badge">${escapeHTML(linkedTaskText)}</span>
          </div>
          <h3>${escapeHTML(view.title)}</h3>
          <p>${escapeHTML(view.question)}</p>
        </div>
        <span class="badge ${DONE_DECISION_STATUSES.includes(view.status) ? "ready" : "decision"}">${escapeHTML(view.status)}</span>
      </div>

      <div class="decision-actions">
        <button class="ghost-button" data-decision-action="open-detail" data-decision-id="${view.id}" type="button">查看</button>
        <button class="ghost-button" data-decision-action="edit-detail" data-decision-id="${view.id}" type="button">编辑</button>
        ${outputButton}
        ${joinChecklistButton}
        ${context === "center" ? `<button class="ghost-button" data-decision-action="open-node" data-target-node-id="${view.nodeId}" type="button">查看节点</button>` : ""}
        <button class="ghost-button danger" data-decision-action="delete" data-decision-id="${view.id}" type="button">删除</button>
      </div>
    </article>
  `;
}

function renderComparisonTable(decisionView) {
  const options = decisionView.options.length
    ? decisionView.options.slice(0, 3)
    : [
        { name: "方案 A", notes: {} },
        { name: "方案 B", notes: {} },
        { name: "方案 C", notes: {} },
      ];
  const criteria = decisionView.criteria.length ? decisionView.criteria : ["预算", "体验", "风险"];
  const cells = [
    `<div class="compare-row">
      <div class="compare-cell">维度</div>
      ${options.map((option) => `<div class="compare-cell">${escapeHTML(option.name)}</div>`).join("")}
    </div>`,
    ...criteria.map((criterion) => `
      <div class="compare-row">
        <div class="compare-cell">${escapeHTML(criterion)}</div>
        ${options.map((option) => `<div class="compare-cell">${escapeHTML(option.notes?.[criterion] || "待补充")}</div>`).join("")}
      </div>
    `),
  ];
  return `<div class="compare-table">${cells.join("")}</div>`;
}

function makeDecisionViewModel(decision) {
  const node = getNode(decision.nodeId);
  const due = decisionDueDate(decision);
  const days = daysBetween(due);
  return {
    id: decision.id,
    nodeId: decision.nodeId,
    nodeName: node?.name || "未知节点",
    title: decision.title,
    question: decision.question,
    type: decision.type,
    owner: decision.owner,
    participants: decision.participants,
    status: decision.status,
    finalChoice: decision.finalChoice || "",
    conclusion: decision.conclusion || "",
    gaps: decision.gaps || [],
    options: decision.options || [],
    criteria: decision.criteria || [],
    linkedTaskCount: linkedTasksForDecision(decision).length,
    outputGenerated: Boolean(decision.outputGenerated),
    dueDateLabel: formatDate(due),
    dueDistanceLabel: days >= 0 ? `${days} 天后` : `逾期 ${Math.abs(days)} 天`,
    isOverdue: days < 0,
  };
}

function renderPackage() {
  const timeline = enabledNodes().flatMap((node) => node.packageItems.map((item) => ({ node, item })));
  const owners = collectOwnerHandoff();
  const risks = [
    ...overdueTasks().map((task) => `${getNode(task.nodeId)?.name}: ${task.title} 已逾期`),
    ...overdueDecisions().map((decision) => `${getNode(decision.nodeId)?.name}: ${decision.title} 已逾期`),
    ...openDecisions().flatMap((decision) => decision.gaps || []).slice(0, 8),
  ];
  const decisionOutputs = state.decisions
    .filter((decision) => decision.status === "已转任务")
    .map((decision) => `${getNode(decision.nodeId)?.name}: ${decision.title} -> ${decision.finalChoice || "已输出"}`);

  renderPackageList("timelinePackage", timeline.map(({ node, item }) => `${node.name}: ${item}`));
  renderPackageList("ownerPackage", owners);
  renderPackageList("riskPackage", risks.length ? risks : ["暂无逾期风险，继续检查待拍板决策。"]);
  renderPackageList("decisionPackage", decisionOutputs.length ? decisionOutputs : ["还没有决策生成的执行包素材。"]);
}

function collectOwnerHandoff() {
  const byOwner = new Map();
  openTasks().forEach((task) => {
    const ownerText = taskOwnerText(task);
    if (!byOwner.has(ownerText)) byOwner.set(ownerText, []);
    byOwner.get(ownerText).push(`${getNode(task.nodeId)?.name}: ${task.title}`);
  });
  return [...byOwner.entries()].map(([owner, tasks]) => `${owner}: ${tasks.slice(0, 3).join("；")}`);
}

function renderPackageList(id, items) {
  document.getElementById(id).innerHTML = items
    .map((item) => `
      <article class="package-row">
        <p class="row-title">${escapeHTML(item)}</p>
        <span class="badge ready">汇总</span>
      </article>
    `)
    .join("");
}

function stageLabel(stageKey) {
  return checklistCore.STAGES.find((stage) => stage.stageKey === stageKey)?.label || "未分组";
}

function isChecklistFiltered() {
  return checklistStatusFilter !== "all" || checklistOwnerFilter !== "all" || checklistStageFilter !== "all";
}

function canEditProject() {
  return state.currentRole === "editor";
}

function sourceLabel(item) {
  if (item.sourceType === "task") return "任务";
  if (item.sourceType === "decision_item") return "决策项";
  if (item.sourceType === "node_checklist_template") return "节点推荐";
  return "手动";
}

function renderNodeCandidates(nodeId) {
  const list = document.getElementById("nodeCandidateList");
  const button = document.getElementById("joinNodeCandidatesBtn");
  const candidates = checklistCore.getNodeCandidates(recommendationConfig, nodeId);
  const canEdit = canEditProject();
  button.disabled = !canEdit || !candidates.length;

  if (!candidates.length) {
    list.innerHTML = `<p class="subtle">这个节点暂无推荐执行项。</p>`;
    return;
  }

  list.innerHTML = candidates
    .map((candidate) => {
      const joinedItem = checklistCore.findActiveItemBySource(state, {
        sourceType: "node_checklist_template",
        sourceNodeId: nodeId,
        sourceCandidateKey: candidate.candidateKey,
      });
      return `
        <article class="candidate-row">
          <label>
            <input
              type="checkbox"
              data-node-candidate="${escapeAttribute(candidate.candidateKey)}"
              ${joinedItem || !canEdit ? "disabled" : ""}
            />
            <span class="row-title">${escapeHTML(candidate.content)}</span>
            <span class="row-meta">${escapeHTML(stageLabel(candidate.stageKey))}${candidate.timeText ? ` · ${escapeHTML(candidate.timeText)}` : ""}${candidate.noteText ? ` · ${escapeHTML(candidate.noteText.split("\n")[0])}` : ""}</span>
          </label>
          <div class="candidate-actions">
            ${joinedItem ? `<span class="badge ready">已加入</span><button class="ghost-button" data-open-checklist-item="${joinedItem.id}" type="button">查看执行清单项</button>` : ""}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderChecklist() {
  let view;
  try {
    view = checklistCore.getOrCreateExecutionChecklist(state).result;
  } catch (error) {
    document.getElementById("checklistStats").innerHTML = "";
    document.getElementById("checklistSortActions").innerHTML = "";
    document.getElementById("checklistContent").innerHTML = `
      <section class="empty-checklist">
        <p class="row-title">无法加载执行清单，请稍后重试</p>
        <button class="primary-button" id="retryChecklistLoadBtn" type="button">重试</button>
      </section>
    `;
    return;
  }
  const canEdit = canEditProject();
  document.getElementById("projectRoleSelect").value = state.currentRole;
  document.getElementById("addChecklistItemBtn").disabled = !canEdit || Boolean(checklistSortDraft);
  document.getElementById("manageOwnersBtn").disabled = !canEdit || Boolean(checklistSortDraft);
  document.getElementById("sortChecklistBtn").disabled = !canEdit || isChecklistFiltered() || view.items.length === 0;

  document.getElementById("checklistStats").innerHTML = `
    <article class="checklist-stat"><span>全部</span><strong>${view.summary.totalCount}</strong></article>
    <article class="checklist-stat"><span>待确认</span><strong>${view.summary.pendingCount}</strong></article>
    <article class="checklist-stat"><span>已确认</span><strong>${view.summary.confirmedCount}</strong></article>
  `;

  document.querySelectorAll("#checklistStatusFilter button").forEach((button) => {
    button.classList.toggle("active", button.dataset.checklistStatusFilter === checklistStatusFilter);
  });
  renderChecklistOwnerFilter();
  renderChecklistStageFilter();
  renderChecklistSortActions();

  if (checklistSortDraft) {
    renderChecklistSortDraft();
    return;
  }

  if (view.items.length === 0) {
    document.getElementById("checklistContent").innerHTML = `
      <section class="empty-checklist">
        <p class="row-title">还没有执行项，完成节点规划后可逐步加入</p>
        <button class="primary-button" data-add-checklist-stage="ungrouped" type="button" ${canEdit ? "" : "disabled"}>新增执行项</button>
      </section>
    `;
    return;
  }

  const filteredItems = view.items.filter((item) => {
    const statusMatch =
      checklistStatusFilter === "all" ||
      (checklistStatusFilter === "pending" && item.status === "待确认") ||
      (checklistStatusFilter === "confirmed" && item.status === "已确认");
    const ownerMatch =
      checklistOwnerFilter === "all" ||
      (checklistOwnerFilter === "unassigned" && item.ownerIds.length === 0) ||
      item.ownerIds.includes(checklistOwnerFilter);
    const stageMatch = checklistStageFilter === "all" || item.stageKey === checklistStageFilter;
    return statusMatch && ownerMatch && stageMatch;
  });

  const stagesToRender = checklistCore.STAGES
    .map((stage) => ({
      ...stage,
      items: filteredItems.filter((item) => item.stageKey === stage.stageKey),
    }))
    .filter((stage) => !isChecklistFiltered() || stage.items.length);

  document.getElementById("checklistContent").innerHTML = stagesToRender.length
    ? stagesToRender.map((stage) => renderChecklistStage(stage, canEdit)).join("")
    : `<p class="subtle">当前筛选下没有执行项。</p>`;
}

function renderChecklistOwnerFilter() {
  const select = document.getElementById("checklistOwnerFilter");
  const validOwnerFilters = new Set(["all", "unassigned", ...activeOwners().map((owner) => owner.ownerId)]);
  if (!validOwnerFilters.has(checklistOwnerFilter)) checklistOwnerFilter = "all";
  const options = [
    `<option value="all">所有负责人</option>`,
    `<option value="unassigned">未填写</option>`,
    ...activeOwners().map((owner) => `<option value="${owner.ownerId}">${escapeHTML(owner.name)}</option>`),
  ];
  select.innerHTML = options.join("");
  select.value = checklistOwnerFilter;
}

function renderChecklistStageFilter() {
  const select = document.getElementById("checklistStageFilter");
  const validStageFilters = new Set(["all", ...checklistCore.STAGES.map((stage) => stage.stageKey)]);
  if (!validStageFilters.has(checklistStageFilter)) checklistStageFilter = "all";
  select.innerHTML = [
    `<option value="all">所有执行阶段</option>`,
    ...checklistCore.STAGES.map((stage) => `<option value="${stage.stageKey}">${escapeHTML(stage.label)}</option>`),
  ].join("");
  select.value = checklistStageFilter;
}

function renderChecklistSortActions() {
  const container = document.getElementById("checklistSortActions");
  container.innerHTML = checklistSortDraft
    ? `
      <button class="ghost-button" id="cancelChecklistSortBtn" type="button">取消</button>
      <button class="primary-button" id="saveChecklistSortBtn" type="button">保存顺序</button>
    `
    : "";
}

function renderChecklistStage(stage, canEdit) {
  const addButton = !isChecklistFiltered()
    ? `<button class="text-button" data-add-checklist-stage="${stage.stageKey}" type="button" ${canEdit ? "" : "disabled"}>+ 新增执行项</button>`
    : `<span class="subtle">清除筛选后可新增执行项</span>`;
  const rows = stage.items.length
    ? stage.items.map((item) => renderChecklistItemRow(item, canEdit)).join("")
    : `<p class="subtle">这个阶段暂时没有执行项。</p>`;
  return `
    <section class="checklist-stage">
      <div class="checklist-stage-header">
        <div>
          <p class="row-title">${escapeHTML(stage.label)}</p>
          <p class="row-meta">${stage.items.length} 项</p>
        </div>
        ${addButton}
      </div>
      <div class="checklist-content">${rows}</div>
    </section>
  `;
}

function renderChecklistItemRow(item, canEdit) {
  const isLocked = checklistStatusSavingItemId === item.id;
  const noteFirstLine = item.noteText ? item.noteText.split("\n")[0] : "";
  const source = sourceLabel(item);
  const nextStatus = item.status === "待确认" ? "已确认" : "待确认";
  return `
    <article class="checklist-item-row ${item.status === "已确认" ? "confirmed" : ""} ${isLocked ? "locked" : ""}">
      <div class="checklist-row-main">
        <div class="node-meta">
          <span class="badge ${item.status === "已确认" ? "ready" : "decision"}">${escapeHTML(item.status)}</span>
          <span class="badge">${escapeHTML(source)}</span>
          <button class="text-button source-link" data-open-checklist-source="${item.id}" type="button">查看来源</button>
        </div>
        <p class="row-title">${escapeHTML(item.content)}</p>
        <p class="row-meta">${escapeHTML(ownerNameFromIds(item.ownerIds))}${item.timeText ? ` · ${escapeHTML(item.timeText)}` : ""}${noteFirstLine ? ` · ${escapeHTML(noteFirstLine)}` : ""}</p>
      </div>
      <div class="checklist-row-actions">
        <button class="ghost-button" data-toggle-checklist-status="${item.id}" data-next-status="${nextStatus}" type="button" ${canEdit && !isLocked ? "" : "disabled"}>${escapeHTML(nextStatus)}</button>
        <button class="ghost-button" data-edit-checklist-item="${item.id}" type="button">${canEdit ? "编辑" : "查看"}</button>
      </div>
    </article>
  `;
}

function renderChecklistSortDraft() {
  const itemById = new Map(checklistCore.activeItems(state).map((item) => [item.id, item]));
  document.getElementById("checklistContent").innerHTML = checklistSortDraft.stages
    .map((stage) => {
      const rows = stage.itemIds.length
        ? stage.itemIds
            .map((itemId, index) => {
              const item = itemById.get(itemId);
              if (!item) return "";
              return `
                <article class="checklist-item-row sortable-checklist-row" data-sort-item="${item.id}" draggable="true">
                  <div class="checklist-row-main">
                    <button class="drag-handle" data-sort-handle data-sort-drag="${item.id}" type="button" aria-label="拖动排序">拖动</button>
                    <p class="row-title">${escapeHTML(item.content)}</p>
                    <p class="row-meta">${escapeHTML(ownerNameFromIds(item.ownerIds))}${item.timeText ? ` · ${escapeHTML(item.timeText)}` : ""}</p>
                  </div>
                </article>
              `;
            })
            .join("")
        : `<p class="subtle">这个阶段暂时没有执行项。</p>`;
      return `
        <section class="checklist-stage">
          <div class="checklist-stage-header">
            <div>
              <p class="row-title">${escapeHTML(stage.label)}</p>
              <p class="row-meta">${stage.itemIds.length} 项</p>
            </div>
          </div>
          <div class="checklist-content sort-drop-zone" data-sort-stage-bucket="${stage.stageKey}">${rows}</div>
        </section>
      `;
    })
    .join("");
}

function openChecklistItemFromButton(itemId, mode = "view") {
  activeView = "checklist";
  renderAll();
  openChecklistItemForm({ mode, itemId });
}

function renderChecklistFormOptions(selectedStageKey, selectedOwnerIds) {
  document.getElementById("checklistStageSelect").innerHTML = checklistCore.STAGES
    .map((stage) => `<option value="${stage.stageKey}" ${stage.stageKey === selectedStageKey ? "selected" : ""}>${escapeHTML(stage.label)}</option>`)
    .join("");
  document.getElementById("checklistOwnerCheckboxes").innerHTML = activeOwners()
    .map((owner) => `
      <label>
        <input type="checkbox" name="ownerIds" value="${owner.ownerId}" ${selectedOwnerIds.includes(owner.ownerId) ? "checked" : ""} />
        ${escapeHTML(owner.name)}
      </label>
    `)
    .join("");
}

async function openChecklistItemForm({ mode, itemId = "", stageKey = "ungrouped", prefill = null }) {
  const dialog = document.getElementById("checklistItemDialog");
  const form = document.getElementById("checklistItemForm");
  const sourceHint = document.getElementById("checklistSourceHint");
  const item = itemId ? checklistCore.activeItems(state).find((entry) => entry.id === itemId) : null;
  const draftKey = checklistDraftKey({ mode, itemId, stageKey, prefill });
  let payload =
    prefill ||
    item || {
      content: "",
      stageKey,
      timeText: "",
      ownerIds: [],
      noteText: "",
      status: "待确认",
    };

  if (mode !== "view" && checklistDrafts.has(draftKey)) {
    const restore = await askConfirm({
      title: "恢复草稿",
      message: "发现未保存内容，是否恢复？",
      cancelText: "不恢复",
      okText: "恢复",
    });
    if (restore) payload = checklistDrafts.get(draftKey);
  }

  checklistFormState = {
    mode,
    itemId,
    draftKey,
    prefill,
    clientRequestId: `manual-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    dirty: false,
  };
  form.reset();
  clearChecklistFormErrors();
  document.getElementById("checklistDialogTitle").textContent = mode === "edit" ? "编辑执行项" : "新增执行项";
  if (mode === "view") document.getElementById("checklistDialogTitle").textContent = "查看执行项";
  document.getElementById("deleteChecklistItemBtn").style.visibility = mode === "edit" ? "visible" : "hidden";
  document.getElementById("editChecklistItemBtn").style.display = mode === "view" && canEditProject() ? "" : "none";
  document.getElementById("saveChecklistItemBtn").style.display = mode === "view" ? "none" : "";
  sourceHint.textContent =
    prefill?.sourceType ? `来源：${escapeHTML(sourceLabel(prefill))}` :
    item?.sourceType && item.sourceType !== "manual" ? `来源：${escapeHTML(sourceLabel(item))}` : "";
  renderChecklistFormOptions(payload.stageKey || stageKey, payload.ownerIds || []);
  form.elements.content.value = payload.content || "";
  form.elements.stageKey.value = payload.stageKey || stageKey;
  form.elements.timeText.value = payload.timeText || "";
  form.elements.status.value = payload.status || "待确认";
  form.elements.noteText.value = payload.noteText || "";
  updateChecklistSaveAvailability();
  form.querySelectorAll("input, select, textarea, button").forEach((control) => {
    if (control.matches("[data-close-dialog]") || control.value === "cancel") {
      control.disabled = false;
      return;
    }
    if (control.id === "editChecklistItemBtn") {
      control.disabled = mode !== "view" || !canEditProject();
      return;
    }
    if (control.id === "deleteChecklistItemBtn") {
      control.disabled = !canEditProject() || mode !== "edit";
      return;
    }
    if (control.id === "saveChecklistItemBtn") {
      control.disabled = mode === "view" || control.disabled || !canEditProject();
      return;
    }
    control.disabled = mode === "view" || (!canEditProject() && control.value !== "cancel");
  });
  dialog.showModal();
}

function checklistDraftKey({ mode, itemId, stageKey, prefill }) {
  const projectId = state.projectId || "local-project";
  if (mode === "edit") return `${projectId}:item:${itemId}`;
  if (prefill?.sourceType === "task") return `${projectId}:task:${prefill.sourceTaskId}`;
  if (prefill?.sourceType === "decision_item") return `${projectId}:decision:${prefill.sourceDecisionId}`;
  if (prefill?.sourceType === "node_checklist_template") {
    return `${projectId}:candidate:${prefill.sourceNodeId}:${prefill.sourceCandidateKey}`;
  }
  return `${projectId}:new-manual:${stageKey}`;
}

function readChecklistFormPayload() {
  const form = document.getElementById("checklistItemForm");
  return {
    content: form.elements.content.value,
    stageKey: form.elements.stageKey.value,
    timeText: form.elements.timeText.value,
    ownerIds: [...form.querySelectorAll("input[name='ownerIds']:checked")].map((input) => input.value),
    noteText: form.elements.noteText.value,
    status: form.elements.status.value,
  };
}

function scheduleChecklistDraftSave() {
  if (!checklistFormState) return;
  checklistFormState.dirty = true;
  updateChecklistSaveAvailability();
  clearTimeout(checklistDraftTimer);
  const draftKey = checklistFormState.draftKey;
  const payload = readChecklistFormPayload();
  checklistDraftTimer = setTimeout(() => {
    checklistDrafts.set(draftKey, payload);
  }, 180);
}

function updateChecklistSaveAvailability() {
  if (!checklistFormState) return;
  const saveButton = document.getElementById("saveChecklistItemBtn");
  const payload = readChecklistFormPayload();
  const validation = checklistCore.validateExecutionItemPayload(state, payload);
  const fieldErrors = { ...validation.fieldErrors };
  if (checklistFormState.mode === "edit" && payload.content.trim().length === 0) {
    delete fieldErrors.content;
  }
  setChecklistFormErrors(fieldErrors);
  saveButton.disabled = !canEditProject() || Object.keys(fieldErrors).length > 0;
}

function flushChecklistDraft() {
  if (!checklistFormState?.dirty) return;
  checklistDrafts.set(checklistFormState.draftKey, readChecklistFormPayload());
}

function clearChecklistDraft() {
  if (!checklistFormState) return;
  checklistDrafts.delete(checklistFormState.draftKey);
}

function clearChecklistFormErrors() {
  document.querySelectorAll("#checklistItemForm [data-error-for], #ownerDialogForm [data-error-for]").forEach((node) => {
    node.textContent = "";
  });
}

function setChecklistFormErrors(fieldErrors = {}) {
  clearChecklistFormErrors();
  Object.entries(fieldErrors).forEach(([field, message]) => {
    const node = document.querySelector(`#checklistItemForm [data-error-for="${field}"], #ownerDialogForm [data-error-for="${field === "name" ? "ownerName" : field}"]`);
    if (node) node.textContent = message;
  });
}

function showOperationError(result) {
  if (result?.error?.code === "VALIDATION_ERROR") {
    setChecklistFormErrors(result.error.details.fieldErrors || {});
    showToast("请检查表单内容");
    return;
  }
  showToast(result?.error?.message || "操作失败，请重试");
}

async function saveChecklistItemForm() {
  const payload = readChecklistFormPayload();
  if (checklistFormState.mode === "edit" && payload.content.trim().length === 0) {
    const shouldDelete = await askConfirm({
      title: "删除执行项",
      message: "必填内容已清空，是否删除这条执行项？",
      cancelText: "继续编辑",
      okText: "删除",
    });
    if (!shouldDelete) return;
    const deleted = checklistCore.deleteExecutionItem(state, checklistFormState.itemId);
    if (!deleted.ok) {
      showOperationError(deleted);
      return;
    }
    closeChecklistItemDialog(true);
    persistAndRender();
    showToast("执行项已删除");
    return;
  }

  let result;
  if (checklistFormState.mode === "edit") {
    result = checklistCore.updateExecutionItem(state, checklistFormState.itemId, payload);
  } else if (checklistFormState.prefill?.sourceType) {
    result = checklistCore.createSourceExecutionItem(state, { ...checklistFormState.prefill, ...payload });
  } else {
    result = checklistCore.createManualExecutionItem(state, {
      ...payload,
      clientRequestId: checklistFormState.clientRequestId,
    });
  }

  if (!result.ok) {
    showOperationError(result);
    return;
  }
  closeChecklistItemDialog(true);
  persistAndRender();
  showToast(result.result.type === "existing_by_idempotency" ? "已恢复重复提交的执行项" : "执行项已保存");
}

async function deleteChecklistItemFromForm() {
  const shouldDelete = await askConfirm({
    title: "删除执行项",
    message: "删除后不会在 v1 提供撤销，确认删除这条执行项？",
    cancelText: "继续编辑",
    okText: "删除",
  });
  if (!shouldDelete) return;
  const result = checklistCore.deleteExecutionItem(state, checklistFormState.itemId);
  if (!result.ok) {
    showOperationError(result);
    return;
  }
  closeChecklistItemDialog(true);
  persistAndRender();
  showToast("执行项已删除");
}

async function closeChecklistItemDialog(force = false) {
  clearTimeout(checklistDraftTimer);
  flushChecklistDraft();
  if (!force && checklistFormState?.dirty) {
    const discard = await askConfirm({
      title: "放弃修改",
      message: "放弃本次修改？",
      cancelText: "继续编辑",
      okText: "放弃",
    });
    if (!discard) return false;
  }
  clearChecklistDraft();
  checklistFormState = null;
  document.getElementById("checklistItemDialog").close();
  return true;
}

function renderOwnerDialog() {
  const owners = activeOwners();
  document.getElementById("ownerList").innerHTML = owners
    .map((owner) => {
      const affectedTaskCount = state.tasks.filter((task) => (task.ownerIds || []).includes(owner.ownerId)).length;
      const affectedItemCount = checklistCore.activeItems(state).filter((item) => item.ownerIds.includes(owner.ownerId)).length;
      return `
        <article class="owner-row">
          <div>
            <p class="row-title">${escapeHTML(owner.name)}</p>
            <p class="row-meta">任务 ${affectedTaskCount} · 执行项 ${affectedItemCount}</p>
          </div>
          <button class="ghost-button danger" data-delete-owner="${owner.ownerId}" type="button">删除</button>
        </article>
      `;
    })
    .join("");
}

async function deleteOwnerWithPrompt(ownerId) {
  const owner = activeOwners().find((item) => item.ownerId === ownerId);
  if (!owner) return;
  const affectedTaskCount = state.tasks.filter((task) => (task.ownerIds || []).includes(ownerId)).length;
  const affectedItemCount = checklistCore.activeItems(state).filter((item) => item.ownerIds.includes(ownerId)).length;
  const message = affectedTaskCount || affectedItemCount
    ? `删除后会从 ${affectedTaskCount} 个任务和 ${affectedItemCount} 个执行项中移除这个负责人。`
    : "删除这个负责人？";
  const confirmed = await askConfirm({
    title: "删除负责人",
    message,
    cancelText: "取消",
    okText: "删除",
  });
  if (!confirmed) return;
  const result = checklistCore.deleteOwner(state, ownerId);
  if (!result.ok) {
    showOperationError(result);
    return;
  }
  if (checklistOwnerFilter === ownerId) checklistOwnerFilter = "all";
  persistAndRender();
  renderOwnerDialog();
  showToast("负责人已删除");
}

function enterChecklistSortMode() {
  if (isChecklistFiltered()) {
    showToast("清除筛选后可调整顺序");
    return;
  }
  const view = checklistCore.getOrCreateExecutionChecklist(state).result;
  checklistSortDraft = {
    orderVersion: view.orderVersion,
    stages: checklistCore.STAGES.map((stage) => ({
      ...stage,
      itemIds: view.items.filter((item) => item.stageKey === stage.stageKey).map((item) => item.id),
    })),
  };
  renderChecklist();
}

function moveSortItem(itemId, direction) {
  if (!checklistSortDraft) return;
  const stage = checklistSortDraft.stages.find((entry) => entry.itemIds.includes(itemId));
  const index = stage?.itemIds.indexOf(itemId) ?? -1;
  if (!stage || index < 0) return;
  const nextIndex = direction === "up" ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= stage.itemIds.length) return;
  const [item] = stage.itemIds.splice(index, 1);
  stage.itemIds.splice(nextIndex, 0, item);
  renderChecklist();
}

function moveSortItemToStage(itemId, stageKey) {
  if (!checklistSortDraft) return;
  moveSortItemToPosition(itemId, stageKey);
}

function moveSortItemToPosition(itemId, targetStageKey, targetItemId = "", afterTarget = false) {
  if (!checklistSortDraft) return;
  const before = JSON.stringify(checklistSortDraft.stages.map((stage) => [stage.stageKey, stage.itemIds]));
  const fromStage = checklistSortDraft.stages.find((entry) => entry.itemIds.includes(itemId));
  const toStage = checklistSortDraft.stages.find((entry) => entry.stageKey === targetStageKey);
  if (!fromStage || !toStage) return false;
  fromStage.itemIds = fromStage.itemIds.filter((id) => id !== itemId);
  let insertIndex = toStage.itemIds.length;
  if (targetItemId && targetItemId !== itemId) {
    const targetIndex = toStage.itemIds.indexOf(targetItemId);
    if (targetIndex >= 0) insertIndex = targetIndex + (afterTarget ? 1 : 0);
  }
  toStage.itemIds.splice(insertIndex, 0, itemId);
  const after = JSON.stringify(checklistSortDraft.stages.map((stage) => [stage.stageKey, stage.itemIds]));
  if (before === after) return false;
  renderChecklist();
  return true;
}

function markChecklistSortDraggingRow(itemId) {
  [...document.querySelectorAll("[data-sort-item]")]
    .find((row) => row.dataset.sortItem === itemId)
    ?.classList.add("dragging");
  document.body.classList.add("is-sorting-drag");
}

function findChecklistSortDropTarget(clientX, clientY) {
  const target = document.elementFromPoint(clientX, clientY);
  let bucket = target?.closest?.("[data-sort-stage-bucket]");
  if (!bucket) {
    const buckets = [...document.querySelectorAll("[data-sort-stage-bucket]")];
    bucket = buckets.find((candidate) => {
      const rect = candidate.getBoundingClientRect();
      return clientY >= rect.top && clientY <= rect.bottom;
    });
    if (!bucket) {
      bucket = buckets
        .map((candidate) => {
          const rect = candidate.getBoundingClientRect();
          return {
            node: candidate,
            distance: Math.min(Math.abs(clientY - rect.top), Math.abs(clientY - rect.bottom)),
          };
        })
        .sort((a, b) => a.distance - b.distance)[0]?.node;
    }
  }
  if (!bucket) return null;
  const rows = [...bucket.querySelectorAll("[data-sort-item]")].filter((row) => {
    return row.dataset.sortItem !== checklistSortDragState?.itemId;
  });
  const beforeRow = rows.find((row) => {
    const rect = row.getBoundingClientRect();
    return clientY < rect.top + rect.height / 2;
  });
  if (beforeRow) {
    return {
      stageKey: bucket.dataset.sortStageBucket,
      targetItemId: beforeRow.dataset.sortItem,
      afterTarget: false,
    };
  }
  const lastRow = rows[rows.length - 1];
  return {
    stageKey: bucket.dataset.sortStageBucket,
    targetItemId: lastRow?.dataset.sortItem || "",
    afterTarget: Boolean(lastRow),
  };
}

function autoScrollChecklistSort(clientY) {
  const edgeSize = 96;
  const step = 18;
  if (clientY < edgeSize) {
    window.scrollBy(0, -step);
  } else if (clientY > window.innerHeight - edgeSize) {
    window.scrollBy(0, step);
  }
}

function moveSortItemToPointer(clientX, clientY) {
  if (!checklistSortDragState) return false;
  autoScrollChecklistSort(clientY);
  const target = findChecklistSortDropTarget(clientX, clientY);
  if (!target) return false;
  const moved = moveSortItemToPosition(
    checklistSortDragState.itemId,
    target.stageKey,
    target.targetItemId,
    target.afterTarget,
  );
  if (moved) markChecklistSortDraggingRow(checklistSortDragState.itemId);
  return moved;
}

function cleanupChecklistSortDrag() {
  document.querySelectorAll(".sortable-checklist-row.dragging").forEach((row) => row.classList.remove("dragging"));
  document.body.classList.remove("is-sorting-drag");
  checklistSortDragState = null;
}

function finishChecklistSortDrag(clientX, clientY) {
  if (!checklistSortDragState) return;
  moveSortItemToPointer(clientX, clientY);
  cleanupChecklistSortDrag();
}

function saveChecklistSort() {
  if (!checklistSortDraft) return;
  const result = checklistCore.reorderExecutionItems(state, {
    orderVersion: checklistSortDraft.orderVersion,
    stages: checklistSortDraft.stages.map((stage) => ({
      stageKey: stage.stageKey,
      itemIds: [...stage.itemIds],
    })),
  });
  if (!result.ok) {
    showOperationError(result);
    if (result.error.code === "ORDER_VERSION_CONFLICT") showToast("清单顺序已被更新，请刷新后重试");
    return;
  }
  checklistSortDraft = null;
  persistAndRender();
  showToast("顺序已保存");
}

async function joinTaskToChecklist(taskId) {
  if (!(await confirmDirtyFormBeforeSourceJoin())) return;
  const result = checklistCore.joinSourceExecutionItem(state, { sourceType: "task", sourceTaskId: taskId });
  await handleSourceJoinResult(result);
}

async function joinDecisionToChecklist(decisionId) {
  if (!(await confirmDirtyFormBeforeSourceJoin())) return;
  const result = checklistCore.joinSourceExecutionItem(state, { sourceType: "decision_item", sourceDecisionId: decisionId });
  await handleSourceJoinResult(result);
}

async function handleSourceJoinResult(result) {
  if (!result.ok) {
    showOperationError(result);
    return;
  }
  if (result.result.type === "needs_edit") {
    await openChecklistItemForm({ mode: "source", prefill: result.result.prefill });
    showToast(result.result.reason);
    return;
  }
  persistAndRender();
  showToast(result.result.type === "existing" ? "已加入过执行清单" : "已加入执行清单");
}

async function joinSelectedNodeCandidates() {
  if (!(await confirmDirtyFormBeforeSourceJoin())) return;
  const selected = [...document.querySelectorAll("#nodeCandidateList [data-node-candidate]:checked")].map((input) => input.dataset.nodeCandidate);
  if (!selected.length) {
    showToast("请选择要加入的推荐项");
    return;
  }
  const result = checklistCore.batchJoinNodeCandidates(state, recommendationConfig, selectedNodeId, selected);
  if (!result.ok) {
    showOperationError(result);
    return;
  }
  const { created, existing, failed, needsEdit } = result.result;
  persistAndRender();
  if (needsEdit.length) {
    await openChecklistItemForm({ mode: "source", prefill: needsEdit[0].prefill });
    showToast("有推荐项需要编辑后加入");
    return;
  }
  if (created.length && failed.length) showToast(`已加入 ${created.length} 项，${failed.length} 项加入失败`);
  else if (created.length || existing.length) showToast("已加入执行清单");
  else showToast("加入失败，请重试");
}

async function confirmDirtyFormBeforeSourceJoin() {
  if (!checklistFormState?.dirty || !document.getElementById("checklistItemDialog").open) return true;
  const shouldSave = await askConfirm({
    title: "保存并加入",
    message: "当前修改尚未保存，是否保存后加入执行清单？",
    cancelText: "继续编辑",
    okText: "保存并加入",
  });
  if (!shouldSave) return false;
  await saveChecklistItemForm();
  return !document.getElementById("checklistItemDialog").open;
}

async function openChecklistSource(itemId) {
  const item = checklistCore.activeItems(state).find((entry) => entry.id === itemId);
  if (!item) return;
  if (checklistFormState?.dirty) {
    const discard = await askConfirm({
      title: "查看来源",
      message: "有未保存修改，是否放弃并查看来源？",
      cancelText: "继续编辑",
      okText: "放弃",
    });
    if (!discard) return;
    closeChecklistItemDialog(true);
  }
  if (item.sourceType === "task" && item.sourceTaskId) {
    const task = state.tasks.find((entry) => entry.id === item.sourceTaskId);
    if (task) selectNode(task.nodeId);
    return;
  }
  if (item.sourceType === "decision_item" && item.sourceDecisionId) {
    const decision = state.decisions.find((entry) => entry.id === item.sourceDecisionId);
    if (decision) {
      selectedNodeId = decision.nodeId;
      switchView("decisions");
    }
    return;
  }
  if (item.sourceType === "node_checklist_template" && item.sourceNodeId) {
    selectNode(item.sourceNodeId);
    return;
  }
  showToast("手动执行项没有外部来源");
}

function askConfirm({ title, message, cancelText, okText }) {
  const dialog = document.getElementById("confirmDialog");
  document.getElementById("confirmDialogTitle").textContent = title;
  document.getElementById("confirmDialogMessage").textContent = message;
  document.getElementById("confirmCancelBtn").textContent = cancelText;
  document.getElementById("confirmOkBtn").textContent = okText;
  dialog.showModal();
  return new Promise((resolve) => {
    pendingConfirmResolver = resolve;
  });
}

function renderAll() {
  renderTabs();
  renderProfile();
  renderStats();
  renderMap();
  renderTemplateGrid();
  renderNodeSelectors();
  renderNodeDetail();
  renderDecisionBoard();
  renderChecklist();
  renderPackage();
}

function persistAndRender() {
  saveState();
  renderAll();
}

function switchView(view) {
  activeView = view;
  renderAll();
}

function selectNode(nodeId) {
  selectedNodeId = nodeId;
  switchView("node");
}

const decisionActions = {
  create(payload) {
    const decision = makeCustomDecision(payload);
    state.decisions.push(decision);
    return decision;
  },
  update(decisionId, patch) {
    const decision = state.decisions.find((item) => item.id === decisionId);
    if (!decision) return null;
    Object.assign(decision, normalizeDecisionPatch(patch));
    return decision;
  },
  output(decisionId) {
    return outputDecisionToNode(decisionId);
  },
  remove(decisionId) {
    const before = state.decisions.length;
    state.decisions = state.decisions.filter((decision) => decision.id !== decisionId);
    return state.decisions.length !== before;
  },
};

const decisionInputMap = {
  nodeId: "nodeId",
  title: "title",
  question: "question",
  type: "type",
  owner: "owner",
  participants: "participants",
  dueDate: "dueDate",
  dueOffset: "dueOffset",
  status: "status",
  finalChoice: "finalChoice",
  conclusion: "conclusion",
  gaps: "gaps",
  options: "options",
  criteria: "criteria",
  linkedTaskIds: "linkedTaskIds",
};

function normalizeDecisionPatch(patch) {
  return Object.entries(patch).reduce((result, [key, value]) => {
    const field = decisionInputMap[key];
    if (field) result[field] = value;
    return result;
  }, {});
}

function outputDecisionToNode(decisionId) {
  const decision = state.decisions.find((item) => item.id === decisionId);
  if (!decision) return null;
  const node = getNode(decision.nodeId);
  if (!node) return null;

  if (!decision.finalChoice) {
    decision.finalChoice = decision.options?.[0]?.name || "已决定方案";
  }
  if (!decision.conclusion) {
    decision.conclusion = "已形成结论，后续事项自动加入节点任务。";
  }

  const outputText = `${decision.title}: ${decision.finalChoice}。${decision.conclusion}`;
  const alreadyOutput = node.outputs.some((output) => output.sourceDecisionId === decision.id);
  if (!alreadyOutput) {
    node.outputs.push({
      id: uid("output"),
      text: outputText,
      sourceDecisionId: decision.id,
    });
  }

  (decision.followUps || []).forEach(([title, owner, dueOffset]) => {
    const exists = state.tasks.some((task) => task.sourceDecisionId === decision.id && task.title === title);
    if (!exists) {
      const task = {
        id: uid("task"),
        nodeId: decision.nodeId,
        title,
        owner,
        ownerIds: firstOwnerIdByName(owner) ? [firstOwnerIdByName(owner)] : [],
        dueOffset,
        done: false,
        sourceDecisionId: decision.id,
      };
      state.tasks.push(task);
      decision.linkedTaskIds = Array.from(new Set([...(decision.linkedTaskIds || []), task.id]));
    }
  });

  decision.status = "已转任务";
  decision.outputGenerated = true;
  return decision;
}

function makeCustomDecision({
  nodeId,
  title,
  question = "把候选方案、信息缺口和最终结论补齐后，再生成后续任务。",
  type,
  owner,
  dueDate,
  status = "信息收集中",
  participants = "新人",
  finalChoice = "",
  conclusion = "",
  gaps = ["需要补充候选方案信息"],
  options = [],
  criteria = [...DEFAULT_COMPARISON_CRITERIA],
  linkedTaskIds = [],
}) {
  return {
    id: uid("decision"),
    nodeId,
    title,
    question,
    type,
    owner,
    participants,
    dueDate,
    status,
    options: options.length
      ? options
      : defaultDecisionOptions(),
    criteria,
    gaps,
    finalChoice,
    conclusion,
    linkedTaskIds,
    followUps: [["根据决策结论补充后续任务", owner, -30]],
    outputGenerated: false,
  };
}

function renderDecisionLinkedTaskOptions(decision, nodeId) {
  const container = document.getElementById("decisionLinkedTaskCheckboxes");
  const tasks = nodeTasks(nodeId);
  const linkedTaskIds = new Set(decision?.linkedTaskIds || []);
  container.innerHTML = tasks.length
    ? tasks
        .map((task) => `
          <label>
            <input type="checkbox" name="linkedTaskIds" value="${task.id}" ${linkedTaskIds.has(task.id) ? "checked" : ""} />
            ${escapeHTML(task.title)}
          </label>
        `)
        .join("")
    : `<p class="subtle">这个节点暂无任务，先在节点里添加任务后再关联。</p>`;
  updateDecisionLinkedTaskSummary();
}

function decisionLinkedTaskIdsFromForm() {
  return [...document.querySelectorAll("#decisionLinkedTaskCheckboxes input[name='linkedTaskIds']:checked")]
    .map((input) => input.value);
}

function updateDecisionLinkedTaskSummary() {
  const summary = document.getElementById("decisionLinkedTaskSummary");
  const panel = document.getElementById("decisionLinkedTasksPanel");
  const toggle = document.getElementById("toggleDecisionLinkedTasksBtn");
  const linkedIds = decisionLinkedTaskIdsFromForm();
  const linkedTaskNames = linkedIds
    .map((taskId) => taskById(taskId)?.title)
    .filter(Boolean);
  summary.textContent = linkedTaskNames.length
    ? `已关联 ${linkedTaskNames.length} 个任务：${linkedTaskNames.slice(0, 3).join("、")}${linkedTaskNames.length > 3 ? "…" : ""}`
    : "未关联任务";
  const expanded = Boolean(decisionDialogState?.linkedTasksExpanded);
  panel.hidden = !expanded;
  toggle.textContent = expanded ? "收起关联任务" : "勾选关联任务";
  toggle.setAttribute("aria-expanded", String(expanded));
}

function syncDecisionComparisonControls() {
  const isView = decisionDialogState?.mode === "view";
  const optionCount = document.querySelectorAll("#decisionComparisonEditor [data-decision-option-index]").length;
  const criterionCount = document.querySelectorAll("#decisionComparisonEditor [data-decision-criterion-index]").length;
  const addButton = document.getElementById("addDecisionOptionBtn");
  const addCriterionButton = document.getElementById("addDecisionCriterionBtn");
  addButton.style.display = isView ? "none" : "";
  addButton.disabled = isView || optionCount >= MAX_DECISION_OPTIONS;
  addCriterionButton.style.display = isView ? "none" : "";
  addCriterionButton.disabled = isView || criterionCount >= MAX_DECISION_CRITERIA;
  document.querySelectorAll("[data-remove-decision-option]").forEach((button) => {
    button.style.display = isView ? "none" : "";
    button.disabled = isView || optionCount <= 1;
  });
  document.querySelectorAll("[data-remove-decision-criterion]").forEach((button) => {
    button.style.display = isView ? "none" : "";
    button.disabled = isView || criterionCount <= 1;
  });
}

function addDecisionOption() {
  if (decisionDialogState?.mode === "view") return;
  const comparison = readDecisionComparisonEditor();
  if (comparison.options.length >= MAX_DECISION_OPTIONS) return;
  comparison.options.push({
    name: `方案 ${comparison.options.length + 1}`,
    notes: comparison.criteria.reduce((notes, criterion) => {
      notes[criterion] = "";
      return notes;
    }, {}),
  });
  renderDecisionComparisonEditor(comparison);
  syncDecisionComparisonControls();
}

function removeDecisionOption(optionIndex) {
  if (decisionDialogState?.mode === "view") return;
  const comparison = readDecisionComparisonEditor();
  if (comparison.options.length <= 1) return;
  comparison.options.splice(optionIndex, 1);
  renderDecisionComparisonEditor(comparison);
  syncDecisionComparisonControls();
}

function addDecisionCriterion() {
  if (decisionDialogState?.mode === "view") return;
  const comparison = readDecisionComparisonEditor();
  if (comparison.criteria.length >= MAX_DECISION_CRITERIA) return;
  const nextCriterion = `对比项 ${comparison.criteria.length + 1}`;
  comparison.criteria.push(nextCriterion);
  comparison.options.forEach((option) => {
    option.notes[nextCriterion] = "";
  });
  renderDecisionComparisonEditor(comparison);
  syncDecisionComparisonControls();
}

function removeDecisionCriterion(criterionIndex) {
  if (decisionDialogState?.mode === "view") return;
  const comparison = readDecisionComparisonEditor();
  if (comparison.criteria.length <= 1) return;
  const [removedCriterion] = comparison.criteria.splice(criterionIndex, 1);
  comparison.options.forEach((option) => {
    delete option.notes[removedCriterion];
  });
  renderDecisionComparisonEditor(comparison);
  syncDecisionComparisonControls();
}

function setDecisionDialogMode(mode) {
  const form = document.getElementById("decisionDialogForm");
  const isView = mode === "view";
  decisionDialogState.mode = mode;
  document.getElementById("decisionDialogTitle").textContent =
    mode === "create" ? "新建决策" : isView ? "查看决策" : "编辑决策";
  document.getElementById("deleteDecisionBtn").style.display = mode === "edit" ? "" : "none";
  document.getElementById("editDecisionBtn").style.display = isView && decisionDialogState.decisionId ? "" : "none";
  document.getElementById("saveDecisionBtn").style.display = isView ? "none" : "";
  document.getElementById("saveDecisionBtn").disabled = isView;
  form.querySelectorAll("input, textarea, select").forEach((control) => {
    control.disabled = isView;
  });
  syncDecisionComparisonControls();
  updateDecisionLinkedTaskSummary();
}

function openDecisionDialog({ mode = "create", decisionId = "", nodeId = selectedNodeId } = {}) {
  const dialog = document.getElementById("decisionDialog");
  const form = document.getElementById("decisionDialogForm");
  const decision = decisionId ? state.decisions.find((item) => item.id === decisionId) : null;
  const source = decision || makeCustomDecision({
    nodeId,
    title: "",
    question: "",
    type: "流程",
    owner: "双方一起",
    dueDate: isoDate(addDays(new Date(), 7)),
    gaps: [],
    options: [],
    linkedTaskIds: [],
  });
  decisionDialogState = { mode, decisionId: decision?.id || "", dirty: false, linkedTasksExpanded: false };
  form.reset();
  form.elements.decisionId.value = decision?.id || "";
  form.elements.nodeId.innerHTML = enabledNodes()
    .map((node) => `<option value="${node.id}" ${node.id === source.nodeId ? "selected" : ""}>${escapeHTML(node.name)}</option>`)
    .join("");
  form.elements.status.innerHTML = decisionStatusOptions(source.status || "信息收集中");
  form.elements.owner.innerHTML = ownerNameOptions(source.owner || "双方一起");
  form.elements.nodeId.value = source.nodeId || nodeId;
  form.elements.title.value = source.title || "";
  form.elements.question.value = source.question || "";
  form.elements.type.value = source.type || "流程";
  form.elements.status.value = source.status || "信息收集中";
  form.elements.owner.value = source.owner || "双方一起";
  form.elements.dueDate.value = decisionDueDateForForm(source);
  form.elements.participants.value = source.participants || "";
  form.elements.finalChoice.value = source.finalChoice || "";
  form.elements.conclusion.value = source.conclusion || "";
  form.elements.gapsText.value = (source.gaps || []).join("\n");
  renderDecisionComparisonEditor(source);
  renderDecisionLinkedTaskOptions(source, source.nodeId || nodeId);
  setDecisionDialogMode(mode);
  dialog.showModal();
}

function readDecisionDialogPayload() {
  const form = document.getElementById("decisionDialogForm");
  const comparison = readDecisionComparisonEditor();
  return {
    nodeId: form.elements.nodeId.value,
    title: form.elements.title.value,
    question: form.elements.question.value,
    type: form.elements.type.value,
    owner: form.elements.owner.value,
    dueDate: form.elements.dueDate.value,
    dueOffset: null,
    status: form.elements.status.value,
    participants: form.elements.participants.value,
    finalChoice: form.elements.finalChoice.value,
    conclusion: form.elements.conclusion.value,
    gaps: form.elements.gapsText.value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
    options: comparison.options,
    criteria: comparison.criteria,
    linkedTaskIds: decisionLinkedTaskIdsFromForm(),
  };
}

async function deleteDecisionFromDialog() {
  if (!decisionDialogState?.decisionId) return;
  const shouldDelete = await askConfirm({
    title: "删除决策",
    message: "删除后不会在 v1 提供撤销，确认删除这个决策 item？",
    cancelText: "继续保留",
    okText: "删除",
  });
  if (!shouldDelete) return;
  decisionActions.remove(decisionDialogState.decisionId);
  document.getElementById("decisionDialog").close();
  decisionDialogState = null;
  persistAndRender();
  showToast("决策已删除");
}

function saveDecisionDialog() {
  const payload = readDecisionDialogPayload();
  if (decisionDialogState.mode === "create") {
    decisionActions.create(payload);
    showToast("已添加决策");
  } else if (decisionDialogState.decisionId) {
    decisionActions.update(decisionDialogState.decisionId, payload);
    showToast("决策已保存");
  }
  document.getElementById("decisionDialog").close();
  decisionDialogState = null;
  selectedNodeId = payload.nodeId;
  persistAndRender();
}

function handleDecisionInput(event) {
  const input = event.target.closest("[data-decision-input][data-decision-id]");
  if (!input) return;
  decisionActions.update(input.dataset.decisionId, {
    [input.dataset.decisionInput]: input.value,
  });
  saveState();
}

function handleDecisionChange(event) {
  const input = event.target.closest("[data-decision-input][data-decision-id]");
  if (!input) return;
  decisionActions.update(input.dataset.decisionId, {
    [input.dataset.decisionInput]: input.value,
  });
  persistAndRender();
}

async function handleDecisionClick(event) {
  const actionButton = event.target.closest("[data-decision-action]");
  if (!actionButton) return;
  const action = actionButton.dataset.decisionAction;

  if (action === "open-detail") {
    openDecisionDialog({ mode: "view", decisionId: actionButton.dataset.decisionId });
    return;
  }

  if (action === "edit-detail") {
    openDecisionDialog({ mode: "edit", decisionId: actionButton.dataset.decisionId });
    return;
  }

  if (action === "output") {
    const decision = decisionActions.output(actionButton.dataset.decisionId);
    if (decision) {
      persistAndRender();
      showToast("已生成后续任务，并加入执行包素材");
    }
    return;
  }

  if (action === "open-node") {
    selectNode(actionButton.dataset.targetNodeId);
    return;
  }

  if (action === "join-checklist") {
    joinDecisionToChecklist(actionButton.dataset.decisionId);
    return;
  }

  if (action === "open-checklist-item") {
    openChecklistItemFromButton(actionButton.dataset.checklistItemId, "view");
    return;
  }

  if (action === "delete") {
    const shouldDelete = await askConfirm({
      title: "删除决策",
      message: "删除后不会在 v1 提供撤销，确认删除这个决策 item？",
      cancelText: "继续保留",
      okText: "删除",
    });
    if (!shouldDelete) return;
    decisionActions.remove(actionButton.dataset.decisionId);
    persistAndRender();
    showToast("决策已删除");
  }
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function buildPackageText() {
  const checklistItems = checklistCore.activeItems(state);
  const lines = [
    `喜事计划舱执行包 - ${state.profile.groom} & ${state.profile.bride}`,
    `婚期: ${formatFullDate(state.profile.date)}`,
    `城市/场地: ${state.profile.city} ${state.profile.venue}`,
    `预算: ${currency.format(Number(state.profile.budget || 0))}，宾客: ${state.profile.guestCount} 人`,
    "",
    "一、节点输出",
    ...enabledNodes().flatMap((node) => node.outputs.map((output) => `- ${node.name}: ${output.text}`)),
    "",
    "二、待执行事项",
    ...openTasks().map((task) => `- ${formatDate(taskDueDate(task))} ${getNode(task.nodeId)?.name} / ${taskOwnerText(task)}: ${task.title}`),
    "",
    "三、婚礼执行清单",
    ...(checklistItems.length
      ? checklistItems.map((item) => `- [${item.status}] ${stageLabel(item.stageKey)} / ${ownerNameFromIds(item.ownerIds)}${item.timeText ? ` / ${item.timeText}` : ""}: ${item.content}${item.noteText ? `\n  ${item.noteText.replaceAll("\n", "\n  ")}` : ""}`)
      : ["- 还没有执行项，完成节点规划后可逐步加入"]),
    "",
    "四、待拍板决策",
    ...openDecisions().map((decision) => `- ${formatDate(decisionDueDate(decision))} ${getNode(decision.nodeId)?.name}: ${decision.title}`),
    "",
    "五、风险与缺口",
    ...[
      ...overdueTasks().map((task) => `${getNode(task.nodeId)?.name}: ${task.title} 已逾期`),
      ...overdueDecisions().map((decision) => `${getNode(decision.nodeId)?.name}: ${decision.title} 已逾期`),
    ].map((risk) => `- ${risk}`),
  ];
  return lines.join("\n");
}

document.getElementById("profileForm").addEventListener("input", (event) => {
  const { name, value, type } = event.target;
  if (!name) return;
  state.profile[name] = type === "number" ? Number(value) : value;
  persistAndRender();
});

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.view));
});

document.querySelectorAll("[data-jump-view]").forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.jumpView));
});

document.addEventListener("click", (event) => {
  const closeButton = event.target.closest("[data-close-dialog]");
  if (!closeButton) return;
  const dialogId = closeButton.dataset.closeDialog;
  if (dialogId === "checklistItemDialog") {
    closeChecklistItemDialog(false);
    return;
  }
  if (dialogId === "decisionDialog") {
    document.getElementById("decisionDialog").close();
    decisionDialogState = null;
    return;
  }
  document.getElementById(dialogId)?.close();
});

document.getElementById("nodeMap").addEventListener("click", (event) => {
  const card = event.target.closest("[data-node-id]");
  if (!card) return;
  selectNode(card.dataset.nodeId);
});

document.getElementById("templateGrid").addEventListener("click", (event) => {
  const button = event.target.closest("[data-toggle-node]");
  if (!button || button.disabled) return;
  const node = getNode(button.dataset.toggleNode);
  if (!node) return;
  node.enabled = !node.enabled;
  if (!node.enabled && selectedNodeId === node.id) {
    selectedNodeId = enabledNodes()[0]?.id || "profile";
  }
  persistAndRender();
});

document.getElementById("openTemplateLibraryBtn").addEventListener("click", () => {
  renderTemplateGrid();
  document.getElementById("templateDialog").showModal();
});

document.getElementById("customNodeForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  state.customNodeCount += 1;
  const nodeId = `custom-${state.customNodeCount}`;
  state.nodes.push({
    id: nodeId,
    name: data.get("name"),
    type: data.get("type"),
    locked: false,
    enabled: true,
    order: state.nodes.length,
    owner: "双方一起",
    description: "自定义节点，可用于特殊流程、家庭习俗或个性化环节。",
    budgetNote: "按实际需要补充预算影响。",
    outputs: [],
    packageItems: [],
  });
  state.tasks.push({
    id: uid("task"),
    nodeId,
    title: "梳理这个节点需要完成的事项",
    owner: "双方一起",
    ownerIds: firstOwnerIdByName("双方一起") ? [firstOwnerIdByName("双方一起")] : [],
    dueDate: isoDate(addDays(new Date(), 7)),
    done: false,
    sourceDecisionId: "",
  });
  event.currentTarget.reset();
  selectedNodeId = nodeId;
  persistAndRender();
  switchView("node");
});

document.getElementById("nodeSelect").addEventListener("change", (event) => {
  selectedNodeId = event.target.value;
  renderAll();
});

document.getElementById("quickTaskBtn").addEventListener("click", () => {
  activeTaskNodeId = selectedNodeId;
  const form = document.getElementById("taskDialogForm");
  form.reset();
  form.elements.owner.innerHTML = ownerSelectOptions(firstOwnerIdByName("双方一起"));
  form.elements.dueDate.value = isoDate(addDays(new Date(), 7));
  document.getElementById("taskDialog").showModal();
});

document.getElementById("taskDialogForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (event.submitter?.value === "cancel") {
    document.getElementById("taskDialog").close();
    return;
  }
  const data = new FormData(event.currentTarget);
  const ownerId = data.get("owner");
  const ownerName = activeOwners().find((owner) => owner.ownerId === ownerId)?.name || "";
  state.tasks.push({
    id: uid("task"),
    nodeId: activeTaskNodeId,
    title: data.get("title"),
    owner: ownerName,
    ownerIds: ownerId ? [ownerId] : [],
    dueDate: data.get("dueDate"),
    done: false,
    sourceDecisionId: "",
  });
  document.getElementById("taskDialog").close();
  persistAndRender();
});

document.getElementById("nodeTaskList").addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-task-id]");
  if (!checkbox) return;
  const task = state.tasks.find((item) => item.id === checkbox.dataset.taskId);
  if (task) task.done = checkbox.checked;
  persistAndRender();
});

document.getElementById("nodeTaskList").addEventListener("click", async (event) => {
  const joinButton = event.target.closest("[data-join-task]");
  if (joinButton) {
    joinTaskToChecklist(joinButton.dataset.joinTask);
    return;
  }
  const openButton = event.target.closest("[data-open-checklist-item]");
  if (openButton) {
    openChecklistItemFromButton(openButton.dataset.openChecklistItem);
    return;
  }
  const button = event.target.closest("[data-delete-task]");
  if (!button) return;
  const task = state.tasks.find((item) => item.id === button.dataset.deleteTask);
  const shouldDelete = await askConfirm({
    title: "删除任务",
    message: `确认删除“${task?.title || "这个任务"}”？`,
    cancelText: "继续保留",
    okText: "删除",
  });
  if (!shouldDelete) return;
  state.tasks = state.tasks.filter((task) => task.id !== button.dataset.deleteTask);
  state.decisions.forEach((decision) => {
    decision.linkedTaskIds = (decision.linkedTaskIds || []).filter((taskId) => taskId !== button.dataset.deleteTask);
  });
  persistAndRender();
  showToast("任务已删除");
});

document.getElementById("quickDecisionBtn").addEventListener("click", () => {
  openDecisionDialog({ mode: "create", nodeId: selectedNodeId });
});

document.getElementById("newDecisionFromCenterBtn").addEventListener("click", () => {
  openDecisionDialog({ mode: "create", nodeId: selectedNodeId });
});

document.getElementById("decisionDialogNodeSelect").addEventListener("change", (event) => {
  const decision = decisionDialogState?.decisionId
    ? state.decisions.find((item) => item.id === decisionDialogState.decisionId)
    : { linkedTaskIds: [] };
  renderDecisionLinkedTaskOptions(decision, event.target.value);
});

document.getElementById("addDecisionOptionBtn").addEventListener("click", addDecisionOption);

document.getElementById("addDecisionCriterionBtn").addEventListener("click", addDecisionCriterion);

document.getElementById("decisionComparisonEditor").addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-remove-decision-option]");
  if (removeButton) {
    removeDecisionOption(Number(removeButton.dataset.removeDecisionOption));
    return;
  }
  const removeCriterionButton = event.target.closest("[data-remove-decision-criterion]");
  if (removeCriterionButton) {
    removeDecisionCriterion(Number(removeCriterionButton.dataset.removeDecisionCriterion));
  }
});

document.getElementById("toggleDecisionLinkedTasksBtn").addEventListener("click", () => {
  if (!decisionDialogState) return;
  decisionDialogState.linkedTasksExpanded = !decisionDialogState.linkedTasksExpanded;
  updateDecisionLinkedTaskSummary();
});

document.getElementById("decisionLinkedTaskCheckboxes").addEventListener("change", updateDecisionLinkedTaskSummary);

document.getElementById("decisionDialogForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const value = event.submitter?.value;
  if (value === "cancel") {
    document.getElementById("decisionDialog").close();
    decisionDialogState = null;
    return;
  }
  if (value === "edit") {
    setDecisionDialogMode("edit");
    return;
  }
  if (value === "delete") {
    await deleteDecisionFromDialog();
    return;
  }
  saveDecisionDialog();
});

document.getElementById("nodeDecisionList").addEventListener("input", handleDecisionInput);
document.getElementById("nodeDecisionList").addEventListener("change", handleDecisionChange);
document.getElementById("nodeDecisionList").addEventListener("click", handleDecisionClick);

document.getElementById("decisionFilter").addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  decisionFilter = button.dataset.filter;
  document.querySelectorAll("#decisionFilter button").forEach((item) => {
    item.classList.toggle("active", item === button);
  });
  renderDecisionBoard();
});

document.getElementById("decisionBoard").addEventListener("input", handleDecisionInput);
document.getElementById("decisionBoard").addEventListener("change", handleDecisionChange);
document.getElementById("decisionBoard").addEventListener("click", handleDecisionClick);

document.getElementById("projectRoleSelect").addEventListener("change", (event) => {
  state.currentRole = event.target.value;
  if (state.currentRole === "viewer" && document.getElementById("checklistItemDialog").open) {
    closeChecklistItemDialog(true);
  }
  persistAndRender();
  showToast(state.currentRole === "viewer" ? "已切换为只读视图" : "已切换为编辑者视图");
});

document.getElementById("addChecklistItemBtn").addEventListener("click", () => {
  openChecklistItemForm({ mode: "create", stageKey: "ungrouped" });
});

document.getElementById("manageOwnersBtn").addEventListener("click", () => {
  clearChecklistFormErrors();
  renderOwnerDialog();
  document.getElementById("ownerDialog").showModal();
});

document.getElementById("sortChecklistBtn").addEventListener("click", enterChecklistSortMode);

document.getElementById("checklistStatusFilter").addEventListener("click", (event) => {
  const button = event.target.closest("[data-checklist-status-filter]");
  if (!button) return;
  checklistStatusFilter = button.dataset.checklistStatusFilter;
  renderChecklist();
});

document.getElementById("checklistOwnerFilter").addEventListener("change", (event) => {
  checklistOwnerFilter = event.target.value;
  renderChecklist();
});

document.getElementById("checklistStageFilter").addEventListener("change", (event) => {
  checklistStageFilter = event.target.value;
  renderChecklist();
});

document.getElementById("checklistSortActions").addEventListener("click", (event) => {
  if (event.target.closest("#cancelChecklistSortBtn")) {
    checklistSortDraft = null;
    renderChecklist();
    return;
  }
  if (event.target.closest("#saveChecklistSortBtn")) {
    saveChecklistSort();
  }
});

document.getElementById("checklistContent").addEventListener("click", (event) => {
  if (event.target.closest("#retryChecklistLoadBtn")) {
    renderChecklist();
    return;
  }
  const addButton = event.target.closest("[data-add-checklist-stage]");
  if (addButton) {
    openChecklistItemForm({ mode: "create", stageKey: addButton.dataset.addChecklistStage });
    return;
  }
  const editButton = event.target.closest("[data-edit-checklist-item]");
  if (editButton) {
    openChecklistItemForm({ mode: canEditProject() ? "edit" : "view", itemId: editButton.dataset.editChecklistItem });
    return;
  }
  const toggleButton = event.target.closest("[data-toggle-checklist-status]");
  if (toggleButton) {
    const itemId = toggleButton.dataset.toggleChecklistStatus;
    checklistStatusSavingItemId = itemId;
    renderChecklist();
    setTimeout(() => {
      const result = checklistCore.updateExecutionItemStatus(state, itemId, toggleButton.dataset.nextStatus);
      checklistStatusSavingItemId = "";
      if (!result.ok) {
        showToast(result.error.code === "FORBIDDEN_PROJECT_PERMISSION" ? result.error.message : "更新失败，请重试");
      } else {
        saveState();
      }
      renderAll();
    }, 180);
    return;
  }
  const sourceButton = event.target.closest("[data-open-checklist-source]");
  if (sourceButton) {
    openChecklistSource(sourceButton.dataset.openChecklistSource);
    return;
  }
  const sortButton = event.target.closest("[data-sort-move]");
  if (sortButton) {
    moveSortItem(sortButton.dataset.sortMove, sortButton.dataset.direction);
  }
});

document.getElementById("checklistContent").addEventListener("change", (event) => {
  const stageSelect = event.target.closest("[data-sort-stage]");
  if (!stageSelect) return;
  moveSortItemToStage(stageSelect.dataset.sortStage, stageSelect.value);
});

document.getElementById("checklistContent").addEventListener("pointerdown", (event) => {
  const handle = event.target.closest("[data-sort-handle]");
  if (!handle || !checklistSortDraft) return;
  event.preventDefault();
  const row = handle.closest("[data-sort-item]");
  checklistSortDragState = {
    itemId: handle.dataset.sortDrag,
    pointerId: event.pointerId,
  };
  row?.classList.add("dragging");
  document.body.classList.add("is-sorting-drag");
});

document.addEventListener("pointermove", (event) => {
  if (!checklistSortDragState) return;
  event.preventDefault();
  moveSortItemToPointer(event.clientX, event.clientY);
});

document.addEventListener("pointerup", (event) => {
  if (!checklistSortDragState) return;
  finishChecklistSortDrag(event.clientX, event.clientY);
});

document.addEventListener("pointercancel", cleanupChecklistSortDrag);

document.getElementById("checklistContent").addEventListener("dragstart", (event) => {
  const row = event.target.closest("[data-sort-item]");
  if (!row || !checklistSortDraft) return;
  checklistSortDragState = { itemId: row.dataset.sortItem };
  event.dataTransfer?.setData("text/plain", row.dataset.sortItem);
  row.classList.add("dragging");
  document.body.classList.add("is-sorting-drag");
});

document.getElementById("checklistContent").addEventListener("dragover", (event) => {
  if (!checklistSortDragState) return;
  event.preventDefault();
  moveSortItemToPointer(event.clientX, event.clientY);
});

document.getElementById("checklistContent").addEventListener("drop", (event) => {
  if (!checklistSortDragState) return;
  event.preventDefault();
  finishChecklistSortDrag(event.clientX, event.clientY);
});

document.getElementById("checklistContent").addEventListener("dragend", cleanupChecklistSortDrag);

document.getElementById("checklistItemForm").addEventListener("input", scheduleChecklistDraftSave);
document.getElementById("checklistItemForm").addEventListener("change", scheduleChecklistDraftSave);

document.getElementById("checklistItemForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const value = event.submitter?.value;
  if (value === "edit") {
    const itemId = checklistFormState?.itemId;
    document.getElementById("checklistItemDialog").close();
    checklistFormState = null;
    if (itemId) openChecklistItemForm({ mode: "edit", itemId });
    return;
  }
  if (value === "cancel") {
    await closeChecklistItemDialog(false);
    return;
  }
  if (value === "delete") {
    await deleteChecklistItemFromForm();
    return;
  }
  await saveChecklistItemForm();
});

document.getElementById("ownerDialogForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (event.submitter?.value === "cancel") {
    document.getElementById("ownerDialog").close();
    return;
  }
  const name = new FormData(event.currentTarget).get("name");
  const result = checklistCore.createOwner(state, { name });
  if (!result.ok) {
    showOperationError(result);
    return;
  }
  event.currentTarget.reset();
  persistAndRender();
  renderOwnerDialog();
  showToast("负责人已添加");
});

document.getElementById("ownerList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-owner]");
  if (!button) return;
  deleteOwnerWithPrompt(button.dataset.deleteOwner);
});

document.getElementById("confirmDialogForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const accepted = event.submitter?.value === "ok";
  document.getElementById("confirmDialog").close();
  if (pendingConfirmResolver) pendingConfirmResolver(accepted);
  pendingConfirmResolver = null;
});

document.getElementById("joinNodeCandidatesBtn").addEventListener("click", joinSelectedNodeCandidates);

document.getElementById("nodeCandidateList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-open-checklist-item]");
  if (!button) return;
  openChecklistItemFromButton(button.dataset.openChecklistItem);
});

window.addEventListener("pagehide", flushChecklistDraft);

document.getElementById("copyPackageBtn").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(buildPackageText());
    showToast("执行包文本已复制");
  } catch (error) {
    showToast("复制失败，可使用导出执行包");
  }
});

document.getElementById("exportPackageBtn").addEventListener("click", () => {
  const blob = new Blob([buildPackageText()], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.download = "wedding-execution-package.txt";
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("执行包已导出");
});

document.getElementById("resetBtn").addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  const fresh = makeDefaultState();
  Object.keys(state).forEach((key) => delete state[key]);
  Object.assign(state, fresh);
  selectedNodeId = "lawn";
  activeView = "map";
  decisionFilter = "all";
  checklistStatusFilter = "all";
  checklistOwnerFilter = "all";
  checklistStageFilter = "all";
  checklistStatusSavingItemId = "";
  checklistSortDraft = null;
  checklistFormState = null;
  checklistDrafts.clear();
  persistAndRender();
  showToast("已恢复节点地图原型");
});

renderAll();
