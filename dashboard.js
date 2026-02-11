// Dashboard script for Research Paper Tracker

let allPapers = [];
let currentView = 'overview';
let currentFilter = 'all';
let searchQuery = '';

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
  loadPapers();
  setupEventListeners();
  setupNavigation();
});

// Setup event listeners
function setupEventListeners() {
  // Add paper button
  document.getElementById('addPaperBtn')?.addEventListener('click', showAddPaperDialog);
  
  // Export all button
  document.getElementById('exportAllBtn')?.addEventListener('click', showExportDialog);
  
  // Library search
  document.getElementById('librarySearch')?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    loadLibraryView();
  });
  
  // Library filters
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.dataset.filter;
      loadLibraryView();
    });
  });
  
  // Modal close
  document.getElementById('closeModal')?.addEventListener('click', closeModal);
  document.querySelector('.modal-backdrop')?.addEventListener('click', closeModal);
}

// Setup navigation
function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const view = item.dataset.view;
      switchView(view);
      
      // Update active state
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
    });
  });
}

// Switch between views
function switchView(view) {
  currentView = view;
  
  // Hide all views
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  
  // Show selected view
  const viewMap = {
    'overview': 'overviewView',
    'timeline': 'timelineView',
    'graph': 'graphView',
    'library': 'libraryView',
    'tags': 'tagsView'
  };
  
  const viewId = viewMap[view];
  if (viewId) {
    document.getElementById(viewId)?.classList.remove('hidden');
  }
  
  // Load view-specific data
  switch (view) {
    case 'overview':
      loadOverviewView();
      break;
    case 'timeline':
      loadTimelineView();
      break;
    case 'graph':
      loadGraphView();
      break;
    case 'library':
      loadLibraryView();
      break;
    case 'tags':
      loadTagsView();
      break;
  }
}

// Load all papers from storage
async function loadPapers() {
  chrome.runtime.sendMessage({ action: 'getPapers' }, (response) => {
    if (response && response.papers) {
      allPapers = response.papers;
      loadOverviewView();
    }
  });
}

// Load overview view
function loadOverviewView() {
  // Update stats
  document.getElementById('overviewTotal').textContent = allPapers.length;
  document.getElementById('overviewUnread').textContent = 
    allPapers.filter(p => p.status === 'unread').length;
  document.getElementById('overviewReading').textContent = 
    allPapers.filter(p => p.status === 'reading').length;
  document.getElementById('overviewRead').textContent = 
    allPapers.filter(p => p.status === 'read').length;
  
  // Load recent papers
  const recentPapers = allPapers.slice(0, 6);
  const grid = document.getElementById('recentPapersGrid');
  
  if (recentPapers.length === 0) {
    grid.innerHTML = '<p style="color: #9ca3af; text-align: center; grid-column: 1/-1;">No papers saved yet. Start by adding your first research paper!</p>';
    return;
  }
  
  grid.innerHTML = recentPapers.map(paper => createPaperCard(paper)).join('');
  
  // Add click listeners
  grid.querySelectorAll('.paper-card-large').forEach(card => {
    card.addEventListener('click', () => {
      const paperId = card.dataset.id;
      showPaperDetail(paperId);
    });
  });
}

// Load timeline view
function loadTimelineView() {
  const timeline = document.getElementById('timelineContent');
  
  if (allPapers.length === 0) {
    timeline.innerHTML = '<p style="color: #9ca3af; text-align: center;">No papers in your timeline yet.</p>';
    return;
  }
  
  // Group papers by date
  const groupedByDate = {};
  allPapers.forEach(paper => {
    const date = new Date(paper.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    if (!groupedByDate[date]) {
      groupedByDate[date] = [];
    }
    groupedByDate[date].push(paper);
  });
  
  // Create timeline items
  timeline.innerHTML = Object.entries(groupedByDate).map(([date, papers]) => `
    <div class="timeline-item">
      <div class="timeline-date">${date}</div>
      ${papers.map(paper => `
        <div class="timeline-paper" data-id="${paper.id}">
          <div class="timeline-paper-title">${escapeHtml(paper.title || 'Untitled')}</div>
          <div class="timeline-paper-meta">
            ${paper.authors ? escapeHtml(paper.authors) : 'Unknown authors'}
            ${paper.year ? ` • ${escapeHtml(paper.year)}` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `).join('');
  
  // Add click listeners
  timeline.querySelectorAll('.timeline-paper').forEach(item => {
    item.addEventListener('click', () => {
      showPaperDetail(item.dataset.id);
    });
  });
}

// Load graph view
function loadGraphView() {
  const canvas = document.getElementById('graphCanvas');
  
  // Extract unique tags
  const tagConnections = {};
  allPapers.forEach(paper => {
    if (paper.tags && paper.tags.length > 0) {
      paper.tags.forEach(tag => {
        if (!tagConnections[tag]) {
          tagConnections[tag] = [];
        }
        tagConnections[tag].push(paper);
      });
    }
  });
  
  // If no tags, show placeholder
  if (Object.keys(tagConnections).length === 0) {
    return;
  }
  
  // Simple visualization (in a real app, you'd use D3.js or similar)
  canvas.innerHTML = `
    <div style="padding: 40px; text-align: center;">
      <h3 style="margin-bottom: 20px;">Tags Overview</h3>
      <div style="display: flex; flex-wrap: wrap; gap: 12px; justify-content: center;">
        ${Object.entries(tagConnections).map(([tag, papers]) => `
          <div style="padding: 12px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 20px; font-weight: 600;">
            ${escapeHtml(tag)} (${papers.length})
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// Load library view
function loadLibraryView() {
  let filtered = allPapers;
  
  // Apply status filter
  if (currentFilter !== 'all') {
    filtered = filtered.filter(p => p.status === currentFilter);
  }
  
  // Apply search
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(p => 
      p.title?.toLowerCase().includes(query) ||
      p.authors?.toLowerCase().includes(query) ||
      p.abstract?.toLowerCase().includes(query)
    );
  }
  
  const grid = document.getElementById('libraryGrid');
  
  if (filtered.length === 0) {
    grid.innerHTML = '<p style="color: #9ca3af; text-align: center; grid-column: 1/-1;">No papers found.</p>';
    return;
  }
  
  grid.innerHTML = filtered.map(paper => createPaperCard(paper)).join('');
  
  // Add click listeners
  grid.querySelectorAll('.paper-card-large').forEach(card => {
    card.addEventListener('click', () => {
      showPaperDetail(card.dataset.id);
    });
  });
}

// Load tags view
function loadTagsView() {
  const tagsCount = {};
  
  allPapers.forEach(paper => {
    if (paper.tags) {
      paper.tags.forEach(tag => {
        tagsCount[tag] = (tagsCount[tag] || 0) + 1;
      });
    }
  });
  
  const grid = document.getElementById('tagsGrid');
  
  if (Object.keys(tagsCount).length === 0) {
    grid.innerHTML = '<p style="color: #9ca3af; text-align: center; grid-column: 1/-1;">No tags yet. Add tags to your papers to organize them better!</p>';
    return;
  }
  
  grid.innerHTML = Object.entries(tagsCount)
    .sort((a, b) => b[1] - a[1])
    .map(([tag, count]) => `
      <div class="tag-card" data-tag="${escapeHtml(tag)}">
        <div class="tag-card-name">${escapeHtml(tag)}</div>
        <div class="tag-card-count">${count} paper${count !== 1 ? 's' : ''}</div>
      </div>
    `).join('');
  
  // Add click listeners
  grid.querySelectorAll('.tag-card').forEach(card => {
    card.addEventListener('click', () => {
      const tag = card.dataset.tag;
      // Switch to library view with this tag filter
      currentFilter = 'all';
      searchQuery = tag;
      document.getElementById('librarySearch').value = tag;
      switchView('library');
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      document.querySelector('[data-view="library"]').classList.add('active');
    });
  });
}

// Create paper card HTML
function createPaperCard(paper) {
  return `
    <div class="paper-card-large" data-id="${paper.id}">
      <div class="paper-card-header">
        <div class="paper-card-title">${escapeHtml(paper.title || 'Untitled Paper')}</div>
        <span class="status-badge-large ${paper.status || 'unread'}">${formatStatus(paper.status)}</span>
      </div>
      
      ${paper.authors || paper.year ? `
        <div class="paper-card-meta">
          ${paper.authors ? escapeHtml(paper.authors) : ''}
          ${paper.year ? ` • ${escapeHtml(paper.year)}` : ''}
        </div>
      ` : ''}
      
      ${paper.abstract ? `
        <div class="paper-card-abstract">${escapeHtml(paper.abstract)}</div>
      ` : ''}
      
      ${paper.tags && paper.tags.length > 0 ? `
        <div class="paper-card-tags">
          ${paper.tags.map(tag => `<span class="tag-large">${escapeHtml(tag)}</span>`).join('')}
        </div>
      ` : ''}
      
      <div class="paper-card-footer">
        <div class="paper-card-date">
          Added ${formatDate(paper.createdAt)}
        </div>
        <div class="paper-card-actions">
          <button class="icon-btn-small" title="View" onclick="event.stopPropagation(); window.open('${escapeHtml(paper.url)}', '_blank')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </button>
          <button class="icon-btn-small" title="Delete" onclick="event.stopPropagation(); deletePaper('${paper.id}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;
}

// Show paper detail modal
function showPaperDetail(paperId) {
  const paper = allPapers.find(p => p.id === paperId);
  if (!paper) return;
  
  const modal = document.getElementById('paperModal');
  const modalBody = document.getElementById('modalBody');
  
  modalBody.innerHTML = `
    <div style="margin-bottom: 20px;">
      <h3 style="font-size: 20px; margin-bottom: 12px;">${escapeHtml(paper.title || 'Untitled')}</h3>
      ${paper.authors ? `<p style="color: #6b7280; margin-bottom: 8px;">${escapeHtml(paper.authors)}</p>` : ''}
      ${paper.year ? `<p style="color: #6b7280; margin-bottom: 8px;">Year: ${escapeHtml(paper.year)}</p>` : ''}
      ${paper.source ? `<p style="color: #6b7280; margin-bottom: 8px;">Source: ${escapeHtml(paper.source)}</p>` : ''}
    </div>
    
    <div style="margin-bottom: 20px;">
      <label style="display: block; font-weight: 600; margin-bottom: 8px;">Status:</label>
      <select id="paperStatus" style="width: 100%; padding: 10px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <option value="unread" ${paper.status === 'unread' ? 'selected' : ''}>Unread</option>
        <option value="reading" ${paper.status === 'reading' ? 'selected' : ''}>Reading</option>
        <option value="read" ${paper.status === 'read' ? 'selected' : ''}>Read</option>
        <option value="to-revisit" ${paper.status === 'to-revisit' ? 'selected' : ''}>To Revisit</option>
      </select>
    </div>
    
    ${paper.abstract ? `
      <div style="margin-bottom: 20px;">
        <h4 style="font-weight: 600; margin-bottom: 8px;">Abstract:</h4>
        <p style="color: #4b5563; line-height: 1.6;">${escapeHtml(paper.abstract)}</p>
      </div>
    ` : ''}
    
    <div style="margin-bottom: 20px;">
      <label style="display: block; font-weight: 600; margin-bottom: 8px;">Tags:</label>
      <input type="text" id="paperTags" value="${paper.tags ? paper.tags.join(', ') : ''}" 
        placeholder="machine learning, neural networks, etc."
        style="width: 100%; padding: 10px; border: 1px solid #e5e7eb; border-radius: 8px;">
      <p style="font-size: 12px; color: #9ca3af; margin-top: 4px;">Separate tags with commas</p>
    </div>
    
    <div style="margin-bottom: 20px;">
      <label style="display: block; font-weight: 600; margin-bottom: 8px;">Notes:</label>
      <textarea id="paperNotes" rows="4" 
        style="width: 100%; padding: 10px; border: 1px solid #e5e7eb; border-radius: 8px; resize: vertical;"
        placeholder="Add your notes here...">${escapeHtml(paper.notes || '')}</textarea>
    </div>
    
    <div style="display: flex; gap: 12px;">
      <button onclick="savePaperChanges('${paperId}')" style="flex: 1; padding: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
        Save Changes
      </button>
      <button onclick="window.open('${escapeHtml(paper.url)}', '_blank')" style="flex: 1; padding: 12px; background: #f3f4f6; color: #4b5563; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
        View Paper
      </button>
    </div>
  `;
  
  modal.classList.add('active');
}

// Close modal
function closeModal() {
  document.getElementById('paperModal').classList.remove('active');
}

// Save paper changes
window.savePaperChanges = function(paperId) {
  const status = document.getElementById('paperStatus').value;
  const tags = document.getElementById('paperTags').value
    .split(',')
    .map(t => t.trim())
    .filter(t => t);
  const notes = document.getElementById('paperNotes').value;
  
  chrome.runtime.sendMessage({
    action: 'updatePaper',
    id: paperId,
    updates: { status, tags, notes }
  }, () => {
    loadPapers();
    closeModal();
  });
};

// Delete paper
window.deletePaper = function(paperId) {
  if (confirm('Are you sure you want to delete this paper?')) {
    chrome.runtime.sendMessage({ action: 'deletePaper', id: paperId }, () => {
      loadPapers();
    });
  }
};

// Show add paper dialog
function showAddPaperDialog() {
  alert('To add a paper, visit an academic website (Google Scholar, PubMed, arXiv, etc.) and click the "Save Paper" button that appears.');
}

// Show export dialog
function showExportDialog() {
  const format = prompt('Export format (json, csv, or bibtex):');
  if (format && ['json', 'csv', 'bibtex'].includes(format.toLowerCase())) {
    chrome.runtime.sendMessage({ action: 'exportData', format: format.toLowerCase() }, (response) => {
      if (response && response.data) {
        const blob = new Blob([response.data], { 
          type: format === 'json' ? 'application/json' : 'text/plain' 
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `research-papers-${Date.now()}.${format.toLowerCase()}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    });
  }
}

// Helper functions
function formatStatus(status) {
  const statusMap = {
    'unread': 'Unread',
    'reading': 'Reading',
    'read': 'Read',
    'to-revisit': 'To Revisit'
  };
  return statusMap[status] || 'Unread';
}

function formatDate(dateString) {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
