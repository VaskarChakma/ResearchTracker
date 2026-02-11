// Popup script for Research Paper Tracker

let currentFilter = 'all';
let searchQuery = '';

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  loadPapers();
  setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
  // Search input
  document.getElementById('searchInput').addEventListener('input', (e) => {
    searchQuery = e.target.value;
    loadPapers();
  });
  
  // Filter tabs
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.status;
      loadPapers();
    });
  });
  
  // Save current page button
  document.getElementById('saveCurrentBtn').addEventListener('click', saveCurrentPage);
  
  // View dashboard button
  document.getElementById('viewDashboardBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  });
  
  // Export button
  document.getElementById('exportBtn').addEventListener('click', () => {
    document.getElementById('exportModal').classList.add('active');
  });
  
  // Close export modal
  document.getElementById('closeExportModal').addEventListener('click', () => {
    document.getElementById('exportModal').classList.remove('active');
  });
  
  // Export options
  document.querySelectorAll('.export-option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      exportData(btn.dataset.format);
      document.getElementById('exportModal').classList.remove('active');
    });
  });
}

// Load statistics
async function loadStats() {
  chrome.runtime.sendMessage({ action: 'getPapers' }, (response) => {
    if (response && response.papers) {
      const papers = response.papers;
      
      document.getElementById('totalCount').textContent = papers.length;
      document.getElementById('unreadCount').textContent = 
        papers.filter(p => p.status === 'unread').length;
      document.getElementById('readingCount').textContent = 
        papers.filter(p => p.status === 'reading').length;
      document.getElementById('readCount').textContent = 
        papers.filter(p => p.status === 'read').length;
    }
  });
}

// Load papers
async function loadPapers() {
  const filter = {
    status: currentFilter !== 'all' ? currentFilter : null,
    search: searchQuery || null
  };
  
  chrome.runtime.sendMessage({ action: 'getPapers', filter }, (response) => {
    if (response && response.papers) {
      displayPapers(response.papers);
    }
  });
}

// Display papers in the list
function displayPapers(papers) {
  const papersList = document.getElementById('papersList');
  const emptyState = document.getElementById('emptyState');
  
  if (papers.length === 0) {
    papersList.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }
  
  emptyState.classList.add('hidden');
  
  papersList.innerHTML = papers.map(paper => `
    <div class="paper-card" data-id="${paper.id}">
      <div class="paper-header">
        <div class="paper-title">${escapeHtml(paper.title || 'Untitled Paper')}</div>
        <span class="status-badge ${paper.status || 'unread'}">${formatStatus(paper.status)}</span>
      </div>
      
      ${paper.authors ? `
        <div class="paper-meta">
          <div class="paper-authors">${escapeHtml(paper.authors)}</div>
        </div>
      ` : ''}
      
      ${paper.year ? `
        <div class="paper-meta">
          <span>${escapeHtml(paper.year)}</span>
        </div>
      ` : ''}
      
      ${paper.tags && paper.tags.length > 0 ? `
        <div class="paper-tags">
          ${paper.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
        </div>
      ` : ''}
      
      <div class="paper-footer">
        <span class="paper-source">${escapeHtml(paper.source || 'Web')}</span>
        <div class="paper-actions">
          <button class="paper-action-btn view-btn" data-url="${escapeHtml(paper.url)}">View</button>
          <button class="paper-action-btn edit-btn">Edit</button>
          <button class="paper-action-btn delete-btn">Delete</button>
        </div>
      </div>
    </div>
  `).join('');
  
  // Add event listeners to paper cards
  document.querySelectorAll('.paper-card').forEach(card => {
    const paperId = card.dataset.id;
    
    // View button
    card.querySelector('.view-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const url = e.target.dataset.url;
      if (url) {
        chrome.tabs.create({ url });
      }
    });
    
    // Edit button
    card.querySelector('.edit-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditDialog(paperId);
    });
    
    // Delete button
    card.querySelector('.delete-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Are you sure you want to delete this paper?')) {
        deletePaper(paperId);
      }
    });
    
    // Click on card to change status
    card.addEventListener('click', () => {
      cycleStatus(paperId);
    });
  });
}

// Save current page
function saveCurrentPage() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'extractPaper' }, (response) => {
        if (chrome.runtime.lastError) {
          // Content script not loaded, show message
          showNotification('Please navigate to an academic website to save papers.');
        }
      });
    }
  });
}

// Cycle through status
function cycleStatus(paperId) {
  chrome.runtime.sendMessage({ action: 'getPapers' }, (response) => {
    if (response && response.papers) {
      const paper = response.papers.find(p => p.id === paperId);
      if (paper) {
        const statuses = ['unread', 'reading', 'read', 'to-revisit'];
        const currentIndex = statuses.indexOf(paper.status || 'unread');
        const nextStatus = statuses[(currentIndex + 1) % statuses.length];
        
        chrome.runtime.sendMessage({
          action: 'updatePaper',
          id: paperId,
          updates: { status: nextStatus }
        }, () => {
          loadStats();
          loadPapers();
        });
      }
    }
  });
}

// Delete paper
function deletePaper(paperId) {
  chrome.runtime.sendMessage({ action: 'deletePaper', id: paperId }, () => {
    loadStats();
    loadPapers();
  });
}

// Open edit dialog (simplified - full version would be in dashboard)
function openEditDialog(paperId) {
  // For now, just open dashboard with this paper
  chrome.tabs.create({ 
    url: chrome.runtime.getURL(`dashboard.html?paper=${paperId}`) 
  });
}

// Export data
function exportData(format) {
  chrome.runtime.sendMessage({ action: 'exportData', format }, (response) => {
    if (response && response.data) {
      const blob = new Blob([response.data], { 
        type: format === 'json' ? 'application/json' : 'text/plain' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `research-papers-${Date.now()}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      
      showNotification('Papers exported successfully!');
    }
  });
}

// Format status for display
function formatStatus(status) {
  const statusMap = {
    'unread': 'Unread',
    'reading': 'Reading',
    'read': 'Read',
    'to-revisit': 'To Revisit'
  };
  return statusMap[status] || 'Unread';
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Show notification
function showNotification(message) {
  // Simple alert for now - could be improved with custom notification
  alert(message);
}
