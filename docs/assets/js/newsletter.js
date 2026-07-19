class Newsletter {
  constructor() {
    this.newsletterData = null;
    this.loadNewsletter();
  }

  async loadNewsletter() {
    try {
      const response = await fetch('/Ramazing/assets/newsletter.json');
      this.newsletterData = await response.json();
      this.renderLatestUpdate();
    } catch (error) {
      console.error('Error loading newsletter:', error);
    }
  }

  renderLatestUpdate() {
    if (!this.newsletterData || !this.newsletterData.updates || this.newsletterData.updates.length === 0) {
      return;
    }

    const latestUpdate = this.newsletterData.updates[0];
    const updateBox = document.getElementById('latest-update-box');
    
    if (updateBox) {
      updateBox.innerHTML = `
        <div class="update-card" style="${latestUpdate.important ? 'border: 2px solid #ff6b6b;' : ''}">
          <h3>${latestUpdate.title}</h3>
          <p class="update-date">📅 ${new Date(latestUpdate.date).toLocaleDateString()}</p>
          <p>${latestUpdate.content}</p>
          <a href="shadow://newsletter" style="color: #007BFF; text-decoration: none; font-weight: bold;">View all updates →</a>
        </div>
      `;
    }
  }

  displayFullNewsletter() {
    const container = document.getElementById('newsletter-content');
    if (!container || !this.newsletterData) return;

    let html = `
      <div class="newsletter-header">
        <h1>${this.newsletterData.announcements.title}</h1>
        <p class="announcement-content">${this.newsletterData.announcements.content}</p>
      </div>

      <div class="newsletter-updates">
        <h2>📰 Recent Updates</h2>
    `;

    if (this.newsletterData.updates && this.newsletterData.updates.length > 0) {
      this.newsletterData.updates.forEach((update, index) => {
        html += `
          <div class="update-item" style="${update.important ? 'background-color: #fff3cd; border-left: 4px solid #ff6b6b;' : ''}">
            <h3>${update.title}</h3>
            <p class="update-meta">
              <span class="date">📅 ${new Date(update.date).toLocaleDateString()}</span>
              ${update.important ? '<span class="badge">⭐ Important</span>' : ''}
            </p>
            <p>${update.content}</p>
          </div>
        `;
      });
    } else {
      html += '<p>No updates available yet.</p>';
    }

    html += '</div>';
    container.innerHTML = html;
  }
}

// Initialize newsletter
const newsletter = new Newsletter();
