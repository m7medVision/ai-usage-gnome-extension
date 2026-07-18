import {
    importDetectedAccounts,
    isAlreadyConfigured,
} from '../../../ui/prefs/account-detection.js';

function assertEqual(actual, expected, message) {
    if (actual !== expected)
        throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

const existing = [{
    id: 'existing',
    label: 'OpenAI',
    provider: 'openai',
    credentials: { accountId: 'acct-1' },
}];
const duplicate = {
    provider: 'openai',
    label: 'OpenAI duplicate',
    identityKey: 'acct-1',
    credentials: { oauthToken: 'rotated' },
};
const newAccount = {
    provider: 'claude-code',
    label: 'Claude Code',
    identityKey: 'token-2',
    credentials: { oauthToken: 'token-2', autoDetect: true },
};

assertEqual(isAlreadyConfigured(existing, duplicate), true,
    'stable account id deduplicates rotated token');
assertEqual(isAlreadyConfigured(existing, newAccount), false,
    'different provider is not a duplicate');

const imported = importDetectedAccounts(existing, [duplicate, newAccount], {
    createId: () => 'generated',
    createDefaultCredentials: () => ({ oauthRefresh: '' }),
});
assertEqual(imported.accounts.length, 2, 'one account imported');
assertEqual(imported.added[0], 'Claude Code', 'added label');
assertEqual(imported.skipped[0], 'OpenAI duplicate', 'skipped label');
assertEqual(imported.accounts[1].id, 'generated', 'generated account id');
assertEqual(imported.accounts[1].credentials.oauthRefresh, '', 'defaults merged');
assertEqual(imported.accounts[1].credentials.autoDetect, true, 'detected credentials override defaults');
