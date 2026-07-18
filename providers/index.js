import { claudeCodeProvider } from './claude-code.js';
import { deepseekProvider } from './deepseek.js';
import { opencodeGoProvider } from './opencode-go.js';
import { openaiProvider } from './openai.js';
import { zaiProvider } from './zai.js';

export const PROVIDERS = {
    zai: {
        name: 'Z.AI (Zhipu)',
        adapter: zaiProvider,
        credentials: () => ({
            apiKey: '', oauthToken: '', oauthRefresh: '', oauthExpiry: 0, endpoint: 'intl',
        }),
    },
    'opencode-go': {
        name: 'OpenCode Go',
        adapter: opencodeGoProvider,
        credentials: () => ({ workspaceId: '', authCookie: '', serverId: '' }),
    },
    openai: {
        name: 'OpenAI (ChatGPT Plus/Pro)',
        adapter: openaiProvider,
        credentials: () => ({ oauthToken: '', oauthRefresh: '', oauthExpiry: 0 }),
    },
    deepseek: {
        name: 'DeepSeek',
        adapter: deepseekProvider,
        credentials: () => ({ apiKey: '' }),
    },
    'claude-code': {
        name: 'Claude Code',
        adapter: claudeCodeProvider,
        credentials: () => ({
            oauthToken: '', oauthRefresh: '', oauthExpiry: 0, autoDetect: false,
        }),
    },
};

export function createDefaultCredentials(providerId) {
    return PROVIDERS[providerId]?.credentials() ?? {};
}
