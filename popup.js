document.addEventListener('DOMContentLoaded', () => {
  const slider = document.getElementById('postLimit');
  const label = document.getElementById('countLabel');
  const presetBtns = document.querySelectorAll('.preset-btn');
  const msgBox = document.getElementById('msgBox');

  function updateLabel(val) {
    label.textContent = val;
    label.classList.add('pop');
    setTimeout(() => label.classList.remove('pop'), 150);

    presetBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.val === String(val));
    });
  }

  slider.addEventListener('input', () => {
    updateLabel(slider.value);
  });

  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      slider.value = btn.dataset.val;
      updateLabel(slider.value);
    });
  });

  // Ищем активную или открытую рядом вкладку ВК
  async function findVKTab() {
    let [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab && activeTab.url && (activeTab.url.includes('vk.com') || activeTab.url.includes('vk.ru'))) {
      return activeTab;
    }
    let vkTabs = await chrome.tabs.query({ url: ['*://*.vk.com/*', '*://*.vk.ru/*'] });
    if (vkTabs.length > 0) {
      await chrome.tabs.update(vkTabs[0].id, { active: true });
      return vkTabs[0];
    }
    return null;
  }

  document.getElementById('cleanBtn').addEventListener('click', async () => {
    const limit = parseInt(slider.value, 10) || 100;
    const tab = await findVKTab();

    if (!tab) {
      msgBox.textContent = "⚠️ Open VK tab first!";
      return;
    }

    msgBox.textContent = "✅ Running on VK...";

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (maxPosts) => {
        window.vkCleanerTargetLimit = maxPosts;
      },
      args: [limit]
    });

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
  });

  document.getElementById('stopBtn').addEventListener('click', async () => {
    const tab = await findVKTab();
    if (!tab) return;

    msgBox.textContent = "🛑 Stopping...";

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        window.stopVKCleaner = true;
      }
    });
  });
});