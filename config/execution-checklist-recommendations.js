(function attachExecutionChecklistRecommendations(root, factory) {
  const config = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = config;
  }
  root.ExecutionChecklistRecommendationConfig = config;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildExecutionChecklistRecommendations() {
  return {
    schemaVersion: 1,
    configVersion: "2026-07-07-p0",
    candidates: [
      {
        candidateKey: "profile_print_master_info",
        nodeTemplateKey: "profile",
        content: "打印婚礼基础信息页并交给当天总负责人",
        stageKey: "pre_wedding",
        timeText: "婚礼前一周",
        noteText: "包含婚期、场地、宾客规模、预算红线和紧急联系人。",
      },
      {
        candidateKey: "budget_prepare_tail_payment_cash",
        nodeTemplateKey: "budget",
        content: "准备尾款和备用金支付清单",
        stageKey: "pre_wedding",
        timeText: "婚礼前 3 天",
        noteText: "标明金额、付款方式、收款方和负责付款的人。",
      },
      {
        candidateKey: "guests_confirm_special_care",
        nodeTemplateKey: "guests",
        content: "确认老人、小孩和特殊照顾宾客的到场安排",
        stageKey: "pre_wedding",
        timeText: "婚礼前一周",
        noteText: "写清楚座位、餐食、接送和现场协助人。",
      },
      {
        candidateKey: "lawn_confirm_weather_switch",
        nodeTemplateKey: "lawn",
        content: "确认草坪仪式雨备切换条件和最终拍板人",
        stageKey: "wedding_eve",
        timeText: "婚礼前一天 18:00",
        noteText: "同步场地方、主持、摄影摄像、花艺和当天总负责人。",
      },
      {
        candidateKey: "lawn_check_power_audio",
        nodeTemplateKey: "lawn",
        content: "检查草坪仪式区电源、音响和麦克风",
        stageKey: "wedding_day",
        timeText: "仪式前 90 分钟",
        noteText: "至少完成一次新人入场音乐和主持麦克风测试。",
      },
      {
        candidateKey: "dinner_confirm_table_service",
        nodeTemplateKey: "dinner",
        content: "确认晚宴桌型、菜单和服务人员配置",
        stageKey: "pre_wedding",
        timeText: "婚礼前 3 天",
        noteText: "和酒店核对桌数、儿童椅、素食或忌口宾客。",
      },
      {
        candidateKey: "dinner_handoff_cocktail_hour",
        nodeTemplateKey: "dinner",
        content: "把迎宾酒或转场安排交接给主持和酒店",
        stageKey: "wedding_eve",
        timeText: "婚礼前一天",
        noteText: "如果取消迎宾酒，也要同步宾客动线和摄影摄像安排。",
      },
      {
        candidateKey: "villa_confirm_noise_rules",
        nodeTemplateKey: "villa",
        content: "确认别墅 After Party 噪音、酒水和过夜规则",
        stageKey: "pre_wedding",
        timeText: "婚礼前一周",
        noteText: "规则截图或聊天记录需交给 After Party 负责人。",
      },
      {
        candidateKey: "villa_assign_cleanup_owner",
        nodeTemplateKey: "villa",
        content: "指定 After Party 收尾清洁和安全负责人",
        stageKey: "wedding_day",
        timeText: "After Party 开始前",
        noteText: "确认垃圾、贵重物品、返程和过夜名单。",
      },
      {
        candidateKey: "vendors_confirm_arrival_contacts",
        nodeTemplateKey: "vendors",
        content: "确认所有供应商到场时间和当天联系人",
        stageKey: "pre_wedding",
        timeText: "婚礼前 2 天",
        noteText: "至少包含场地、花艺、影像、化妆、主持、酒水和交通。",
      },
      {
        candidateKey: "vendors_prepare_final_payment",
        nodeTemplateKey: "vendors",
        content: "确认供应商尾款支付时间和付款负责人",
        stageKey: "wedding_eve",
        timeText: "婚礼前一天",
        noteText: "避免婚礼当天临时找新人确认金额。",
      },
      {
        candidateKey: "handoff_run_owner_briefing",
        nodeTemplateKey: "handoff",
        content: "完成当天负责人 briefing",
        stageKey: "pre_wedding",
        timeText: "婚礼前一周",
        noteText: "逐项说明可拍板事项、联系人、雨备、供应商和应急预案。",
      },
      {
        candidateKey: "handoff_share_execution_package",
        nodeTemplateKey: "handoff",
        content: "把最终执行包发给关键负责人",
        stageKey: "wedding_eve",
        timeText: "婚礼前一天",
        noteText: "发送后请负责人回复确认收到。",
      },
      {
        candidateKey: "package_check_final_version",
        nodeTemplateKey: "package",
        content: "检查婚礼执行包终版是否包含流程、负责人、风险和供应商",
        stageKey: "wedding_eve",
        timeText: "婚礼前一天",
        noteText: "终版之后只允许补充关键变更，避免多版本混乱。",
      },
      {
        candidateKey: "package_collect_post_wedding_items",
        nodeTemplateKey: "package",
        content: "收尾确认归还物品、尾款和照片素材",
        stageKey: "wrap_up",
        timeText: "婚礼后 1-3 天",
        noteText: "包括服装、押金、余款、感谢信息和素材备份。",
      },
    ],
  };
});
