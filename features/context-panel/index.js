/**
 * Context Panel Feature for Tool Box
 *
 * Detects messages containing the trigger pattern "以下是用户..." and replaces
 * the display with an interactive context panel showing user input, memory
 * recall from AutoCardUpdaterAPI, and supplement information.
 */

import { eventSource, event_types, chat } from '/script.js';

// ========== Constants ==========
const TRIGGER_PATTERN = /以下是用户([\s\S]*)$/;

// ========== Utility Functions ==========
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function extractTag(text, tagName) {
    const regex = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`);
    const match = text.match(regex);
    return match ? match[1].trim() : '';
}

function parseAmCodes(raw) {
    return raw.split(/[,，\s]+/)
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

function findMemoryInTable(tables, amCode, tableName) {
    for (const uid in tables) {
        const sheet = tables[uid];
        if (!sheet?.name || sheet.name !== tableName || !sheet?.content || sheet.content.length < 2) {
            continue;
        }
        const headers = sheet.content[0];
        const codeIdx = headers.indexOf('编码索引');
        const summaryIdx = headers.indexOf('纪要');
        const titleIdx = headers.indexOf('标题');
        if (codeIdx === -1) continue;

        for (let i = 0; i < sheet.content.length - 1; i++) {
            const row = sheet.content[i + 1];
            if (!row || row.length <= codeIdx) continue;
            if (String(row[codeIdx] || '').trim().toUpperCase() === amCode) {
                return {
                    code: amCode,
                    title: titleIdx !== -1 && row.length > titleIdx
                        ? String(row[titleIdx] || '').trim() : '',
                    content: summaryIdx !== -1 && row.length > summaryIdx
                        ? String(row[summaryIdx] || '').trim() : '',
                    source: tableName,
                    rowIndex: i + 1,
                };
            }
        }
    }
    return null;
}

// ========== HTML Rendering ==========
function renderMemoryItem(entry) {
    if (!entry) {
        return '<div class="memory-item"><div class="memory-header">'
            + '<span class="memory-id">-</span>'
            + '<span class="memory-title">未找到对应记忆</span>'
            + '</div></div>';
    }
    return '<div class="memory-item">'
        + '<div class="memory-header">'
        + '<span class="memory-id">' + escapeHtml(entry.code) + '</span>'
        + '<span class="memory-title">' + escapeHtml(entry.title || '无标题') + '</span>'
        + '</div>'
        + '<div class="memory-body">' + escapeHtml(entry.content || '（无内容）') + '</div>'
        + '<div class="memory-source">'
        + '<span class="memory-source-icon">\u{1F4C1}</span>'
        + '<span>来源: ' + escapeHtml(entry.source || '未知来源') + ' (第' + entry.rowIndex + '行)</span>'
        + '</div></div>';
}

function renderNotFoundMemory(amCode) {
    return '<div class="memory-item"><div class="memory-header">'
        + '<span class="memory-id">' + escapeHtml(amCode) + '</span>'
        + '<span class="memory-title" style="color:#c07080">未找到对应记忆</span>'
        + '</div>'
        + '<div class="memory-body" style="color:#8a6070;font-style:italic">'
        + '在纪要表和总结表中均未找到编码索引为 ' + escapeHtml(amCode) + ' 的记录'
        + '</div></div>';
}

function renderSupplementItem(item) {
    const icons = { '背景设定': '\u{1F3F7}️', '角色设定': '\u{1F464}', '剧情设定': '\u{1F4D6}', '系统提示': '\u{2699}️' };
    const icon = icons[item.tag] || '\u{1F4CB}';
    return '<div class="supplement-item">'
        + '<div class="supplement-header">'
        + '<span class="supplement-tag">' + icon + ' ' + escapeHtml(item.tag) + '</span>'
        + '</div>'
        + '<div class="supplement-content">' + escapeHtml(item.content) + '</div>'
        + '</div>';
}

function buildPanelHTML(amCodes, supplementItems) {
    return '<div class="context-panel">'
        + '<div class="panel-content"><div class="panel-content-inner">'
        // User input section
        + '<div class="user-input-section">'
        + '<div class="section-header"><span class="section-icon">\u{1F4AC}</span><span class="section-title">本轮用户输入</span></div>'
        + '<div class="user-input-content js-user-input"></div>'
        + '</div>'
        // Memory recall section
        + '<div class="recall-section collapsed" data-section="recall">'
        + '<div class="section-header" data-toggle="recall">'
        + '<span class="section-icon">\u{1F52E}</span>'
        + '<span class="section-title">相关记忆召回</span>'
        + '<span class="badge badge-memory js-memory-badge">记忆 ' + amCodes.length + '</span>'
        + '<span class="toggle-arrow">\u{25BC}</span>'
        + '</div>'
        + '<div class="memory-list js-memory-list">'
        + '<div class="recall-loading">正在从数据库检索记忆</div>'
        + '</div></div>'
        // Supplement section
        + '<div class="supplement-section collapsed" data-section="supplement">'
        + '<div class="section-header" data-toggle="supplement">'
        + '<span class="section-icon">\u{1F4DC}</span>'
        + '<span class="section-title">补充信息</span>'
        + '<span class="badge badge-supplement js-supplement-badge">补充 ' + supplementItems.length + '</span>'
        + '<span class="toggle-arrow">\u{25BC}</span>'
        + '</div>'
        + '<div class="supplement-list js-supplement-list"></div>'
        + '</div>'
        // Stats section
        + '<div class="stats-section">'
        + '<div class="stats-item"><span class="stats-icon">\u{1F4CA}</span><span>记忆条目:</span><span class="stats-value js-stats-memory">-</span></div>'
        + '<div class="stats-item"><span class="stats-icon">\u{1F4CB}</span><span>补充信息:</span><span class="stats-value js-stats-supplement">' + supplementItems.length + '</span></div>'
        + '<div class="stats-item"><span class="stats-icon">\u{1F550}</span><span>加载时间:</span><span class="stats-value js-stats-time">-</span></div>'
        + '</div>'
        + '</div></div></div>';
}

// ========== Dynamic Content Loading ==========
async function loadMemories(container, amCodes) {
    const listEl = container.querySelector('.js-memory-list');
    const statsEl = container.querySelector('.js-stats-memory');
    const timeEl = container.querySelector('.js-stats-time');
    const startTime = Date.now();

    if (amCodes.length === 0) {
        if (listEl) {
            listEl.innerHTML = '<div style="color:#7a9fc0;text-align:center;padding:20px;">暂无相关记忆</div>';
        }
        if (statsEl) statsEl.textContent = '0';
        if (timeEl) timeEl.textContent = (Date.now() - startTime) + 'ms';
        return;
    }

    const api = window.AutoCardUpdaterAPI;
    if (!api) {
        console.warn('[ToolBox:ContextPanel] AutoCardUpdaterAPI not available');
        if (listEl) {
            listEl.innerHTML = '<div class="error-message">'
                + '<div class="error-icon">\u{26A0}️</div>'
                + '<div>数据库API不可用，无法加载记忆内容</div>'
                + '<div style="font-size:11px;color:#8a6070;margin-top:8px;">请确保AutoCardUpdaterAPI已正确加载</div>'
                + '</div>' + amCodes.map(() => renderMemoryItem(null)).join('');
        }
        return;
    }

    try {
        if (api.refreshDataAndWorldbook) {
            try {
                await api.refreshDataAndWorldbook();
            } catch (e) {
                console.warn('[ToolBox:ContextPanel] Data refresh failed:', e);
            }
        }

        const jsonData = api.exportTableAsJson();
        if (!jsonData) {
            if (listEl) {
                listEl.innerHTML = '<div class="error-message">'
                    + '<div class="error-icon">\u{26A0}️</div>'
                    + '<div>数据库返回数据为空</div>'
                    + '</div>' + amCodes.map(() => renderMemoryItem(null)).join('');
            }
            return;
        }

        const tables = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
        console.log('[ToolBox:ContextPanel] Tables:', Object.values(tables).map(t => t?.name).filter(Boolean));

        let html = '';
        let found = 0;
        for (const code of amCodes) {
            const entry = findMemoryInTable(tables, code, '纪要表')
                || findMemoryInTable(tables, code, '总结表');
            if (entry) {
                found++;
                html += renderMemoryItem(entry);
            } else {
                html += renderNotFoundMemory(code);
            }
        }

        if (listEl) listEl.innerHTML = html;
        if (statsEl) statsEl.textContent = found + '/' + amCodes.length;
        if (timeEl) timeEl.textContent = (Date.now() - startTime) + 'ms';
    } catch (err) {
        console.error('[ToolBox:ContextPanel] Memory loading failed:', err);
        if (listEl) {
            listEl.innerHTML = '<div class="error-message">'
                + '<div class="error-icon">\u{274C}</div>'
                + '<div>记忆加载失败: ' + escapeHtml(err.message || err) + '</div>'
                + '</div>' + amCodes.map(() => renderMemoryItem(null)).join('');
        }
    }
}

// ========== Toggle Handlers ==========
function setupToggles(container) {
    container.querySelectorAll('.section-header[data-toggle]').forEach(header => {
        header.style.cursor = 'pointer';
        header.style.userSelect = 'none';
        header.addEventListener('click', () => {
            const section = container.querySelector('[data-section="' + header.dataset.toggle + '"]');
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
    if (!mesText || mesText.querySelector('.context-panel-processed')) return;

    const rawContent = match[1] || '';

    // Parse data from original message
    const userInput = extractTag(rawContent, '本轮用户输入');
    const recallContent = extractTag(rawContent, 'recall');
    const supplementContent = extractTag(rawContent, 'supplement');
    const amCodes = parseAmCodes(recallContent);
    const supplementItems = parseSupplementItems(supplementContent);

    // Build and inject panel
    mesText.innerHTML = buildPanelHTML(amCodes, supplementItems);

    // Mark as processed (hidden marker to prevent re-processing)
    const marker = document.createElement('span');
    marker.className = 'context-panel-processed';
    marker.style.display = 'none';
    mesText.appendChild(marker);

    // Render static content
    const userInputEl = mesText.querySelector('.js-user-input');
    if (userInputEl) {
        const trimmed = userInput.trim();
        userInputEl.innerHTML = trimmed
            ? escapeHtml(trimmed)
            : '<span style="color:#888;font-style:italic;">（无输入内容）</span>';
    }

    const supplementListEl = mesText.querySelector('.js-supplement-list');
    if (supplementListEl) {
        if (supplementItems.length === 0) {
            supplementListEl.innerHTML = '<div style="color:#a090c0;text-align:center;padding:20px;">暂无补充信息</div>';
        } else {
            supplementListEl.innerHTML = supplementItems.map(renderSupplementItem).join('');
        }
    }

    // Set up toggle handlers
    setupToggles(mesText);

    // Load memories asynchronously
    loadMemories(mesText, amCodes);
}

// ========== Event Handlers (stored for cleanup) ==========
let _processMessageFn = null;
let _moreMessagesFn = null;

// ========== Feature API ==========
export async function init() {
    _processMessageFn = processMessage;
    _moreMessagesFn = () => {
        document.querySelectorAll('#chat .mes').forEach(mesBlock => {
            const mesid = parseInt(mesBlock.getAttribute('mesid'));
            if (!isNaN(mesid)) processMessage(mesid);
        });
    };

    eventSource.on(event_types.USER_MESSAGE_RENDERED, _processMessageFn);
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, _processMessageFn);
    eventSource.on(event_types.MESSAGE_UPDATED, _processMessageFn);
    eventSource.on(event_types.MORE_MESSAGES_LOADED, _moreMessagesFn);
}

export function destroy() {
    if (_processMessageFn) {
        eventSource.off(event_types.USER_MESSAGE_RENDERED, _processMessageFn);
        eventSource.off(event_types.CHARACTER_MESSAGE_RENDERED, _processMessageFn);
        eventSource.off(event_types.MESSAGE_UPDATED, _processMessageFn);
        _processMessageFn = null;
    }
    if (_moreMessagesFn) {
        eventSource.off(event_types.MORE_MESSAGES_LOADED, _moreMessagesFn);
        _moreMessagesFn = null;
    }
}
