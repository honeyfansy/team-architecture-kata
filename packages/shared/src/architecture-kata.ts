export interface QAScenario {
  name: string;
  stimulus: string;
  source: string;
  environment: string;
  response: string;
  responseMeasure: string;
  priority?: number;
}

export interface ArchitectureModule {
  name: string;
  responsibility: string;
  boundedContext?: string;
  dependencies: string[];
  keyQA: string[];
}

export interface PatternDecision {
  module: string;
  selectedPattern: string;
  alternatives: string[];
  rationale: string;
  satisfiedQA: string[];
  compromisedQA: string[];
  conflictingPatterns: string[];
}

export interface ViewElementData {
  viewType: 'logical' | 'process' | 'development' | 'data' | 'deployment';
  nodeName: string;
  nodeType: 'component' | 'connector' | 'node' | 'layer';
  relationships: string[];
  description: string;
}

export interface ADRRecord {
  id: string;
  title: string;
  status: 'proposed' | 'accepted' | 'deprecated' | 'disputed';
  context: string;
  decision: string;
  alternatives: { name: string; vetoReason: string }[];
  rationale: string;
  consequences: string;
  relatedADRs: string[];
}

export interface ArchitectureRisk {
  description: string;
  likelihood: 'high' | 'medium' | 'low';
  impact: 'high' | 'medium' | 'low';
  affectedQA: string[];
  mitigation: string;
  owner: string;
}

export interface ArchitectureReport {
  qaScenarios: QAScenario[];
  constraints: { content: string; type: string; source: string }[];
  modules: ArchitectureModule[];
  patterns: PatternDecision[];
  views: ViewElementData[];
  adrs: ADRRecord[];
  risks: ArchitectureRisk[];
  generatedAt: number;
}
