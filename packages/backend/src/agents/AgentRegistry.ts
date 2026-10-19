import type { AgentConfig, AgentRole, SessionConfig } from '@team-architecture-kata/shared';
import { FacilitatorAgent } from './FacilitatorAgent.js';
import { DomainArchitectAgent } from './DomainArchitectAgent.js';
import { SystemArchitectAgent } from './SystemArchitectAgent.js';
import { QualityAnalystAgent } from './QualityAnalystAgent.js';
import { GenericAgent } from './GenericAgent.js';
import { BaseAgent } from './BaseAgent.js';
import { AGENT_SYSTEM_PROMPTS } from '../orchestrator/phases.js';

export class AgentRegistry {
  private agents: Map<AgentRole, BaseAgent> = new Map();

  constructor(config: SessionConfig) {
    for (const ac of config.agents) {
      if (!ac.enabled) continue;
      const detailedPrompt = AGENT_SYSTEM_PROMPTS[ac.role];
      const agent = this.createAgent({ ...ac, systemPrompt: detailedPrompt || ac.systemPrompt });
      if (agent) this.agents.set(ac.role, agent);
    }
  }

  private createAgent(ac: AgentConfig): BaseAgent | null {
    switch (ac.role) {
      case 'facilitator': return new FacilitatorAgent(ac);
      case 'domain_architect': return new DomainArchitectAgent(ac);
      case 'system_architect': return new SystemArchitectAgent(ac);
      case 'quality_analyst': return new QualityAnalystAgent(ac);
      case 'technology_architect': case 'data_architect': case 'infra_architect': case 'risk_reviewer': return new GenericAgent(ac);
      default: return null;
    }
  }

  get(role: AgentRole): BaseAgent | undefined { return this.agents.get(role); }
  getAll(): BaseAgent[] { return Array.from(this.agents.values()); }
  getActiveRoles(): AgentRole[] { return Array.from(this.agents.keys()); }
}
