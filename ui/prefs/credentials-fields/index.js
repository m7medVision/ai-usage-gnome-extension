import { renderZaiFields } from './zai-fields.js';
import { renderOpencodeGoFields } from './opencode-go-fields.js';
import { renderOpenaiFields } from './openai-fields.js';
import { renderDeepseekFields } from './deepseek-fields.js';
import { renderClaudeCodeFields } from './claude-code-fields.js';

const FIELD_STRATEGIES = {
    zai: renderZaiFields,
    'opencode-go': renderOpencodeGoFields,
    openai: renderOpenaiFields,
    deepseek: renderDeepseekFields,
    'claude-code': renderClaudeCodeFields,
};

export function renderCredentialFields(row, account, context) {
    FIELD_STRATEGIES[account.provider]?.(row, account, context);
}
