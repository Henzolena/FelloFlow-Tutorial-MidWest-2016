// External assets configuration
// Move these files to CDN/external storage and update references

const externalAssets = {
  // Voiceover files - move to CDN
  voiceover: {
    base: 'https://cdn.yourdomain.com/fellowflow-tutorial/voiceover',
    files: [
      'intro.wav', 'form.wav', 'attendance.wav', 'kote.wav',
      'child.wav', 'infant.wav', 'checkout.wav', 'badges.wav', 'meals.wav'
    ]
  },
  
  // Badge images - keep in repo (small enough)
  badges: {
    base: '/Email-Badg-and-Other',
    files: ['email-1.jpeg', 'email-2.jpeg', 'email-3.jpeg', 'confirmation.png']
  }
};

// Function to get external URL
function getVoiceoverUrl(phaseId) {
  return `${externalAssets.voiceover.base}/voiceover-${phaseId}.wav`;
}

// Function to get badge URL
function getBadgeUrl(filename) {
  return `${externalAssets.badges.base}/${filename}`;
}

module.exports = { externalAssets, getVoiceoverUrl, getBadgeUrl };
