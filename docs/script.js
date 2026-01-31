/**
 * 帳票データ化アプリ - 移行マニュアル JavaScript
 */

// ========================================
// 初期化
// ========================================

document.addEventListener('DOMContentLoaded', () => {
  loadProgress();
  loadMemo();
  setupEventListeners();
  updateProgressDisplay();
  setupSmoothScroll();
  setupIntersectionObserver();
});

// ========================================
// 進捗管理
// ========================================

const TOTAL_SECTIONS = 11;
let completedSections = new Set();

function loadProgress() {
  const saved = localStorage.getItem('migration_progress');
  if (saved) {
    completedSections = new Set(JSON.parse(saved));
    completedSections.forEach(section => {
      markSectionCompleted(section, false);
    });
  }
}

function saveProgress() {
  localStorage.setItem('migration_progress', JSON.stringify([...completedSections]));
}

function completeSection(sectionNum) {
  completedSections.add(sectionNum);
  saveProgress();
  markSectionCompleted(sectionNum, true);
  updateProgressDisplay();

  // 次のセクションにスクロール
  if (sectionNum < TOTAL_SECTIONS) {
    setTimeout(() => {
      const nextSection = document.getElementById(`section-${sectionNum + 1}`);
      if (nextSection) {
        nextSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 500);
  }

  // 全セクション完了チェック
  if (completedSections.size === TOTAL_SECTIONS) {
    showCompletionSection();
  }
}

function markSectionCompleted(sectionNum, animate = false) {
  // ナビゲーションの更新
  const navItem = document.querySelector(`.nav-item[data-section="${sectionNum}"]`);
  if (navItem) {
    navItem.classList.add('completed');
    const checkSpan = document.getElementById(`check-${sectionNum}`);
    if (checkSpan) {
      checkSpan.textContent = '✓';
    }
  }

  // ボタンの更新
  const section = document.getElementById(`section-${sectionNum}`);
  if (section) {
    const btn = section.querySelector('.complete-btn');
    if (btn) {
      btn.textContent = '✓ 完了';
      btn.classList.add('completed');
      btn.disabled = true;
    }
  }

  if (animate) {
    // アニメーション効果
    if (navItem) {
      navItem.style.transform = 'scale(1.05)';
      setTimeout(() => {
        navItem.style.transform = '';
      }, 200);
    }
  }
}

function updateProgressDisplay() {
  const progress = (completedSections.size / TOTAL_SECTIONS) * 100;
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');

  if (progressFill) {
    progressFill.style.width = `${progress}%`;
  }
  if (progressText) {
    progressText.textContent = `${Math.round(progress)}%`;
  }
}

function resetProgress() {
  if (confirm('進捗をリセットしますか？すべてのチェックが解除されます。')) {
    completedSections.clear();
    localStorage.removeItem('migration_progress');
    localStorage.removeItem('migration_memo');

    // UIをリセット
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('completed');
    });
    document.querySelectorAll('.nav-check').forEach(check => {
      check.textContent = '';
    });
    document.querySelectorAll('.complete-btn').forEach(btn => {
      btn.textContent = 'このセクションを完了';
      btn.classList.remove('completed');
      btn.disabled = false;
    });
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.checked = false;
    });
    document.querySelectorAll('.memo-section input').forEach(input => {
      input.value = '';
    });

    updateProgressDisplay();
    hideCompletionSection();

    // ページトップに戻る
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function showCompletionSection() {
  const completionSection = document.getElementById('completion-section');
  if (completionSection) {
    completionSection.style.display = 'block';
    generateFinalSummary();
    completionSection.scrollIntoView({ behavior: 'smooth' });
  }
}

function hideCompletionSection() {
  const completionSection = document.getElementById('completion-section');
  if (completionSection) {
    completionSection.style.display = 'none';
  }
}

function generateFinalSummary() {
  const summaryGrid = document.getElementById('final-summary-grid');
  if (!summaryGrid) return;

  const memo = JSON.parse(localStorage.getItem('migration_memo') || '{}');

  const items = [
    { label: 'プロジェクトID', key: 'project-id' },
    { label: 'バックエンドURL', key: 'backend-url' },
    { label: 'フロントエンドURL', key: 'frontend-url' },
  ];

  summaryGrid.innerHTML = items.map(item => `
    <div class="summary-item">
      <span class="summary-label">${item.label}</span>
      <span class="summary-value">${memo[item.key] || '未入力'}</span>
    </div>
  `).join('');
}

// ========================================
// メモ管理
// ========================================

function saveMemo() {
  const memoFields = document.querySelectorAll('.memo-section input');
  const memo = {};

  memoFields.forEach(field => {
    const id = field.id.replace('memo-', '');
    if (field.value) {
      memo[id] = field.value;
    }
  });

  localStorage.setItem('migration_memo', JSON.stringify(memo));
  updateConfigDisplay();
}

function loadMemo() {
  const saved = localStorage.getItem('migration_memo');
  if (saved) {
    const memo = JSON.parse(saved);
    Object.keys(memo).forEach(key => {
      const field = document.getElementById(`memo-${key}`);
      if (field) {
        field.value = memo[key];
      }
    });
    updateConfigDisplay();
  }
}

function updateConfigDisplay() {
  const memo = JSON.parse(localStorage.getItem('migration_memo') || '{}');

  const mappings = {
    'project-id': 'display-project-id',
    'firebase-apikey': 'display-firebase-apikey',
    'firebase-authdomain': 'display-firebase-authdomain',
    'firebase-projectid': 'display-firebase-projectid',
    'firebase-storagebucket': 'display-firebase-storagebucket',
    'firebase-senderid': 'display-firebase-senderid',
    'firebase-appid': 'display-firebase-appid',
    'gemini-key': 'display-gemini-key',
  };

  Object.keys(mappings).forEach(memoKey => {
    const displayEl = document.getElementById(mappings[memoKey]);
    if (displayEl) {
      const value = memo[memoKey];
      if (value) {
        // APIキーは一部マスク
        if (memoKey === 'gemini-key') {
          displayEl.textContent = value.substring(0, 10) + '...';
        } else {
          displayEl.textContent = value;
        }
        displayEl.style.color = '#16a34a';
      } else {
        displayEl.textContent = '未入力';
        displayEl.style.color = '#9ca3af';
      }
    }
  });

  // コード内のプレースホルダーを更新
  if (memo['project-id']) {
    document.querySelectorAll('#code-project-id-1').forEach(el => {
      el.textContent = memo['project-id'];
    });
  }
  if (memo['backend-url']) {
    document.querySelectorAll('#code-backend-url').forEach(el => {
      el.textContent = memo['backend-url'];
    });
  }
}

// ========================================
// UI操作
// ========================================

function copyCode(btn) {
  const codeBlock = btn.closest('.code-block');
  const code = codeBlock.querySelector('code').textContent;

  navigator.clipboard.writeText(code).then(() => {
    const originalText = btn.textContent;
    btn.textContent = 'コピー済み';
    btn.classList.add('copied');

    setTimeout(() => {
      btn.textContent = originalText;
      btn.classList.remove('copied');
    }, 2000);
  }).catch(err => {
    console.error('コピーに失敗しました:', err);
    alert('コピーに失敗しました。手動でコピーしてください。');
  });
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    // 簡易フィードバック
    const notification = document.createElement('div');
    notification.textContent = 'コピーしました！';
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #16a34a;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 0.9rem;
      z-index: 1000;
      animation: fadeInOut 2s ease;
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2000);
  }).catch(err => {
    console.error('コピーに失敗しました:', err);
  });
}

function toggleAccordion(btn) {
  const accordion = btn.closest('.accordion');
  accordion.classList.toggle('open');
}

function toggleFaq(btn) {
  const faqItem = btn.closest('.faq-item');
  faqItem.classList.toggle('open');
}

function toggleVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '隠す';
  } else {
    input.type = 'password';
    btn.textContent = '表示';
  }
}

// ========================================
// タブ切り替え
// ========================================

function setupEventListeners() {
  // タブ切り替え
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      const container = btn.closest('.section-content');

      // ボタンの状態更新
      container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // コンテンツの表示切り替え
      container.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      document.getElementById(`tab-${tabId}`).classList.add('active');
    });
  });

  // モバイルメニュー
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const sidebar = document.getElementById('sidebar');

  if (mobileMenuBtn && sidebar) {
    mobileMenuBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });

    // サイドバー外クリックで閉じる
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 1024 &&
          !sidebar.contains(e.target) &&
          !mobileMenuBtn.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });
  }

  // チェックボックスの変更を監視
  document.querySelectorAll('input[type="checkbox"][data-section]').forEach(cb => {
    cb.addEventListener('change', () => {
      // 何かの処理（必要に応じて）
    });
  });
}

// ========================================
// スムーススクロール
// ========================================

function setupSmoothScroll() {
  document.querySelectorAll('.nav-item').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('href');
      const target = document.querySelector(targetId);

      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // モバイルの場合はサイドバーを閉じる
        if (window.innerWidth <= 1024) {
          document.getElementById('sidebar').classList.remove('open');
        }
      }
    });
  });
}

// ========================================
// スクロール監視
// ========================================

function setupIntersectionObserver() {
  const options = {
    root: null,
    rootMargin: '-100px 0px -70% 0px',
    threshold: 0
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const sectionId = entry.target.id;
        const sectionNum = sectionId.replace('section-', '');

        // ナビゲーションのアクティブ状態を更新
        document.querySelectorAll('.nav-item').forEach(item => {
          item.classList.remove('active');
          if (item.dataset.section === sectionNum) {
            item.classList.add('active');
          }
        });
      }
    });
  }, options);

  document.querySelectorAll('.section').forEach(section => {
    observer.observe(section);
  });
}

// ========================================
// ユーティリティ
// ========================================

// エスケープ処理
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
