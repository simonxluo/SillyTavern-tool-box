/**
 * Tool Box - SillyTavern Extension Framework
 *
 * A modular extension that provides multiple features that can be individually
 * enabled or disabled. Each feature lives in the features/ directory.
 */

import { saveSettingsDebounced } from '/script.js';
import { extension_settings } from '/scripts/extensions.js';

const EXT_KEY = 'toolbox';
const DRAWER_ID = 'toolbox_drawer';

const FEATURES = [
    {
        id: 'contextPanel',
        label: 'Context Panel',
        description: '解析消息中的上下文面板标签，渲染记忆召回与补充信息',
        module: './features/context-panel/index.js',
        default: true,
    },
];

const DEFAULT_SETTINGS = {};
for (const f of FEATURES) {
    DEFAULT_SETTINGS[f.id] = f.default;
}

// ---------- Settings ----------

function loadSettings() {
    if (!extension_settings[EXT_KEY]) {
        extension_settings[EXT_KEY] = {};
    }
    for (const key in DEFAULT_SETTINGS) {
        if (!(key in extension_settings[EXT_KEY])) {
            extension_settings[EXT_KEY][key] = DEFAULT_SETTINGS[key];
        }
    }
}

function saveSetting(key, value) {
    extension_settings[EXT_KEY][key] = value;
    saveSettingsDebounced();
}

// ---------- Feature Registry ----------

/** @type {Map<string, { init: Function, destroy?: Function }>} */
const loadedFeatures = new Map();

async function loadFeature(feature) {
    if (loadedFeatures.has(feature.id)) return;
    try {
        const mod = await import(feature.module);
        if (mod.init) {
            await mod.init();
            loadedFeatures.set(feature.id, mod);
            console.log(`[ToolBox] Feature "${feature.id}" enabled`);
        }
    } catch (err) {
        console.error(`[ToolBox] Failed to load feature "${feature.id}":`, err);
    }
}

function unloadFeature(feature) {
    const mod = loadedFeatures.get(feature.id);
    if (mod?.destroy) {
        mod.destroy();
    }
    loadedFeatures.delete(feature.id);
    console.log(`[ToolBox] Feature "${feature.id}" disabled`);
}

function toggleFeature(feature, enabled) {
    if (enabled) {
        loadFeature(feature);
    } else {
        unloadFeature(feature);
    }
}

// ---------- Settings UI ----------

function createSettingsPanel() {
    const host =
        document.getElementById('extensions_settings2') ||
        document.getElementById('extensions_settings');
    if (!host) return;

    // Prevent duplicates
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
        const label = document.createElement('label');
        label.className = 'checkbox_label';
        label.style.display = 'flex';
        label.style.alignItems = 'flex-start';
        label.style.gap = '6px';
        label.style.marginBottom = '8px';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = `toolbox_${feature.id}`;
        input.checked = extension_settings[EXT_KEY][feature.id];

        input.addEventListener('change', () => {
            saveSetting(feature.id, input.checked);
            toggleFeature(feature, input.checked);
        });

        const small = document.createElement('small');
        small.textContent = `${feature.label} - ${feature.description}`;
        small.style.flex = '1';

        label.appendChild(input);
        label.appendChild(small);
        content.appendChild(label);
    }

    drawer.appendChild(header);
    drawer.appendChild(content);
    host.appendChild(drawer);
}

// ---------- Init ----------

export async function init() {
    loadSettings();
    createSettingsPanel();

    for (const feature of FEATURES) {
        if (extension_settings[EXT_KEY][feature.id]) {
            await loadFeature(feature);
        }
    }

    console.log('[ToolBox] Extension loaded');
}
