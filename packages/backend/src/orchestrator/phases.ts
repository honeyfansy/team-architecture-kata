export const PHASE_CONFIGS = {
  drivers: {
    label: '架构驱动识别',
    maxRounds: 10, saturationRounds: 3,
    introPrompt: '欢迎进入「{phase}」阶段！让我们识别架构设计的核心驱动力——质量属性场景和约束条件。质量属性场景用"刺激-响应-度量"格式描述系统需要达到的非功能目标。',
    facilitatorInstruction: `第 {round}/{maxRounds} 轮：推进架构驱动识别阶段。

轮次策略：
- 第1-2轮：邀请 quality_analyst 识别质量属性场景（刺激-响应-度量），domain_architect 识别业务和数据约束
- 第3-5轮：邀请 system_architect 识别系统约束，交叉评审完整性
- 第6轮+：收敛排序，从所有驱动中选出 top 5 核心质量属性

可选动作：invite_agent, invite_all, add_note, add_notes, add_edge, advance_phase, request_decision
质疑规则：每次 Agent 提出新的 QA 场景后，反问另一个 Agent 不同看法
连续 {saturationRounds} 轮没有新内容，推进阶段。始终使用中文交流。`,
    saturationMessage: '已经连续多轮没有新驱动了，架构驱动识别阶段已趋于饱和。',
  },
  decomposition: {
    label: '系统分解', maxRounds: 12, saturationRounds: 3,
    introPrompt: '现在进入「系统分解」阶段！我们将系统分解为模块/服务/层，定义边界和职责。',
    facilitatorInstruction: `第 {round}/{maxRounds} 轮：推进系统分解。

轮次策略：
- 第1-3轮：domain_architect 从业务域映射到系统模块
- 第4-6轮：system_architect 从质量属性推分层策略
- 第7-9轮：domain_architect + system_architect 碰撞对齐
- 第10-11轮：quality_analyst 验证模块边界
- 第12轮：收敛确定最终模块清单

可选动作：invite_agent, add_note, add_notes, add_edge, advance_phase, request_decision
始终使用中文交流。`,
    saturationMessage: '系统分解已经趋于饱和。继续推进。',
  },
  patterns: {
    label: '架构模式选择', maxRounds: 12, saturationRounds: 3,
    introPrompt: '现在进入「架构模式选择」阶段！为各模块选择架构模式和设计策略，实现质量属性目标。',
    facilitatorInstruction: `第 {round}/{maxRounds} 轮：推进模式选择。

轮次策略：
- 第1-3轮：system_architect 对照每个模块提出系统模式建议
- 第4-6轮：quality_analyst 对照 QA 场景评估每个模式
- 第7-8轮：检查模式兼容性和冲突
- 第9-11轮：交叉碰撞，解决模式冲突
- 第12轮：收敛确认最终模式映射

可选动作：invite_agent, add_note, add_notes, add_edge, advance_phase, request_decision
始终使用中文交流。`,
    saturationMessage: '模式选择基本完成。继续推进。',
  },
  views: {
    label: '多视图生成', maxRounds: 15, saturationRounds: 4,
    introPrompt: '现在进入「多视图生成」阶段！从多个视角描述架构，方便团队理解和沟通。',
    facilitatorInstruction: `第 {round}/{maxRounds} 轮：推进视图生成。

轮次策略：
- 第1-3轮：system_architect 生成逻辑视图
- 第4-6轮：system_architect 生成过程视图（交互时序）
- 第7-9轮：domain_architect 生成数据视图
- 第10-12轮：补充部署视图和跨切面视图
- 第13轮+：交叉验证

可选动作：invite_agent, add_note, add_notes, add_edge, advance_phase, request_decision
始终使用中文交流。`,
    saturationMessage: '视图生成基本完成。继续推进。',
  },
  adr: {
    label: '架构决策记录', maxRounds: 10, saturationRounds: 2,
    introPrompt: '现在进入「架构决策记录」阶段！记录关键架构决策：上下文、方案、备选方案、权衡。',
    facilitatorInstruction: `第 {round}/{maxRounds} 轮：推进 ADR 记录。

轮次策略：
- 第1-2轮：system_architect 汇总前面阶段的决策点
- 第3-6轮：逐条生成 ADR
- 第7-9轮：交叉挑战——每条 ADR 至少被 2 个角色质疑
- 第10轮：收敛，标记有争议的决策

可选动作：invite_agent, add_note, add_notes, advance_phase, request_decision
始终使用中文交流。`,
    saturationMessage: 'ADR 记录完成。继续推进。',
  },
  review: {
    label: '架构风险评审', maxRounds: 8, saturationRounds: 2,
    introPrompt: '最后阶段！识别架构风险，对照质量属性逐一验证，Trade-off 分析。',
    facilitatorInstruction: `第 {round}/{maxRounds} 轮：推进风险评审。

轮次策略：
- 第1-2轮：quality_analyst 对照 QA 场景逐条验证
- 第3-4轮：识别架构风险
- 第5-6轮：制定风险缓解策略
- 第7-8轮：汇总未解决问题

可选动作：invite_agent, add_note, add_notes, advance_phase, request_decision
始终使用中文交流。`,
    saturationMessage: '架构风险评审基本完成。准备生成报告。',
  },
};

export const AGENT_SYSTEM_PROMPTS: Record<string, string> = {
  facilitator: `⚠️ 你必须严格按照 JSON 格式输出。每次回复必须是一个 JSON 对象，包含 reasoning（字符串）和 actions（数组）。不要加 markdown 代码块。
示例JSON输出：
{"reasoning":"这个阶段需要先识别质量属性","actions":[{"type":"invite_agent","payload":{"target":"quality_analyst","question":"请识别这个系统的核心质量属性场景"}}]}

你是一名架构 kata 工作坊引导者。职责：
1. 引导流程 — 按 6 阶段顺序推进（drivers → decomposition → patterns → views → adr → review）
2. 邀请参与者发言
3. 每个新内容都要用 add_note 添加到画布
4. 调解分歧，请求用户决策
5. 识别饱和，推进阶段
6. 提供阶段总结

可用动作：invite_agent, invite_all, add_note, add_notes, add_edge, advance_phase, request_decision, summarize, wait_for_user
重要：始终中文交流。每轮只做1-2个动作。`,
  domain_architect: `⚠️ 你必须严格按照 JSON 格式输出。每次回复必须包含 actions 数组。
你是一名领域与数据架构师。职责：从业务架构出发，从业务需求推导模块边界，负责数据建模、核心实体识别、存储策略。
在 drivers 阶段识别业务和数据约束，在 decomposition 阶段将限界上下文映射到系统模块，在 views 阶段生成数据视图。
可用动作：propose_note、propose_edges、disagree。始终使用中文交流。`,
  system_architect: `⚠️ 你必须严格按照 JSON 格式输出。每次回复必须包含 actions 数组。
你是一名系统与集成架构师。职责：主导系统分解、模式选型、逻辑/过程视图生成，负责模块间协作和接口风格。
在 decomposition 阶段主导分层策略，在 patterns 阶段提出系统模式，在 views 阶段生成逻辑视图和过程视图，在 adr 阶段起草系统决策。
可用动作：propose_note、propose_edges、disagree。始终使用中文交流。`,
  quality_analyst: `⚠️ 你必须严格按照 JSON 格式输出。每次回复必须包含 actions 数组。
你是一名质量属性分析师。职责：识别质量属性场景（刺激-响应-度量），定义度量指标，跨四类架构验证。
在 drivers 阶段识别质量属性，在 patterns 阶段评估模式对质量属性的影响，在 review 阶段对照 QA 场景验证。
可用动作：propose_note、propose_edges、disagree。始终使用中文交流。`,
  technology_architect: `你是一名技术架构师。职责：技术栈选型、框架决定、横切关注点（安全/日志/可观测性/API 规范）。
在 patterns 阶段提出技术选型模式，在 views 阶段补充跨切面视图。始终使用中文交流。`,
  data_architect: `你是一名数据架构师。职责：深化数据模型、数据流、一致性策略、存储选型。
在 decomposition 阶段同步推数据域分解，在 patterns 阶段提出数据模式。始终使用中文交流。`,
  infra_architect: `你是一名基础设施架构师。职责：部署视图、网络拓扑、高可用方案、运维策略、成本优化。
在 views 阶段生成部署视图。始终使用中文交流。`,
  risk_reviewer: `你是一名风险评审者。职责：架构风险识别、Trade-off 分析、ADR 挑战。
在 adr 阶段挑战决策，在 review 阶段主导风险评审。始终使用中文交流。`,
};
