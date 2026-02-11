// Content script for extracting paper metadata from academic websites

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractPaper') {
    const paper = extractPaperMetadata();
    if (paper) {
      showSaveNotification(paper);
    }
  }
});

// Add floating save button to pages with detected papers
window.addEventListener('load', () => {
  const paper = extractPaperMetadata();
  if (paper && paper.title) {
    addFloatingSaveButton();
  }
});

// Extract paper metadata based on current website
function extractPaperMetadata() {
  const url = window.location.href;
  const hostname = window.location.hostname;
  
  let paper = {
    url: url,
    source: hostname,
    savedFrom: hostname
  };
  
  // Google Scholar
  if (hostname.includes('scholar.google')) {
    paper = extractGoogleScholar();
  }
  // PubMed
  else if (hostname.includes('pubmed.ncbi.nlm.nih.gov')) {
    paper = extractPubMed();
  }
  // arXiv
  else if (hostname.includes('arxiv.org')) {
    paper = extractArxiv();
  }
  // Semantic Scholar
  else if (hostname.includes('semanticscholar.org')) {
    paper = extractSemanticScholar();
  }
  // IEEE Xplore
  else if (hostname.includes('ieeexplore.ieee.org')) {
    paper = extractIEEE();
  }
  // ScienceDirect
  else if (hostname.includes('sciencedirect.com')) {
    paper = extractScienceDirect();
  }
  // Nature
  else if (hostname.includes('nature.com')) {
    paper = extractNature();
  }
  // Generic extraction as fallback
  else {
    paper = extractGeneric();
  }
  
  paper.url = url;
  paper.source = hostname;
  
  return paper;
}

// Google Scholar extraction
function extractGoogleScholar() {
  const titleElem = document.querySelector('h3.gs_rt a, .gsc_oci_title a');
  const authorsElem = document.querySelector('.gs_a, .gs_scl .gsc_oci_value');
  const abstractElem = document.querySelector('.gs_rs');
  
  return {
    title: titleElem?.textContent?.trim() || '',
    authors: extractAuthorsFromScholar(authorsElem?.textContent || ''),
    year: extractYearFromText(authorsElem?.textContent || ''),
    abstract: abstractElem?.textContent?.trim() || '',
    source: 'Google Scholar'
  };
}

function extractAuthorsFromScholar(text) {
  const parts = text.split('-');
  return parts[0]?.trim() || '';
}

// PubMed extraction
function extractPubMed() {
  const titleElem = document.querySelector('h1.heading-title, .abstract-title');
  const authorsElems = document.querySelectorAll('.authors-list .authors-list-item a, .contrib-author');
  const abstractElem = document.querySelector('.abstract-content p, #abstract p');
  const yearElem = document.querySelector('.citation-year, .cit');
  const doiElem = document.querySelector('.id-link[href*="doi.org"]');
  
  const authors = Array.from(authorsElems).map(a => a.textContent.trim()).join(', ');
  
  return {
    title: titleElem?.textContent?.trim() || '',
    authors: authors || '',
    year: yearElem?.textContent?.trim() || extractYearFromText(document.body.textContent),
    abstract: abstractElem?.textContent?.trim() || '',
    doi: doiElem?.href || '',
    source: 'PubMed'
  };
}

// arXiv extraction
function extractArxiv() {
  const titleElem = document.querySelector('h1.title');
  const authorsElem = document.querySelector('.authors');
  const abstractElem = document.querySelector('.abstract');
  const dateElem = document.querySelector('.dateline');
  
  return {
    title: titleElem?.textContent?.replace('Title:', '')?.trim() || '',
    authors: authorsElem?.textContent?.replace('Authors:', '')?.trim() || '',
    year: extractYearFromText(dateElem?.textContent || ''),
    abstract: abstractElem?.textContent?.replace('Abstract:', '')?.trim() || '',
    source: 'arXiv'
  };
}

// Semantic Scholar extraction
function extractSemanticScholar() {
  const titleElem = document.querySelector('h1[data-test-id="paper-detail-title"]');
  const authorsElems = document.querySelectorAll('[data-test-id="author-list"] a');
  const abstractElem = document.querySelector('[data-test-id="paper-abstract-text"]');
  const yearElem = document.querySelector('[data-test-id="paper-year"]');
  
  const authors = Array.from(authorsElems).map(a => a.textContent.trim()).join(', ');
  
  return {
    title: titleElem?.textContent?.trim() || '',
    authors: authors || '',
    year: yearElem?.textContent?.trim() || '',
    abstract: abstractElem?.textContent?.trim() || '',
    source: 'Semantic Scholar'
  };
}

// IEEE Xplore extraction
function extractIEEE() {
  const titleElem = document.querySelector('.document-title, h1.page-header');
  const authorsElems = document.querySelectorAll('.authors-info .author a, .authors-banner-info a');
  const abstractElem = document.querySelector('.abstract-text');
  const yearElem = document.querySelector('.doc-abstract-pubdate, .u-pb-1.stats-document-abstract-publishedIn');
  
  const authors = Array.from(authorsElems).map(a => a.textContent.trim()).join(', ');
  
  return {
    title: titleElem?.textContent?.trim() || '',
    authors: authors || '',
    year: extractYearFromText(yearElem?.textContent || ''),
    abstract: abstractElem?.textContent?.trim() || '',
    source: 'IEEE Xplore'
  };
}

// ScienceDirect extraction
function extractScienceDirect() {
  const titleElem = document.querySelector('h1.title-text, .article-header h1');
  const authorsElems = document.querySelectorAll('.author a, .author-name');
  const abstractElem = document.querySelector('.abstract .abstract-text, #abstracts p');
  const yearElem = document.querySelector('.article-info .text-xs');
  
  const authors = Array.from(authorsElems).map(a => a.textContent.trim()).join(', ');
  
  return {
    title: titleElem?.textContent?.trim() || '',
    authors: authors || '',
    year: extractYearFromText(yearElem?.textContent || document.body.textContent),
    abstract: abstractElem?.textContent?.trim() || '',
    source: 'ScienceDirect'
  };
}

// Nature extraction
function extractNature() {
  const titleElem = document.querySelector('h1.c-article-title, .article__title');
  const authorsElems = document.querySelectorAll('[data-test="author-name"], .c-article-author-list a');
  const abstractElem = document.querySelector('#Abs1-content, .c-article-section__content');
  const yearElem = document.querySelector('time, .c-bibliographic-information__value');
  
  const authors = Array.from(authorsElems).map(a => a.textContent.trim()).join(', ');
  
  return {
    title: titleElem?.textContent?.trim() || '',
    authors: authors || '',
    year: extractYearFromText(yearElem?.textContent || yearElem?.getAttribute('datetime') || ''),
    abstract: abstractElem?.textContent?.trim() || '',
    source: 'Nature'
  };
}

// Generic extraction using meta tags and common patterns
function extractGeneric() {
  const title = 
    document.querySelector('meta[name="citation_title"]')?.content ||
    document.querySelector('meta[property="og:title"]')?.content ||
    document.querySelector('h1')?.textContent?.trim() ||
    document.title;
  
  const authors = 
    document.querySelector('meta[name="citation_author"]')?.content ||
    document.querySelector('meta[name="author"]')?.content ||
    '';
  
  const abstract = 
    document.querySelector('meta[name="citation_abstract"]')?.content ||
    document.querySelector('meta[name="description"]')?.content ||
    document.querySelector('meta[property="og:description"]')?.content ||
    '';
  
  const year = 
    document.querySelector('meta[name="citation_publication_date"]')?.content ||
    document.querySelector('meta[name="citation_year"]')?.content ||
    '';
  
  const doi = 
    document.querySelector('meta[name="citation_doi"]')?.content ||
    '';
  
  return {
    title: title || '',
    authors: authors || '',
    year: extractYearFromText(year),
    abstract: abstract || '',
    doi: doi || '',
    source: 'Generic'
  };
}

// Extract year from text
function extractYearFromText(text) {
  const yearMatch = text.match(/\b(19|20)\d{2}\b/);
  return yearMatch ? yearMatch[0] : '';
}

// Add floating save button
function addFloatingSaveButton() {
  // Check if button already exists
  if (document.getElementById('research-tracker-save-btn')) {
    return;
  }
  
  const button = document.createElement('div');
  button.id = 'research-tracker-save-btn';
  button.className = 'research-tracker-floating-btn';
  button.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
    </svg>
    <span>Save Paper</span>
  `;
  
  button.addEventListener('click', () => {
    const paper = extractPaperMetadata();
    if (paper && paper.title) {
      savePaper(paper);
    }
  });
  
  document.body.appendChild(button);
}

// Save paper and show notification
function savePaper(paper) {
  chrome.runtime.sendMessage(
    { action: 'savePaper', paper },
    response => {
      if (response && response.success) {
        showSuccessNotification();
      }
    }
  );
}

// Show save notification
function showSaveNotification(paper) {
  const notification = document.createElement('div');
  notification.className = 'research-tracker-notification';
  notification.innerHTML = `
    <div class="notification-content">
      <h4>Save this paper?</h4>
      <p class="paper-title">${paper.title || 'Untitled Paper'}</p>
      <div class="notification-buttons">
        <button class="btn-save">Save</button>
        <button class="btn-cancel">Cancel</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  notification.querySelector('.btn-save').addEventListener('click', () => {
    savePaper(paper);
    notification.remove();
  });
  
  notification.querySelector('.btn-cancel').addEventListener('click', () => {
    notification.remove();
  });
  
  setTimeout(() => {
    notification.remove();
  }, 10000);
}

// Show success notification
function showSuccessNotification() {
  const notification = document.createElement('div');
  notification.className = 'research-tracker-notification success';
  notification.innerHTML = `
    <div class="notification-content">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
      <span>Paper saved successfully!</span>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}
