/**
 * Tool Box - SillyTavern Modular Extension
 *
 * Provides multiple features that can be individually enabled or disabled.
 * Each feature lives in features/<id>/index.js and exports:
 *
 *   export async function init()      - Register event listeners, start feature
 *   export function destroy()         - Remove listeners, clean up state
 *
 * To add a new feature:
 *   1. Create features/<id>/index.js with init()/destroy()
 *   2. Add entry to FEATURES array below
 */

import { saveSettingsDebounced } from '/script.js';
import { extension_settings } from '/scripts/extensions.js';

// ========== Configuration ==========

const LOG_PREFIX = 'ToolBox';
const SETTINGS_KEY = 'toolbox';
const DRAWER_ID = 'toolbox_settings_drawer';

/**
 * Feature registry. Each entry defines:
 *   id          - Unique identifier (matches features/<id>/ directory)
 *   label       - Display name in settings UI
 *   description - Short description shown next to the toggle
 *   module      - Relative path to the feature module
 *   default     - Default enabled state
 */
const FEATURES = [
    {
        id: 'context-panel',
        label: 'Context Panel',
        description: '解析消息中的上下文面板标签，渲染记忆召回与补充信息',
        module: './features/context-panel/index.js',
        default: true,
    },
];

// ========== Settings ==========

function getDefaultSettings() {
    const defaults = {};
    for (const f of FEATURES) {
        defaults[f.id] = f.default;
    }
    return defaults;
}

function loadSettings() {
    if (!extension_settings[SETTINGS_KEY]) {
        extension_settings[SETTINGS_KEY] = {};
    }
    const defaults = getDefaultSettings();
    for (const key in defaults) {
        if (!(key in extension_settings[SETTINGS_KEY])) {
            extension_settings[SETTINGS_KEY][key] = defaults[key];
        }
    }
}

function saveSetting(key, value) {
    extension_settings[SETTINGS_KEY][key] = value;
    saveSettingsDebounced();
}

function getSetting(key) {
    return extension_settings[SETTINGS_KEY]?.[key] ?? false;
}

// ========== Feature Registry ==========

/** @type {Map<string, { init: Function, destroy?: Function }>} */
const loadedModules = new Map();

async function loadFeature(feature) {
    if (loadedModules.has(feature.id)) return;

    try {
        const mod = await import(feature.module);
        if (typeof mod.init !== 'function') {
            console.error(`[${LOG_PREFIX}] Feature "${feature.id}" has no init() export`);
            return;
        }
        await mod.init();
        loadedModules.set(feature.id, mod);
        console.log(`[${LOG_PREFIX}] Feature "${feature.id}" loaded`);
    } catch (err) {
        console.error(`[${LOG_PREFIX}] Failed to load feature "${feature.id}":`, err);
    }
}

function unloadFeature(featureId) {
    const mod = loadedModules.get(featureId);
    if (!mod) return;

    try {
        if (typeof mod.destroy === 'function') {
            mod.destroy();
        }
    } catch (err) {
        console.error(`[${LOG_PREFIX}] Error destroying feature "${featureId}":`, err);
    }

    loadedModules.delete(featureId);
    console.log(`[${LOG_PREFIX}] Feature "${featureId}" unloaded`);
}

// ========== Settings UI ==========

function createSettingsPanel() {
    const host =
        document.getElementById('extensions_settings2') ||
        document.getElementById('extensions_settings');
    if (!host) return;

    if (document.getElementById(DRAWER_ID)) return;

    const drawer = document.createElement('div');
    drawer.id = DRAWER_ID;
    drawer.className = 'inline-drawer';

    const header = document.createElement('div');
    header.className = 'inline-drawer-toggle inline-drawer-header';
    header.innerHTML =
        '<b>Tool Box</b>' +
        '<div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>';

    const content = document.createElement('div');
    content.className = 'inline-drawer-content';

    for (const feature of FEATURES) {
        const row = document.createElement('label');
        row.className = 'checkbox_label';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = `toolbox_toggle_${feature.id}`;
        input.checked = getSetting(feature.id);

        const label = document.createElement('small');
        label.textContent = `${feature.label} — ${feature.description}`;

        input.addEventListener('change', () => {
            const enabled = input.checked;
            saveSetting(feature.id, enabled);
            if (enabled) {
                loadFeature(feature);
            } else {
                unloadFeature(feature.id);
            }
        });

        row.appendChild(input);
        row.appendChild(label);
        content.appendChild(row);
    }

    drawer.appendChild(header);
    drawer.appendChild(content);
    host.appendChild(drawer);
}

// ========== Init ==========

export async function init() {
    loadSettings();
    createSettingsPanel();

    for (const feature of FEATURES) {
        if (getSetting(feature.id)) {
            await loadFeature(feature);
        }
    }

    console.log(`[${LOG_PREFIX}] Extension loaded`);
}
