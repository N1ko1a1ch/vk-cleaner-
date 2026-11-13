(async function cleanVKPosts() {
    if (window.isVKCleanerRunning) {
        return;
    }

    const currentPath = window.location.pathname;
    const forbiddenPaths = ['/feed', '/im', '/friends', '/groups', '/settings', '/audio', '/video', '/bookmarks', '/clips'];
    if (forbiddenPaths.some(path => currentPath.startsWith(path))) {
        alert("Safety Stop: Go to your own profile page first!");
        return;
    }

    const targetLimit = window.vkCleanerTargetLimit || 100;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    function triggerClick(el) {
        if (!el) return;
        ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(type => {
            el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
        });
    }

    function triggerHover(el) {
        if (!el) return;
        ['pointerover', 'mouseover', 'pointerenter', 'mouseenter'].forEach(type => {
            el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
        });
    }

    function findDeleteButton() {
        const targets = [
            '\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0437\u0430\u043f\u0438\u0441\u044c', // Удалить запись
            '\u0423\u0434\u0430\u043b\u0438\u0442\u044c', // Удалить
            'Delete post',
            'Delete'
        ];

        const candidates = document.querySelectorAll(
            '[role="menuitem"], [role="button"], a.ui_actions_menu_item, .PostApproveMenuItem, .vkuiActionSheetItem, div, span, button, a'
        );

        for (const el of candidates) {
            if (el.children.length === 0 && el.offsetParent !== null) {
                const text = (el.textContent || '').trim();
                if (targets.includes(text)) {
                    return el.closest('[role="menuitem"], a, button, .ui_actions_menu_item, .vkuiActionSheetItem') || el;
                }
            }
        }
        return null;
    }

    // Ультра-быстрый перехват кнопки (проверка каждые 15 мс)
    async function waitForDeleteButton(timeoutMs = 180) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const btn = findDeleteButton();
            if (btn) return btn;
            await sleep(15);
        }
        return null;
    }

    function getNextPostMenuButton() {
        const buttons = new Set();

        document.querySelectorAll(
            '[data-testid="post_context_menu_toggle"], .PostHeaderActionsButton, .ui_actions_menu_wrap, .ui_actions_menu_icons, [aria-label="\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044f"], [aria-label="\u0415\u0449\u0451"], [aria-label="More"]'
        ).forEach(btn => buttons.add(btn));

        document.querySelectorAll('[data-testid="post"], ._post, .Post, [id^="post-"], [id^="post"]').forEach(post => {
            const header = post.querySelector('[data-testid="post-header"], .PostHeader, .post_header, .PostHeaderActions');
            if (header) {
                const actionBtns = header.querySelectorAll('button, [role="button"], .ui_actions_menu_icons');
                if (actionBtns.length > 0) {
                    buttons.add(actionBtns[actionBtns.length - 1]);
                }
            }
        });

        for (const btn of buttons) {
            if (btn.offsetParent !== null && !btn.dataset.vkProcessed) {
                return btn;
            }
        }
        return null;
    }

    window.stopVKCleaner = false;
    window.isVKCleanerRunning = true;

    // Стили анимации для плавающей панели внутри ВК
    if (!document.getElementById('vk-cleaner-styles')) {
        const style = document.createElement('style');
        style.id = 'vk-cleaner-styles';
        style.textContent = `
            @keyframes vkTurboBG {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
            }
            @keyframes vkPulseDot {
                0%, 100% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.4); opacity: 0.5; }
            }
            #vk-cleaner-panel {
                position: fixed;
                top: 70px;
                right: 20px;
                z-index: 999999;
                width: 245px;
                padding: 16px;
                border-radius: 14px;
                background: linear-gradient(-45deg, #130f26, #2b193d, #192236, #3b132b);
                background-size: 300% 300%;
                animation: vkTurboBG 6s ease infinite;
                color: #fff;
                font-family: 'Segoe UI', system-ui, sans-serif;
                box-shadow: 0 10px 30px rgba(0,0,0,0.65), 0 0 15px rgba(255, 65, 108, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.16);
                backdrop-filter: blur(10px);
            }
            .vk-progress-wrap {
                width: 100%;
                height: 7px;
                background: rgba(255, 255, 255, 0.12);
                border-radius: 6px;
                overflow: hidden;
                margin: 10px 0 12px;
            }
            #vk-cleaner-bar {
                height: 100%;
                width: 0%;
                background: linear-gradient(90deg, #ff416c, #ff4b2b, #f9cb28);
                border-radius: 6px;
                transition: width 0.2s ease;
                box-shadow: 0 0 10px rgba(255, 65, 108, 0.8);
            }
            #vk-cleaner-stop {
                width: 100%;
                padding: 9px;
                background: linear-gradient(90deg, #ff416c, #ff4b2b);
                color: #fff;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 700;
                font-size: 12px;
                letter-spacing: 0.5px;
                transition: transform 0.15s ease, box-shadow 0.15s ease;
            }
            #vk-cleaner-stop:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(255, 65, 108, 0.6);
            }
        `;
        document.head.appendChild(style);
    }

    let panel = document.getElementById('vk-cleaner-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'vk-cleaner-panel';
        panel.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px; font-weight:800; font-size:14px; margin-bottom:8px;">
                <span style="width:9px; height:9px; border-radius:50%; background:#ff416c; display:inline-block; animation:vkPulseDot 1s infinite;"></span>
                <span>VK TURBO CLEANER</span>
            </div>
            <div id="vk-cleaner-status" style="font-size:13px; color:#eee;">Starting...</div>
            <div class="vk-progress-wrap"><div id="vk-cleaner-bar"></div></div>
            <button id="vk-cleaner-stop">🛑 STOP TURBO</button>
        `;
        document.body.appendChild(panel);
    }

    const statusEl = document.getElementById('vk-cleaner-status');
    const barEl = document.getElementById('vk-cleaner-bar');
    barEl.style.width = '0%';

    document.getElementById('vk-cleaner-stop').onclick = () => {
        window.stopVKCleaner = true;
        statusEl.innerText = 'Stopping...';
    };

    let deletedCount = 0;
    let emptyScrollRetries = 0;

    function updateProgress(text) {
        const pct = Math.min(100, Math.round((deletedCount / targetLimit) * 100));
        barEl.style.width = `${pct}%`;
        statusEl.innerText = text || `Deleted: ${deletedCount} / ${targetLimit} (${pct}%)`;
    }

    while (deletedCount < targetLimit) {
        if (window.stopVKCleaner) {
            updateProgress(`Stopped! Deleted: ${deletedCount}/${targetLimit}`);
            window.isVKCleanerRunning = false;
            return;
        }

        const btn = getNextPostMenuButton();

        // Автоподгрузка старых постов при прокрутке до 500–1000 записей
        if (!btn) {
            emptyScrollRetries++;
            if (emptyScrollRetries > 8) {
                updateProgress(`Finished! No more posts (${deletedCount})`);
                break;
            }
            updateProgress(`Scrolling wall... (${deletedCount}/${targetLimit})`);
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });
            await sleep(450);
            continue;
        }

        emptyScrollRetries = 0;
        btn.dataset.vkProcessed = "true";

        try {
            // Мгновенный прыжок к посту
            btn.scrollIntoView({ behavior: 'instant', block: 'center' });
            await sleep(15);

            // Пробуем открыть меню наведением и сразу кликом без пауз
            triggerHover(btn);
            let deleteBtn = await waitForDeleteButton(110);

            if (!deleteBtn) {
                triggerClick(btn);
                deleteBtn = await waitForDeleteButton(180);
            }

            if (deleteBtn) {
                triggerClick(deleteBtn);
                deletedCount++;
                updateProgress();
            }

            // Турбо-пауза 0.18 сек (около 4-5 постов в секунду)
            await sleep(180);
        } catch (err) {
            console.error(err);
        }
    }

    window.isVKCleanerRunning = false;
    if (!window.stopVKCleaner && deletedCount >= targetLimit) {
        updateProgress(`⚡ Done! Deleted ${deletedCount} posts!`);
    }
})();