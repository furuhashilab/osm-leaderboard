import { load as yamlLoad } from 'js-yaml';

export interface UsersConfig {
  users: string[];
  hashtags: string[];
}

export async function fetchUsersConfig(): Promise<UsersConfig> {
  const url = import.meta.env.BASE_URL + 'users.yaml';
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to load users.yaml');
  }
  const text = await response.text();
  const config = yamlLoad(text) as any;
  
  return {
    users: Array.isArray(config?.users) ? config.users : [],
    hashtags: Array.isArray(config?.hashtags) ? config.hashtags.map((h: string) => h.toLowerCase()) : []
  };
}
