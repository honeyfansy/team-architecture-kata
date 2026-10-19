import { callAIWithRetry } from '../llm/callAI.js';
import type { StickyNote, Edge, ArchitectureReport, QAScenario, ArchitectureModule, PatternDecision, ADRRecord, ArchitectureRisk } from '@team-architecture-kata/shared';

interface ReportInput {
  notes: StickyNote[];
  edges: Edge[];
  domainDescription: string;
  modelName: string;
  systemPrompt: string;
  signal?: AbortSignal;
}

export async function generateArchitectureReport(input: ReportInput): Promise<ArchitectureReport> {
  const byType = new Map<string, StickyNote[]>();
  for (const n of input.notes) {
    if (!byType.has(n.type)) byType.set(n.type, []);
    byType.get(n.type)!.push(n);
  }

  const summaryParts: string[] = [`# 领域: ${input.domainDescription}\n`];

  for (const [type, notes] of byType) {
    summaryParts.push(`## ${type} (${notes.length} 个)`);
    for (const n of notes) {
      summaryParts.push(`- [${n.author}] ${n.content}`);
    }
  }

  if (input.edges.length > 0) {
    summaryParts.push(`\n## 关系连线 (${input.edges.length} 条)`);
    for (const e of input.edges) {
      const src = input.notes.find((n) => n.id === e.source)?.content || e.source;
      const tgt = input.notes.find((n) => n.id === e.target)?.content || e.target;
      summaryParts.push(`- ${src} → ${tgt} [${e.type}]`);
    }
  }

  const prompt = summaryParts.join('\n');

  const result = await callAIWithRetry({
    model: input.modelName,
    system: input.systemPrompt,
    messages: [{ role: 'user', content: prompt }],
    responseFormat: 'json',
    signal: input.signal,
    timeoutMs: 120000,
  });

  if (result.timedOut) {
    return {
      qaScenarios: [], constraints: [], modules: [],
      patterns: [], views: [], adrs: [], risks: [],
      generatedAt: Date.now(),
    };
  }

  try {
    const data = JSON.parse(result.text);
    return {
      qaScenarios: (data.qaScenarios || []).map(normalizeQA),
      constraints: data.constraints || [],
      modules: (data.modules || []).map(normalizeModule),
      patterns: (data.patterns || []).map(normalizePattern),
      views: data.views || [],
      adrs: (data.adrs || data.adr || []).map(normalizeADR),
      risks: (data.risks || []).map(normalizeRisk),
      generatedAt: Date.now(),
    };
  } catch {
    return {
      qaScenarios: [], constraints: [], modules: [],
      patterns: [], views: [], adrs: [], risks: [],
      generatedAt: Date.now(),
    };
  }
}

function normalizeQA(a: any): QAScenario {
  return {
    name: a.name || a.scenario || '',
    stimulus: a.stimulus || '',
    source: a.source || '',
    environment: a.environment || '',
    response: a.response || '',
    responseMeasure: a.responseMeasure || a.response_measure || '',
    priority: a.priority,
  };
}

function normalizeModule(m: any): ArchitectureModule {
  return {
    name: m.name || '',
    responsibility: m.responsibility || m.description || '',
    boundedContext: m.boundedContext || m.bounded_context || '',
    dependencies: m.dependencies || [],
    keyQA: m.keyQA || m.key_qa || [],
  };
}

function normalizePattern(p: any): PatternDecision {
  return {
    module: p.module || '',
    selectedPattern: p.selectedPattern || p.selected_pattern || p.name || '',
    alternatives: p.alternatives || [],
    rationale: p.rationale || p.reason || '',
    satisfiedQA: p.satisfiedQA || p.satisfied_qa || [],
    compromisedQA: p.compromisedQA || p.compromised_qa || [],
    conflictingPatterns: p.conflictingPatterns || p.conflicting_patterns || [],
  };
}

function normalizeADR(a: any): ADRRecord {
  return {
    id: a.id || '',
    title: a.title || '',
    status: a.status || 'proposed',
    context: a.context || '',
    decision: a.decision || '',
    alternatives: a.alternatives || [],
    rationale: a.rationale || '',
    consequences: a.consequences || '',
    relatedADRs: a.relatedADRs || a.related_adrs || [],
  };
}

function normalizeRisk(r: any): ArchitectureRisk {
  return {
    description: r.description || '',
    likelihood: r.likelihood || 'medium',
    impact: r.impact || 'medium',
    affectedQA: r.affectedQA || r.affected_qa || [],
    mitigation: r.mitigation || r.mitigation_strategy || '',
    owner: r.owner || '',
  };
}
