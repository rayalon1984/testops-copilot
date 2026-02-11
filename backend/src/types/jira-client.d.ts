declare module 'jira-client' {
  interface JiraClientOptions {
    protocol: string;
    host: string;
    apiVersion: string;
    strictSSL: boolean;
    bearer?: string;
    username?: string;
    password?: string;
  }

  interface JiraIssueFields {
    project?: { key: string };
    summary?: string;
    description?: string;
    issuetype?: { name: string };
    labels?: string[];
    [key: string]: any;
  }

  interface JiraTransition {
    id: string;
    name: string;
    to: {
      id: string;
      name: string;
    };
  }

  interface JiraIssue {
    id: string;
    key: string;
    fields: JiraIssueFields;
  }

  interface JiraTransitions {
    transitions: JiraTransition[];
  }

  class JiraApi {
    constructor(options: JiraClientOptions);

    addNewIssue(issue: { fields: JiraIssueFields }): Promise<JiraIssue>;
    updateIssue(issueKey: string, issue: { fields: JiraIssueFields }): Promise<void>;
    findIssue(issueKey: string): Promise<JiraIssue>;
    listTransitions(issueKey: string): Promise<JiraTransitions>;
    transitionIssue(issueKey: string, transition: { transition: { id: string } }): Promise<void>;
    addComment(issueKey: string, comment: { body: string }): Promise<void>;
    searchJira(searchString: string, optional?: { maxResults?: number; fields?: string[]; startAt?: number }): Promise<{ issues: JiraIssue[]; total: number; maxResults: number; startAt: number }>;
  }

  export = JiraApi;
}