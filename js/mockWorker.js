/* Mock Background Worker & Scanning Engine */
import { store } from './state.js';

class BackgroundWorkerEngine {
  constructor() {
    this.scanInterval = null;
  }

  // Simulates Headless IMAP OTP verification when adding a customer
  simulateHeadlessVerification(customerData, onProgress, onComplete) {
    let step = 0;
    const steps = [
      'Connecting to Gmail IMAP server...',
      'Verifying Amazon login credentials...',
      'Waiting for Amazon 2FA OTP code...',
      'Extracting OTP code (e.g. 481920)...',
      'Submitting OTP code to Amazon portal...',
      'Account Verified & Saved Successfully!'
    ];

    const timer = setInterval(() => {
      if (step < steps.length) {
        onProgress(steps[step]);
        step++;
      } else {
        clearInterval(timer);
        onComplete();
      }
    }, 900);
  }

  // Simulates the live Schedule ID Scanner from screenshot
  startScheduleScanner(config, onProgress, onComplete) {
    let currentId = config.startId;
    const totalIds = config.endId - config.startId + 1;
    let scanned = 0;
    let found = 0;
    let available = 0;
    const results = [];

    const mockLocations = ['Calgary, AB', 'Cambridge, ON', 'Acheson, AB', 'Toronto, ON', 'Brampton, ON'];
    const mockSchedules = [
      'Sat, Sun, Mon, Tue 6:00 p.m. - 4:30 a.m.',
      'Wed, Thu, Fri, Sat 7:00 a.m. - 5:30 p.m.',
      'Thu, Fri, Sat, Sun 6:00 p.m. - 4:30 a.m.',
      'Mon, Tue, Wed, Thu 7:00 a.m. - 5:30 p.m.'
    ];

    if (this.scanInterval) clearInterval(this.scanInterval);

    const delay = Math.max(500, config.delayMs || 2500);

    this.scanInterval = setInterval(() => {
      if (currentId <= config.endId) {
        scanned++;
        const schCode = `SCH-CA-00000${currentId}`;
        const isFound = Math.random() > 0.1;
        const availableSlots = isFound ? Math.floor(Math.random() * 8) : 0;

        if (isFound) found++;
        if (availableSlots > 0) available += availableSlots;

        const row = {
          schId: schCode,
          status: 'UNPOSTED',
          available: `${availableSlots} / ${availableSlots + Math.floor(Math.random() * 30 + 10)}`,
          availableVal: availableSlots,
          startDates: Math.floor(Math.random() * 8 + 1),
          location: mockLocations[Math.floor(Math.random() * mockLocations.length)],
          pay: '$23.10',
          schedule: mockSchedules[Math.floor(Math.random() * mockSchedules.length)],
          type: 'FULL TIME',
          hrsWk: 40,
          firstDay: '2026-08-01'
        };

        results.unshift(row);

        const progressPct = Math.round((scanned / totalIds) * 100);

        onProgress({
          currentId,
          scanned,
          found,
          available,
          totalIds,
          progressPct,
          results
        });

        currentId++;
      } else {
        clearInterval(this.scanInterval);
        this.scanInterval = null;
        onComplete(results);
      }
    }, Math.min(delay, 800)); // Accelerated for slick responsive UX
  }

  stopScheduleScanner() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
  }
}

export const workerEngine = new BackgroundWorkerEngine();
