(function attachExecutionChecklistCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.ExecutionChecklistCore = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildExecutionChecklistCore() {
  const STAGES = [
    { stageKey: "pre_wedding", label: "婚前准备" },
    { stageKey: "wedding_eve", label: "婚礼前一天" },
    { stageKey: "wedding_day", label: "婚礼当天" },
    { stageKey: "wrap_up", label: "收尾/撤场" },
    { stageKey: "ungrouped", label: "未分组" },
  ];
  const STAGE_KEYS = new Set(STAGES.map((stage) => stage.stageKey));
  const STATUS_VALUES = ["待确认", "已确认"];
  const SOURCE_TYPES = ["manual", "task", "decision_item", "node_checklist_template"];
  const LIMITS = {
    content: 200,
    timeText: 50,
    noteText: 1000,
    ownerName: 20,
    maxCandidatesPerNode: 8,
  };
  const SUPPORTED_RECOMMENDATION_SCHEMA_VERSION = 1;

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function uid(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function ok(result) {
    return { ok: true, result };
  }

  function fail(code, message, details = {}) {
    return { ok: false, error: { code, message, details } };
  }

  function stableStringify(value) {
    if (Array.isArray(value)) {
      return `[${value.map(stableStringify).join(",")}]`;
    }
    if (value && typeof value === "object") {
      return `{${Object.keys(value)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
        .join(",")}}`;
    }
    return JSON.stringify(value);
  }

  function ensureExecutionChecklistState(project) {
    project.version = Math.max(Number(project.version || 0), 3);
    project.projectId = project.projectId || "local-project";
    project.currentRole = project.currentRole || "editor";
    project.projectOwners = normalizeOwners(project);
    normalizeTaskOwnerIds(project);

    if (!project.executionChecklist) {
      project.executionChecklist = {
        id: "local-execution-checklist",
        projectId: project.projectId,
        totalCount: 0,
        pendingCount: 0,
        confirmedCount: 0,
        orderVersion: 0,
        shareEnabled: false,
        shareToken: null,
        shareExpiresAt: null,
      };
    }
    if (!Number.isFinite(project.executionChecklist.orderVersion)) {
      project.executionChecklist.orderVersion = 0;
    }
    if (!Array.isArray(project.executionItems)) {
      project.executionItems = [];
    }
    project.executionItems.forEach((item) => {
      item.stageKey = normalizeStageKey(item.stageKey);
      item.status = STATUS_VALUES.includes(item.status) ? item.status : "待确认";
      item.ownerIds = Array.isArray(item.ownerIds) ? item.ownerIds : [];
      item.sourceType = SOURCE_TYPES.includes(item.sourceType) ? item.sourceType : "manual";
      item.sortOrder = Number.isFinite(item.sortOrder) ? item.sortOrder : nextSortOrder(project, item.stageKey);
    });
    project.checklistIdempotency = project.checklistIdempotency || {};
    recalculateChecklistSummary(project);
    return project;
  }

  function normalizeOwners(project) {
    const owners = Array.isArray(project.projectOwners) ? project.projectOwners.map((owner) => ({ ...owner })) : [];
    const knownNames = ["新郎", "新娘"];
    (project.nodes || []).forEach((node) => {
      if (node.owner) knownNames.push(node.owner);
    });
    (project.tasks || []).forEach((task) => {
      if (task.owner) knownNames.push(task.owner);
    });
    (project.decisions || []).forEach((decision) => {
      if (decision.owner) knownNames.push(decision.owner);
    });

    let sortOrder = owners.reduce((max, owner) => Math.max(max, Number(owner.sortOrder || 0)), -1) + 1;
    knownNames.forEach((name) => {
      if (!name || owners.some((owner) => owner.name === name)) return;
      owners.push({
        ownerId: `owner-${owners.length + 1}`,
        name,
        sortOrder,
        deletedAt: null,
      });
      sortOrder += 1;
    });

    return owners
      .map((owner, index) => ({
        ownerId: owner.ownerId || `owner-${index + 1}`,
        name: owner.name || "",
        sortOrder: Number.isFinite(owner.sortOrder) ? owner.sortOrder : index,
        deletedAt: owner.deletedAt || null,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  function normalizeTaskOwnerIds(project) {
    (project.tasks || []).forEach((task) => {
      if (Array.isArray(task.ownerIds)) return;
      const owner = findActiveOwnerByName(project, task.owner);
      task.ownerIds = owner ? [owner.ownerId] : [];
    });
  }

  function activeOwners(project) {
    ensureExecutionChecklistState(project);
    return project.projectOwners.filter((owner) => !owner.deletedAt).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  function findActiveOwnerByName(project, name) {
    return (project.projectOwners || []).find((owner) => owner.name === name && !owner.deletedAt) || null;
  }

  function ownerNames(project, ownerIds) {
    const ids = Array.isArray(ownerIds) ? ownerIds : [];
    const names = ids
      .map((ownerId) => activeOwners(project).find((owner) => owner.ownerId === ownerId)?.name)
      .filter(Boolean);
    return names.length ? names.join("、") : "未填写";
  }

  function normalizeStageKey(stageKey) {
    return STAGE_KEYS.has(stageKey) ? stageKey : "ungrouped";
  }

  function isEditor(project) {
    return (project.currentRole || "editor") === "editor";
  }

  function requireEditor(project) {
    if (isEditor(project)) return null;
    return fail("FORBIDDEN_PROJECT_PERMISSION", "当前为只读权限，不能修改执行清单", {
      role: project.currentRole || "viewer",
    });
  }

  function activeItems(project) {
    ensureExecutionChecklistState(project);
    return project.executionItems
      .filter((item) => !item.deletedAt)
      .sort((a, b) => {
        const stageDelta = stageIndex(a.stageKey) - stageIndex(b.stageKey);
        if (stageDelta) return stageDelta;
        return a.sortOrder - b.sortOrder;
      });
  }

  function stageIndex(stageKey) {
    const index = STAGES.findIndex((stage) => stage.stageKey === stageKey);
    return index >= 0 ? index : STAGES.length - 1;
  }

  function recalculateChecklistSummary(project) {
    const items = (project.executionItems || []).filter((item) => !item.deletedAt);
    project.executionChecklist.totalCount = items.length;
    project.executionChecklist.pendingCount = items.filter((item) => item.status === "待确认").length;
    project.executionChecklist.confirmedCount = items.filter((item) => item.status === "已确认").length;
  }

  function getOrCreateExecutionChecklist(project) {
    ensureExecutionChecklistState(project);
    return ok({
      summary: { ...project.executionChecklist },
      owners: activeOwners(project).map((owner) => ({ ...owner })),
      stages: STAGES.map((stage) => ({ ...stage })),
      items: activeItems(project).map((item) => ({ ...item, ownerNames: ownerNames(project, item.ownerIds) })),
      orderVersion: project.executionChecklist.orderVersion,
      role: project.currentRole,
    });
  }

  function nextSortOrder(project, stageKey) {
    const normalizedStage = normalizeStageKey(stageKey);
    const currentMax = (project.executionItems || [])
      .filter((item) => !item.deletedAt && item.stageKey === normalizedStage)
      .reduce((max, item) => Math.max(max, Number(item.sortOrder || 0)), -1);
    return currentMax + 1;
  }

  function validateExecutionItemPayload(project, payload) {
    const fieldErrors = {};
    const ownerIds = Array.isArray(payload.ownerIds) ? payload.ownerIds : [];
    const activeOwnerIds = new Set(activeOwners(project).map((owner) => owner.ownerId));
    const normalized = {
      content: String(payload.content ?? ""),
      stageKey: payload.stageKey || "ungrouped",
      timeText: String(payload.timeText ?? ""),
      ownerIds,
      noteText: String(payload.noteText ?? ""),
      status: payload.status || "待确认",
    };

    if (normalized.content.trim().length === 0) {
      fieldErrors.content = "请填写必填内容";
    } else if (normalized.content.length > LIMITS.content) {
      fieldErrors.content = `执行内容不能超过 ${LIMITS.content} 个字`;
    }
    if (!STAGE_KEYS.has(normalized.stageKey)) {
      fieldErrors.stageKey = "执行阶段不合法";
    }
    if (normalized.timeText.length > LIMITS.timeText) {
      fieldErrors.timeText = `执行时间不能超过 ${LIMITS.timeText} 个字`;
    }
    if (normalized.noteText.length > LIMITS.noteText) {
      fieldErrors.noteText = `备注不能超过 ${LIMITS.noteText} 个字`;
    }
    if (!STATUS_VALUES.includes(normalized.status)) {
      fieldErrors.status = "执行状态不合法";
    }
    const invalidOwnerIds = ownerIds.filter((ownerId) => !activeOwnerIds.has(ownerId));
    if (invalidOwnerIds.length) {
      fieldErrors.ownerIds = "负责人不存在或已删除";
    }

    return {
      valid: Object.keys(fieldErrors).length === 0,
      fieldErrors,
      normalized,
    };
  }

  function idempotencyPayload(payload) {
    return {
      content: String(payload.content ?? ""),
      stageKey: payload.stageKey || "ungrouped",
      timeText: String(payload.timeText ?? ""),
      ownerIds: Array.isArray(payload.ownerIds) ? payload.ownerIds : [],
      noteText: String(payload.noteText ?? ""),
      status: payload.status || "待确认",
    };
  }

  function createManualExecutionItem(project, payload) {
    ensureExecutionChecklistState(project);
    const permissionError = requireEditor(project);
    if (permissionError) return permissionError;

    const clientRequestId = String(payload.clientRequestId || "");
    if (!clientRequestId) {
      return fail("VALIDATION_ERROR", "手动新增需要 clientRequestId", {
        fieldErrors: { clientRequestId: "缺少 clientRequestId" },
      });
    }

    const payloadHash = stableStringify(idempotencyPayload(payload));
    const idempotencyRecord = project.checklistIdempotency[clientRequestId];
    if (idempotencyRecord) {
      if (idempotencyRecord.payloadHash !== payloadHash) {
        return fail("IDEMPOTENCY_KEY_PAYLOAD_MISMATCH", "同一个 clientRequestId 不能用于不同内容", {
          clientRequestId,
        });
      }
      const existing = project.executionItems.find((item) => item.id === idempotencyRecord.itemId);
      return ok({ type: "existing_by_idempotency", item: existing ? { ...existing } : null });
    }

    const validation = validateExecutionItemPayload(project, payload);
    if (!validation.valid) {
      return fail("VALIDATION_ERROR", "执行项内容校验失败", { fieldErrors: validation.fieldErrors });
    }

    const item = createExecutionItem(project, validation.normalized, {
      sourceType: "manual",
      clientRequestId,
    });
    project.checklistIdempotency[clientRequestId] = {
      payloadHash,
      itemId: item.id,
    };
    return ok({ type: "created", item: { ...item } });
  }

  function createExecutionItem(project, normalized, metadata) {
    const stageKey = normalizeStageKey(normalized.stageKey);
    const timestamp = nowIso();
    const item = {
      id: uid("exec-item"),
      content: normalized.content,
      stageKey,
      timeText: normalized.timeText,
      ownerIds: [...normalized.ownerIds],
      noteText: normalized.noteText,
      status: normalized.status || "待确认",
      sourceType: metadata.sourceType || "manual",
      sourceTaskId: metadata.sourceTaskId || "",
      sourceDecisionId: metadata.sourceDecisionId || "",
      sourceNodeId: metadata.sourceNodeId || "",
      sourceCandidateKey: metadata.sourceCandidateKey || "",
      sortOrder: nextSortOrder(project, stageKey),
      clientRequestId: metadata.clientRequestId || "",
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    };
    project.executionItems.push(item);
    project.executionChecklist.orderVersion += 1;
    recalculateChecklistSummary(project);
    return item;
  }

  function findActiveItem(project, itemId) {
    ensureExecutionChecklistState(project);
    return project.executionItems.find((item) => item.id === itemId && !item.deletedAt) || null;
  }

  function updateExecutionItem(project, itemId, payload) {
    ensureExecutionChecklistState(project);
    const permissionError = requireEditor(project);
    if (permissionError) return permissionError;
    const item = findActiveItem(project, itemId);
    if (!item) return fail("ITEM_NOT_FOUND_OR_DELETED", "执行项不存在或已删除", { itemId });

    const previousStage = item.stageKey;
    const validation = validateExecutionItemPayload(project, { ...item, ...payload });
    if (!validation.valid) {
      return fail("VALIDATION_ERROR", "执行项内容校验失败", { fieldErrors: validation.fieldErrors });
    }

    Object.assign(item, validation.normalized, { updatedAt: nowIso() });
    if (previousStage !== item.stageKey) {
      item.sortOrder = nextSortOrder(project, item.stageKey);
      project.executionChecklist.orderVersion += 1;
    }
    recalculateChecklistSummary(project);
    return ok({ type: "updated", item: { ...item } });
  }

  function deleteExecutionItem(project, itemId) {
    ensureExecutionChecklistState(project);
    const permissionError = requireEditor(project);
    if (permissionError) return permissionError;
    const item = findActiveItem(project, itemId);
    if (!item) return fail("ITEM_NOT_FOUND_OR_DELETED", "执行项不存在或已删除", { itemId });
    item.deletedAt = nowIso();
    item.updatedAt = item.deletedAt;
    project.executionChecklist.orderVersion += 1;
    recalculateChecklistSummary(project);
    return ok({ type: "deleted", itemId });
  }

  function updateExecutionItemStatus(project, itemId, status) {
    ensureExecutionChecklistState(project);
    const permissionError = requireEditor(project);
    if (permissionError) return permissionError;
    const item = findActiveItem(project, itemId);
    if (!item) return fail("ITEM_NOT_FOUND_OR_DELETED", "执行项不存在或已删除", { itemId });
    if (!STATUS_VALUES.includes(status)) {
      return fail("VALIDATION_ERROR", "执行状态不合法", { fieldErrors: { status: "执行状态不合法" } });
    }
    item.status = status;
    item.updatedAt = nowIso();
    recalculateChecklistSummary(project);
    return ok({ type: "updated", item: { ...item } });
  }

  function createOwner(project, payload) {
    ensureExecutionChecklistState(project);
    const permissionError = requireEditor(project);
    if (permissionError) return permissionError;
    const name = String(payload.name ?? "");
    const fieldErrors = {};
    if (name.trim().length === 0) fieldErrors.name = "请填写负责人名称";
    if (name.length > LIMITS.ownerName) fieldErrors.name = `负责人名称不能超过 ${LIMITS.ownerName} 个字`;
    if (activeOwners(project).some((owner) => owner.name === name)) fieldErrors.name = "负责人名称不能重复";
    if (Object.keys(fieldErrors).length) {
      return fail("VALIDATION_ERROR", "负责人校验失败", { fieldErrors });
    }
    const sortOrder = activeOwners(project).reduce((max, owner) => Math.max(max, owner.sortOrder), -1) + 1;
    const owner = {
      ownerId: uid("owner"),
      name,
      sortOrder,
      deletedAt: null,
    };
    project.projectOwners.push(owner);
    return ok({ type: "created", owner: { ...owner } });
  }

  function deleteOwner(project, ownerId) {
    ensureExecutionChecklistState(project);
    const permissionError = requireEditor(project);
    if (permissionError) return permissionError;
    const owner = activeOwners(project).find((item) => item.ownerId === ownerId);
    if (!owner) return fail("ITEM_NOT_FOUND_OR_DELETED", "负责人不存在或已删除", { ownerId });
    const affectedTasks = (project.tasks || []).filter((task) => Array.isArray(task.ownerIds) && task.ownerIds.includes(ownerId));
    const affectedItems = activeItems(project).filter((item) => item.ownerIds.includes(ownerId));
    owner.deletedAt = nowIso();
    affectedTasks.forEach((task) => {
      task.ownerIds = task.ownerIds.filter((id) => id !== ownerId);
      if (task.owner === owner.name) task.owner = "";
    });
    affectedItems.forEach((item) => {
      item.ownerIds = item.ownerIds.filter((id) => id !== ownerId);
      item.updatedAt = nowIso();
    });
    return ok({
      type: "deleted",
      ownerId,
      affectedTaskCount: affectedTasks.length,
      affectedItemCount: affectedItems.length,
    });
  }

  function sourceIdentity(source) {
    if (source.sourceType === "task") return { sourceType: "task", sourceTaskId: source.sourceTaskId || source.taskId || "" };
    if (source.sourceType === "decision_item") {
      return { sourceType: "decision_item", sourceDecisionId: source.sourceDecisionId || source.decisionId || "" };
    }
    if (source.sourceType === "node_checklist_template") {
      return {
        sourceType: "node_checklist_template",
        sourceNodeId: source.sourceNodeId || source.nodeId || "",
        sourceCandidateKey: source.sourceCandidateKey || source.candidateKey || "",
      };
    }
    return { sourceType: "manual" };
  }

  function findActiveItemBySource(project, source) {
    const identity = sourceIdentity(source);
    return activeItems(project).find((item) => {
      if (item.sourceType !== identity.sourceType) return false;
      if (identity.sourceType === "task") return item.sourceTaskId === identity.sourceTaskId;
      if (identity.sourceType === "decision_item") return item.sourceDecisionId === identity.sourceDecisionId;
      if (identity.sourceType === "node_checklist_template") {
        return item.sourceNodeId === identity.sourceNodeId && item.sourceCandidateKey === identity.sourceCandidateKey;
      }
      return false;
    }) || null;
  }

  function buildTaskPrefill(project, taskId) {
    const task = (project.tasks || []).find((item) => item.id === taskId);
    if (!task) return fail("ITEM_NOT_FOUND_OR_DELETED", "任务不存在或已删除", { taskId });
    if (!task.done) {
      return fail("VALIDATION_ERROR", "未完成任务不能加入执行清单", {
        fieldErrors: { sourceTaskId: "任务尚未完成" },
      });
    }
    return ok({
      content: String(task.title || task.content || ""),
      stageKey: "ungrouped",
      timeText: "",
      ownerIds: Array.isArray(task.ownerIds) ? [...task.ownerIds] : [],
      noteText: "",
      status: "待确认",
      sourceType: "task",
      sourceTaskId: task.id,
    });
  }

  function buildDecisionPrefill(project, decisionId) {
    const decision = (project.decisions || []).find((item) => item.id === decisionId);
    if (!decision) return fail("ITEM_NOT_FOUND_OR_DELETED", "决策项不存在或已删除", { decisionId });
    if (!["已决定", "已转任务"].includes(decision.status)) {
      return fail("VALIDATION_ERROR", "只有已决定的决策项才能加入执行清单", {
        fieldErrors: { sourceDecisionId: "决策项尚未完成" },
      });
    }
    const owner = findActiveOwnerByName(project, decision.owner);
    const suffix = decision.finalChoice || decision.conclusion ? `：${decision.finalChoice || decision.conclusion}` : "";
    return ok({
      content: `${decision.title || ""}${suffix}`,
      stageKey: "ungrouped",
      timeText: "",
      ownerIds: owner ? [owner.ownerId] : [],
      noteText: "",
      status: "待确认",
      sourceType: "decision_item",
      sourceDecisionId: decision.id,
    });
  }

  function joinSourceExecutionItem(project, source) {
    ensureExecutionChecklistState(project);
    const permissionError = requireEditor(project);
    if (permissionError) return permissionError;
    const existing = findActiveItemBySource(project, source);
    if (existing) return ok({ type: "existing", item: { ...existing } });

    let prefillResult;
    if (source.sourceType === "task") prefillResult = buildTaskPrefill(project, source.sourceTaskId || source.taskId);
    if (source.sourceType === "decision_item") prefillResult = buildDecisionPrefill(project, source.sourceDecisionId || source.decisionId);
    if (!prefillResult) {
      return fail("VALIDATION_ERROR", "来源类型不合法", { fieldErrors: { sourceType: "来源类型不合法" } });
    }
    if (!prefillResult.ok) return prefillResult;

    const validation = validateExecutionItemPayload(project, prefillResult.result);
    if (!validation.valid) {
      return ok({
        type: "needs_edit",
        reason: validation.fieldErrors.content || "来源内容需要编辑后才能加入",
        fieldErrors: validation.fieldErrors,
        prefill: prefillResult.result,
      });
    }
    const item = createExecutionItem(project, validation.normalized, sourceIdentity(prefillResult.result));
    return ok({ type: "created", item: { ...item } });
  }

  function createSourceExecutionItem(project, payload) {
    ensureExecutionChecklistState(project);
    const permissionError = requireEditor(project);
    if (permissionError) return permissionError;
    const existing = findActiveItemBySource(project, payload);
    if (existing) return ok({ type: "existing", item: { ...existing } });
    const validation = validateExecutionItemPayload(project, payload);
    if (!validation.valid) {
      return fail("VALIDATION_ERROR", "执行项内容校验失败", { fieldErrors: validation.fieldErrors });
    }
    const item = createExecutionItem(project, validation.normalized, sourceIdentity(payload));
    return ok({ type: "created", item: { ...item } });
  }

  function getNodeCandidates(config, nodeTemplateKey) {
    return (config?.candidates || []).filter((candidate) => candidate.nodeTemplateKey === nodeTemplateKey);
  }

  function batchJoinNodeCandidates(project, config, nodeTemplateKey, candidateKeys) {
    ensureExecutionChecklistState(project);
    const permissionError = requireEditor(project);
    if (permissionError) return permissionError;
    const keys = Array.isArray(candidateKeys) ? candidateKeys : [];
    const candidates = getNodeCandidates(config, nodeTemplateKey);
    const result = { created: [], existing: [], failed: [], needsEdit: [] };

    keys.forEach((candidateKey) => {
      const candidate = candidates.find((item) => item.candidateKey === candidateKey);
      if (!candidate) {
        result.failed.push({
          candidateKey,
          error: { code: "ITEM_NOT_FOUND_OR_DELETED", message: "推荐项不存在", details: { candidateKey } },
        });
        return;
      }
      const source = {
        sourceType: "node_checklist_template",
        sourceNodeId: nodeTemplateKey,
        sourceCandidateKey: candidate.candidateKey,
      };
      const existing = findActiveItemBySource(project, source);
      if (existing) {
        result.existing.push({ candidateKey, item: { ...existing } });
        return;
      }
      const payload = {
        content: candidate.content,
        stageKey: candidate.stageKey,
        timeText: candidate.timeText || "",
        ownerIds: [],
        noteText: candidate.noteText || "",
        status: "待确认",
        ...source,
      };
      const validation = validateExecutionItemPayload(project, payload);
      if (!validation.valid) {
        result.needsEdit.push({
          candidateKey,
          reason: validation.fieldErrors.content || "推荐项需要编辑后才能加入",
          fieldErrors: validation.fieldErrors,
          prefill: payload,
        });
        return;
      }
      const item = createExecutionItem(project, validation.normalized, source);
      result.created.push({ candidateKey, item: { ...item } });
    });

    return ok(result);
  }

  function reorderExecutionItems(project, payload) {
    ensureExecutionChecklistState(project);
    const permissionError = requireEditor(project);
    if (permissionError) return permissionError;
    if (payload.orderVersion !== project.executionChecklist.orderVersion) {
      return fail("ORDER_VERSION_CONFLICT", "清单顺序已被更新，请刷新后重试", {
        expected: project.executionChecklist.orderVersion,
        received: payload.orderVersion,
      });
    }

    const activeItemIds = new Set(activeItems(project).map((item) => item.id));
    const seen = new Set();
    const stages = Array.isArray(payload.stages) ? payload.stages : [];
    const fieldErrors = {};
    stages.forEach((stage) => {
      if (!STAGE_KEYS.has(stage.stageKey)) fieldErrors.stageKey = "执行阶段不合法";
      (stage.itemIds || []).forEach((itemId) => {
        if (!activeItemIds.has(itemId)) fieldErrors.itemIds = "排序包含不存在或已删除的执行项";
        if (seen.has(itemId)) fieldErrors.itemIds = "排序包含重复执行项";
        seen.add(itemId);
      });
    });
    if (seen.size !== activeItemIds.size) fieldErrors.itemIds = "排序必须包含所有 active 执行项";
    if (Object.keys(fieldErrors).length) {
      return fail("VALIDATION_ERROR", "排序数据校验失败", { fieldErrors });
    }

    stages.forEach((stage) => {
      stage.itemIds.forEach((itemId, index) => {
        const item = findActiveItem(project, itemId);
        item.stageKey = stage.stageKey;
        item.sortOrder = index;
        item.updatedAt = nowIso();
      });
    });
    project.executionChecklist.orderVersion += 1;
    recalculateChecklistSummary(project);
    return ok({ type: "reordered", orderVersion: project.executionChecklist.orderVersion });
  }

  function validateRecommendationConfig(config, nodeTemplateKeys) {
    const registry = new Set(nodeTemplateKeys || []);
    const errors = [];
    const warnings = [];
    const countsByNode = {};
    const seenKeys = new Set();
    const wording = new Map();
    const suspectedDuplicates = [];

    if (!config || typeof config !== "object") {
      return {
        valid: false,
        errors: [{ path: "$", code: "CONFIG_NOT_OBJECT", message: "配置必须是对象" }],
        warnings,
        countsByNode,
        suspectedDuplicates,
      };
    }

    if (config.schemaVersion !== SUPPORTED_RECOMMENDATION_SCHEMA_VERSION) {
      errors.push({
        path: "schemaVersion",
        code: "UNSUPPORTED_SCHEMA_VERSION",
        message: `仅支持 schemaVersion ${SUPPORTED_RECOMMENDATION_SCHEMA_VERSION}`,
      });
    }
    if (typeof config.configVersion !== "string" || !config.configVersion) {
      errors.push({ path: "configVersion", code: "MISSING_CONFIG_VERSION", message: "缺少 configVersion" });
    }
    if (!Array.isArray(config.candidates)) {
      errors.push({ path: "candidates", code: "CANDIDATES_NOT_ARRAY", message: "candidates 必须是数组" });
    }

    (config.candidates || []).forEach((candidate, index) => {
      const path = `candidates[${index}]`;
      const candidateKey = candidate.candidateKey;
      if (!/^[a-z][a-z0-9_]*$/.test(candidateKey || "")) {
        errors.push({ path: `${path}.candidateKey`, code: "ILLEGAL_CANDIDATE_KEY", message: "candidateKey 必须是英文 snake_case" });
      }
      if (seenKeys.has(candidateKey)) {
        errors.push({ path: `${path}.candidateKey`, code: "DUPLICATE_CANDIDATE_KEY", message: "candidateKey 重复" });
      }
      seenKeys.add(candidateKey);

      if (!registry.has(candidate.nodeTemplateKey)) {
        errors.push({ path: `${path}.nodeTemplateKey`, code: "UNKNOWN_NODE_TEMPLATE_KEY", message: "nodeTemplateKey 不在节点模板注册表中" });
      }
      if (!STAGE_KEYS.has(candidate.stageKey)) {
        errors.push({ path: `${path}.stageKey`, code: "ILLEGAL_STAGE_KEY", message: "stageKey 不在固定阶段枚举中" });
      }
      if (typeof candidate.content !== "string" || candidate.content.trim().length === 0) {
        errors.push({ path: `${path}.content`, code: "EMPTY_CONTENT", message: "content 不能为空" });
      } else if (candidate.content.length > LIMITS.content) {
        errors.push({ path: `${path}.content`, code: "CONTENT_TOO_LONG", message: `content 不能超过 ${LIMITS.content} 个字` });
      }
      ["timeText", "noteText"].forEach((field) => {
        if (!(field in candidate)) return;
        if (candidate[field] === null || candidate[field] === "") {
          errors.push({ path: `${path}.${field}`, code: "EMPTY_OPTIONAL_FIELD", message: "可选空字段应省略，不应写 null 或空字符串" });
        }
      });
      if (candidate.timeText && candidate.timeText.length > LIMITS.timeText) {
        errors.push({ path: `${path}.timeText`, code: "TIME_TEXT_TOO_LONG", message: `timeText 不能超过 ${LIMITS.timeText} 个字` });
      }
      if (candidate.noteText && candidate.noteText.length > LIMITS.noteText) {
        errors.push({ path: `${path}.noteText`, code: "NOTE_TEXT_TOO_LONG", message: `noteText 不能超过 ${LIMITS.noteText} 个字` });
      }

      countsByNode[candidate.nodeTemplateKey] = (countsByNode[candidate.nodeTemplateKey] || 0) + 1;
      const normalizedWording = String(candidate.content || "").replace(/\s+/g, "");
      if (wording.has(normalizedWording)) {
        suspectedDuplicates.push([wording.get(normalizedWording), candidateKey]);
      } else {
        wording.set(normalizedWording, candidateKey);
      }
    });

    Object.entries(countsByNode).forEach(([nodeTemplateKey, count]) => {
      if (count > LIMITS.maxCandidatesPerNode) {
        warnings.push({
          path: `node:${nodeTemplateKey}`,
          code: "TOO_MANY_CANDIDATES",
          message: `${nodeTemplateKey} 有 ${count} 条推荐项，可能过多`,
        });
      }
    });
    suspectedDuplicates.forEach(([firstKey, secondKey]) => {
      warnings.push({
        path: `candidate:${secondKey}`,
        code: "SUSPECTED_DUPLICATE_WORDING",
        message: `${secondKey} 和 ${firstKey} 文案疑似重复`,
      });
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      countsByNode,
      suspectedDuplicates,
    };
  }

  function dryRunRecommendationConfig(previousConfig, nextConfig, nodeTemplateKeys) {
    const previousCandidates = new Map((previousConfig?.candidates || []).map((candidate) => [candidate.candidateKey, candidate]));
    const nextCandidates = new Map((nextConfig?.candidates || []).map((candidate) => [candidate.candidateKey, candidate]));
    const added = [];
    const changed = [];
    const removed = [];

    nextCandidates.forEach((candidate, key) => {
      if (!previousCandidates.has(key)) {
        added.push(key);
        return;
      }
      if (stableStringify(previousCandidates.get(key)) !== stableStringify(candidate)) {
        changed.push(key);
      }
    });
    previousCandidates.forEach((_, key) => {
      if (!nextCandidates.has(key)) removed.push(key);
    });

    const validation = validateRecommendationConfig(nextConfig, nodeTemplateKeys);
    return {
      schemaVersion: nextConfig?.schemaVersion,
      configVersion: nextConfig?.configVersion,
      previousConfigVersion: previousConfig?.configVersion || null,
      added,
      changed,
      removed,
      errors: validation.errors,
      warnings: validation.warnings,
      countsByNode: validation.countsByNode,
      suspectedDuplicates: validation.suspectedDuplicates,
      valid: validation.valid,
    };
  }

  function formatDryRunMarkdown(report) {
    const lines = [
      `# Execution Checklist Recommendation Dry-run`,
      "",
      `- schemaVersion: ${report.schemaVersion ?? "unknown"}`,
      `- configVersion: ${report.configVersion || "unknown"}`,
      `- previousConfigVersion: ${report.previousConfigVersion || "none"}`,
      `- valid: ${report.valid ? "yes" : "no"}`,
      "",
      "## Changed Candidate Keys",
      "",
      `- Added: ${report.added.length ? report.added.join(", ") : "none"}`,
      `- Changed: ${report.changed.length ? report.changed.join(", ") : "none"}`,
      `- Removed: ${report.removed.length ? report.removed.join(", ") : "none"}`,
      "",
      "## Counts Per Node",
      "",
      ...Object.entries(report.countsByNode).map(([node, count]) => `- ${node}: ${count}`),
      "",
      "## Errors",
      "",
      ...(report.errors.length ? report.errors.map((error) => `- ${error.code} at ${error.path}: ${error.message}`) : ["- none"]),
      "",
      "## Warnings",
      "",
      ...(report.warnings.length ? report.warnings.map((warning) => `- ${warning.code} at ${warning.path}: ${warning.message}`) : ["- none"]),
    ];
    return lines.join("\n");
  }

  return {
    STAGES,
    STAGE_KEYS: [...STAGE_KEYS],
    STATUS_VALUES,
    SOURCE_TYPES,
    LIMITS,
    ensureExecutionChecklistState,
    getOrCreateExecutionChecklist,
    activeOwners,
    activeItems,
    ownerNames,
    createManualExecutionItem,
    updateExecutionItem,
    deleteExecutionItem,
    updateExecutionItemStatus,
    createOwner,
    deleteOwner,
    joinSourceExecutionItem,
    createSourceExecutionItem,
    batchJoinNodeCandidates,
    findActiveItemBySource,
    getNodeCandidates,
    reorderExecutionItems,
    validateExecutionItemPayload,
    validateRecommendationConfig,
    dryRunRecommendationConfig,
    formatDryRunMarkdown,
    stableStringify,
    deepClone,
  };
});
