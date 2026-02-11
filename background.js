// Background service worker for Research Paper Tracker

// Create context menu on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'savePaper',
    title: 'Save as Research Paper',
    contexts: ['page', 'selection', 'link']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'savePaper') {
    chrome.tabs.sendMessage(tab.id, { action: 'extractPaper' });
  }
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'savePaper') {
    savePaper(request.paper).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.action === 'getPapers') {
    getPapers(request.filter).then(papers => {
      sendResponse({ papers });
    });
    return true;
  }
  
  if (request.action === 'updatePaper') {
    updatePaper(request.id, request.updates).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.action === 'deletePaper') {
    deletePaper(request.id).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.action === 'addAnnotation') {
    addAnnotation(request.paperId, request.annotation).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.action === 'exportData') {
    exportData(request.format).then(data => {
      sendResponse({ data });
    });
    return true;
  }
});

// Save a paper to storage
async function savePaper(paper) {
  const papers = await chrome.storage.local.get('papers');
  const papersList = papers.papers || [];
  
  // Check if paper already exists (by URL or title)
  const existingIndex = papersList.findIndex(
    p => p.url === paper.url || p.title === paper.title
  );
  
  if (existingIndex !== -1) {
    // Update existing paper
    papersList[existingIndex] = {
      ...papersList[existingIndex],
      ...paper,
      updatedAt: new Date().toISOString()
    };
  } else {
    // Add new paper
    paper.id = generateId();
    paper.createdAt = new Date().toISOString();
    paper.updatedAt = new Date().toISOString();
    paper.status = paper.status || 'unread';
    paper.tags = paper.tags || [];
    paper.annotations = paper.annotations || [];
    paper.notes = paper.notes || '';
    papersList.push(paper);
  }
  
  await chrome.storage.local.set({ papers: papersList });
  
  // Update statistics
  await updateStats();
}

// Get papers with optional filtering
async function getPapers(filter = {}) {
  const data = await chrome.storage.local.get('papers');
  let papers = data.papers || [];
  
  // Apply filters
  if (filter.status) {
    papers = papers.filter(p => p.status === filter.status);
  }
  
  if (filter.tag) {
    papers = papers.filter(p => p.tags && p.tags.includes(filter.tag));
  }
  
  if (filter.search) {
    const searchLower = filter.search.toLowerCase();
    papers = papers.filter(p => 
      p.title?.toLowerCase().includes(searchLower) ||
      p.authors?.toLowerCase().includes(searchLower) ||
      p.abstract?.toLowerCase().includes(searchLower)
    );
  }
  
  // Sort by date (newest first)
  papers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  return papers;
}

// Update a paper
async function updatePaper(id, updates) {
  const data = await chrome.storage.local.get('papers');
  const papers = data.papers || [];
  
  const index = papers.findIndex(p => p.id === id);
  if (index !== -1) {
    papers[index] = {
      ...papers[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    await chrome.storage.local.set({ papers });
    await updateStats();
  }
}

// Delete a paper
async function deletePaper(id) {
  const data = await chrome.storage.local.get('papers');
  const papers = data.papers || [];
  
  const filtered = papers.filter(p => p.id !== id);
  await chrome.storage.local.set({ papers: filtered });
  await updateStats();
}

// Add annotation to a paper
async function addAnnotation(paperId, annotation) {
  const data = await chrome.storage.local.get('papers');
  const papers = data.papers || [];
  
  const index = papers.findIndex(p => p.id === paperId);
  if (index !== -1) {
    if (!papers[index].annotations) {
      papers[index].annotations = [];
    }
    
    annotation.id = generateId();
    annotation.createdAt = new Date().toISOString();
    papers[index].annotations.push(annotation);
    papers[index].updatedAt = new Date().toISOString();
    
    await chrome.storage.local.set({ papers });
  }
}

// Update statistics
async function updateStats() {
  const data = await chrome.storage.local.get('papers');
  const papers = data.papers || [];
  
  const stats = {
    total: papers.length,
    unread: papers.filter(p => p.status === 'unread').length,
    reading: papers.filter(p => p.status === 'reading').length,
    read: papers.filter(p => p.status === 'read').length,
    toRevisit: papers.filter(p => p.status === 'to-revisit').length,
    lastUpdated: new Date().toISOString()
  };
  
  await chrome.storage.local.set({ stats });
}

// Export data in various formats
async function exportData(format) {
  const data = await chrome.storage.local.get('papers');
  const papers = data.papers || [];
  
  if (format === 'json') {
    return JSON.stringify(papers, null, 2);
  }
  
  if (format === 'csv') {
    const headers = ['Title', 'Authors', 'Year', 'Status', 'Tags', 'URL', 'Notes'];
    const rows = papers.map(p => [
      p.title || '',
      p.authors || '',
      p.year || '',
      p.status || '',
      p.tags ? p.tags.join('; ') : '',
      p.url || '',
      p.notes || ''
    ]);
    
    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n');
    
    return csv;
  }
  
  if (format === 'bibtex') {
    return papers.map(p => {
      const key = `${p.authors?.split(',')[0]?.split(' ').pop() || 'Unknown'}${p.year || 'n.d.'}`;
      return `@article{${key},
  title={${p.title || 'Untitled'}},
  author={${p.authors || 'Unknown'}},
  year={${p.year || 'n.d.'}},
  url={${p.url || ''}},
  note={${p.notes || ''}}
}`;
    }).join('\n\n');
  }
  
  return '';
}

// Generate unique ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Initialize stats on install
chrome.runtime.onInstalled.addListener(async () => {
  await updateStats();
});
