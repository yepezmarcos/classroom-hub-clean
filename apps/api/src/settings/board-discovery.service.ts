import { Injectable } from '@nestjs/common';

export type BoardProvider =
  | 'trello'
  | 'monday'
  | 'notion'
  | 'linear'
  | 'jira'
  | 'asana'
  | 'clickup'
  | 'github';

export interface BoardIntegration {
  provider: BoardProvider;
  title: string;
  enabled: boolean;
  details?: Record<string, string | undefined>;
}

/**
 * Very light-weight “discovery” of integrations based on env vars.
 * We keep it DI-friendly and side-effect free so it’s easy to expand later.
 */
@Injectable()
export class BoardDiscoveryService {
  list(): BoardIntegration[] {
    const items: BoardIntegration[] = [
      {
        provider: 'trello',
        title: 'Trello',
        enabled: !!process.env.TRELLO_API_KEY,
        details: {
          apiKey: process.env.TRELLO_API_KEY,
          workspace: process.env.TRELLO_WORKSPACE,
        },
      },
      {
        provider: 'monday',
        title: 'Monday.com',
        enabled: !!process.env.MONDAY_API_TOKEN,
        details: {
          token: process.env.MONDAY_API_TOKEN,
          workspace: process.env.MONDAY_WORKSPACE,
        },
      },
      {
        provider: 'notion',
        title: 'Notion',
        enabled: !!process.env.NOTION_API_KEY,
        details: { apiKey: process.env.NOTION_API_KEY },
      },
      {
        provider: 'linear',
        title: 'Linear',
        enabled: !!process.env.LINEAR_API_KEY,
        details: { apiKey: process.env.LINEAR_API_KEY },
      },
      {
        provider: 'jira',
        title: 'Jira',
        enabled:
          !!process.env.JIRA_BASE_URL &&
          !!process.env.JIRA_EMAIL &&
          !!process.env.JIRA_API_TOKEN,
        details: {
          baseUrl: process.env.JIRA_BASE_URL,
          email: process.env.JIRA_EMAIL,
        },
      },
      {
        provider: 'asana',
        title: 'Asana',
        enabled: !!process.env.ASANA_ACCESS_TOKEN,
        details: { token: process.env.ASANA_ACCESS_TOKEN },
      },
      {
        provider: 'clickup',
        title: 'ClickUp',
        enabled: !!process.env.CLICKUP_API_TOKEN,
        details: { token: process.env.CLICKUP_API_TOKEN },
      },
      {
        provider: 'github',
        title: 'GitHub Projects',
        enabled: !!process.env.GITHUB_TOKEN,
        details: { token: process.env.GITHUB_TOKEN },
      },
    ];

    // keep it simple and typesafe
    return items.filter((x) => x.enabled);
  }
}
