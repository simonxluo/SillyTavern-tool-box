/**
 * Context Panel Feature for Tool Box
 *
 * Detects messages containing the trigger pattern "以下是用户..." and replaces
 * the display with an interactive context panel showing user input, memory
 * recall from AutoCardUpdaterAPI, and supplement information.
 *
 * Exports:
 *   init()    - Register event listeners
 *   destroy() - Remove all event listeners
 */

import { eventSource, event_types, chat } from '/script.js';

const LOG = 'ToolBox:ContextPanel';
const TRIGGER_PATTERN = /以下是用户([\s\S]*)$/;
const PROCESSED_MARKER = 'context-panel-processed';

// ========== Utilities ==========

function escapeHtml(text) {
    const el = document.createElement('div');
    el.textContent = text;
    return el.innerHTML;
}

function extractTag(text, tagName) {
    const match = text.match(new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`));
    return match ? match[1].trim() : '';
}

function parseAmCodes(raw) {
    return raw
        .split(/[,，\s]+/)
        .map(s => s.trim())
        .filter(s => /^AM\d+$/i.test(s))
        .map(s => s.toUpperCase());
}

function parseSupplementItems(raw) {
    const lines = raw.split('\n');
    const items = [];
    let current = null;

    for (const line of lines) {
        const m = line.match(/^\s*-\s*\[([^\]]+)\]\s*(.*)/);
        if (m) {
            if (current) items.push(current);
            current = { tag: m[1].trim(), content: m[2].trim() };
        } else if (current && line.trim()) {
            current.content += '\n' + line.trim();
        }
    }
    if (current) items.push(current);
    return items;
}

// ========== Data Access ==========

function findMemoryInTable(tables, amCode, tableName) {
    const keys = Object.keys(tables);
    for (let k = 0; k < keys.length; k++) {
        const sheet = tables[keys[k]];
        if (!sheet?.name || sheet.name !== tableName) continue;
        if (!sheet?.content || sheet.content.length < 2) continue;

        const headers = sheet.content[0];
        const codeIdx = headers.indexOf('编码索引');
        if (codeIdx === -1) continue;

        const summaryIdx = headers.indexOf('纪要');
        const titleIdx = headers.indexOf('标题');

        for (let i = 1; i < sheet.content.length; i++) {
            const row = sheet.content[i];
            if (!row || row.length <= codeIdx) continue;
            if (String(row[codeIdx] || '').trim().toUpperCase() !== amCode) continue;

            return {
                code: amCode,
                title: titleIdx !== -1 && row.length > titleIdx
                    ? String(row[titleIdx] || '').trim() : '',
                content: summaryIdx !== -1 && row.length > summaryIdx
                    ? String(row[summaryIdx] || '').trim() : '',
                source: tableName,
                rowIndex: i,
            };
        }
    }
    return null;
}

function findMemory(tables, amCode) {
    return findMemoryInTable(tables, amCode, '纪要表')
        || findMemoryInTable(tables, amCode, '总结表');
}

// ========== Rendering ==========

function renderMemoryItem(entry) {
    if (!entry) {
        return '<div class="cp-memory-item"><div class="cp-memory-header">'
            + '<span class="cp-memory-id">-</span>'
            + '<span class="cp-memory-title">未找到对应记忆</span>'
            + '</div></div>';
    }
    return '<div class="cp-memory-item">'
        + '<div class="cp-memory-header">'
        + '<span class="cp-memory-id">' + escapeHtml(entry.code) + '</span>'
        + '<span class="cp-memory-title">' + escapeHtml(entry.title || '无标题') + '</span>'
        + '</div>'
        + '<div class="cp-memory-body">' + escapeHtml(entry.content || '（无内容）') + '</div>'
        + '<div class="cp-memory-source">'
        + '<span class="cp-memory-source-icon">\u{1F4C1}</span>'
        + '<span>来源: ' + escapeHtml(entry.source || '未知来源') + ' (第' + entry.rowIndex + '行)</span>'
        + '</div></div>';
}

function renderNotFoundMemory(amCode) {
    return '<div class="cp-memory-item cp-memory-not-found"><div class="cp-memory-header">'
        + '<span class="cp-memory-id">' + escapeHtml(amCode) + '</span>'
        + '<span class="cp-memory-title">未找到对应记忆</span>'
        + '</div>'
        + '<div class="cp-memory-body">'
        + '在纪要表和总结表中均未找到编码索引为 ' + escapeHtml(amCode) + ' 的记录'
        + '</div></div>';
}

const SUPPLEMENT_ICONS = {
    '背景设定': '\u{1F3F7}️',
    '角色设定': '\u{1F464}',
    '剧情设定': '\u{1F4D6}',
    '系统提示': '⚙️',
};

function renderSupplementItem(item) {
    const icon = SUPPLEMENT_ICONS[item.tag] || '\u{1F4CB}';
    return '<div class="cp-supplement-item">'
        + '<div class="cp-supplement-header">'
        + '<span class="cp-supplement-tag">' + icon + ' ' + escapeHtml(item.tag) + '</span>'
        + '</div>'
        + '<div class="cp-supplement-content">' + escapeHtml(item.content) + '</div>'
        + '</div>';
}

function renderError(icon, message, detail) {
    let html = '<div class="cp-error">'
        + '<div class="cp-error-icon">' + icon + '</div>'
        + '<div>' + message + '</div>';
    if (detail) {
        html += '<div class="cp-error-detail">' + detail + '</div>';
    }
    return html + '</div>';
}

function buildPanelHTML(amCodes, supplementItems) {
    return '<div class="context-panel">'
        + '<div class="cp-content"><div class="cp-content-inner">'

        // User input
        + '<div class="cp-section cp-section-input">'
        + '<div class="cp-section-header">'
        + '<span class="cp-section-icon">\u{1F4AC}</span>'
        + '<span class="cp-section-title">本轮用户输入</span>'
        + '</div>'
        + '<div class="cp-user-input js-cp-user-input"></div>'
        + '</div>'

        // Memory recall
        + '<div class="cp-section cp-section-recall collapsed" data-cp-section="recall">'
        + '<div class="cp-section-header" data-cp-toggle="recall">'
        + '<span class="cp-section-icon">\u{1F52E}</span>'
        + '<span class="cp-section-title">相关记忆召回</span>'
        + '<span class="cp-badge cp-badge-memory">记忆 ' + amCodes.length + '</span>'
        + '<span class="cp-toggle-arrow">▼</span>'
        + '</div>'
        + '<div class="cp-memory-list js-cp-memory-list">'
        + '<div class="cp-loading">正在从数据库检索记忆</div>'
        + '</div></div>'

        // Supplement
        + '<div class="cp-section cp-section-supplement collapsed" data-cp-section="supplement">'
        + '<div class="cp-section-header" data-cp-toggle="supplement">'
        + '<span class="cp-section-icon">\u{1F4DC}</span>'
        + '<span class="cp-section-title">补充信息</span>'
        + '<span class="cp-badge cp-badge-supplement">补充 ' + supplementItems.length + '</span>'
        + '<span class="cp-toggle-arrow">▼</span>'
        + '</div>'
        + '<div class="cp-supplement-list js-cp-supplement-list"></div>'
        + '</div>'

        // Stats
        + '<div class="cp-stats">'
        + '<div class="cp-stats-item"><span class="cp-stats-icon">\u{1F4CA}</span><span>记忆条目:</span><span class="cp-stats-value js-cp-stats-memory">-</span></div>'
        + '<div class="cp-stats-item"><span class="cp-stats-icon">\u{1F4CB}</span><span>补充信息:</span><span class="cp-stats-value js-cp-stats-supplement">' + supplementItems.length + '</span></div>'
        + '<div class="cp-stats-item"><span class="cp-stats-icon">\u{1F550}</span><span>加载时间:</span><span class="cp-stats-value js-cp-stats-time">-</span></div>'
        + '</div>'

        + '</div></div></div>';
}

// ========== Dynamic Loading ==========

async function loadMemories(container, amCodes) {
    const listEl = container.querySelector('.js-cp-memory-list');
    const statsEl = container.querySelector('.js-cp-stats-memory');
    const timeEl = container.querySelector('.js-cp-stats-time');
    const t0 = Date.now();

    const finish = (stats, ms) => {
        if (statsEl) statsEl.textContent = stats;
        if (timeEl) timeEl.textContent = ms + 'ms';
    };

    if (amCodes.length === 0) {
        if (listEl) {
            listEl.innerHTML = '<div class="cp-empty">暂无相关记忆</div>';
        }
        finish('0', Date.now() - t0);
        return;
    }

    const api = window.AutoCardUpdaterAPI;
    if (!api) {
        console.warn(`[${LOG}] AutoCardUpdaterAPI not available`);
        if (listEl) {
            listEl.innerHTML = renderError('⚠️', '数据库API不可用，无法加载记忆内容', '请确保AutoCardUpdaterAPI已正确加载')
                + amCodes.map(() => renderMemoryItem(null)).join('');
        }
        return;
    }

    try {
        if (api.refreshDataAndWorldbook) {
            try { await api.refreshDataAndWorldbook(); }
            catch (e) { console.warn(`[${LOG}] Data refresh failed:`, e); }
        }

        const raw = api.exportTableAsJson();
        if (!raw) {
            if (listEl) {
                listEl.innerHTML = renderError('⚠️', '数据库返回数据为空')
                    + amCodes.map(() => renderMemoryItem(null)).join('');
            }
            return;
        }

        const tables = typeof raw === 'string' ? JSON.parse(raw) : raw;

        let html = '';
        let found = 0;
        for (const code of amCodes) {
            const entry = findMemory(tables, code);
            if (entry) {
                found++;
                html += renderMemoryItem(entry);
            } else {
                html += renderNotFoundMemory(code);
            }
        }

        if (listEl) listEl.innerHTML = html;
        finish(found + '/' + amCodes.length, Date.now() - t0);
    } catch (err) {
        console.error(`[${LOG}] Memory loading failed:`, err);
        if (listEl) {
            listEl.innerHTML = renderError('❌', '记忆加载失败: ' + escapeHtml(err.message || err))
                + amCodes.map(() => renderMemoryItem(null)).join('');
        }
    }
}

// ========== Toggle Handlers ==========

function setupToggles(container) {
    container.querySelectorAll('[data-cp-toggle]').forEach(header => {
        header.style.cursor = 'pointer';
        header.style.userSelect = 'none';
        header.addEventListener('click', () => {
            const section = container.querySelector('[data-cp-section="' + header.dataset.cpToggle + '"]');
            if (section) section.classList.toggle('collapsed');
        });
    });
}

// ========== Message Processing ==========

function processMessage(messageId) {
    if (typeof messageId !== 'number' || !chat || !chat[messageId]) return;

    const text = chat[messageId].mes;
    if (!text) return;

    const match = text.match(TRIGGER_PATTERN);
    if (!match) return;

    const mesBlock = document.querySelector('#chat .mes[mesid="' + messageId + '"]');
    if (!mesBlock) return;

    const mesText = mesBlock.querySelector('.mes_text');
    if (!mesText || mesText.querySelector('.' + PROCESSED_MARKER)) return;

    const rawContent = match[1] || '';
    const userInput = extractTag(rawContent, '本轮用户输入');
    const amCodes = parseAmCodes(extractTag(rawContent, 'recall'));
    const supplementItems = parseSupplementItems(extractTag(rawContent, 'supplement'));

    mesText.innerHTML = buildPanelHTML(amCodes, supplementItems);

    const marker = document.createElement('span');
    marker.className = PROCESSED_MARKER;
    marker.style.display = 'none';
    mesText.appendChild(marker);

    // User input
    const inputEl = mesText.querySelector('.js-cp-user-input');
    if (inputEl) {
        const trimmed = userInput.trim();
        inputEl.innerHTML = trimmed
            ? escapeHtml(trimmed)
            : '<span class="cp-empty">（无输入内容）</span>';
    }

    // Supplement list
    const supEl = mesText.querySelector('.js-cp-supplement-list');
    if (supEl) {
        supEl.innerHTML = supplementItems.length === 0
            ? '<div class="cp-empty">暂无补充信息</div>'
            : supplementItems.map(renderSupplementItem).join('');
    }

    setupToggles(mesText);
    loadMemories(mesText, amCodes);
}

// ========== Feature Lifecycle ==========

let handlers = null;

export async function init() {
    const onMessage = (messageId) => processMessage(messageId);
    const onMoreMessages = () => {
        document.querySelectorAll('#chat .mes').forEach(el => {
            const id = parseInt(el.getAttribute('mesid'));
            if (!isNaN(id)) processMessage(id);
        });
    };

    eventSource.on(event_types.USER_MESSAGE_RENDERED, onMessage);
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, onMessage);
    eventSource.on(event_types.MESSAGE_UPDATED, onMessage);
    eventSource.on(event_types.MORE_MESSAGES_LOADED, onMoreMessages);

    handlers = { onMessage, onMoreMessages };
}

export function destroy() {
    if (!handlers) return;

    eventSource.off(event_types.USER_MESSAGE_RENDERED, handlers.onMessage);
    eventSource.off(event_types.CHARACTER_MESSAGE_RENDERED, handlers.onMessage);
    eventSource.off(event_types.MESSAGE_UPDATED, handlers.onMessage);
    eventSource.off(event_types.MORE_MESSAGES_LOADED, handlers.onMoreMessages);

    handlers = null;
}
