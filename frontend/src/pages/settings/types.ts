import type { UseMutationResult } from '@tanstack/react-query';

export interface Settings {
  notifications: {
    slack: {
      enabled: boolean;
      webhookUrl: string;
    };
    email: {
      enabled: boolean;
      recipients: string[];
    };
  };
  cicd: {
    jenkins: {
      enabled: boolean;
      url: string;
      username: string;
      apiToken: string;
    };
    github: {
      enabled: boolean;
      apiToken: string;
      repositories: string[];
    };
  };
  general: {
    autoRefresh: boolean;
    refreshInterval: number;
    theme: 'light' | 'dark';
  };
}

export interface SettingsTabProps {
  settings: Settings;
  updateSettings: UseMutationResult<Settings, Error, Partial<Settings>>;
  onSubmit: (e: React.FormEvent) => void;
}
