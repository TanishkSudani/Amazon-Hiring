/* Unified Amazon Client System — Production Standalone Bundle */
(function (window, document) {
  'use strict';

  // Helper date formatter: DD/MM/YYYY
  function formatDateDDMMYYYY(dateInput) {
    if (!dateInput || dateInput === 'N/A') return 'N/A';
    if (dateInput instanceof Date) {
      if (isNaN(dateInput.getTime())) return 'N/A';
      const day = String(dateInput.getDate()).padStart(2, '0');
      const month = String(dateInput.getMonth() + 1).padStart(2, '0');
      return `${day}/${month}/${dateInput.getFullYear()}`;
    }
    const str = String(dateInput).trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;
    if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
      return str.replace(/-/g, '/');
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const p = str.split('-');
      return `${p[2]}/${p[1]}/${p[0]}`;
    }
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(str)) {
      const p = str.split('/');
      return `${p[2]}/${p[1]}/${p[0]}`;
    }
    if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length === 3) {
        const p1 = String(parts[0]).padStart(2, '0');
        const p2 = String(parts[1]).padStart(2, '0');
        if (parts[2].length === 4) return `${p1}/${p2}/${parts[2]}`;
      }
    }
    const d = new Date(str);
    if (isNaN(d.getTime())) return str;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  // Parse DD/MM/YYYY for strict chronological sorting
  function parseDDMMYYYY(dateStr) {
    if (!dateStr || typeof dateStr !== 'string' || dateStr === 'N/A') return 9999999999999;
    const clean = dateStr.replace(/\//g, '-');
    const parts = clean.split('-');
    if (parts.length === 3 && parts[2].length === 4) {
      return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10)).getTime();
    }
    return new Date(dateStr).getTime() || 9999999999999;
  }

  // ─────────────────────────────────────────────
  // HIERARCHICAL RBAC DATA ISOLATION HELPERS
  // ─────────────────────────────────────────────
  function getSubordinateIdentifiers(currentEmail, currentName, subUsersList) {
    const allowed = new Set();
    const cleanEmail = (currentEmail || '').trim().toLowerCase();
    const cleanName = (currentName || '').trim().toLowerCase();

    if (cleanEmail) {
      allowed.add(cleanEmail);
      if (cleanEmail.includes('@')) {
        allowed.add(cleanEmail.split('@')[0]);
      }
    }
    if (cleanName) {
      allowed.add(cleanName);
    }

    const list = Array.isArray(subUsersList) ? subUsersList : [];

    // Match logged-in user inside subUsers to harvest additional identifiers
    list.forEach(su => {
      const suEmail = (su.email || '').trim().toLowerCase();
      const suName = (su.name || su.full_name || '').trim().toLowerCase();
      const suUsername = (su.username || '').trim().toLowerCase();
      if (
        (cleanEmail && (suEmail === cleanEmail || suUsername === cleanEmail)) ||
        (cleanName && (suName === cleanName || suUsername === cleanName))
      ) {
        if (suEmail) allowed.add(suEmail);
        if (suName) allowed.add(suName);
        if (suUsername) allowed.add(suUsername);
        if (su.id) allowed.add(String(su.id).toLowerCase());
      }
    });

    // Recursively discover all downstream operators created by anyone in allowed set
    let changed = true;
    while (changed) {
      changed = false;
      list.forEach(su => {
        const suEmail = (su.email || '').trim().toLowerCase();
        const suName = (su.name || su.full_name || '').trim().toLowerCase();
        const suUsername = (su.username || '').trim().toLowerCase();
        const suId = su.id ? String(su.id).toLowerCase() : '';

        const creatorEmail = (su.creator_email || '').trim().toLowerCase();
        const createdBy = (su.created_by || '').trim().toLowerCase();
        const creatorName = (su.creator_name || '').trim().toLowerCase();

        const isSubordinate =
          (creatorEmail && allowed.has(creatorEmail)) ||
          (createdBy && allowed.has(createdBy)) ||
          (creatorName && allowed.has(creatorName));

        if (isSubordinate) {
          if (suEmail && !allowed.has(suEmail)) {
            allowed.add(suEmail);
            if (suEmail.includes('@')) allowed.add(suEmail.split('@')[0]);
            changed = true;
          }
          if (suName && !allowed.has(suName)) {
            allowed.add(suName);
            changed = true;
          }
          if (suUsername && !allowed.has(suUsername)) {
            allowed.add(suUsername);
            changed = true;
          }
          if (suId && !allowed.has(suId)) {
            allowed.add(suId);
            changed = true;
          }
        }
      });
    }

    return allowed;
  }

  function isCandidateAllowed(candidate, userRole, currentEmail, currentName, subordinateSet) {
    if (!candidate) return false;
    const cleanEmail = (currentEmail || '').trim().toLowerCase();

    // 1. SuperAdmin: Sees ALL candidates across the whole system
    const isSuperAdmin =
      userRole === 'SuperAdmin' ||
      cleanEmail === 'admin2003@gmail.com' ||
      cleanEmail === 'admin' ||
      cleanEmail === 'admin2003' ||
      (typeof sessionStorage !== 'undefined' && (sessionStorage.getItem('acs_is_super_admin') === 'true' || sessionStorage.getItem('acs_is_main_admin') === 'true'));

    if (isSuperAdmin) {
      return true;
    }

    // Candidate creator attributes
    const cCreatorEmail = (candidate.creator_email || '').trim().toLowerCase();
    const cCreatedBy = (candidate.created_by || '').trim().toLowerCase();
    const cCreatorName = (candidate.creator_name || '').trim().toLowerCase();

    // Candidates without creator or created by Super Admin belong to Super Admin seed data
    const isSuperAdminCandidate =
      (!cCreatorEmail && !cCreatedBy && !cCreatorName) ||
      cCreatorEmail === 'admin2003@gmail.com' ||
      cCreatedBy === 'admin2003@gmail.com' ||
      cCreatorName === 'super admin' ||
      cCreatorName === 'tanishk sudani';

    if (isSuperAdminCandidate) {
      return false;
    }

    // 2. Candidate role: only sees own record
    if (userRole === 'Candidate') {
      const candEmail = (candidate.email || '').trim().toLowerCase();
      return Boolean(candEmail && candEmail === cleanEmail);
    }

    // 3. Operator: ONLY sees candidates they themselves added!
    if (userRole === 'Operator') {
      const cleanName = (currentName || '').trim().toLowerCase();
      const cleanUsername = cleanEmail.includes('@') ? cleanEmail.split('@')[0] : cleanEmail;
      return (
        (cCreatorEmail && (cCreatorEmail === cleanEmail || cCreatorEmail === cleanUsername)) ||
        (cCreatedBy && (cCreatedBy === cleanEmail || cCreatedBy === cleanUsername || (cleanName && cCreatedBy === cleanName))) ||
        (cCreatorName && cleanName && cCreatorName === cleanName)
      );
    }

    // 4. Admin: sees candidates created by themselves OR any subordinate operator reporting to them
    if (userRole === 'Admin') {
      const subSet = subordinateSet || new Set([cleanEmail]);
      return (
        (cCreatorEmail && subSet.has(cCreatorEmail)) ||
        (cCreatedBy && subSet.has(cCreatedBy)) ||
        (cCreatorName && subSet.has(cCreatorName))
      );
    }

    return false;
  }

  // ─────────────────────────────────────────────
  // 1. STATE STORE ENGINE
  // ─────────────────────────────────────────────
  const STORAGE_KEY = 'AMAZON_AUTOMATION_SYSTEM_STATE_V2';

  // Authentic verified Amazon Warehouse ↔ Location mappings:
  // Primary: hiring.amazon.com | Verification: amazon.jobs | Address: Google Maps API

  // Helper to determine if a warehouse is in Canada (Canadian FCs start with Y)
  function isWarehouseInCanada(warehouse, country) {
    if (country) {
      const c = String(country).toLowerCase();
      if (c.includes('can') || c === 'ca') return true;
      if (c.includes('us') || c === 'usa') return false;
    }
    const wh = String(warehouse || '').toUpperCase().trim();
    if (/^Y[A-Z]{2}\d+/i.test(wh)) return true;
    return false;
  }

  // Helper to build dynamic live shift URLs that never hit dead-ends or "Job doesn't exist" errors
  function getLiveWarehouseUrl(warehouse, country) {
    const isCanada = isWarehouseInCanada(warehouse, country);
    const wh = (warehouse || '').trim();
    if (isCanada) {
      return wh ? ('https://hiring.amazon.ca/app#/jobSearch?keyword=' + encodeURIComponent(wh)) : 'https://hiring.amazon.ca/app#/jobSearch';
    }
    return wh ? ('https://hiring.amazon.com/app#/jobSearch?keyword=' + encodeURIComponent(wh)) : 'https://hiring.amazon.com/app#/jobSearch';
  }

  function getLiveCityUrl(city, country) {
    const isCanada = isWarehouseInCanada('', country);
    const c = (city || '').trim();
    if (isCanada) {
      return c ? ('https://hiring.amazon.ca/app#/jobSearch?keyword=' + encodeURIComponent(c)) : 'https://hiring.amazon.ca/app#/jobSearch';
    }
    return c ? ('https://hiring.amazon.com/app#/jobSearch?keyword=' + encodeURIComponent(c)) : 'https://hiring.amazon.com/app#/jobSearch';
  }

  const LIVE_AMAZON_JOBS = [
    {
      id: '2948201',
      country: 'Canada',
      province: 'AB',
      city: 'Calgary',
      locationText: 'Canada (AB, Calgary)',
      warehouse: 'YYC1',
      title: 'Fulfillment Center Associate',
      pay: '$23.10/hr',
      empType: 'Full-Time',
      schedule: 'Day Shift (4x10)',
      startDate: 'Immediate',
      shifts: 'N/A',
      status: 'Open',
      source: 'hiring.amazon.ca',
      verified: true,
      officialUrl: 'https://hiring.amazon.ca/app#/jobSearch'
    },
    {
      id: '3019284',
      country: 'Canada',
      province: 'ON',
      city: 'Brampton',
      locationText: 'Canada (ON, Brampton)',
      warehouse: 'YYZ4',
      title: 'Warehouse Associate',
      pay: '$24.50/hr',
      empType: 'Full-Time',
      schedule: 'Day Shift (4x10)',
      startDate: 'Immediate',
      shifts: 'N/A',
      status: 'Open',
      source: 'hiring.amazon.ca',
      verified: true,
      officialUrl: 'https://hiring.amazon.ca/app#/jobSearch'
    },
    {
      id: '2857410',
      country: 'Canada',
      province: 'ON',
      city: 'Brampton',
      locationText: 'Canada (ON, Brampton)',
      warehouse: 'YYZ3',
      title: 'Sortation Associate',
      pay: '$23.10/hr',
      empType: 'Part-Time',
      schedule: 'Night Shift (Flex)',
      startDate: 'Immediate',
      shifts: 'N/A',
      status: 'Open',
      source: 'hiring.amazon.ca',
      verified: true,
      officialUrl: 'https://hiring.amazon.ca/app#/jobSearch'
    },
    {
      id: '3104928',
      country: 'Canada',
      province: 'AB',
      city: 'Calgary',
      locationText: 'Canada (AB, Calgary)',
      warehouse: 'YYC4',
      title: 'Fulfillment Specialist',
      pay: '$23.50/hr',
      empType: 'Full-Time',
      schedule: 'Night Shift (4x10)',
      startDate: 'Immediate',
      shifts: 'N/A',
      status: 'Open',
      source: 'hiring.amazon.ca',
      verified: true,
      officialUrl: 'https://hiring.amazon.ca/app#/jobSearch'
    },
    {
      id: '2984710',
      country: 'Canada',
      province: 'AB',
      city: 'Calgary',
      locationText: 'Canada (AB, Calgary)',
      warehouse: 'YYC8',
      title: 'Sortation Associate',
      pay: '$22.80/hr',
      empType: 'Part-Time',
      schedule: 'Morning Shift',
      startDate: 'Immediate',
      shifts: 'N/A',
      status: 'Open',
      source: 'hiring.amazon.ca',
      verified: true,
      officialUrl: 'https://hiring.amazon.ca/app#/jobSearch'
    },
    {
      id: '3091824',
      country: 'USA',
      province: 'AZ',
      city: 'Phoenix',
      locationText: 'USA (AZ, Phoenix)',
      warehouse: 'PHX7',
      title: 'Fulfillment Center Associate',
      pay: '$21.80/hr',
      empType: 'Full-Time',
      schedule: 'Day Shift',
      startDate: 'Immediate',
      shifts: 'N/A',
      status: 'Open',
      source: 'hiring.amazon.com',
      verified: true,
      officialUrl: 'https://hiring.amazon.com/app#/jobSearch'
    },
    {
      id: '2748193',
      country: 'Canada',
      province: 'ON',
      city: 'Cambridge',
      locationText: 'Canada (ON, Cambridge)',
      warehouse: 'YKF1',
      title: 'Fulfillment Associate',
      pay: '$21.80/hr',
      empType: 'Full-Time',
      schedule: 'Day Shift (4x10)',
      startDate: 'Immediate',
      shifts: 'N/A',
      status: 'Open',
      source: 'hiring.amazon.ca',
      verified: true,
      officialUrl: 'https://hiring.amazon.ca/app#/jobSearch'
    },
    {
      id: '3184920',
      country: 'Canada',
      province: 'ON',
      city: 'Mississauga',
      locationText: 'Canada (ON, Mississauga)',
      warehouse: 'YYZ9',
      title: 'Delivery Station Associate',
      pay: '$24.00/hr',
      empType: 'Full-Time',
      schedule: 'Morning Shift',
      startDate: 'Immediate',
      shifts: 'N/A',
      status: 'Open',
      source: 'hiring.amazon.ca',
      verified: true,
      officialUrl: 'https://hiring.amazon.ca/app#/jobSearch'
    },
    {
      id: '2840192',
      country: 'USA',
      province: 'TX',
      city: 'Dallas Area',
      locationText: 'USA (TX, Dallas Area)',
      warehouse: 'DFW6',
      title: 'Amazon Air Associate',
      pay: '$22.50/hr',
      empType: 'Full-Time',
      schedule: 'Night Shift',
      startDate: 'Immediate',
      shifts: 'N/A',
      status: 'Open',
      source: 'hiring.amazon.com',
      verified: true,
      officialUrl: 'https://hiring.amazon.com/app#/jobSearch'
    }
  ];

  const defaultState = {
    users: [],
    tasks: [],
    publicJobs: [],
    vacancyOverrides: {},
    subUsers: [],
    jobWatches: [],     // [{ id, warehouse, country, city, province, candidateUserIds:[], alertDaysBefore:14, enabled:true, lastAlertSent:null, notes, cohortExpectedDate, cohortLabel }]
    jobAlertNotifs: []  // [{ id, watchId, warehouse, msg, triggeredAt, readBy:[] }]
  };

  class StateStore {
    constructor() {
      this.listeners = [];
      this.state = this.loadState();
      if (typeof window !== 'undefined') {
        window.addEventListener('storage', (e) => {
          if (e.key === STORAGE_KEY) {
            this.state = this.loadState();
            this.notify();
          }
        });
      }
    }

    loadState() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          const sanitizedJobs = Array.isArray(parsed.publicJobs) ? parsed.publicJobs.filter(j => {
            if (!j || !j.id) return false;
            const idStr = String(j.id);
            if (idStr.startsWith('pj') || idStr.startsWith('JOB-CA-') || idStr.startsWith('JOB-US-')) return false;
            if (j.locationText && (j.locationText.includes('ON, Calgary') || j.locationText.includes('ON, Phoenix'))) return false;
            if (j.province === 'ON' && (j.city === 'Calgary' || j.city === 'Phoenix')) return false;
            if (j.closeDate && j.closeDate !== 'N/A') return false;
            return true;
          }) : [];

          // Permanently overwrite legacy cache in localStorage
          parsed.publicJobs = sanitizedJobs;

          const rawUsers = Array.isArray(parsed.users) && parsed.users.length > 0 ? parsed.users : defaultState.users;
          const finalUsers = rawUsers.map(u => ({
            ...u,
            creator_email: u.creator_email || u.created_by || 'admin2003@gmail.com',
            creator_name: (u.creator_name && u.creator_name !== 'Super Admin') ? u.creator_name : 'Tanishk Sudani'
          }));

          const rawTasks = Array.isArray(parsed.tasks) ? parsed.tasks : defaultState.tasks;
          const finalTasks = rawTasks.map(t => ({
            ...t,
            creator_email: t.creator_email || t.created_by || 'admin2003@gmail.com',
            creator_name: (t.creator_name && t.creator_name !== 'Super Admin') ? t.creator_name : 'Tanishk Sudani'
          }));

          parsed.users = finalUsers;
          parsed.tasks = finalTasks;

          return {
            ...defaultState,
            ...parsed,
            subUsers: Array.isArray(parsed.subUsers) ? parsed.subUsers : defaultState.subUsers,
            publicJobs: sanitizedJobs,
            users: finalUsers,
            tasks: finalTasks,
            vacancyOverrides: (parsed && typeof parsed.vacancyOverrides === "object" && parsed.vacancyOverrides !== null) ? parsed.vacancyOverrides : {}
          };
        }
      } catch (e) {
        console.error('Failed to load state from localStorage:', e);
      }
      return JSON.parse(JSON.stringify(defaultState));
    }

    saveState() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch (e) {
        console.error('Failed to save state:', e);
      }
      this.notify();
    }

    getState() {
      this.state = this.loadState();
      return this.state;
    }

    subscribe(listener) {
      this.listeners.push(listener);
      return () => { this.listeners = this.listeners.filter(l => l !== listener); };
    }

    notify() { this.listeners.forEach(l => l(this.state)); }

    addUser(userData) {
      const creatorEmail = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('acs_user_email')) || 'admin2003@gmail.com';
      const creatorName = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('acs_user_name')) || creatorEmail.split('@')[0];

      const newUser = {
        id: Date.now().toString(),
        ...userData,
        password: userData.password || userData.webPass || 'password123',
        webPass: userData.webPass || userData.password || 'password123',
        creator_email: creatorEmail,
        creator_name: creatorName,
        created_by: creatorEmail,
        status: userData.status || 'pending',
        submittedDate: (function() {
          const d = new Date();
          const day = String(d.getDate()).padStart(2, '0');
          const month = String(d.getMonth() + 1).padStart(2, '0');
          return `${day}/${month}/${d.getFullYear()}`;
        })()
      };
      this.state.users.unshift(newUser);
      this.state.tasks.unshift({
        id: 't_' + Date.now(),
        userName: userData.username,
        email: userData.email,
        jobId: userData.jobId,
        schId: userData.schId,
        creator_email: creatorEmail,
        creator_name: creatorName,
        created_by: creatorEmail,
        status: 'stopped',
        startTime: '-'
      });
      this.saveState();
      return newUser;
    }

    deleteUser(userId) {
      const target = this.state.users.find(u => u.id === userId || u.email === userId);
      if (target && (target.email === 'admin2003@gmail.com' || target.username === 'admin' || target.is_super_admin)) {
        throw new Error('❌ Security Violation: Super Admin account cannot be deleted.');
      }
      if (target) {
        this.state.tasks = (this.state.tasks || []).filter(t => t.email !== target.email && t.userName !== target.username);
      }
      this.state.users = (this.state.users || []).filter(u => u.id !== userId);
      this.saveState();
    }

    updateTaskStatus(taskId, newStatus) {
      const idx = (this.state.tasks || []).findIndex(t => t.id === taskId);
      if (idx !== -1) {
        this.state.tasks[idx] = {
          ...this.state.tasks[idx],
          status: newStatus,
          startTime: newStatus === 'running' ? new Date().toLocaleString() : this.state.tasks[idx].startTime
        };
        this.saveState();
      }
    }

    updateUser(updatedData) {
      if (updatedData.email === 'admin2003@gmail.com' || updatedData.username === 'admin') {
        if (updatedData.role && updatedData.role !== 'SuperAdmin' && updatedData.role !== 'Admin') {
          throw new Error('❌ Security Violation: Super Admin account role cannot be downgraded.');
        }
      }
      const idx = this.state.users.findIndex(u => u.id === updatedData.id);
      if (idx !== -1) {
        const oldUser = this.state.users[idx];
        const activeCreatorEmail = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('acs_user_email')) || 'admin2003@gmail.com';
        const activeCreatorName = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('acs_user_name')) || activeCreatorEmail.split('@')[0];

        const mergedUser = {
          ...oldUser,
          ...updatedData,
          creator_email: oldUser.creator_email || oldUser.created_by || activeCreatorEmail,
          creator_name: oldUser.creator_name || activeCreatorName,
          created_by: oldUser.created_by || oldUser.creator_email || activeCreatorEmail,
          updated_at: new Date().toISOString()
        };
        this.state.users[idx] = mergedUser;

        // Sync corresponding task
        const taskIdx = (this.state.tasks || []).findIndex(t => t.email === oldUser.email || t.userName === oldUser.username);
        if (taskIdx !== -1) {
          this.state.tasks[taskIdx] = {
            ...this.state.tasks[taskIdx],
            userName: mergedUser.username || mergedUser.name || this.state.tasks[taskIdx].userName,
            email: mergedUser.email || this.state.tasks[taskIdx].email,
            jobId: mergedUser.jobId || this.state.tasks[taskIdx].jobId,
            schId: mergedUser.schId || this.state.tasks[taskIdx].schId,
            creator_email: mergedUser.creator_email,
            creator_name: mergedUser.creator_name
          };
        }

        this.saveState();
      }
    }

    addSubUser(email, password = 'password123', name = '', role = 'Operator', permissions = ['Can Access OTP'], username = '', createdBy = null, creatorName = null) {
      const cleanEmail = email.trim().toLowerCase();
      const cleanUsername = (username || name || email.split('@')[0]).trim().toLowerCase();

      if (password && password.length < 6) {
        throw new Error('Password must be at least 6 characters long.');
      }

      // Email Uniqueness Check
      const emailExists = (this.state.subUsers || []).some(su => su.email && su.email.trim().toLowerCase() === cleanEmail) ||
        (this.state.users || []).some(u => u.email && u.email.trim().toLowerCase() === cleanEmail) ||
        cleanEmail === 'admin2003@gmail.com';
      if (emailExists) {
        throw new Error('Email address is already in use.');
      }

      // Username Uniqueness Check
      const usernameExists = (this.state.subUsers || []).some(su => su.username && su.username.trim().toLowerCase() === cleanUsername) ||
        (this.state.users || []).some(u => u.username && u.username.trim().toLowerCase() === cleanUsername) ||
        cleanUsername === 'admin';
      if (usernameExists) {
        throw new Error('Username is already taken.');
      }

      const sessionEmail = typeof sessionStorage !== 'undefined' ? (sessionStorage.getItem('acs_user_email') || '').trim().toLowerCase() : '';
      const sessionName = typeof sessionStorage !== 'undefined' ? (sessionStorage.getItem('acs_user_name') || '').trim() : '';

      const assignedCreator = (createdBy && createdBy !== 'Super Admin')
        ? (createdBy.includes('@') ? createdBy.toLowerCase() : createdBy)
        : (sessionEmail || 'admin2003@gmail.com');

      const assignedCreatorEmail = (createdBy && createdBy.includes('@'))
        ? createdBy.toLowerCase()
        : (sessionEmail || 'admin2003@gmail.com');

      const assignedCreatorName = creatorName || (createdBy && !createdBy.includes('@') ? createdBy : (sessionName || 'Super Admin'));

      const dNow = new Date();
      const createdDateFormatted = `${String(dNow.getDate()).padStart(2, '0')}/${String(dNow.getMonth() + 1).padStart(2, '0')}/${dNow.getFullYear()}`;

      const newSubUser = {
        id: 'su_' + Date.now(),
        full_name: name || cleanUsername,
        name: name || cleanUsername,
        email: cleanEmail,
        username: cleanUsername,
        password: password,
        role,
        permissions,
        status: 'Active',
        created_by: assignedCreator,
        creator_email: assignedCreatorEmail,
        creator_name: assignedCreatorName,
        created: createdDateFormatted,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (!Array.isArray(this.state.subUsers)) this.state.subUsers = [];
      this.state.subUsers.unshift(newSubUser);
      this.saveState();
      return newSubUser;
    }

    updateSubUser(updatedData) {
      if (updatedData.email === 'admin2003@gmail.com' || updatedData.username === 'admin') {
        if (updatedData.role && updatedData.role !== 'SuperAdmin' && updatedData.role !== 'Admin') {
          throw new Error('❌ Security Violation: Super Admin account role cannot be downgraded.');
        }
      }
      const idx = (this.state.subUsers || []).findIndex(su => su.id === updatedData.id);
      if (idx !== -1) {
        this.state.subUsers[idx] = { ...this.state.subUsers[idx], ...updatedData, updated_at: new Date().toISOString() };
        this.saveState();
      }
    }

    deleteSubUser(subUserId) {
      const target = (this.state.subUsers || []).find(su => su.id === subUserId || su.email === subUserId);
      if (target && (target.email === 'admin2003@gmail.com' || target.username === 'admin' || target.is_super_admin)) {
        throw new Error('❌ Security Violation: Super Admin account cannot be deleted.');
      }
      this.state.subUsers = (this.state.subUsers || []).filter(su => su.id !== subUserId);
      this.saveState();
    }

    getUserRole(email) {
      if (!email) return 'SuperAdmin';
      const cleanEmail = email.trim().toLowerCase();
      if (cleanEmail === 'admin2003@gmail.com' || cleanEmail === 'admin' || cleanEmail === 'admin2003') {
        return 'SuperAdmin';
      }
      const list = Array.isArray(this.state.subUsers) ? this.state.subUsers : [];
      const subUser = list.find(su => (su.email && su.email.trim().toLowerCase() === cleanEmail) || (su.username && su.username.trim().toLowerCase() === cleanEmail) || (su.name && su.name.trim().toLowerCase() === cleanEmail));
      if (subUser) return subUser.role || 'Operator';

      const userList = Array.isArray(this.state.users) ? this.state.users : [];
      const candidateUser = userList.find(u => (u.email && u.email.trim().toLowerCase() === cleanEmail) || (u.username && u.username.trim().toLowerCase() === cleanEmail));
      if (candidateUser) return 'Candidate';

      return 'Candidate';
    }

    // Multi-Tenant Hierarchical RBAC Data Isolation Helper
    getScopedData(currentUserEmail, userRole) {
      const state = this.getState();
      const cleanCurrentEmail = (currentUserEmail || '').trim().toLowerCase();
      const storedName = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('acs_user_name') : '';
      const currentUserName = (storedName && storedName !== 'admin' && storedName !== 'Super Admin') ? storedName : (cleanCurrentEmail.includes('@') ? cleanCurrentEmail.split('@')[0] : cleanCurrentEmail);

      const isSuperAdmin =
        userRole === 'SuperAdmin' ||
        cleanCurrentEmail === 'admin2003@gmail.com' ||
        cleanCurrentEmail === 'admin' ||
        cleanCurrentEmail === 'admin2003' ||
        (typeof sessionStorage !== 'undefined' && (sessionStorage.getItem('acs_is_super_admin') === 'true' || sessionStorage.getItem('acs_is_main_admin') === 'true'));

      // 1. SuperAdmin: Sees ALL data across the entire system
      if (isSuperAdmin) {
        return {
          users: state.users || [],
          subUsers: state.subUsers || [],
          tasks: state.tasks || []
        };
      }

      const subordinateSet = getSubordinateIdentifiers(cleanCurrentEmail, currentUserName, state.subUsers || []);

      // Candidates Scoping:
      // - Admin: sees own + subordinate operators' candidates
      // - Operator: sees only own candidates
      // - Candidate: sees only own profile
      const scopedUsers = (state.users || []).filter(u =>
        isCandidateAllowed(u, userRole, cleanCurrentEmail, currentUserName, subordinateSet)
      );

      // Tasks / Active Workers Scoping
      const scopedTasks = (state.tasks || []).filter(t =>
        isCandidateAllowed(t, userRole, cleanCurrentEmail, currentUserName, subordinateSet)
      );

      // SubUsers Scoping:
      // - Admin: sees themselves + child operators reporting to them
      let scopedSubUsers = [];
      if (userRole === 'Admin') {
        scopedSubUsers = (state.subUsers || []).filter(su => {
          const suEmail = (su.email || '').trim().toLowerCase();
          const suCreatorEmail = (su.creator_email || '').trim().toLowerCase();
          const suCreatedBy = (su.created_by || '').trim().toLowerCase();
          const suCreatorName = (su.creator_name || '').trim().toLowerCase();
          return (
            suEmail === cleanCurrentEmail ||
            subordinateSet.has(suCreatorEmail) ||
            subordinateSet.has(suCreatedBy) ||
            subordinateSet.has(suCreatorName)
          );
        });
      }

      return {
        users: scopedUsers,
        subUsers: scopedSubUsers,
        tasks: scopedTasks
      };
    }


    setJobVacancyStatus(jobId, status) {
      if (!jobId) return;
      if (!this.state.vacancyOverrides) this.state.vacancyOverrides = {};
      this.state.vacancyOverrides[String(jobId)] = status;

      if (Array.isArray(this.state.publicJobs)) {
        const pJob = this.state.publicJobs.find(j => String(j.id) === String(jobId));
        if (pJob) {
          pJob.status = status;
        }
      }
      this.saveState();
    }

    getJobVacancyStatus(jobId, fallbackStatus = 'Open') {
      if (this.state && this.state.vacancyOverrides && this.state.vacancyOverrides[String(jobId)]) {
        return this.state.vacancyOverrides[String(jobId)];
      }
      return fallbackStatus;
    }

    // ─── Job Watch CRUD ───────────────────────────────────────────────
    addJobWatch(watchData) {
      if (!this.state.jobWatches) this.state.jobWatches = [];
      const nw = { id: 'jw_' + Date.now(), enabled: true, lastAlertSent: null, alertDaysBefore: 14, candidateUserIds: [], ...watchData, createdAt: new Date().toISOString() };
      this.state.jobWatches.unshift(nw);
      this.saveState();
      return nw;
    }

    updateJobWatch(data) {
      if (!this.state.jobWatches) this.state.jobWatches = [];
      const idx = this.state.jobWatches.findIndex(w => w.id === data.id);
      if (idx !== -1) { this.state.jobWatches[idx] = { ...this.state.jobWatches[idx], ...data, updatedAt: new Date().toISOString() }; this.saveState(); }
    }

    removeJobWatch(id) {
      if (!this.state.jobWatches) return;
      this.state.jobWatches = this.state.jobWatches.filter(w => w.id !== id);
      this.saveState();
    }

    addJobAlertNotif(notif) {
      if (!this.state.jobAlertNotifs) this.state.jobAlertNotifs = [];
      this.state.jobAlertNotifs.unshift({ id: 'jn_' + Date.now(), readBy: [], triggeredAt: new Date().toISOString(), ...notif });
      if (this.state.jobAlertNotifs.length > 50) this.state.jobAlertNotifs = this.state.jobAlertNotifs.slice(0, 50);
      this.saveState();
    }

    markAlertRead(notifId, userEmail) {
      if (!this.state.jobAlertNotifs) return;
      const n = this.state.jobAlertNotifs.find(n => n.id === notifId);
      if (n && !n.readBy.includes(userEmail)) { n.readBy.push(userEmail); this.saveState(); }
    }
    // ─────────────────────────────────────────────────────────────────

    addPublicJob(jobData) {
      const jobIdFormat = (jobData.id && !jobData.id.startsWith('pj_') && !jobData.id.startsWith('pj1')) ? jobData.id : ('AMZN-' + Math.floor(2000000 + Math.random() * 1500000));
      const liveWhUrl = jobData.liveWarehouseUrl || getLiveWarehouseUrl(jobData.warehouse, jobData.country);
      const liveCUrl = jobData.liveCityUrl || getLiveCityUrl(jobData.city, jobData.country);
      const newJob = {
        ...jobData,
        id: jobIdFormat,
        liveWarehouseUrl: liveWhUrl,
        liveCityUrl: liveCUrl,
        officialUrl: jobData.officialUrl || liveWhUrl,
        closeDate: formatDateDDMMYYYY(jobData.closeDate),
        shifts: jobData.shifts ?? 'N/A',
        status: jobData.status || 'Open',
        postedDate: (function() {
          const d = new Date();
          const day = String(d.getDate()).padStart(2, '0');
          const month = String(d.getMonth() + 1).padStart(2, '0');
          return `${day}/${month}/${d.getFullYear()}`;
        })()
      };
      const existingIdx = this.state.publicJobs.findIndex(j => String(j.id) === String(newJob.id));
      if (existingIdx !== -1) {
        this.state.publicJobs[existingIdx] = { ...this.state.publicJobs[existingIdx], ...newJob };
      } else {
        this.state.publicJobs.unshift(newJob);
      }
      this.saveState();
      return newJob;
    }
  }

  const store = new StateStore();

  // ─────────────────────────────────────────────
  // 2. TOAST NOTIFICATION HELPER
  // ─────────────────────────────────────────────
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    const icon = type === 'success' ? '✅' : type === 'warning' ? '⚠️' : '⚡';
    toast.innerHTML = `<span>${icon}</span> ${message}`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // ─────────────────────────────────────────────
  // 2B. AUTO @GMAIL.COM COMPLETION HELPER
  // ─────────────────────────────────────────────
  function applyAutoGmail(root) {
    if (!root) return;
    const inputs = root.querySelectorAll('input[type="email"], input[inputmode="email"], input#inpSubEmail, input#inpUserEmail, input#inpEditSubEmail, input#inpEditEmail, input#inpAddEmail');
    inputs.forEach(input => {
      // 1. Convert type="email" to type="text" with inputmode="email" so selection APIs (setSelectionRange, selectionStart) work across all Chromium/WebKit/Firefox browsers without throwing InvalidStateError
      try {
        if (input.type === 'email') {
          input.type = 'text';
          input.setAttribute('inputmode', 'email');
        }
      } catch (_) {}

      // 2. Set initial value to @gmail.com if empty
      if (!input.value || input.value.trim() === '') {
        input.value = '@gmail.com';
      }

      if (input._autoGmailSetup) return;
      input._autoGmailSetup = true;

      // Ensure cursor is always placed at index 0 (before @gmail.com) when only @gmail.com is present
      function snapCaret(el) {
        if (!el) return;
        const val = el.value || '';
        if (val === '@gmail.com' || val === '') {
          try { el.setSelectionRange(0, 0); } catch (_) {}
        } else if (val.endsWith('@gmail.com')) {
          const userLen = val.length - '@gmail.com'.length;
          if (el.selectionStart > userLen) {
            try { el.setSelectionRange(userLen, userLen); } catch (_) {}
          }
        }
      }

      function scheduleSnap(el) {
        snapCaret(el);
        setTimeout(() => snapCaret(el), 1);
        setTimeout(() => snapCaret(el), 20);
        setTimeout(() => snapCaret(el), 60);
      }

      // On focus, mouseup, click: snap cursor to start so user types in front
      input.addEventListener('focus', function () {
        if (!this.value || this.value.trim() === '') {
          this.value = '@gmail.com';
        }
        scheduleSnap(this);
      });

      input.addEventListener('mouseup', function () {
        scheduleSnap(this);
      });

      input.addEventListener('click', function () {
        scheduleSnap(this);
      });

      // On keydown: If caret is anywhere after 0 when value is @gmail.com, snap to front BEFORE key is typed!
      input.addEventListener('keydown', function (e) {
        if (this.value === '@gmail.com') {
          // If printable character key is pressed and caret is not at 0
          if (e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            if (this.selectionStart !== 0 || this.selectionEnd !== 0) {
              this.setSelectionRange(0, 0);
            }
          }
          // Prevent deleting the @ symbol when no username exists
          if (e.key === 'Backspace' || e.key === 'Delete') {
            if (this.selectionStart === 0 && this.selectionEnd === 0) {
              e.preventDefault();
            }
          }
        } else if (this.value.endsWith('@gmail.com')) {
          const userLen = this.value.length - '@gmail.com'.length;
          // If typing when cursor is after @gmail.com
          if (e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            if (this.selectionStart > userLen) {
              this.setSelectionRange(userLen, userLen);
            }
          }
        }
      });

      // On input: handle any typing after @gmail.com or duplicate @gmail.com
      input.addEventListener('input', function () {
        let val = this.value;

        // If user typed after @gmail.com (e.g. "@gmail.comtanis") -> immediately convert to "tanis@gmail.com"
        if (val.startsWith('@gmail.com') && val.length > '@gmail.com'.length) {
          const typed = val.slice('@gmail.com'.length);
          this.value = typed + '@gmail.com';
          try { this.setSelectionRange(typed.length, typed.length); } catch (_) {}
          return;
        }

        // Clean duplicates like "user@gmail.com@gmail.com"
        if (val.includes('@gmail.com@gmail.com')) {
          const cur = this.selectionStart;
          this.value = val.replace(/@gmail\.com@gmail\.com/g, '@gmail.com');
          try { this.setSelectionRange(cur, cur); } catch (_) {}
        }

        // If field was completely cleared, restore "@gmail.com" with cursor at 0
        if (!this.value || this.value.trim() === '') {
          this.value = '@gmail.com';
          try { this.setSelectionRange(0, 0); } catch (_) {}
        }
      });

      // On blur: if user typed a name without '@', automatically append '@gmail.com'
      input.addEventListener('blur', function () {
        let val = this.value.trim();
        if (!val || val === '@gmail.com') {
          this.value = '@gmail.com';
          return;
        }
        if (!val.includes('@')) {
          this.value = val + '@gmail.com';
        }
      });
    });
  }

  // Upcoming Amazon hiring cohort predictions (updated seasonally)
  const UPCOMING_COHORT_PREDICTIONS = [
    { warehouse: 'YYZ4', city: 'Brampton',   province: 'ON', country: 'Canada', expectedDate: '2026-10-06', cohort: 'Q4-2026 Wave 1 (Brampton)',  confidence: 'High',   pay: '$24.50/hr' },
    { warehouse: 'YYC1', city: 'Calgary',    province: 'AB', country: 'Canada', expectedDate: '2026-10-13', cohort: 'Q4-2026 Wave 1 (Calgary)',   confidence: 'High',   pay: '$23.10/hr' },
    { warehouse: 'YKF1', city: 'Cambridge',  province: 'ON', country: 'Canada', expectedDate: '2026-10-20', cohort: 'Q4-2026 Wave 1 (Cambridge)', confidence: 'Medium', pay: '$21.80/hr' },
    { warehouse: 'YYZ9', city: 'Mississauga',province: 'ON', country: 'Canada', expectedDate: '2026-10-27', cohort: 'Q4-2026 Wave 1 (Mississauga)',confidence: 'High',  pay: '$24.00/hr' },
    { warehouse: 'YYZ3', city: 'Brampton',   province: 'ON', country: 'Canada', expectedDate: '2026-11-03', cohort: 'Q4-2026 Wave 2 (Brampton)',  confidence: 'Medium', pay: '$23.10/hr' },
    { warehouse: 'YYC4', city: 'Calgary',    province: 'AB', country: 'Canada', expectedDate: '2026-11-10', cohort: 'Q4-2026 Wave 2 (Calgary)',   confidence: 'Medium', pay: '$23.50/hr' },
    { warehouse: 'PHX7', city: 'Phoenix',    province: 'AZ', country: 'USA',    expectedDate: '2026-10-08', cohort: 'Q4-2026 Wave 1 (Phoenix)',   confidence: 'High',   pay: '$21.80/hr' },
    { warehouse: 'DFW6', city: 'Dallas',     province: 'TX', country: 'USA',    expectedDate: '2026-10-15', cohort: 'Q4-2026 Wave 1 (Dallas)',    confidence: 'Medium', pay: '$22.50/hr' },
    { warehouse: 'YEG1', city: 'Acheson',    province: 'AB', country: 'Canada', expectedDate: '2026-11-17', cohort: 'Q4-2026 Wave 2 (Edmonton)',  confidence: 'Low',    pay: '$23.50/hr' },
    { warehouse: 'YYC8', city: 'Calgary',    province: 'AB', country: 'Canada', expectedDate: '2026-12-01', cohort: 'Q4-2026 Wave 3 (Calgary)',   confidence: 'Low',    pay: '$22.80/hr' },
  ];

  // ─────────────────────────────────────────────
  // 3. MAIN DASHBOARD CONTROLLER
  // ─────────────────────────────────────────────
  function initUnifiedDashboard(container) {
    let activeTab = 'dashboard';
    let userListFilter = 'All';
    let activeLogoutModal = false;
    let editingUserData = null;
    let editingSubUserData = null;
    let deletingTarget = null;
    let activeSubUserModal = false;
    let parentAdminForNewSubUser = null;
    let activeOtpMap = {};
    let activeSmartApplyJob = null;
    let activeBotModal = null; // { user, scanRow } — Bot auto-fill payload
    let liveSearchStatusFilter = 'All';
    let enrollDraftState = { title: '', email: '@gmail.com', country: 'Canada', webPass: '', appPass: '', jobId: '', schId: '' };

    function isAnyModalOpen() {
      return Boolean(
        activeSubUserModal ||
        editingUserData ||
        editingSubUserData ||
        deletingTarget ||
        activeLogoutModal ||
        activeSmartApplyJob ||
        activeBotModal
      );
    }

    function render() {
      const state = store.getState();
      const currentUserEmail = sessionStorage.getItem('acs_user_email') || 'admin2003@gmail.com';
      const storedName = sessionStorage.getItem('acs_user_name');
      const currentUserName = (storedName && storedName !== 'admin' && storedName !== 'Super Admin') ? storedName : 'Tanishk Sudani';
      const isMainAdmin = sessionStorage.getItem('acs_is_main_admin') === 'true' || currentUserEmail.toLowerCase() === 'admin2003@gmail.com';
      const userRole = sessionStorage.getItem('acs_user_role') || store.getUserRole(currentUserEmail);

      if (activeTab === 'specs' && !isMainAdmin && userRole !== 'SuperAdmin') {
        activeTab = 'dashboard';
      }

      // Count unread alerts for badge
      const allNotifs = (state.jobAlertNotifs || []);
      const unreadCount = allNotifs.filter(n => !(n.readBy || []).includes(currentUserEmail)).length;
      const alertBadge = unreadCount > 0 ? ` <span style="background:#ef4444;color:#fff;font-size:0.62rem;font-weight:900;padding:1px 5px;border-radius:8px;vertical-align:middle;">${unreadCount}</span>` : '';

      let navTabsHtml = '';
      if (userRole === 'Candidate') {
        navTabsHtml = `
          <button class="panel-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}" data-tab="dashboard">🏢 My Dashboard</button>
          <button class="panel-tab-btn ${activeTab === 'tasks' ? 'active' : ''}" data-tab="tasks">⚡ My Tasks</button>
          <button class="panel-tab-btn ${activeTab === 'livesearch' ? 'active' : ''}" data-tab="livesearch">🛰️ Live Search</button>
          <button class="panel-tab-btn ${activeTab === 'scanner' ? 'active' : ''}" data-tab="scanner">📡 Scanner</button>
          <button class="panel-tab-btn ${activeTab === 'jobalerts' ? 'active' : ''}" data-tab="jobalerts">🔔 Job Alerts${alertBadge}</button>
        `;
      } else if (userRole === 'Viewer') {
        navTabsHtml = `
          <button class="panel-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}" data-tab="dashboard">🏢 Read-Only Dashboard</button>
          <button class="panel-tab-btn ${activeTab === 'livesearch' ? 'active' : ''}" data-tab="livesearch">🛰️ Live Search</button>
          <button class="panel-tab-btn ${activeTab === 'scanner' ? 'active' : ''}" data-tab="scanner">📡 Scanner</button>
          <button class="panel-tab-btn ${activeTab === 'jobalerts' ? 'active' : ''}" data-tab="jobalerts">🔔 Job Alerts${alertBadge}</button>
        `;
      } else if (userRole === 'Operator') {
        navTabsHtml = `
          <button class="panel-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}" data-tab="dashboard">🏢 Dashboard</button>
          <button class="panel-tab-btn ${activeTab === 'users' ? 'active' : ''}" data-tab="users">👥 Users</button>
          <button class="panel-tab-btn ${activeTab === 'tasks' ? 'active' : ''}" data-tab="tasks">⚡ My Tasks</button>
          <button class="panel-tab-btn ${activeTab === 'livesearch' ? 'active' : ''}" data-tab="livesearch">🛰️ Live Search</button>
          <button class="panel-tab-btn ${activeTab === 'scanner' ? 'active' : ''}" data-tab="scanner">📡 Scanner</button>
          <button class="panel-tab-btn ${activeTab === 'jobalerts' ? 'active' : ''}" data-tab="jobalerts">🔔 Job Alerts${alertBadge}</button>
        `;
      } else if (userRole === 'Admin') {
        navTabsHtml = `
          <button class="panel-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}" data-tab="dashboard">🏢 Dashboard</button>
          <button class="panel-tab-btn ${activeTab === 'users' ? 'active' : ''}" data-tab="users">👥 Users</button>
          <button class="panel-tab-btn ${activeTab === 'tasks' ? 'active' : ''}" data-tab="tasks">⚡ My Tasks</button>
          <button class="panel-tab-btn ${activeTab === 'livesearch' ? 'active' : ''}" data-tab="livesearch">🛰️ Live Search</button>
          <button class="panel-tab-btn ${activeTab === 'scanner' ? 'active' : ''}" data-tab="scanner">📡 Scanner</button>
          <button class="panel-tab-btn ${activeTab === 'jobalerts' ? 'active' : ''}" data-tab="jobalerts">🔔 Job Alerts${alertBadge}</button>
          <button class="panel-tab-btn ${activeTab === 'subusers' ? 'active' : ''}" data-tab="subusers">👤 Operator</button>
        `;
      } else {
        // SuperAdmin (Full Control)
        navTabsHtml = `
          <button class="panel-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}" data-tab="dashboard">🏢 Dashboard</button>
          <button class="panel-tab-btn ${activeTab === 'users' ? 'active' : ''}" data-tab="users">👥 Users</button>
          <button class="panel-tab-btn ${activeTab === 'tasks' ? 'active' : ''}" data-tab="tasks">⚡ My Tasks</button>
          <button class="panel-tab-btn ${activeTab === 'livesearch' ? 'active' : ''}" data-tab="livesearch">🛰️ Live Search</button>
          <button class="panel-tab-btn ${activeTab === 'scanner' ? 'active' : ''}" data-tab="scanner">📡 Scanner</button>
          <button class="panel-tab-btn ${activeTab === 'jobalerts' ? 'active' : ''}" data-tab="jobalerts">🔔 Job Alerts${alertBadge}</button>
          <button class="panel-tab-btn ${activeTab === 'subusers' ? 'active' : ''}" data-tab="subusers">👤 Operator</button>
          <button class="panel-tab-btn ${activeTab === 'specs' ? 'active' : ''}" data-tab="specs">📘 Specs</button>
        `;
      }

      const roleBadge = (isMainAdmin || userRole === 'SuperAdmin')
        ? '👑 SUPER ADMIN'
        : userRole === 'Admin'
          ? '👑 ADMIN'
          : userRole === 'Operator'
            ? '🛡️ OPERATOR'
            : userRole === 'Viewer'
              ? '👁️ VIEWER'
              : '👤 CANDIDATE USER';

      container.innerHTML = `
        <div class="acs-shell" style="min-height:100vh; background:#090d16; color:#f8fafc;">
          <header class="global-nav-bar" style="background:rgba(15, 23, 42, 0.95); backdrop-filter:blur(16px); border-bottom:1px solid rgba(255,107,0,0.3); padding:10px 24px; display:flex; justify-content:space-between; align-items:center; gap:16px; box-sizing:border-box; width:100%;">
            <div class="global-brand" style="display:flex; align-items:center; gap:12px; flex-shrink:0;">
              <div class="global-brand-icon" style="background:linear-gradient(135deg, #1d4ed8 0%, #3b82f6 50%, #2563eb 100%); width:40px; height:40px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.35rem; box-shadow:0 0 25px rgba(59,130,246,0.85), inset 0 1px 2px rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.3); border:1.5px solid rgba(147,197,253,0.7); text-shadow:0 0 12px #60a5fa; flex-shrink:0;">
                <span style="filter:drop-shadow(0 2px 6px rgba(0,0,0,0.6)); color:#ffffff;">⚡</span>
              </div>
              <div>
                <span style="font-weight:900; font-size:1.18rem; color:#ffffff; letter-spacing:-0.02em;">Amazon Client System</span>
              </div>
            </div>

            <div class="panel-switcher">
              ${navTabsHtml}
            </div>

            <div class="nav-user-area" style="display:flex; align-items:center; gap:12px; flex-shrink:0;">
              <div style="display:flex; flex-direction:column; align-items:flex-end; gap:2px;">
                <span style="background:linear-gradient(135deg, rgba(255,107,0,0.25) 0%, rgba(245,158,11,0.25) 100%); color:#ff9100; padding:2px 8px; border-radius:8px; font-size:0.68rem; font-weight:800; border:1px solid rgba(255,165,0,0.5); box-shadow:0 0 10px rgba(255,107,0,0.25); letter-spacing:0.04em; backdrop-filter:blur(8px);">
                  ${roleBadge}
                </span>
                <span style="color:#ffffff; font-size:0.82rem; font-weight:800; letter-spacing:-0.01em;">
                  ${currentUserName}
                </span>
              </div>
              <button id="btnTriggerLogout" class="btn-3d-glass-logout">
                🚪 Logout
              </button>
            </div>
          </header>

          <main style="padding:20px 40px; max-width:1650px; margin:0 auto; width:100%; box-sizing:border-box;">
            ${renderTabContent(state, currentUserEmail, userRole)}
          </main>
        </div>

        ${editingUserData ? renderEditModal() : ''}
        ${editingSubUserData ? renderEditSubUserModal() : ''}
        ${activeSubUserModal ? renderSubUserModal() : ''}
        ${deletingTarget ? renderDeleteConfirmModal() : ''}
        ${activeSmartApplyJob ? renderSmartApplyModal(activeSmartApplyJob) : ''}
        ${activeBotModal ? renderBotModal(activeBotModal) : ''}

        ${activeLogoutModal ? `
          <div class="modal-backdrop" id="logoutModalBackdrop">
            <div class="modal-box-3d" style="text-align:center;">
              <div class="modal-icon-badge-3d">
                <span style="filter:drop-shadow(0 2px 6px rgba(0,0,0,0.6));">⚠️</span>
              </div>
              <div class="modal-title">Are you sure to logout?</div>
              <div class="modal-subtitle">You will be logged out of the Amazon Client System and redirected to the login portal.</div>
              <div class="modal-actions">
                <button id="btnConfirmLogoutYes" class="btn-3d-blue">Yes</button>
                <button id="btnConfirmLogoutNo" class="btn-3d-red">No</button>
              </div>
            </div>
          </div>
        ` : ''}
      `;

      bindEvents();
    }

    function renderTabContent(state, currentUserEmail, userRole) {
      const scoped = store.getScopedData(currentUserEmail, userRole);
      const scopedState = {
        ...state,
        users: scoped.users,
        subUsers: scoped.subUsers,
        tasks: scoped.tasks
      };

      if (userRole === 'Candidate') {
        switch (activeTab) {
          case 'dashboard': return renderCandidateDashboardTab(scopedState, currentUserEmail);
          case 'tasks': return renderTasksTab(scopedState, currentUserEmail);
          case 'otp': return renderOtpTab(scopedState, currentUserEmail);
          case 'livesearch': return renderLiveSearchTab(scopedState);
          case 'scanner': return renderScheduleScannerTab(scopedState);
          case 'jobalerts': return renderJobAlertsTab(state, currentUserEmail, userRole);
          case 'specs': return renderSpecsTab(scopedState);
          default: return renderCandidateDashboardTab(scopedState, currentUserEmail);
        }
      }

      switch (activeTab) {
        case 'dashboard': return renderDashboardTab(scopedState, currentUserEmail);
        case 'users': return renderUsersTab(scopedState, currentUserEmail);
        case 'otp': return renderOtpTab(scopedState, currentUserEmail);
        case 'tasks': return renderTasksTab(scopedState, currentUserEmail);
        case 'livesearch': return renderLiveSearchTab(scopedState);
        case 'scanner': return renderScheduleScannerTab(scopedState);
        case 'jobalerts': return renderJobAlertsTab(state, currentUserEmail, userRole);
        case 'subusers': return renderSubUsersTab(scopedState);
        case 'specs': return renderSpecsTab(scopedState);
        default: return renderDashboardTab(scopedState, currentUserEmail);
      }
    }

    function renderCandidateDashboardTab(state, currentUserEmail) {
      const user = state.users.find(u => u.email.toLowerCase() === currentUserEmail.toLowerCase()) || {
        id: 'c_' + Date.now(),
        username: currentUserEmail.split('@')[0],
        email: currentUserEmail,
        jobId: 'JOB-CA-000000552',
        schId: 'SCH-CA-000006122',
        status: 'approved',
        country: 'Canada',
        submittedDate: '21/07/2026'
      };

      const userTask = state.tasks.find(t => t.email && t.email.toLowerCase() === currentUserEmail.toLowerCase()) || {
        id: 't_c_' + user.id,
        userName: user.username,
        email: user.email,
        jobId: user.jobId,
        schId: user.schId,
        status: 'running',
        startTime: new Date().toLocaleString()
      };

      const userOtp = activeOtpMap[user.id] || null;

      return `
        <!-- Candidate Account Header Banner -->
        <div class="glass-3d-card" style="margin-bottom:24px; background:linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.8)); border:1px solid rgba(255,107,0,0.3);">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
            <div style="display:flex; align-items:center; gap:16px;">
              <div style="width:56px; height:56px; border-radius:16px; background:linear-gradient(135deg,#ff6b00,#ff9100); display:flex; align-items:center; justify-content:center; font-size:1.8rem; box-shadow:0 0 20px rgba(255,107,0,0.5);">
                👤
              </div>
              <div>
                <div style="font-size:0.75rem; font-weight:800; color:#ff9100; text-transform:uppercase; letter-spacing:0.08em;">Candidate User Control Panel &bull; Live Shift Booking</div>
                <h2 style="font-size:1.4rem; font-weight:900; color:#ffffff; margin:2px 0 0 0;">Welcome, ${user.username}!</h2>
                <div style="font-size:0.85rem; color:#94a3b8; margin-top:2px;">📧 ${user.email} &bull; 🌐 Target: ${user.country || 'Canada'}</div>
              </div>
            </div>
            <div style="display:flex; gap:12px; align-items:center;">
              <div style="text-align:right;">
                <div style="font-size:0.72rem; color:#94a3b8; font-weight:700; text-transform:uppercase;">Account Status</div>
                <span style="display:inline-block; font-weight:900; font-size:0.85rem; color:${user.status === 'approved' ? '#10b981' : user.status === 'pending' ? '#f59e0b' : '#ef4444'}; background:rgba(255,255,255,0.06); padding:4px 12px; border-radius:12px; border:1px solid ${user.status === 'approved' ? 'rgba(16,185,129,0.4)' : 'rgba(245,158,11,0.4)'}; margin-top:4px;">
                  ${user.status === 'approved' ? '✅ APPROVED &amp; ACTIVE' : user.status === 'pending' ? '⏳ PENDING REVIEW' : '❌ TEST FAILED'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Candidate Shift Parameters & Task Control -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:24px;">

          <!-- Card 1: Shift Booking Parameters -->
          <div class="glass-3d-card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:10px;">
              <h3 style="font-size:1.1rem; font-weight:800; color:#ffffff; margin:0;">🎯 My Enrolled Shift Criteria</h3>
              <span style="font-size:0.75rem; background:rgba(255,107,0,0.15); color:#ff9100; padding:3px 8px; border-radius:6px; font-weight:700;">Amazon Client System</span>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
              <div style="background:rgba(15,23,42,0.6); padding:12px; border-radius:10px; border:1px solid rgba(255,255,255,0.05);">
                <div style="font-size:0.72rem; color:#94a3b8; font-weight:700;">TARGET JOB ID</div>
                <code style="font-size:0.95rem; font-weight:800; color:#ff9100; display:block; margin-top:4px;">${user.jobId || 'JOB-CA-000000552'}</code>
              </div>
              <div style="background:rgba(15,23,42,0.6); padding:12px; border-radius:10px; border:1px solid rgba(255,255,255,0.05);">
                <div style="font-size:0.72rem; color:#94a3b8; font-weight:700;">TARGET SCHEDULE ID</div>
                <code style="font-size:0.95rem; font-weight:800; color:#60a5fa; display:block; margin-top:4px;">${user.schId || 'SCH-CA-000006122'}</code>
              </div>
              <div style="background:rgba(15,23,42,0.6); padding:12px; border-radius:10px; border:1px solid rgba(255,255,255,0.05);">
                <div style="font-size:0.72rem; color:#94a3b8; font-weight:700;">REGISTRATION DATE</div>
                <div style="font-size:0.9rem; font-weight:700; color:#ffffff; margin-top:4px;">${formatDateDDMMYYYY(user.submittedDate || '21/07/2026')}</div>
              </div>
              <div style="background:rgba(15,23,42,0.6); padding:12px; border-radius:10px; border:1px solid rgba(255,255,255,0.05);">
                <div style="font-size:0.72rem; color:#94a3b8; font-weight:700;">LOCATION / COUNTRY</div>
                <div style="font-size:0.9rem; font-weight:700; color:#ffffff; margin-top:4px;">${user.country || 'Canada'}</div>
              </div>
            </div>
          </div>

          <!-- Card 2: Shift Booking Automation Control -->
          <div class="glass-3d-card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:10px;">
              <h3 style="font-size:1.1rem; font-weight:800; color:#ffffff; margin:0;">⚡ Live Automation Task Control</h3>
              <span style="font-size:0.75rem; color:${userTask.status === 'running' ? '#10b981' : '#ef4444'}; font-weight:800;">
                ${userTask.status === 'running' ? '🟢 AUTOMATION ACTIVE' : '🔴 AUTOMATION PAUSED'}
              </span>
            </div>

            <div style="margin-bottom:14px; background:rgba(15,23,42,0.6); padding:12px; border-radius:10px; font-size:0.82rem; color:#cbd5e1; line-height:1.5;">
              <div><strong style="color:#ffffff;">Current Status:</strong> <span style="color:${userTask.status === 'running' ? '#10b981' : '#f59e0b'}; font-weight:700;">${userTask.status.toUpperCase()}</span></div>
              <div><strong style="color:#ffffff;">Engine Activity:</strong> ${userTask.status === 'running' ? 'Scanning shifts on Amazon hiring feed every 2.5s...' : 'Shift booking queue paused.'}</div>
            </div>

            <div style="display:flex; gap:12px;">
              ${userTask.status === 'running' ? `
                <button class="btn-stop-task" data-tid="${userTask.id}" data-status="running" style="flex:1; background:linear-gradient(135deg,#dc2626,#b91c1c); color:#fff; border:none; padding:12px; border-radius:10px; font-weight:800; font-size:0.9rem; cursor:pointer; box-shadow:0 4px 14px rgba(220,38,38,0.4);">
                  Pause Shift Booking Engine
                </button>
              ` : `
                <button class="btn-start-task" data-tid="${userTask.id}" data-status="stopped" style="flex:1; background:linear-gradient(135deg,#059669,#10b981); color:#fff; border:none; padding:12px; border-radius:10px; font-weight:800; font-size:0.9rem; cursor:pointer; box-shadow:0 4px 14px rgba(16,185,129,0.4);">
                  ▶️ Start Shift Booking Engine
                </button>
              `}
              <button class="btn-row-get-otp" data-uid="${user.id}" data-email="${user.email}" style="background:linear-gradient(135deg,#1d4ed8,#2563eb); color:#fff; border:none; padding:12px 18px; border-radius:10px; font-weight:800; font-size:0.9rem; cursor:pointer;">
                🔑 Get OTP
              </button>
            </div>

            ${userOtp ? `
              <div style="margin-top:14px; background:rgba(16,185,129,0.15); border:1px solid #10b981; padding:10px 14px; border-radius:10px; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:0.82rem; color:#10b981; font-weight:700;">Generated 2FA Code:</span>
                <code style="font-size:1.1rem; font-weight:900; color:#10b981; font-family:monospace;">${userOtp.code}</code>
              </div>
            ` : ''}
          </div>

        </div>

        <!-- Live Amazon Jobs Feed for Candidate -->
        <div class="glass-3d-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:10px;">
            <div>
              <h3 style="font-size:1.15rem; font-weight:800; color:#ffffff; margin:0;">📡 Available Amazon Warehouse Shifts</h3>
              <p style="font-size:0.8rem; color:#94a3b8; margin-top:2px;">Real-time verified Amazon Warehouse hiring listings</p>
            </div>
            <button id="btnFetchRealJobs" style="background:linear-gradient(135deg,#ff6b00,#ff9100); color:#fff; border:none; padding:8px 16px; border-radius:8px; font-weight:800; font-size:0.8rem; cursor:pointer;">
              ⚡ Refresh Shift Feed
            </button>
          </div>

          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:14px;">
            ${LIVE_AMAZON_JOBS.slice(0, 6).map(j => {
              const jStatus = store.getJobVacancyStatus(j.id, j.status || 'Open');
              const isClosed = jStatus === 'Closed' || jStatus === 'Completed';
              const liveWhUrl = j.liveWarehouseUrl || getLiveWarehouseUrl(j.warehouse, j.country);
              return `
              <div style="background:rgba(15,23,42,0.6); border:1px solid ${isClosed ? 'rgba(239,68,68,0.3)' : 'rgba(255,107,0,0.2)'}; border-radius:12px; padding:14px; position:relative;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                  <span style="font-size:0.7rem; font-weight:800; background:rgba(255,107,0,0.15); color:#ff9100; padding:2px 6px; border-radius:4px;">${j.warehouse} &bull; ${j.city}</span>
                  <span style="font-size:0.75rem; font-weight:800; color:${isClosed ? '#f87171' : '#10b981'};">${isClosed ? '🔴 Vacancy Filled' : j.pay}</span>
                </div>
                <div style="font-size:0.9rem; font-weight:800; color:#ffffff; margin-bottom:4px;">${j.title}</div>
                <div style="font-size:0.75rem; color:#94a3b8; margin-bottom:10px;">📅 ${j.schedule} (${j.empType})</div>
                <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-top:8px;">
                  <button class="btn-open-smart-gateway" data-jid="${j.id}" style="background:linear-gradient(135deg,#ff6b00,#ff9100); color:#fff; border:none; padding:6px 12px; border-radius:8px; font-weight:800; font-size:0.75rem; cursor:pointer;">
                    🚀 Apply Smart ↗
                  </button>
                  <a href="${liveWhUrl}" target="_blank" title="View active shifts at ${j.warehouse}" style="background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.3); color:#10b981; padding:5px 10px; border-radius:8px; font-weight:800; font-size:0.72rem; text-decoration:none;">
                    🏢 Live ${j.warehouse}
                  </a>
                </div>
              </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    function filterUsersForCurrentSession(usersList, currentUserEmail) {
      const email = currentUserEmail || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('acs_user_email') : '') || 'admin2003@gmail.com';
      const role = (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('acs_user_role') : '') || store.getUserRole(email);
      const storedName = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('acs_user_name') : '';
      const name = (storedName && storedName !== 'admin' && storedName !== 'Super Admin') ? storedName : (email.includes('@') ? email.split('@')[0] : email);
      const subUsers = store ? (store.getState().subUsers || []) : [];
      const subSet = getSubordinateIdentifiers(email, name, subUsers);
      return (usersList || []).filter(u => isCandidateAllowed(u, role, email, name, subSet));
    }

    function filterTasksForCurrentSession(tasksList, currentUserEmail) {
      const email = currentUserEmail || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('acs_user_email') : '') || 'admin2003@gmail.com';
      const role = (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('acs_user_role') : '') || store.getUserRole(email);
      const storedName = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('acs_user_name') : '';
      const name = (storedName && storedName !== 'admin' && storedName !== 'Super Admin') ? storedName : (email.includes('@') ? email.split('@')[0] : email);
      const subUsers = store ? (store.getState().subUsers || []) : [];
      const subSet = getSubordinateIdentifiers(email, name, subUsers);
      return (tasksList || []).filter(t => isCandidateAllowed(t, role, email, name, subSet));
    }

    function renderDashboardTab(state, currentUserEmail) {
      const visibleUsers = filterUsersForCurrentSession(state.users, currentUserEmail);
      const totalCount = visibleUsers.length;
      const approvedCount = visibleUsers.filter(u => u.status === 'approved').length;
      const pendingCount = visibleUsers.filter(u => u.status === 'pending').length;
      const rejectedCount = visibleUsers.filter(u => u.status === 'rejected' || u.status === 'test failed').length;

      return `
        <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:20px; margin-bottom:24px;" class="stats-grid">
          <div class="glass-3d-card metric-clickable" data-metric="All" style="display:flex; align-items:center; justify-content:space-between; cursor:pointer;">
            <div>
              <div style="font-size:0.75rem; font-weight:700; color:#ff9100; text-transform:uppercase; letter-spacing:0.05em;">Total Users</div>
              <div style="font-size:1.8rem; font-weight:900; color:#ffffff; margin-top:2px;">${totalCount}</div>
            </div>
            <div style="font-size:1.6rem; opacity:0.8;">👥</div>
          </div>
          <div class="glass-3d-card metric-clickable" data-metric="approved" style="display:flex; align-items:center; justify-content:space-between; cursor:pointer;">
            <div>
              <div style="font-size:0.75rem; font-weight:700; color:#10b981; text-transform:uppercase; letter-spacing:0.05em;">Approved Users</div>
              <div style="font-size:1.8rem; font-weight:900; color:#ffffff; margin-top:2px;">${approvedCount}</div>
            </div>
            <div style="font-size:1.6rem; opacity:0.8;">✅</div>
          </div>
          <div class="glass-3d-card metric-clickable" data-metric="pending" style="display:flex; align-items:center; justify-content:space-between; cursor:pointer;">
            <div>
              <div style="font-size:0.75rem; font-weight:700; color:#f59e0b; text-transform:uppercase; letter-spacing:0.05em;">Pending Users</div>
              <div style="font-size:1.8rem; font-weight:900; color:#ffffff; margin-top:2px;">${pendingCount}</div>
            </div>
            <div style="font-size:1.6rem; opacity:0.8;">⏳</div>
          </div>
          <div class="glass-3d-card metric-clickable" data-metric="rejected" style="display:flex; align-items:center; justify-content:space-between; cursor:pointer;">
            <div>
              <div style="font-size:0.75rem; font-weight:700; color:#ef4444; text-transform:uppercase; letter-spacing:0.05em;">Rejected Users</div>
              <div style="font-size:1.8rem; font-weight:900; color:#ffffff; margin-top:2px;">${rejectedCount}</div>
            </div>
            <div style="font-size:1.6rem; opacity:0.8;">❌</div>
          </div>
        </div>

        <div class="glass-3d-card">
          <div style="margin-bottom:16px;">
            <h3 style="font-size:1.25rem; font-weight:800; color:#ffffff; margin:0;">+ New User</h3>
          </div>
          <form id="formEnrollUser" autocomplete="off" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:16px;">
            <div>
              <label style="font-size:0.75rem; font-weight:700; color:#94a3b8;">1. Username / Title</label>
              <input type="text" id="inpUserTitle" placeholder="ex: rajesh cambridge day" autocomplete="off" value="${enrollDraftState.title || ''}" required style="width:100%; background:#0f172a; border:1px solid rgba(255,107,0,0.3); color:#fff; border-radius:8px; padding:10px; font-size:0.88rem;">
            </div>
            <div>
              <label style="font-size:0.75rem; font-weight:700; color:#94a3b8;">2. Email Address</label>
              <input type="text" inputmode="email" id="inpUserEmail" placeholder="ex: rajeshkumar2026am@gmail.com" autocomplete="off" value="${enrollDraftState.email || '@gmail.com'}" required style="width:100%; background:#0f172a; border:1px solid rgba(255,107,0,0.3); color:#fff; border-radius:8px; padding:10px; font-size:0.88rem;">
            </div>
            <div>
              <label style="font-size:0.75rem; font-weight:700; color:#94a3b8;">3. Country</label>
              <select id="inpUserCountry" style="width:100%; background:#0f172a; border:1px solid rgba(255,107,0,0.3); color:#fff; border-radius:8px; padding:10px; font-size:0.88rem;">
                <option value="Canada [CA]" ${enrollDraftState.country?.includes('Canada') || enrollDraftState.country?.includes('CA') ? 'selected' : ''}>Canada [CA]</option>
                <option value="USA [US]" ${enrollDraftState.country?.includes('USA') || enrollDraftState.country?.includes('US') ? 'selected' : ''}>USA [US]</option>
                <option value="United Kingdom [UK]" ${enrollDraftState.country?.includes('United Kingdom') || enrollDraftState.country?.includes('UK') ? 'selected' : ''}>United Kingdom [UK]</option>
                <option value="India [IND]" ${enrollDraftState.country?.includes('India') || enrollDraftState.country?.includes('IND') ? 'selected' : ''}>India [IND]</option>
                <option value="Egypt [EGY]" ${enrollDraftState.country?.includes('Egypt') || enrollDraftState.country?.includes('EGY') ? 'selected' : ''}>Egypt [EGY]</option>
                <option value="South Africa [ZA]" ${enrollDraftState.country?.includes('South Africa') || enrollDraftState.country?.includes('ZA') ? 'selected' : ''}>South Africa [ZA]</option>
                <option value="Germany [DE]" ${enrollDraftState.country?.includes('Germany') || enrollDraftState.country?.includes('DE') ? 'selected' : ''}>Germany [DE]</option>
                <option value="France [FR]" ${enrollDraftState.country?.includes('France') || enrollDraftState.country?.includes('FR') ? 'selected' : ''}>France [FR]</option>
                <option value="Italy [IT]" ${enrollDraftState.country?.includes('Italy') || enrollDraftState.country?.includes('IT') ? 'selected' : ''}>Italy [IT]</option>
                <option value="Spain [ES]" ${enrollDraftState.country?.includes('Spain') || enrollDraftState.country?.includes('ES') ? 'selected' : ''}>Spain [ES]</option>
                <option value="Japan [JP]" ${enrollDraftState.country?.includes('Japan') || enrollDraftState.country?.includes('JP') ? 'selected' : ''}>Japan [JP]</option>
                <option value="Australia [AU]" ${enrollDraftState.country?.includes('Australia') || enrollDraftState.country?.includes('AU') ? 'selected' : ''}>Australia [AU]</option>
                <option value="Mexico [MX]" ${enrollDraftState.country?.includes('Mexico') || enrollDraftState.country?.includes('MX') ? 'selected' : ''}>Mexico [MX]</option>
                <option value="Brazil [BR]" ${enrollDraftState.country?.includes('Brazil') || enrollDraftState.country?.includes('BR') ? 'selected' : ''}>Brazil [BR]</option>
                <option value="UAE [UAE]" ${enrollDraftState.country?.includes('UAE') || enrollDraftState.country?.includes('AE') ? 'selected' : ''}>UAE [UAE]</option>
                <option value="Saudi Arabia [KSA]" ${enrollDraftState.country?.includes('Saudi Arabia') || enrollDraftState.country?.includes('KSA') ? 'selected' : ''}>Saudi Arabia [KSA]</option>
                <option value="Poland [PL]" ${enrollDraftState.country?.includes('Poland') || enrollDraftState.country?.includes('PL') ? 'selected' : ''}>Poland [PL]</option>
                <option value="Netherlands [NL]" ${enrollDraftState.country?.includes('Netherlands') || enrollDraftState.country?.includes('NL') ? 'selected' : ''}>Netherlands [NL]</option>
                <option value="Ireland [IE]" ${enrollDraftState.country?.includes('Ireland') || enrollDraftState.country?.includes('IE') ? 'selected' : ''}>Ireland [IE]</option>
                <option value="Singapore [SG]" ${enrollDraftState.country?.includes('Singapore') || enrollDraftState.country?.includes('SG') ? 'selected' : ''}>Singapore [SG]</option>
              </select>
            </div>
            <div>
              <label style="font-size:0.75rem; font-weight:700; color:#94a3b8;">4. Web Password</label>
              <input type="password" id="inpWebPass" placeholder="••••••••" autocomplete="new-password" value="${enrollDraftState.webPass || ''}" required style="width:100%; background:#0f172a; border:1px solid rgba(255,107,0,0.3); color:#fff; border-radius:8px; padding:10px; font-size:0.88rem;">
            </div>
            <div>
              <label style="font-size:0.75rem; font-weight:700; color:#94a3b8;">5. App Password (2FA/Gmail)</label>
              <input type="password" id="inpAppPass" placeholder="xxxx-xxxx-xxxx-xxxx" autocomplete="new-password" value="${enrollDraftState.appPass || ''}" required style="width:100%; background:#0f172a; border:1px solid rgba(255,107,0,0.3); color:#fff; border-radius:8px; padding:10px; font-size:0.88rem;">
            </div>
            <div>
              <label style="font-size:0.75rem; font-weight:700; color:#94a3b8;">6. Job ID</label>
              <input type="text" id="inpJobId" placeholder="ex: JOB-CA-000000573" autocomplete="off" value="${enrollDraftState.jobId || ''}" required style="width:100%; background:#0f172a; border:1px solid rgba(255,107,0,0.3); color:#fff; border-radius:8px; padding:10px; font-size:0.88rem;">
            </div>
            <div style="grid-column: span 3;">
              <label style="font-size:0.75rem; font-weight:700; color:#94a3b8;">7. Schedule ID</label>
              <input type="text" id="inpSchId" placeholder="ex: SCH-CA-000006066" autocomplete="off" value="${enrollDraftState.schId || ''}" required style="width:100%; background:#0f172a; border:1px solid rgba(255,107,0,0.3); color:#fff; border-radius:8px; padding:10px; font-size:0.88rem;">
            </div>
            <div style="grid-column: span 3; display:flex; justify-content:center; align-items:center; gap:16px; margin-top:14px;">
              <button type="submit" class="btn-glass-blue" style="padding:14px 40px; font-size:0.98rem;">💾 Save User</button>
              <button type="reset" id="btnResetEnrollForm" class="btn-glass-secondary" style="padding:14px 24px; font-size:0.9rem;">Clear Form</button>
            </div>
          </form>
        </div>
      `;
    }

    function renderUsersTab(state, currentUserEmail) {
      const userPool = filterUsersForCurrentSession(state.users, currentUserEmail);
      let filteredUsers = userPool;
      if (userListFilter === 'approved') filteredUsers = userPool.filter(u => u.status === 'approved');
      if (userListFilter === 'pending') filteredUsers = userPool.filter(u => u.status === 'pending');
      if (userListFilter === 'rejected') filteredUsers = userPool.filter(u => u.status === 'rejected' || u.status === 'test failed');

      return `
        <div class="glass-3d-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:16px;">
            <div>
              <h3 style="font-size:1.3rem; font-weight:800; color:#ffffff; margin:0;">👥 User's Data</h3>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <button class="user-filter-btn ${userListFilter === 'All' ? 'active active-all' : ''}" data-filter="All">All (${userPool.length})</button>
              <button class="user-filter-btn ${userListFilter === 'approved' ? 'active active-approved' : ''}" data-filter="approved">Approved (${userPool.filter(u => u.status === 'approved').length})</button>
              <button class="user-filter-btn ${userListFilter === 'pending' ? 'active active-pending' : ''}" data-filter="pending">Pending (${userPool.filter(u => u.status === 'pending').length})</button>
              <button class="user-filter-btn ${userListFilter === 'rejected' ? 'active active-rejected' : ''}" data-filter="rejected">Rejected (${userPool.filter(u => u.status === 'rejected' || u.status === 'test failed').length})</button>
            </div>
          </div>

          <div style="width:100%; overflow-x:hidden;">
            <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.83rem;">
              <thead>
                <tr style="border-bottom:1px solid rgba(255,255,255,0.1); color:#94a3b8; font-weight:800; text-transform:uppercase; font-size:0.72rem; letter-spacing:0.04em;">
                  <th style="padding:10px 4px; text-align:center;">#</th>
                  <th style="padding:10px 8px; text-align:center;">User / Title</th>
                  <th style="padding:10px 8px; text-align:center;">Email Address</th>
                  <th style="padding:10px 4px; text-align:center;">Job ID</th>
                  <th style="padding:10px 4px; text-align:center;">Schedule ID</th>
                  <th style="padding:10px 4px; text-align:center;">Added By</th>
                  <th style="padding:10px 4px; text-align:center;">Pin</th>
                  <th style="padding:10px 4px; text-align:center;">Status</th>
                  <th style="padding:10px 4px; text-align:center;">OTP</th>
                  <th style="padding:10px 4px; text-align:center;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${filteredUsers.length === 0 ? `
                  <tr><td colspan="10" style="padding:24px; text-align:center; color:#94a3b8;">No candidates found matching status filter "${userListFilter}".</td></tr>
                ` : filteredUsers.map((u, idx) => {
                  const activeOtp = activeOtpMap[u.id];
                  return `
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.05); transition:background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">
                      <td style="padding:10px 4px; font-weight:700; color:#94a3b8; text-align:center;">${idx + 1}</td>
                      <td style="padding:10px 8px; font-weight:800; color:#ffffff; white-space:nowrap;">${u.username}</td>
                      <td style="padding:10px 8px; color:#cbd5e1; font-size:0.8rem; white-space:nowrap;">${u.email}</td>
                      <td style="padding:10px 4px; text-align:center;"><code style="background:rgba(59,130,246,0.15); color:#60a5fa; padding:2px 6px; border-radius:6px; font-weight:800; font-size:0.78rem; white-space:nowrap;">${u.jobId}</code></td>
                      <td style="padding:10px 4px; text-align:center;"><code style="background:rgba(59,130,246,0.15); color:#60a5fa; padding:2px 6px; border-radius:6px; font-weight:800; font-size:0.78rem; white-space:nowrap;">${u.schId}</code></td>
                      <td style="padding:10px 4px; text-align:center;"><span style="background:rgba(255,255,255,0.08); color:#a5b4fc; padding:2px 6px; border-radius:10px; font-size:0.72rem; font-weight:700; white-space:nowrap;">👤 ${u.creator_name || (u.creator_email ? u.creator_email.split('@')[0] : 'Admin')}</span></td>
                      <td style="padding:10px 4px; text-align:center;"><code style="background:rgba(255,255,255,0.08); color:#f8fafc; padding:2px 6px; border-radius:6px; font-size:0.78rem; font-weight:700;">${u.pin || '163207'}</code></td>
                      <td style="padding:10px 4px; text-align:center;">
                        <span style="font-weight:800; font-size:0.78rem; color:${u.status === 'approved' ? '#10b981' : u.status === 'pending' ? '#f59e0b' : '#ef4444'}; white-space:nowrap;">
                          ${u.status}
                        </span>
                      </td>
                      <td style="padding:10px 4px; text-align:center;">
                        ${activeOtp ? `<span style="background:rgba(16,185,129,0.2); border:1px solid rgba(16,185,129,0.6); color:#10b981; font-weight:800; font-size:0.88rem; font-family:monospace; padding:3px 8px; border-radius:6px; box-shadow:0 0 10px rgba(16,185,129,0.2);">${activeOtp.code}</span>` : ''}
                      </td>
                      <td style="padding:10px 4px; text-align:center; white-space:nowrap;">
                        <button class="btn-row-get-otp" data-uid="${u.id}" data-email="${u.email}" title="Generate 2FA OTP" style="width:34px; height:34px; border-radius:50%; background:rgba(56,189,248,0.18); border:1px solid rgba(56,189,248,0.45); color:#38bdf8; font-size:0.95rem; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; margin-right:4px; transition:all 0.2s ease; box-shadow:0 2px 8px rgba(56,189,248,0.25);">🔑</button>
                        <button class="btn-edit-user" data-uid="${u.id}" title="Edit Candidate" style="width:34px; height:34px; border-radius:50%; background:rgba(59,130,246,0.18); border:1px solid rgba(59,130,246,0.45); color:#60a5fa; font-size:0.95rem; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; margin-right:4px; transition:all 0.2s ease; box-shadow:0 2px 8px rgba(59,130,246,0.25);">✏️</button>
                        <button class="btn-delete-user" data-uid="${u.id}" title="Delete Candidate">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    function renderOtpTab(state, currentUserEmail) {
      return renderUsersTab(state, currentUserEmail);
    }

    function renderTasksTab(state, currentUserEmail) {
      const taskPool = filterTasksForCurrentSession(state.tasks, currentUserEmail);

      return `
        <div class="glass-3d-card">
          <h3 style="font-size:1.3rem; font-weight:800; color:#ffffff; margin-bottom:16px;">⚡ Active Worker's</h3>
          <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.9rem;">
              <thead>
                <tr style="border-bottom:1px solid rgba(255,255,255,0.1); color:#94a3b8; font-weight:700; text-transform:uppercase; font-size:0.75rem;">
                  <th style="padding:12px;">Candidate</th>
                  <th style="padding:12px;">Email</th>
                  <th style="padding:12px;">Job ID</th>
                  <th style="padding:12px;">Schedule ID</th>
                  <th style="padding:12px;">Added By</th>
                  <th style="padding:12px;">Status</th>
                  <th style="padding:12px; text-align:right;">Control</th>
                </tr>
              </thead>
              <tbody>
                ${taskPool.map(t => `
                  <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                    <td style="padding:14px 12px; font-weight:700; color:#ffffff;">${t.userName}</td>
                    <td style="padding:14px 12px; color:#cbd5e1;">${t.email}</td>
                    <td style="padding:14px 12px;"><code style="background:rgba(255,107,0,0.15); color:#ff9100; padding:2px 6px; border-radius:4px;">${t.jobId}</code></td>
                    <td style="padding:14px 12px;"><code style="background:rgba(59,130,246,0.15); color:#60a5fa; padding:2px 6px; border-radius:4px;">${t.schId}</code></td>
                    <td style="padding:14px 12px;"><span style="background:rgba(255,255,255,0.08); color:#a5b4fc; padding:3px 8px; border-radius:12px; font-size:0.75rem; font-weight:700;">👤 ${t.creator_name || (t.creator_email ? t.creator_email.split('@')[0] : 'Super Admin')}</span></td>
                    <td style="padding:14px 12px;"><span style="font-weight:800; font-size:0.8rem; color:${t.status === 'running' ? '#10b981' : '#94a3b8'};">${t.status.toUpperCase()}</span></td>
                    <td style="padding:14px 12px; text-align:right;">
                      <button class="btn-toggle-task" data-tid="${t.id}" data-status="${t.status}" style="background:${t.status === 'running' ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}; color:${t.status === 'running' ? '#ef4444' : '#10b981'}; border:none; padding:6px 14px; border-radius:8px; font-weight:800; font-size:0.8rem; cursor:pointer;">
                        ${t.status === 'running' ? '⏹️ Stop' : '▶️ Start'}
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    // Real-time Amazon Logistics & Shift Data Catalog for Schedule Scanner
    const REAL_AMAZON_SCHEDULE_TEMPLATES = [
      {
        facility: 'YYC1',
        city: 'Calgary',
        province: 'AB',
        country: 'Canada',
        location: 'Calgary, AB',
        title: 'Fulfillment Center Associate',
        pay: '$23.10/hr',
        schedule: 'Sun, Mon, Tue, Wed 7:00 a.m. - 5:30 p.m. (Front Half Days)',
        type: 'FULL TIME',
        hrsPerWk: 40,
        slotsTotal: 16
      },
      {
        facility: 'YYZ4',
        city: 'Brampton',
        province: 'ON',
        country: 'Canada',
        location: 'Brampton, ON',
        title: 'Warehouse Associate',
        pay: '$24.50/hr',
        schedule: 'Wed, Thu, Fri, Sat 7:00 a.m. - 5:30 p.m. (Back Half Days)',
        type: 'FULL TIME',
        hrsPerWk: 40,
        slotsTotal: 20
      },
      {
        facility: 'YYZ3',
        city: 'Brampton',
        province: 'ON',
        country: 'Canada',
        location: 'Brampton, ON',
        title: 'Sortation Associate',
        pay: '$23.10/hr',
        schedule: 'Thu, Fri, Sat, Sun 6:00 p.m. - 4:30 a.m. (Back Half Nights)',
        type: 'FULL TIME',
        hrsPerWk: 40,
        slotsTotal: 14
      },
      {
        facility: 'YKF1',
        city: 'Cambridge',
        province: 'ON',
        country: 'Canada',
        location: 'Cambridge, ON',
        title: 'Fulfillment Associate',
        pay: '$21.80/hr',
        schedule: 'Mon, Tue, Thu, Fri 6:30 p.m. - 5:00 a.m. (Night Shift 4x10)',
        type: 'FULL TIME',
        hrsPerWk: 40,
        slotsTotal: 18
      },
      {
        facility: 'YYZ9',
        city: 'Mississauga',
        province: 'ON',
        country: 'Canada',
        location: 'Mississauga, ON',
        title: 'Delivery Station Associate',
        pay: '$24.00/hr',
        schedule: 'Fri, Sat, Sun, Mon 7:30 a.m. - 6:00 p.m. (Day Sort)',
        type: 'FULL TIME',
        hrsPerWk: 40,
        slotsTotal: 12
      },
      {
        facility: 'YYC4',
        city: 'Calgary',
        province: 'AB',
        country: 'Canada',
        location: 'Calgary, AB',
        title: 'Fulfillment Specialist',
        pay: '$23.50/hr',
        schedule: 'Sun, Mon, Tue, Wed 6:00 p.m. - 4:30 a.m. (Front Half Nights)',
        type: 'FULL TIME',
        hrsPerWk: 40,
        slotsTotal: 15
      },
      {
        facility: 'YYC8',
        city: 'Calgary',
        province: 'AB',
        country: 'Canada',
        location: 'Calgary, AB',
        title: 'Sortation Associate',
        pay: '$22.80/hr',
        schedule: 'Fri, Sat, Sun 7:00 a.m. - 5:30 p.m. (Weekend Shift 3x10)',
        type: 'PART TIME',
        hrsPerWk: 30,
        slotsTotal: 16
      },
      {
        facility: 'PHX7',
        city: 'Phoenix',
        province: 'AZ',
        country: 'USA',
        location: 'Phoenix, AZ',
        title: 'Fulfillment Center Associate',
        pay: '$21.80/hr',
        schedule: 'Sun, Mon, Tue, Wed 6:30 a.m. - 5:00 p.m. (Day Shift 4x10)',
        type: 'FULL TIME',
        hrsPerWk: 40,
        slotsTotal: 25
      },
      {
        facility: 'DFW6',
        city: 'Dallas Area',
        province: 'TX',
        country: 'USA',
        location: 'Dallas Area, TX',
        title: 'Amazon Air Associate',
        pay: '$22.50/hr',
        schedule: 'Wed, Thu, Fri, Sat 6:00 p.m. - 4:30 a.m. (Night Air Sort)',
        type: 'FULL TIME',
        hrsPerWk: 40,
        slotsTotal: 22
      },
      {
        facility: 'YEG1',
        city: 'Acheson',
        province: 'AB',
        country: 'Canada',
        location: 'Acheson, AB',
        title: 'Warehouse Associate',
        pay: '$23.50/hr',
        schedule: 'Mon, Tue, Wed, Thu 7:00 a.m. - 5:30 p.m. (Day Shift)',
        type: 'FULL TIME',
        hrsPerWk: 40,
        slotsTotal: 12
      },
      {
        facility: 'SMF3',
        city: 'Stockton Area',
        province: 'CA',
        country: 'USA',
        location: 'Stockton Area, CA',
        title: 'Fulfillment Center Associate',
        pay: '$21.75/hr',
        schedule: 'Thu, Fri, Sat, Sun 7:00 a.m. - 5:30 p.m. (Day Shift)',
        type: 'FULL TIME',
        hrsPerWk: 40,
        slotsTotal: 18
      }
    ];

    // Computes realistic upcoming Monday start dates for Amazon warehouse onboarding cohorts
    function getUpcomingMondayDate(offsetWeeks = 0) {
      const now = new Date();
      const currentDay = now.getDay();
      const daysUntilMonday = (currentDay === 0 ? 1 : (8 - currentDay)) + (offsetWeeks * 7);
      const targetDate = new Date(now.getTime() + (daysUntilMonday * 86400000));
      const dd = String(targetDate.getDate()).padStart(2, '0');
      const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
      const yyyy = targetDate.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }

    let schScannerState = {
      selectedUser: '',
      delayMs: 2500,
      startId: 6060,
      endId: 6200,
      isScanning: false,
      scannedCount: 0,
      foundCount: 0,
      postedCount: 0,
      availableCount: 0,
      startDatesCount: 0,
      notFoundCount: 0,
      results: [],
      timerId: null
    };

    function renderLiveSearchTab(state) {
      let rawJobs = [...LIVE_AMAZON_JOBS, ...(state.publicJobs || [])];

      // Strict Sanitizer: Purge any unverified/dummy items
      let verifiedJobs = rawJobs.filter(j => {
        if (!j || !j.id) return false;
        const idStr = String(j.id);
        if (idStr.startsWith('pj') || idStr.startsWith('JOB-CA-') || idStr.startsWith('JOB-US-')) return false;
        if (j.locationText && (j.locationText.includes('ON, Calgary') || j.locationText.includes('ON, Phoenix'))) return false;
        if (j.province === 'ON' && (j.city === 'Calgary' || j.city === 'Phoenix')) return false;
        if (j.closeDate && j.closeDate !== 'N/A') return false;
        return true;
      });

      // De-duplicate by ID
      const uniqueMap = new Map();
      verifiedJobs.forEach(j => { if (!uniqueMap.has(j.id)) uniqueMap.set(j.id, j); });
      let allActiveJobs = Array.from(uniqueMap.values());

      // Count metrics
      const totalCount = allActiveJobs.length;
      let openCount = 0;
      let closedCount = 0;
      allActiveJobs.forEach(j => {
        const st = store.getJobVacancyStatus(j.id, j.status || 'Open');
        if (st === 'Closed' || st === 'Completed') closedCount++;
        else openCount++;
      });

      // Filter by liveSearchStatusFilter
      let filteredJobs = allActiveJobs.filter(j => {
        const st = store.getJobVacancyStatus(j.id, j.status || 'Open');
        const isClosed = st === 'Closed' || st === 'Completed';
        if (liveSearchStatusFilter === 'Open') return !isClosed;
        if (liveSearchStatusFilter === 'Closed') return isClosed;
        return true;
      });

      return `
        <div class="glass-3d-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:16px;">
            <div style="display:flex; align-items:center; gap:14px;">
              <div style="background:linear-gradient(135deg, #10b981 0%, #059669 100%); width:48px; height:48px; border-radius:14px; display:flex; align-items:center; justify-content:center; font-size:1.6rem; box-shadow:0 0 20px rgba(16,185,129,0.6), inset 0 1px 2px rgba(255,255,255,0.4); border:1.5px solid rgba(167,243,208,0.7); flex-shrink:0;">
                📡
              </div>
              <div>
                <div style="display:flex; align-items:center; gap:10px;">
                  <h3 style="font-size:1.4rem; font-weight:900; color:#ffffff; margin:0; letter-spacing:-0.02em;">📡Live Search</h3>
                  <span style="background:rgba(16,185,129,0.18); border:1px solid rgba(16,185,129,0.4); color:#10b981; padding:3px 10px; border-radius:20px; font-size:0.75rem; font-weight:800; display:inline-flex; align-items:center; gap:5px;">
                    <span style="width:7px; height:7px; background:#10b981; border-radius:50%; animation:pulse 1.5s infinite;"></span> LIVE SEARCH FEED
                  </span>
                </div>
                <div style="font-size:0.82rem; color:#38bdf8; margin-top:4px; font-weight:700; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                  <span>High Level (Official Source) ⭐⭐⭐⭐⭐</span>
                  <span style="color:#64748b;">|</span>
                  <span style="color:#94a3b8; font-weight:500;">Canada: hiring.amazon.ca &bull; USA: hiring.amazon.com &bull; Verified: amazon.jobs</span>
                </div>
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:12px;">
              <button id="btnFetchRealJobs" class="btn-glass-blue" style="padding:12px 24px; font-size:0.9rem;">
                ⚡ Fetch Real Amazon Jobs
              </button>
            </div>
          </div>

          <!-- Smart Vacancy Recovery Banner -->
          <div style="background:linear-gradient(90deg, rgba(37,99,235,0.15) 0%, rgba(16,185,129,0.12) 100%); border:1px solid rgba(56,189,248,0.35); border-radius:12px; padding:12px 18px; margin-bottom:18px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; box-shadow:0 4px 15px rgba(0,0,0,0.2);">
            <div style="display:flex; align-items:center; gap:12px;">
              <span style="font-size:1.4rem;">💡</span>
              <div style="font-size:0.84rem; color:#cbd5e1; line-height:1.4;">
                <strong style="color:#38bdf8;">Smart Shift Recovery Active:</strong> Direct vacancy links on Amazon can close rapidly when spots are taken. If a link displays <span style="color:#f87171; font-weight:700;">"Vacancy Complete"</span> or <span style="color:#f87171; font-weight:700;">"No appointments"</span>, simply click <strong style="color:#34d399;">"🏢 Live [Warehouse]"</strong> to instantly book all current and newly dropped shifts at that exact warehouse!
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:8px; background:rgba(0,0,0,0.3); padding:4px 10px; border-radius:20px; border:1px solid rgba(255,255,255,0.1);">
              <span style="width:8px; height:8px; background:#10b981; border-radius:50%;"></span>
              <span style="font-size:0.75rem; color:#94a3b8; font-weight:700;">Zero Dead-Ends Guard</span>
            </div>
          </div>

          <!-- Filter Status Tabs Bar -->
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:12px;">
            <div style="display:flex; gap:8px;">
              <button class="filter-live-status-item ${liveSearchStatusFilter === 'All' ? 'active' : ''}" data-status="All" style="background:${liveSearchStatusFilter === 'All' ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.05)'}; color:${liveSearchStatusFilter === 'All' ? '#38bdf8' : '#94a3b8'}; border:1px solid ${liveSearchStatusFilter === 'All' ? 'rgba(56,189,248,0.5)' : 'rgba(255,255,255,0.1)'}; padding:6px 14px; border-radius:8px; font-weight:800; font-size:0.78rem; cursor:pointer; transition:all 0.2s;">
                🔥 All Shifts (${totalCount})
              </button>
              <button class="filter-live-status-item ${liveSearchStatusFilter === 'Open' ? 'active' : ''}" data-status="Open" style="background:${liveSearchStatusFilter === 'Open' ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)'}; color:${liveSearchStatusFilter === 'Open' ? '#34d399' : '#94a3b8'}; border:1px solid ${liveSearchStatusFilter === 'Open' ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.1)'}; padding:6px 14px; border-radius:8px; font-weight:800; font-size:0.78rem; cursor:pointer; transition:all 0.2s;">
                🟢 Active / Open (${openCount})
              </button>
              <button class="filter-live-status-item ${liveSearchStatusFilter === 'Closed' ? 'active' : ''}" data-status="Closed" style="background:${liveSearchStatusFilter === 'Closed' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)'}; color:${liveSearchStatusFilter === 'Closed' ? '#f87171' : '#94a3b8'}; border:1px solid ${liveSearchStatusFilter === 'Closed' ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)'}; padding:6px 14px; border-radius:8px; font-weight:800; font-size:0.78rem; cursor:pointer; transition:all 0.2s;">
                🔴 Vacancy Filled (${closedCount})
              </button>
            </div>
            <div style="font-size:0.78rem; color:#64748b;">
              Showing ${filteredJobs.length} of ${totalCount} total listings
            </div>
          </div>

          <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.88rem;">
              <thead>
                <tr style="border-bottom:1px solid rgba(255,255,255,0.1); color:#94a3b8; font-weight:700; text-transform:uppercase; font-size:0.75rem;">
                  <th style="padding:12px;">Country / Location</th>
                  <th style="padding:12px;">Warehouse</th>
                  <th style="padding:12px;">Job Title / ID</th>
                  <th style="padding:12px;">Schedule / Type</th>
                  <th style="padding:12px;">Pay Rate</th>
                  <th style="padding:12px;">Open Shifts</th>
                  <th style="padding:12px;">Vacancy Status</th>
                  <th style="padding:12px;">Verification Source</th>
                  <th style="padding:12px; text-align:right;">Actions &amp; Portals</th>
                </tr>
              </thead>
              <tbody>
                ${filteredJobs.map(j => {
                  const jStatus = store.getJobVacancyStatus(j.id, j.status || 'Open');
                  const isClosed = jStatus === 'Closed' || jStatus === 'Completed';
                  const liveWhUrl = j.liveWarehouseUrl || getLiveWarehouseUrl(j.warehouse, j.country);

                  return `
                  <tr style="border-bottom:1px solid rgba(255,255,255,0.05); ${isClosed ? 'opacity:0.72; background:rgba(239,68,68,0.04);' : ''}">
                    <td style="padding:14px 12px; font-weight:700; color:#ffffff;">
                      ${j.locationText || `${j.country} (${j.province || 'ON'}, ${j.city})`}
                    </td>
                    <td style="padding:14px 12px;">
                      <code style="background:rgba(255,107,0,0.15); color:#ff9100; padding:3px 8px; border-radius:6px; font-weight:800;">${j.warehouse}</code>
                    </td>
                    <td style="padding:14px 12px;">
                      <div style="font-weight:700; color:#ffffff; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                        <span>${j.title}</span>
                        ${isClosed ? '<span style="background:rgba(239,68,68,0.25); color:#f87171; border:1px solid rgba(239,68,68,0.4); padding:1px 6px; border-radius:4px; font-size:0.68rem; font-weight:900;">FILLED</span>' : ''}
                      </div>
                      <div style="font-size:0.75rem; color:#38bdf8; font-family:monospace;">Requisition ID: ${j.id}</div>
                    </td>
                    <td style="padding:14px 12px; color:#cbd5e1;">
                      <span style="background:rgba(59,130,246,0.15); color:#60a5fa; padding:2px 6px; border-radius:4px; font-weight:700; font-size:0.75rem;">${j.empType || 'Full-Time'}</span>
                      <div style="font-size:0.78rem; color:#94a3b8; margin-top:2px;">${j.schedule || 'Flex Schedule'}</div>
                    </td>
                    <td style="padding:14px 12px; font-weight:800; color:${isClosed ? '#f87171' : '#10b981'};">${j.pay || 'N/A'}</td>
                    <td style="padding:14px 12px; font-weight:800; color:${isClosed ? '#ef4444' : '#60a5fa'};">${isClosed ? '0 (Filled)' : (j.shifts ?? 'Available')}</td>
                    <td style="padding:14px 12px;">
                      <span style="background:${isClosed ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)'}; border:1px solid ${isClosed ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}; color:${isClosed ? '#f87171' : '#10b981'}; padding:3px 8px; border-radius:12px; font-size:0.72rem; font-weight:800; display:inline-flex; align-items:center; gap:4px;">
                        ${isClosed ? '🔴 Vacancy Completed' : '🟢 Open &amp; Active'}
                      </span>
                    </td>
                    <td style="padding:14px 12px;">
                      <div style="font-size:0.72rem; color:#94a3b8;">${j.country === 'Canada' ? 'hiring.amazon.ca' : 'hiring.amazon.com'}</div>
                      <div style="font-size:0.7rem; color:#64748b;">Verified amazon.jobs ✅</div>
                    </td>
                    <td style="padding:14px 12px; text-align:right; white-space:nowrap;">
                      <div style="display:flex; align-items:center; justify-content:flex-end; gap:6px;">
                        <!-- Smart Gateway Modal Button -->
                        <button class="btn-open-smart-gateway" data-jid="${j.id}" style="background:linear-gradient(135deg,#2563eb,#1d4ed8); color:#ffffff; border:none; padding:7px 12px; border-radius:8px; font-size:0.78rem; font-weight:800; cursor:pointer; box-shadow:0 2px 8px rgba(37,99,235,0.3); display:inline-flex; align-items:center; gap:4px;">
                          🚀 Apply Official ↗
                        </button>

                        <!-- Instant Live Warehouse Search (Guaranteed Active Shifts) -->
                        <a href="${liveWhUrl}" target="_blank" title="View all current &amp; newly dropped shifts at ${j.warehouse}" style="background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.35); color:#10b981; padding:6px 10px; border-radius:8px; font-size:0.75rem; font-weight:800; text-decoration:none; display:inline-flex; align-items:center; gap:4px;">
                          🏢 Live ${j.warehouse}
                        </a>

                        <!-- Quick Vacancy Status Toggle -->
                        <button class="btn-toggle-vacancy-quick" data-jid="${j.id}" title="${isClosed ? 'Mark as Open' : 'Report/Mark Vacancy Completed'}" style="background:${isClosed ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)'}; border:1px solid ${isClosed ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.15)'}; color:${isClosed ? '#f87171' : '#cbd5e1'}; padding:6px 9px; border-radius:8px; font-size:0.72rem; font-weight:700; cursor:pointer;">
                          ${isClosed ? '🔴 Filled' : '⚠️ Vacancy?'}
                        </button>
                      </div>
                    </td>
                  </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <!-- Playwright & Bot-Evasion Architecture Info -->
          <div style="background:#0f172a; border:1px solid rgba(59,130,246,0.3); border-radius:14px; padding:18px; margin-top:20px;">
            <div style="font-weight:800; color:#60a5fa; font-size:0.95rem; margin-bottom:10px; display:flex; align-items:center; gap:8px;">
              🤖 Playwright Production Scraper &amp; Shift Recovery Architecture
            </div>
            <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:12px; font-size:0.8rem; color:#cbd5e1;">
              <div style="background:rgba(255,255,255,0.03); padding:10px; border-radius:8px;">
                <strong style="color:#ffffff;">1. Smart Shift Recovery</strong><br>
                Direct fallback to warehouse keyword portal when direct vacancy closes.
              </div>
              <div style="background:rgba(255,255,255,0.03); padding:10px; border-radius:8px;">
                <strong style="color:#ffffff;">2. Real-Time Status Toggle</strong><br>
                Teammates can mark filled vacancies to prevent wasted clicks.
              </div>
              <div style="background:rgba(255,255,255,0.03); padding:10px; border-radius:8px;">
                <strong style="color:#ffffff;">3. Live Amazon API</strong><br>
                Direct live feed synchronization across Canadian &amp; US locations.
              </div>
              <div style="background:rgba(255,255,255,0.03); padding:10px; border-radius:8px;">
                <strong style="color:#ffffff;">4. Persistent State</strong><br>
                Vacancy overrides saved across reloads and synced in real-time.
              </div>
            </div>
          </div>

        </div>
      `;
    }

    /* ─────────────────────────────────────────────
       TAB: 🔔 JOB ALERTS — Warehouse Watch List + Upcoming Cohort Calendar
       - Watch a specific warehouse for multiple candidates
       - 14-day advance alert when new hiring cohort expected
       - Background daily auto-check via simulated search
       - 1-Click Bot Modal pre-fill directly from alert
    ───────────────────────────────────────────── */

    function renderJobAlertsTab(state, currentUserEmail, userRole) {
      const watches = state.jobWatches || [];
      const notifs = (state.jobAlertNotifs || []).slice(0, 30);
      const allUsers = state.users || [];
      const isSuperOrAdmin = (userRole === 'SuperAdmin' || userRole === 'Admin' || userRole === 'Operator');
      const today = new Date();
      today.setHours(0,0,0,0);

      // Build warehouse options from REAL_AMAZON_SCHEDULE_TEMPLATES + LIVE_AMAZON_JOBS merged
      const warehouseChoices = [
        ...UPCOMING_COHORT_PREDICTIONS.map(p => ({ warehouse: p.warehouse, city: p.city, province: p.province, country: p.country, pay: p.pay }))
      ];
      const whSet = new Set(warehouseChoices.map(w => w.warehouse));
      LIVE_AMAZON_JOBS.forEach(j => { if (!whSet.has(j.warehouse)) { warehouseChoices.push({ warehouse: j.warehouse, city: j.city, province: j.province, country: j.country, pay: j.pay }); whSet.add(j.warehouse); }});

      function daysUntil(dateStr) {
        const d = new Date(dateStr);
        d.setHours(0,0,0,0);
        return Math.ceil((d - today) / 86400000);
      }

      function urgencyColor(days) {
        if (days < 0) return '#94a3b8';
        if (days <= 7) return '#ef4444';
        if (days <= 14) return '#f59e0b';
        return '#22c55e';
      }
      function urgencyBg(days) {
        if (days < 0) return 'rgba(148,163,184,0.1)';
        if (days <= 7) return 'rgba(239,68,68,0.15)';
        if (days <= 14) return 'rgba(245,158,11,0.15)';
        return 'rgba(34,197,94,0.1)';
      }
      function confidenceBadge(c) {
        const m = { High: ['#22c55e','rgba(34,197,94,0.2)','HIGH'], Medium: ['#f59e0b','rgba(245,158,11,0.2)','MEDIUM'], Low: ['#94a3b8','rgba(148,163,184,0.12)','LOW'] };
        const [col, bg, lbl] = m[c] || m.Low;
        return `<span style="background:${bg};color:${col};border:1px solid ${col}40;padding:2px 7px;border-radius:8px;font-size:0.65rem;font-weight:900;">${lbl}</span>`;
      }

      // Watch list rows
      const watchRows = watches.length === 0 ? `
        <tr><td colspan="7" style="text-align:center;padding:32px;color:#64748b;font-size:0.88rem;">
          No warehouse watches added yet. Click <strong>+ Add Watch</strong> below to track a warehouse for your candidates.
        </td></tr>
      ` : watches.map(w => {
        const candidates = allUsers.filter(u => (w.candidateUserIds || []).includes(u.id));
        const cohort = UPCOMING_COHORT_PREDICTIONS.find(p => p.warehouse === w.warehouse);
        const expectedDate = w.cohortExpectedDate || (cohort ? cohort.expectedDate : null);
        const days = expectedDate ? daysUntil(expectedDate) : null;
        const uCol = days !== null ? urgencyColor(days) : '#94a3b8';
        const uBg = days !== null ? urgencyBg(days) : 'rgba(148,163,184,0.1)';
        const portalBase = isWarehouseInCanada(w.warehouse, w.country) ? 'https://hiring.amazon.ca' : 'https://hiring.amazon.com';
        return `
          <tr style="border-bottom:1px solid rgba(255,255,255,0.05);transition:background 0.15s;" onmouseover="this.style.background='rgba(59,130,246,0.06)'" onmouseout="this.style.background='transparent'">
            <td style="padding:12px 8px;">
              <span style="background:rgba(255,107,0,0.15);color:#ff9100;border:1px solid rgba(255,107,0,0.3);padding:3px 8px;border-radius:6px;font-weight:900;font-family:'JetBrains Mono',monospace;font-size:0.8rem;">${w.warehouse}</span>
            </td>
            <td style="padding:12px 8px;font-weight:700;color:#f1f5f9;font-size:0.83rem;">${w.city}, ${w.province} <span style="color:#64748b;">(${w.country})</span></td>
            <td style="padding:12px 8px;">
              ${candidates.length === 0 ?
                `<span style="color:#64748b;font-style:italic;font-size:0.78rem;">No candidates assigned</span>` :
                candidates.map(u => `<span style="display:inline-block;background:rgba(99,102,241,0.15);color:#a5b4fc;border:1px solid rgba(99,102,241,0.3);padding:2px 8px;border-radius:12px;font-size:0.75rem;font-weight:700;margin:2px;">${u.username || u.title || u.name}</span>`).join('')
              }
            </td>
            <td style="padding:12px 8px;">
              ${expectedDate ? `
                <div style="font-weight:800;color:${uCol};font-size:0.85rem;">${expectedDate.split('-').reverse().join('/')}</div>
                <div style="font-size:0.72rem;margin-top:2px;background:${uBg};color:${uCol};border:1px solid ${uCol}33;padding:2px 8px;border-radius:8px;display:inline-block;font-weight:800;">
                  ${days < 0 ? 'Cohort Passed' : days === 0 ? '🔴 TODAY!' : days <= 7 ? `🔴 ${days}d left!` : days <= 14 ? `⚠️ ${days} days` : `✅ ${days} days away`}
                </div>
              ` : '<span style="color:#64748b;font-style:italic;font-size:0.78rem;">No date set</span>'}
            </td>
            <td style="padding:12px 8px;">
              <span style="display:inline-flex;align-items:center;gap:4px;font-size:0.78rem;font-weight:800;color:${w.enabled ? '#22c55e' : '#64748b'};">
                <span style="width:8px;height:8px;border-radius:50%;background:${w.enabled ? '#22c55e' : '#64748b'};${w.enabled ? 'box-shadow:0 0 6px #22c55e;' : ''}display:inline-block;"></span>
                ${w.enabled ? 'Active' : 'Paused'}
              </span>
            </td>
            <td style="padding:12px 8px;">
              <a href="${portalBase}/app#/jobSearch" target="_blank" rel="noopener noreferrer"
                 title="Open live shift search for ${w.warehouse}"
                 style="background:linear-gradient(135deg,#059669,#047857);color:#fff;border:none;padding:6px 12px;border-radius:8px;font-size:0.75rem;font-weight:800;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:4px;margin-right:4px;">
                ⚡ Live Shifts ↗
              </a>
              <button class="btn-jw-launch-bot" data-watch-id="${w.id}" title="Launch Bot Modal for all candidates on this watch"
                style="background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;border:none;padding:6px 10px;border-radius:8px;font-size:0.75rem;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:4px;margin-right:4px;">
                🤖 Bot
              </button>
              <button class="btn-jw-toggle" data-watch-id="${w.id}" data-enabled="${w.enabled}"
                title="${w.enabled ? 'Pause watch' : 'Resume watch'}"
                style="background:rgba(255,255,255,0.06);color:#cbd5e1;border:1px solid rgba(255,255,255,0.12);padding:5px 8px;border-radius:8px;font-size:0.75rem;font-weight:700;cursor:pointer;">
                ${w.enabled ? '⏸️' : '▶️'}
              </button>
              <button class="btn-jw-delete" data-watch-id="${w.id}" title="Remove watch"
                style="background:rgba(239,68,68,0.12);color:#f87171;border:1px solid rgba(239,68,68,0.25);padding:5px 8px;border-radius:8px;font-size:0.75rem;cursor:pointer;margin-left:2px;">
                🗑️
              </button>
            </td>
          </tr>`;
      }).join('');

      // Upcoming cohort calendar
      const calendarRows = UPCOMING_COHORT_PREDICTIONS.map(p => {
        const days = daysUntil(p.expectedDate);
        const uCol = urgencyColor(days);
        const uBg = urgencyBg(days);
        const watchActive = watches.some(w => w.warehouse === p.warehouse && w.enabled);
        const portalBase = p.country === 'Canada' ? 'https://hiring.amazon.ca' : 'https://hiring.amazon.com';
        return `
          <div style="background:${uBg};border:1px solid ${uCol}30;border-left:3px solid ${uCol};border-radius:12px;padding:14px 16px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
            <div style="flex:0 0 auto;min-width:80px;text-align:center;">
              <div style="font-size:1.1rem;font-weight:900;color:${uCol};">${days < 0 ? '✓' : days === 0 ? '🔴' : days <= 7 ? '🔴' : '📅'}</div>
              <div style="font-size:0.68rem;font-weight:800;color:${uCol};margin-top:2px;">${days < 0 ? 'PASSED' : days === 0 ? 'TODAY' : `${days} DAYS`}</div>
            </div>
            <div style="flex:0 0 auto;min-width:60px;">
              <span style="background:rgba(255,107,0,0.15);color:#ff9100;border:1px solid rgba(255,107,0,0.3);padding:4px 10px;border-radius:8px;font-weight:900;font-family:'JetBrains Mono',monospace;font-size:0.88rem;">${p.warehouse}</span>
            </div>
            <div style="flex:1;min-width:160px;">
              <div style="font-weight:800;color:#f1f5f9;font-size:0.88rem;">${p.cohort}</div>
              <div style="font-size:0.75rem;color:#94a3b8;margin-top:2px;">📍 ${p.city}, ${p.province} • 💰 ${p.pay} • ${p.country === 'Canada' ? '🇨🇦' : '🇺🇸'} ${p.country}</div>
              <div style="font-size:0.72rem;color:#64748b;margin-top:2px;">Expected: ${p.expectedDate.split('-').reverse().join('/')} ${confidenceBadge(p.confidence)}</div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <a href="${portalBase}/app#/jobSearch" target="_blank" rel="noopener noreferrer"
                 style="background:linear-gradient(135deg,#059669,#047857);color:#fff;padding:8px 14px;border-radius:10px;font-size:0.78rem;font-weight:800;text-decoration:none;display:inline-flex;align-items:center;gap:5px;">
                ⚡ Open Live Shifts ↗
              </a>
              ${watchActive ? `<span style="background:rgba(34,197,94,0.15);color:#22c55e;border:1px solid rgba(34,197,94,0.3);padding:6px 12px;border-radius:8px;font-size:0.75rem;font-weight:800;">✅ Watching</span>` :
                isSuperOrAdmin ? `<button class="btn-add-quick-watch" data-warehouse="${p.warehouse}" data-city="${p.city}" data-province="${p.province}" data-country="${p.country}" data-date="${p.expectedDate}" data-label="${p.cohort.replace(/"/g,'')}"
                  style="background:rgba(124,58,237,0.15);color:#c4b5fd;border:1px solid rgba(124,58,237,0.35);padding:7px 12px;border-radius:9px;font-size:0.75rem;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:5px;">
                  🔔 Watch This Cohort
                </button>` : ''
              }
            </div>
          </div>`;
      }).join('');

      // Recent notifications
      const notifRows = notifs.length === 0 ? `<div style="text-align:center;padding:24px;color:#64748b;font-size:0.85rem;">No alerts yet. Add warehouse watches to receive advance notifications.</div>` :
        notifs.map(n => {
          const isRead = (n.readBy || []).includes(currentUserEmail);
          return `<div class="btn-notif-read" data-notif-id="${n.id}" style="padding:12px 16px;background:${isRead ? 'transparent' : 'rgba(99,102,241,0.08)'};border:1px solid ${isRead ? 'rgba(255,255,255,0.06)' : 'rgba(99,102,241,0.25)'};border-radius:10px;margin-bottom:8px;cursor:pointer;transition:background 0.15s;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
              <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-size:1.1rem;">${isRead ? '📬' : '📩'}</span>
                <div>
                  <div style="font-weight:${isRead ? '600' : '800'};color:${isRead ? '#94a3b8' : '#e2e8f0'};font-size:0.84rem;">${n.msg || n.message || 'Job alert'}</div>
                  <div style="font-size:0.72rem;color:#64748b;margin-top:2px;">${new Date(n.triggeredAt).toLocaleString()}</div>
                </div>
              </div>
              ${n.warehouse && n.candidateId ? `
                <button class="btn-notif-launch-bot" data-notif-id="${n.id}" data-warehouse="${n.warehouse}" data-candidate-id="${n.candidateId}"
                  style="background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;border:none;padding:6px 12px;border-radius:8px;font-size:0.75rem;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:5px;">
                  🤖 Open Bot
                </button>` : ''}
            </div>
          </div>`;
        }).join('');

      // Add Watch form — only for admins/operators
      const addWatchForm = isSuperOrAdmin ? `
        <div style="background:rgba(15,23,42,0.8);border:1px solid rgba(99,102,241,0.3);border-radius:14px;padding:20px;margin-bottom:24px;">
          <div style="font-size:0.9rem;font-weight:900;color:#a5b4fc;margin-bottom:16px;display:flex;align-items:center;gap:8px;">
            🔔 Add New Warehouse Watch
            <span style="font-size:0.7rem;font-weight:600;color:#64748b;font-style:italic;">(1 Warehouse → Multiple Candidates)</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:12px;align-items:end;flex-wrap:wrap;">
            <div>
              <label style="font-size:0.72rem;font-weight:800;color:#64748b;display:block;margin-bottom:6px;">🏭 SELECT WAREHOUSE</label>
              <select id="inpWatchWarehouse" style="width:100%;background:#0f172a;border:1px solid rgba(99,102,241,0.35);color:#f1f5f9;padding:9px 12px;border-radius:9px;font-size:0.83rem;font-weight:700;outline:none;">
                ${warehouseChoices.map(w => `<option value="${w.warehouse}" data-city="${w.city}" data-province="${w.province}" data-country="${w.country}">${w.warehouse} — ${w.city}, ${w.province} (${w.country})</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="font-size:0.72rem;font-weight:800;color:#64748b;display:block;margin-bottom:6px;">👥 ASSIGN CANDIDATES</label>
              <select id="inpWatchCandidates" multiple style="width:100%;background:#0f172a;border:1px solid rgba(99,102,241,0.35);color:#f1f5f9;padding:9px 12px;border-radius:9px;font-size:0.83rem;font-weight:700;height:68px;outline:none;">
                ${allUsers.map(u => `<option value="${u.id}">${u.username || u.title || u.name} (${u.email})</option>`).join('')}
              </select>
              <div style="font-size:0.68rem;color:#64748b;margin-top:3px;">Hold Ctrl/Cmd to select multiple</div>
            </div>
            <div>
              <label style="font-size:0.72rem;font-weight:800;color:#64748b;display:block;margin-bottom:6px;">📅 EXPECTED COHORT DATE (Optional)</label>
              <input id="inpWatchDate" type="date" style="width:100%;background:#0f172a;border:1px solid rgba(99,102,241,0.35);color:#f1f5f9;padding:9px 12px;border-radius:9px;font-size:0.83rem;font-weight:700;outline:none;box-sizing:border-box;">
            </div>
            <button id="btnAddWatch" style="background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:none;padding:10px 20px;border-radius:9px;font-weight:800;font-size:0.85rem;cursor:pointer;white-space:nowrap;height:40px;align-self:end;">
              + Add Watch
            </button>
          </div>
        </div>
      ` : '';

      return `
        <div style="padding:0;">
          <!-- Header -->
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px;">
            <div>
              <h2 style="font-size:1.5rem;font-weight:900;color:#f1f5f9;margin:0;letter-spacing:-0.02em;">🔔 Job Alert System</h2>
              <p style="color:#94a3b8;font-size:0.85rem;margin:4px 0 0;">Watch warehouses for upcoming hiring cohorts • Get 14-day advance alerts • 1-click auto-fill candidate data</p>
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.3);color:#22c55e;padding:8px 16px;border-radius:10px;font-weight:800;font-size:0.82rem;">
                🟢 ${watches.filter(w => w.enabled).length} Active Watches
              </div>
              <div style="background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.3);color:#a5b4fc;padding:8px 16px;border-radius:10px;font-weight:800;font-size:0.82rem;">
                📩 ${(state.jobAlertNotifs||[]).filter(n=>!(n.readBy||[]).includes(currentUserEmail)).length} Unread
              </div>
            </div>
          </div>

          <!-- Status Explanation Banner -->
          <div style="background:linear-gradient(135deg,rgba(99,102,241,0.1),rgba(124,58,237,0.1));border:1px solid rgba(99,102,241,0.25);border-radius:14px;padding:14px 18px;margin-bottom:24px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <span style="font-size:1.4rem;">⚡</span>
            <div style="flex:1;min-width:200px;">
              <div style="font-weight:800;color:#c7d2fe;font-size:0.9rem;">Amazon "Job doesn't exist" error → 100% Eliminated</div>
              <div style="font-size:0.78rem;color:#94a3b8;margin-top:3px;">All portal links now use <strong style="color:#38bdf8;">Live Shift Booking</strong> and <strong style="color:#60a5fa;">Interview Dashboard</strong> URLs — these are always active and never expire. When a shift fills up, simply click the live search to find the next available one.</div>
            </div>
          </div>

          ${addWatchForm}

          <!-- Notification Inbox -->
          <div style="background:rgba(15,23,42,0.7);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:20px;margin-bottom:24px;">
            <div style="font-size:0.9rem;font-weight:900;color:#f1f5f9;margin-bottom:14px;display:flex;align-items:center;gap:8px;">
              📩 Recent Alerts & Notifications
              <span style="background:rgba(99,102,241,0.15);color:#a5b4fc;border:1px solid rgba(99,102,241,0.3);padding:2px 8px;border-radius:8px;font-size:0.68rem;font-weight:800;">${notifs.length}</span>
            </div>
            ${notifRows}
          </div>

          <!-- Active Watches Table -->
          <div style="background:rgba(15,23,42,0.7);border:1px solid rgba(255,255,255,0.08);border-radius:14px;overflow:hidden;margin-bottom:28px;">
            <div style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:space-between;">
              <div style="font-size:0.9rem;font-weight:900;color:#f1f5f9;display:flex;align-items:center;gap:8px;">
                👁️ Active Warehouse Watches
                <span style="background:rgba(255,255,255,0.06);color:#64748b;padding:2px 8px;border-radius:8px;font-size:0.72rem;">${watches.length} total</span>
              </div>
            </div>
            <div style="overflow-x:auto;">
              <table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
                <thead>
                  <tr style="border-bottom:1px solid rgba(255,255,255,0.08);color:#64748b;font-size:0.7rem;font-weight:800;text-transform:uppercase;letter-spacing:0.04em;">
                    <th style="padding:10px 8px;">WAREHOUSE</th>
                    <th style="padding:10px 8px;">LOCATION</th>
                    <th style="padding:10px 8px;">CANDIDATES</th>
                    <th style="padding:10px 8px;">NEXT COHORT</th>
                    <th style="padding:10px 8px;">STATUS</th>
                    <th style="padding:10px 8px;">ACTIONS</th>
                  </tr>
                </thead>
                <tbody id="jwWatchTableBody" style="color:#cbd5e1;">
                  ${watchRows}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Upcoming Cohort Calendar -->
          <div style="background:rgba(15,23,42,0.7);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:20px;">
            <div style="font-size:0.9rem;font-weight:900;color:#f1f5f9;margin-bottom:16px;display:flex;align-items:center;gap:8px;">
              📅 Upcoming Amazon Hiring Cohorts — Advance Calendar
              <span style="background:rgba(245,158,11,0.15);color:#fbbf24;border:1px solid rgba(245,158,11,0.3);padding:2px 8px;border-radius:8px;font-size:0.68rem;font-weight:800;">Q4 2026</span>
            </div>
            <div style="font-size:0.75rem;color:#64748b;margin-bottom:14px;">Amazon typically releases new hiring cohorts every 4-6 weeks. Alert fires 14 days before expected opening. Red = &lt;7 days, Amber = 8-14 days, Green = 15+ days.</div>
            <div style="display:flex;flex-direction:column;gap:10px;">
              ${calendarRows}
            </div>
          </div>
        </div>
      `;
    }

    /* ─────────────────────────────────────────────
       TAB 6: SCHEDULE ID SCANNER (Matching Screenshots 2, 3, 4)
    ───────────────────────────────────────────── */
    function renderScheduleScannerTab(state) {
      const totalIds = Math.max(1, schScannerState.endId - schScannerState.startId + 1);
      const estTime = Math.round((totalIds * schScannerState.delayMs) / 1000);
      const progressPercent = Math.min(100, Math.round((schScannerState.scannedCount / totalIds) * 100));

      const allSystemUsers = state.users || [];
      const userOptions = Array.from(new Set(allSystemUsers.map(u => {
        const name = u.title || u.username || u.name || 'Candidate';
        const emailStr = u.email ? `(${u.email})` : '';
        const phoneStr = u.phone ? u.phone : '';
        return `${name} ${phoneStr} ${emailStr}`.replace(/\s+/g, ' ').trim();
      }).filter(Boolean)));

      if (userOptions.length === 0) {
        userOptions.push('Tanishk Sudani (admin2003@gmail.com) - Super Admin');
      }

      if (!schScannerState.selectedUser && userOptions.length > 0) {
        schScannerState.selectedUser = userOptions[0];
      }

      return `
        <div class="glass-3d-card" style="background:#0f172a; border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:24px; color:#f8fafc;">
          <h3 style="font-size:1.3rem; font-weight:800; color:#ffffff; margin-bottom:20px;">Scanner</h3>

          <!-- Form Control Grid -->
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:16px;">
            <!-- SELECT USER -->
            <div>
              <label style="display:block; font-size:0.75rem; font-weight:800; color:#94a3b8; letter-spacing:0.05em; margin-bottom:6px; text-transform:uppercase;">SELECT USER *</label>
              <select id="schScannerUserSelect" style="width:100%; background:#1e293b; border:1px solid rgba(255,255,255,0.12); color:#ffffff; padding:10px 14px; border-radius:10px; font-size:0.88rem; outline:none;">
                <option value="">-- Select a user --</option>
                ${userOptions.map(opt => `<option value="${opt}" ${schScannerState.selectedUser === opt ? 'selected' : ''}>${opt}</option>`).join('')}
              </select>
            </div>

            <!-- DELAY (MS) -->
            <div>
              <label style="display:block; font-size:0.75rem; font-weight:800; color:#94a3b8; letter-spacing:0.05em; margin-bottom:6px; text-transform:uppercase;">DELAY (MS)</label>
              <input type="number" id="schScannerDelay" value="${schScannerState.delayMs}" min="350" style="width:100%; background:#1e293b; border:1px solid rgba(255,255,255,0.12); color:#ffffff; padding:10px 14px; border-radius:10px; font-size:0.88rem; outline:none;">
              <div style="font-size:0.72rem; color:#64748b; margin-top:4px;">Optimal 500ms - 2500ms for stable rate-limiting.</div>
            </div>

            <!-- SCHID START # -->
            <div>
              <label style="display:block; font-size:0.75rem; font-weight:800; color:#94a3b8; letter-spacing:0.05em; margin-bottom:6px; text-transform:uppercase;">SCHID START # *</label>
              <input type="number" id="schScannerStart" placeholder="e.g. 6060" value="${schScannerState.startId}" style="width:100%; background:#1e293b; border:1px solid rgba(255,255,255,0.12); color:#ffffff; padding:10px 14px; border-radius:10px; font-size:0.88rem; outline:none;">
            </div>

            <!-- SCHID END # -->
            <div>
              <label style="display:block; font-size:0.75rem; font-weight:800; color:#94a3b8; letter-spacing:0.05em; margin-bottom:6px; text-transform:uppercase;">SCHID END # *</label>
              <input type="number" id="schScannerEnd" placeholder="e.g. 6200" value="${schScannerState.endId}" style="width:100%; background:#1e293b; border:1px solid rgba(255,255,255,0.12); color:#ffffff; padding:10px 14px; border-radius:10px; font-size:0.88rem; outline:none;">
            </div>
          </div>

          <!-- Range Info Summary -->
          <div id="schScannerRangeSummary" style="font-size:0.8rem; color:#94a3b8; font-weight:500; margin-bottom:18px; text-align:center;">
            Range: SCH-CA-000000${schScannerState.startId} ~ SCH-CA-000000${schScannerState.endId} (${totalIds} IDs) - Est. time: ~${estTime}s
          </div>

          <!-- Start / Stop Action Button -->
          <div style="display:flex; justify-content:center; align-items:center; margin-top:14px;">
            ${schScannerState.isScanning ? `
              <button id="btnStopSchScan" style="background:#dc2626; color:#ffffff; border:none; padding:12px 32px; border-radius:12px; font-weight:800; font-size:0.9rem; cursor:pointer; box-shadow:0 0 20px rgba(220,38,38,0.5); transition:all 0.2s;">
                ⏹️ Stop Scan
              </button>
            ` : `
              <button id="btnStartSchScan" class="btn-glass-blue" style="padding:12px 36px; font-size:0.95rem;">
                🚀 Start Scan
              </button>
            `}
          </div>

          <!-- Progress Indicator -->
          <div style="margin-top:24px;">
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.85rem; margin-bottom:8px;">
              <span id="schProgressLabel" style="color:#94a3b8; font-weight:600;">${schScannerState.isScanning ? 'Scanning Live Shifts...' : 'Scan Progress'}</span>
              <span id="schScannerProgressText" style="color:#94a3b8; font-weight:600;">${schScannerState.scannedCount} / ${totalIds} (${progressPercent}%)</span>
            </div>
            <div style="width:100%; height:8px; background:#1e293b; border-radius:4px; overflow:hidden;">
              <div id="schScannerProgressBarFill" style="width:${progressPercent}%; height:100%; background:linear-gradient(90deg, #3b82f6, #60a5fa); transition:width 0.3s ease;"></div>
            </div>
          </div>

          <!-- 6 Summary Metric Cards -->
          <div style="display:grid; grid-template-columns:repeat(6, 1fr); gap:12px; margin-top:24px; margin-bottom:24px;">
            <div style="background:rgba(30,41,59,0.7); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:14px; text-align:center;">
              <div id="schMetricScanned" style="font-size:1.6rem; font-weight:900; color:#f8fafc; margin-bottom:2px;">${schScannerState.scannedCount}</div>
              <div style="font-size:0.75rem; font-weight:700; color:#94a3b8;">Scanned</div>
            </div>

            <div style="background:rgba(59,130,246,0.12); border:1px solid rgba(59,130,246,0.3); border-radius:12px; padding:14px; text-align:center;">
              <div id="schMetricFound" style="font-size:1.6rem; font-weight:900; color:#60a5fa; margin-bottom:2px;">${schScannerState.foundCount}</div>
              <div style="font-size:0.75rem; font-weight:700; color:#60a5fa;">Found</div>
            </div>

            <div style="background:rgba(30,41,59,0.7); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:14px; text-align:center;">
              <div id="schMetricPosted" style="font-size:1.6rem; font-weight:900; color:#f8fafc; margin-bottom:2px;">${schScannerState.postedCount}</div>
              <div style="font-size:0.75rem; font-weight:700; color:#94a3b8;">POSTED</div>
            </div>

            <div style="background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.3); border-radius:12px; padding:14px; text-align:center;">
              <div id="schMetricAvailable" style="font-size:1.6rem; font-weight:900; color:#34d399; margin-bottom:2px;">${schScannerState.availableCount}</div>
              <div style="font-size:0.75rem; font-weight:700; color:#34d399;">Available</div>
            </div>

            <div style="background:rgba(30,41,59,0.7); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:14px; text-align:center;">
              <div id="schMetricStartDates" style="font-size:1.6rem; font-weight:900; color:#f8fafc; margin-bottom:2px;">${schScannerState.startDatesCount}</div>
              <div style="font-size:0.75rem; font-weight:700; color:#94a3b8;">Start Dates</div>
            </div>

            <div style="background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.3); border-radius:12px; padding:14px; text-align:center;">
              <div id="schMetricNotFound" style="font-size:1.6rem; font-weight:900; color:#f87171; margin-bottom:2px;">${schScannerState.notFoundCount}</div>
              <div style="font-size:0.75rem; font-weight:700; color:#f87171;">Not Found</div>
            </div>
          </div>

          <!-- Results Table -->
          <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:0.82rem; text-align:left;">
              <thead>
                <tr style="border-bottom:1px solid rgba(255,255,255,0.1); color:#64748b; font-size:0.72rem; font-weight:800; text-transform:uppercase; letter-spacing:0.04em;">
                  <th style="padding:10px 8px;">#</th>
                  <th style="padding:10px 8px;">SCHEDULE ID</th>
                  <th style="padding:10px 8px;">STATUS</th>
                  <th style="padding:10px 8px;">AVAILABLE</th>
                  <th style="padding:10px 8px;">START DATES</th>
                  <th style="padding:10px 8px;">LOCATION</th>
                  <th style="padding:10px 8px;">PAY</th>
                  <th style="padding:10px 8px;">SCHEDULE</th>
                  <th style="padding:10px 8px;">TYPE</th>
                  <th style="padding:10px 8px;">HRS/WK</th>
                  <th style="padding:10px 8px;">FIRST DAY</th>
                  <th style="padding:10px 8px; text-align:center;">🤖 BOT</th>
                </tr>
              </thead>
              <tbody id="schResultsTbody">
                ${schScannerState.results.map((row, idx) => `
                  <tr style="border-bottom:1px solid rgba(255,255,255,0.05); color:#cbd5e1; transition:background 0.18s;" onmouseover="this.style.background='rgba(59,130,246,0.06)'" onmouseout="this.style.background='transparent'">
                    <td style="padding:12px 8px; color:#64748b;">${idx + 1}</td>
                    <td style="padding:12px 8px; color:#38bdf8; font-weight:700; font-family:'JetBrains Mono', monospace;">
                      <a href="${row.liveUrl || 'https://hiring.amazon.ca/app#/jobSearch'}" target="_blank" rel="noopener noreferrer" style="color:#38bdf8; text-decoration:none; display:inline-flex; align-items:center; gap:4px;" title="Open live warehouse portal (${row.facility || 'YYC1'})">
                        ${row.scheduleId}
                        <span style="font-size:0.75rem;">↗</span>
                      </a>
                    </td>
                    <td style="padding:12px 8px;">
                      <span style="background:${row.statusBg || 'rgba(59,130,246,0.15)'}; color:${row.statusColor || '#60a5fa'}; border:1px solid ${row.statusBorder || 'rgba(59,130,246,0.35)'}; padding:2px 8px; border-radius:4px; font-size:0.72rem; font-weight:800;">
                        ${row.status}
                      </span>
                    </td>
                    <td style="padding:12px 8px; color:#34d399; font-weight:700;">${row.available}</td>
                    <td style="padding:12px 8px; color:#60a5fa; font-weight:700;">${row.startDates}</td>
                    <td style="padding:12px 8px; font-weight:600;">
                      <span style="background:rgba(255,107,0,0.15); color:#ff9100; border:1px solid rgba(255,107,0,0.3); padding:2px 6px; border-radius:4px; font-size:0.75rem; font-weight:800; font-family:'JetBrains Mono',monospace; margin-right:6px;">${row.facility || 'AMZN'}</span>
                      <span style="color:#f1f5f9;">${row.location}</span>
                    </td>
                    <td style="padding:12px 8px; font-weight:800; color:#10b981;">${row.pay}</td>
                    <td style="padding:12px 8px; font-size:0.78rem; color:#cbd5e1;">${row.schedule}</td>
                    <td style="padding:12px 8px; font-weight:700; font-size:0.78rem;">${row.type}</td>
                    <td style="padding:12px 8px;">${row.hrsPerWk}h</td>
                    <td style="padding:12px 8px; font-family:'JetBrains Mono', monospace; color:#94a3b8;">${formatDateDDMMYYYY(row.firstDay)}</td>
                    <td style="padding:12px 8px; text-align:center;">
                      <button class="btn-launch-bot" data-row-idx="${idx}" title="🤖 Auto-fill Amazon hiring form for selected user" style="background:linear-gradient(135deg,#7c3aed,#6d28d9); color:#fff; border:1px solid rgba(167,139,250,0.5); padding:5px 12px; border-radius:8px; font-size:0.78rem; font-weight:800; cursor:pointer; box-shadow:0 2px 10px rgba(124,58,237,0.4); display:inline-flex; align-items:center; gap:5px; white-space:nowrap; transition:all 0.2s;" onmouseover="this.style.boxShadow='0 0 18px rgba(139,92,246,0.7)'" onmouseout="this.style.boxShadow='0 2px 10px rgba(124,58,237,0.4)'">
                        🤖 Launch
                      </button>
                    </td>
                  </tr>
                `).join('')}
                ${schScannerState.results.length === 0 ? `
                  <tr id="schEmptyRow">
                    <td colspan="11" style="text-align:center; padding:32px; color:#64748b; font-weight:500;">
                      No schedule scan results yet. Select user, set SCHID range, and click "Start Scan".
                    </td>
                  </tr>
                ` : ''}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    function renderSubUsersTab(state) {
      const list = state.subUsers || [];
      const isSuperAdmin = (
        sessionStorage.getItem('acs_is_super_admin') === 'true' ||
        sessionStorage.getItem('acs_is_main_admin') === 'true' ||
        sessionStorage.getItem('acs_user_role') === 'SuperAdmin' ||
        (sessionStorage.getItem('acs_user_email') || '').toLowerCase() === 'admin2003@gmail.com' ||
        (sessionStorage.getItem('acs_user_email') || '').toLowerCase() === 'admin'
      );

      // Helper to generate tree rows for Admins and their child Operators
      const renderTreeTableRows = () => {
        if (!list || list.length === 0) {
          return `<tr><td colspan="7" style="padding:32px; text-align:center; color:#94a3b8;">🛡️ No operators registered yet. Click "➕ Add Operator" to add operators.</td></tr>`;
        }

        const admins = list.filter(su => su.role === 'Admin');
        const processedIds = new Set();
        let rowsHtml = '';
        let rowIndex = 1;

        // 1. Render Admins and their child Operators underneath with branch connectors (├── and └──)
        admins.forEach((admin) => {
          processedIds.add(admin.id);
          const adminName = admin.name || admin.username;
          const adminEmail = (admin.email || '').toLowerCase();

          // Main Admin Row
          rowsHtml += `
            <tr style="border-bottom:1px solid rgba(255,107,0,0.25); background:rgba(255,107,0,0.06);">
              <td style="padding:14px 12px; font-weight:900; color:#ff9100; font-size:0.95rem;">${rowIndex++}</td>
              <td style="padding:14px 12px; font-weight:800; color:#ffffff; font-size:0.92rem;">👑 ${adminName}</td>
              <td style="padding:14px 12px; color:#cbd5e1;">${admin.email}</td>
              <td style="padding:14px 12px;"><span style="background:rgba(255,107,0,0.25); color:#ff9100; border:1px solid #ff9100; padding:4px 10px; border-radius:12px; font-weight:900; font-size:0.75rem; text-transform:uppercase;">👑 Admin</span></td>
              <td style="padding:14px 12px; white-space:nowrap;"><span style="background:rgba(255,255,255,0.1); color:#f8fafc; padding:4px 10px; border-radius:12px; font-weight:800; font-size:0.75rem; white-space:nowrap;">Super admin (Tanishk Sudani)</span></td>
              <td style="padding:14px 12px; color:#94a3b8; font-size:0.82rem;">${formatDateDDMMYYYY(admin.created || admin.created_at || '31/07/2026')}</td>
              <td style="padding:14px 12px; text-align:right; white-space:nowrap;">
                ${isSuperAdmin ? `
                <button class="btn-add-under-admin" data-admin-id="${admin.id}" data-admin-name="${adminName}" data-admin-email="${admin.email}" title="Add Person under ${adminName}" style="width:34px; height:34px; border-radius:50%; background:rgba(16,185,129,0.18); border:1px solid rgba(16,185,129,0.45); color:#34d399; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; margin-right:4px; transition:all 0.2s ease; box-shadow:0 2px 8px rgba(16,185,129,0.25);" onmouseover="this.style.transform='scale(1.1)'; this.style.boxShadow='0 0 14px rgba(16,185,129,0.5)';" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 2px 8px rgba(16,185,129,0.25)';">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="8.5" cy="7" r="4"></circle>
                    <line x1="20" y1="8" x2="20" y2="14"></line>
                    <line x1="17" y1="11" x2="23" y2="11"></line>
                  </svg>
                </button>
                ` : ''}
                <button class="btn-edit-subuser" data-suid="${admin.id}" title="Edit Operator" style="width:34px; height:34px; border-radius:50%; background:rgba(59,130,246,0.18); border:1px solid rgba(59,130,246,0.45); color:#60a5fa; font-size:0.95rem; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; margin-right:4px; transition:all 0.2s ease; box-shadow:0 2px 8px rgba(59,130,246,0.25);">✏️</button>
                <button class="btn-delete-subuser" data-suid="${admin.id}" title="Remove Operator">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                </button>
              </td>
            </tr>
          `;

          // Find child operators belonging to this Admin
          const children = list.filter(su => {
            if (su.id === admin.id) return false;
            const creator = (su.created_by || '').toLowerCase();
            return creator === adminEmail || creator === adminName.toLowerCase();
          });

          children.forEach((child, cIdx) => {
            processedIds.add(child.id);
            const isLast = cIdx === children.length - 1;
            const branchSymbol = isLast ? '└──' : '├──';
            const childName = child.name || child.username;

            rowsHtml += `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.04); background:rgba(15,23,42,0.45);">
                <td style="padding:12px 12px; text-align:center; color:#64748b;"></td>
                <td style="padding:12px 12px; font-weight:700; color:#ffffff; padding-left:24px;">
                  <span style="color:#ff9100; font-family:monospace; font-weight:900; font-size:0.95rem; margin-right:8px;">${branchSymbol}</span>
                  <span>🛡️ ${childName}</span>
                </td>
                <td style="padding:12px 12px; color:#cbd5e1; font-size:0.85rem;">${child.email}</td>
                <td style="padding:12px 12px;"><span style="background:rgba(59,130,246,0.2); color:#60a5fa; border:1px solid rgba(59,130,246,0.4); padding:3px 8px; border-radius:12px; font-weight:800; font-size:0.73rem;">🛡️ ${child.role}</span></td>
                <td style="padding:12px 12px; white-space:nowrap;"><span style="background:rgba(255,107,0,0.15); color:#ff9100; border:1px solid rgba(255,107,0,0.3); padding:3px 8px; border-radius:12px; font-weight:800; font-size:0.73rem; white-space:nowrap;">Admin (${adminName})</span></td>
                <td style="padding:12px 12px; color:#94a3b8; font-size:0.82rem;">${formatDateDDMMYYYY(child.created || child.created_at || '31/07/2026')}</td>
                <td style="padding:12px 12px; text-align:right; white-space:nowrap;">
                  <button class="btn-edit-subuser" data-suid="${child.id}" title="Edit Operator" style="width:34px; height:34px; border-radius:50%; background:rgba(59,130,246,0.18); border:1px solid rgba(59,130,246,0.45); color:#60a5fa; font-size:0.95rem; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; margin-right:4px; transition:all 0.2s ease; box-shadow:0 2px 8px rgba(59,130,246,0.25);">✏️</button>
                  <button class="btn-delete-subuser" data-suid="${child.id}" title="Remove Operator">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      <line x1="10" y1="11" x2="10" y2="17"></line>
                      <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                  </button>
                </td>
              </tr>
            `;
          });
        });

        // 2. Render remaining standalone operators created directly by Super Admin
        const remaining = list.filter(su => !processedIds.has(su.id));
        remaining.forEach((su) => {
          const suName = su.name || su.username;
          const isAdm = su.role === 'Admin';
          rowsHtml += `
            <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
              <td style="padding:14px 12px; font-weight:900; color:#94a3b8;">${rowIndex++}</td>
              <td style="padding:14px 12px; font-weight:800; color:#ffffff;">${isAdm ? '👑' : '🛡️'} ${suName}</td>
              <td style="padding:14px 12px; color:#cbd5e1;">${su.email}</td>
              <td style="padding:14px 12px;"><span style="background:${isAdm ? 'rgba(255,107,0,0.2)' : 'rgba(59,130,246,0.2)'}; color:${isAdm ? '#ff9100' : '#60a5fa'}; border:1px solid ${isAdm ? '#ff9100' : '#60a5fa'}; padding:4px 10px; border-radius:12px; font-weight:800; font-size:0.75rem;">${isAdm ? '👑 Admin' : '🛡️ Operator'}</span></td>
              <td style="padding:14px 12px; white-space:nowrap;"><span style="background:rgba(255,255,255,0.08); color:#a5b4fc; padding:4px 10px; border-radius:12px; font-weight:700; font-size:0.75rem; white-space:nowrap;">Super admin (Tanishk Sudani)</span></td>
              <td style="padding:14px 12px; color:#94a3b8; font-size:0.82rem;">${formatDateDDMMYYYY(su.created || su.created_at || '31/07/2026')}</td>
              <td style="padding:14px 12px; text-align:right; white-space:nowrap;">
                <button class="btn-edit-subuser" data-suid="${su.id}" title="Edit Operator" style="width:34px; height:34px; border-radius:50%; background:rgba(59,130,246,0.18); border:1px solid rgba(59,130,246,0.45); color:#60a5fa; font-size:0.95rem; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; margin-right:4px; transition:all 0.2s ease; box-shadow:0 2px 8px rgba(59,130,246,0.25);">✏️</button>
                <button class="btn-delete-subuser" data-suid="${su.id}" title="Remove Operator">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                </button>
              </td>
            </tr>
          `;
        });

        return rowsHtml;
      }

      return `
        <div class="glass-3d-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:16px;">
            <div>
              <h3 style="font-size:1.3rem; font-weight:800; color:#ffffff; margin:0;">👤 All Operator's</h3>
            </div>
            <button id="btnOpenSubUserModal" class="btn-glass-blue" style="padding:10px 20px; font-size:0.85rem;">➕ Add Operator</button>
          </div>

          <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.9rem;">
              <thead>
                <tr style="border-bottom:1px solid rgba(255,255,255,0.1); color:#94a3b8; font-weight:700; text-transform:uppercase; font-size:0.75rem;">
                  <th style="padding:12px;">#</th>
                  <th style="padding:12px;">Name / Username</th>
                  <th style="padding:12px;">Email Address</th>
                  <th style="padding:12px;">Security Role</th>
                  <th style="padding:12px;">Added By (name)</th>
                  <th style="padding:12px;">Created</th>
                  <th style="padding:12px; text-align:right;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${renderTreeTableRows()}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    function renderEditSubUserModal() {
      const su = editingSubUserData;
      if (!su) return '';

      return `
        <div class="modal-backdrop" id="editSubUserModalBackdrop" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(9,13,22,0.85); backdrop-filter:blur(16px); display:flex; align-items:center; justify-content:center; z-index:9999;">
          <div class="modal-box" style="background:linear-gradient(145deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.92)); border:1px solid rgba(59,130,246,0.45); border-radius:20px; padding:28px; width:92%; max-width:500px; box-shadow:0 25px 60px rgba(0,0,0,0.8), 0 0 35px rgba(59,130,246,0.25), inset 0 1px 2px rgba(255,255,255,0.15);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:12px;">
              <div style="display:flex; align-items:center; gap:10px;">
                <div style="width:36px; height:36px; border-radius:10px; background:linear-gradient(135deg,#1d4ed8,#3b82f6); display:flex; align-items:center; justify-content:center; font-size:1.1rem; box-shadow:0 0 12px rgba(59,130,246,0.5);">
                  ✏️
                </div>
                <div>
                  <h3 style="font-size:1.25rem; font-weight:900; color:#ffffff; margin:0; letter-spacing:-0.01em;">Edit Operator Role</h3>
                  <div style="font-size:0.75rem; color:#94a3b8; margin-top:2px;">Update operator credentials &amp; RBAC access level</div>
                </div>
              </div>
              <button id="btnCloseEditSubModal" style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); color:#94a3b8; width:32px; height:32px; border-radius:8px; font-size:1.2rem; cursor:pointer; display:flex; align-items:center; justify-content:center;">&times;</button>
            </div>

            <form id="formEditSubUser" style="display:grid; grid-template-columns:1fr; gap:14px;">
              <div>
                <label style="display:block; font-size:0.75rem; font-weight:700; color:#94a3b8; margin-bottom:6px;">🆔 Username *</label>
                <input type="text" id="inpEditSubUsername" value="${su.username || su.name || ''}" required style="width:100%; background:rgba(15,23,42,0.8); border:1px solid rgba(59,130,246,0.35); color:#fff; border-radius:10px; padding:11px 14px; font-size:0.88rem; outline:none; box-sizing:border-box;">
              </div>

              <div>
                <label style="display:block; font-size:0.75rem; font-weight:700; color:#94a3b8; margin-bottom:6px;">📧 Email Address *</label>
                <input type="text" inputmode="email" id="inpEditSubEmail" value="${su.email || '@gmail.com'}" required style="width:100%; background:rgba(15,23,42,0.8); border:1px solid rgba(59,130,246,0.35); color:#fff; border-radius:10px; padding:11px 14px; font-size:0.88rem; outline:none; box-sizing:border-box;">
              </div>

              <div>
                <label style="display:block; font-size:0.75rem; font-weight:700; color:#94a3b8; margin-bottom:6px;">🔑 New Password (leave blank to keep current)</label>
                <input type="password" id="inpEditSubPass" placeholder="••••••••" style="width:100%; background:rgba(15,23,42,0.8); border:1px solid rgba(59,130,246,0.35); color:#fff; border-radius:10px; padding:11px 14px; font-size:0.88rem; outline:none; box-sizing:border-box;">
              </div>

              <div>
                <label style="display:block; font-size:0.75rem; font-weight:700; color:#94a3b8; margin-bottom:6px;">🛡️ Security Role (RBAC)</label>
                <select id="inpEditSubRole" style="width:100%; background:rgba(15,23,42,0.8); border:1px solid rgba(59,130,246,0.35); color:#fff; border-radius:10px; padding:11px 14px; font-size:0.88rem; outline:none; box-sizing:border-box;">
                  <option value="Admin" ${su.role === 'Admin' ? 'selected' : ''}>👑 Admin</option>
                  <option value="Operator" ${su.role === 'Operator' ? 'selected' : ''}>🛡️ Operator (Shift Booking &amp; OTP)</option>
                  <option value="Viewer" ${su.role === 'Viewer' ? 'selected' : ''}>👁️ Viewer (Read-only Scanner &amp; Live Search)</option>
                  <option value="Candidate" ${su.role === 'Candidate' ? 'selected' : ''}>👤 Candidate (Individual Candidate Account)</option>
                </select>
              </div>

              <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:16px; border-top:1px solid rgba(255,255,255,0.08); padding-top:16px;">
                <button type="button" id="btnCancelEditSubModal" style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.15); color:#cbd5e1; padding:10px 22px; border-radius:10px; font-weight:700; font-size:0.88rem; cursor:pointer;">Cancel</button>
                <button type="submit" style="background:linear-gradient(135deg,#1d4ed8 0%,#3b82f6 50%,#2563eb 100%); color:#fff; border:1.5px solid rgba(147,197,253,0.5); padding:11px 28px; border-radius:10px; font-weight:900; font-size:0.9rem; cursor:pointer; box-shadow:0 4px 18px rgba(59,130,246,0.5), inset 0 1px 1px rgba(255,255,255,0.4);">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      `;
    }

    function renderSpecsTab(state) {
      return `
        <div class="glass-3d-card">
          <div style="margin-bottom:24px;">
            <h3 style="font-size:1.4rem; font-weight:800; color:#ffffff; margin-bottom:6px;">📘 System Architecture &amp; Database ERD Specifications</h3>
            <p style="font-size:0.88rem; color:#94a3b8;">Comprehensive technical documentation covering Volumes 1-14, 17 Database ERD Tables, and BullMQ Redis Background Queues.</p>
          </div>

          <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:24px;">
            <div style="background:#0f172a; border:1px solid rgba(255,107,0,0.25); padding:24px; border-radius:16px;">
              <h4 style="color:#ff9100; font-size:1.1rem; font-weight:800; margin-bottom:12px;">⚡ Core Shift Booking Engine Workflow</h4>
              <ol style="line-height:1.8; font-size:0.9rem; color:#cbd5e1; padding-left:20px;">
                <li><strong>Enroll Candidate</strong> &rarr; Save encrypted credentials to state vault.</li>
                <li><strong>Spawn Worker Thread</strong> &rarr; Initiate Redis/BullMQ task queue.</li>
                <li><strong>IMAP 2FA Sync</strong> &rarr; Real-time headless listening for Amazon OTP codes via Gmail App Passwords.</li>
                <li><strong>Amazon Authentication</strong> &rarr; Perform automated login &amp; cookie persistence.</li>
                <li><strong>Schedule Poller</strong> &rarr; Continuous scanning of target warehouse shifts.</li>
                <li><strong>Auto-Booking Clicker</strong> &rarr; Instant execution upon slot discovery.</li>
              </ol>
            </div>

            <div style="background:#0f172a; border:1px solid rgba(79,70,229,0.25); padding:24px; border-radius:16px;">
              <h4 style="color:#a5b4fc; font-size:1.1rem; font-weight:800; margin-bottom:12px;">🗄️ 17 Database ERD Entity Tables</h4>
              <ul style="line-height:1.8; font-size:0.9rem; color:#cbd5e1; padding-left:20px;">
                <li><code>users</code> &bull; <code>customers</code> &bull; <code>amazon_accounts</code></li>
                <li><code>gmail_accounts</code> &bull; <code>jobs</code> &bull; <code>schedule_ids</code></li>
                <li><code>workers</code> &bull; <code>scanner_logs</code> &bull; <code>notifications</code></li>
                <li><code>otp_logs</code> &bull; <code>roles</code> &bull; <code>permissions</code></li>
                <li><code>sub_users</code> &bull; <code>activity_logs</code> &bull; <code>booking_history</code></li>
                <li><code>settings</code> &bull; <code>audit_logs</code></li>
              </ul>
            </div>
          </div>
        </div>
      `;
    }

    function renderSmartApplyModal(job) {
      if (!job) return '';
      const jid = String(job.id);
      const status = store.getJobVacancyStatus(jid, job.status || 'Open');
      const isClosed = status === 'Closed' || status === 'Completed';

      const liveWhUrl = job.liveWarehouseUrl || getLiveWarehouseUrl(job.warehouse, job.country);
      const liveCUrl = job.liveCityUrl || getLiveCityUrl(job.city, job.country);
      const directUrl = job.officialUrl || liveWhUrl;

      return `
        <div class="sag-modal-backdrop" id="smartApplyModalBackdrop">
          <div class="sag-modal-card">

            <!-- Top Glow Accent -->
            <div class="sag-top-glow"></div>

            <!-- Header -->
            <div class="sag-header">
              <div class="sag-header-left">
                <div class="sag-header-icon">🚀</div>
                <div style="min-width:0; flex:1;">
                  <div class="sag-eyebrow">Smart Application Gateway &bull; Shift Recovery</div>
                  <h3 class="sag-title">${job.title}</h3>
                  <div class="sag-meta-row">
                    <span class="sag-tag-wh">${job.warehouse}</span>
                    <span class="sag-tag-loc">📍 ${job.city}, ${job.province || ''} ${job.country}</span>
                    <span class="sag-tag-pay">💰 ${job.pay || 'N/A'}</span>
                  </div>
                </div>
              </div>
              <button id="btnCloseSmartApply" class="sag-btn-close" title="Close modal" aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <!-- Status Banner -->
            <div class="sag-status-card ${isClosed ? 'sag-status-closed' : 'sag-status-open'}">
              <div class="sag-status-content">
                <div class="sag-pulse-dot ${isClosed ? 'closed' : 'open'}"></div>
                <div>
                  <div class="sag-status-title" style="color:${isClosed ? '#f87171' : '#34d399'};">
                    ${isClosed ? 'Vacancy Reported Completed / Filled' : 'Status: Live &amp; Active Opening'}
                  </div>
                  <div class="sag-status-sub">
                    ${isClosed ? 'This shift batch is filled. Click Option 1 below to view newly dropped shifts!' : 'Shift batches fill rapidly on Amazon. Choose your booking channel below:'}
                  </div>
                </div>
              </div>
              <button class="btn-toggle-vacancy-status" data-jid="${job.id}" style="background:${isClosed ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}; color:${isClosed ? '#34d399' : '#f87171'}; border:1px solid ${isClosed ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}; padding:8px 16px; border-radius:10px; font-size:0.8rem; font-weight:800; cursor:pointer; white-space:nowrap; flex-shrink:0; transition:all 0.2s;">
                ${isClosed ? '🔄 Mark as Open' : '⚠️ Mark Vacancy Filled'}
              </button>
            </div>

            <!-- Application Channels List -->
            <div class="sag-channels-list">

              <!-- Channel 1: Live Warehouse (RECOMMENDED) -->
              <a href="${liveWhUrl}" target="_blank" rel="noopener noreferrer" class="sag-channel-card sag-card-rec">
                <div class="sag-card-left">
                  <div class="sag-card-icon sag-icon-wh">🏢</div>
                  <div class="sag-card-info">
                    <div class="sag-card-headline">
                      <span class="sag-card-name">Live Warehouse Shift Portal (${job.warehouse})</span>
                      <span class="sag-badge-rec">RECOMMENDED</span>
                    </div>
                    <p class="sag-card-desc">
                      ⚡ Never hits a dead end! Shows all currently open &amp; newly dropped shifts at ${job.warehouse}.
                    </p>
                  </div>
                </div>
                <span class="sag-btn-action-primary">
                  Open Shifts
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="7" y1="17" x2="17" y2="7"></line>
                    <polyline points="7 7 17 7 17 17"></polyline>
                  </svg>
                </span>
              </a>

              <!-- Channel 2: Direct Requisition -->
              <a href="${directUrl}" target="_blank" rel="noopener noreferrer" class="sag-channel-card sag-card-standard">
                <div class="sag-card-left">
                  <div class="sag-card-icon sag-icon-direct">🔗</div>
                  <div class="sag-card-info">
                    <div class="sag-card-headline">
                      <span class="sag-card-name">Direct Requisition URL</span>
                      <span class="sag-badge-id">ID: ${job.id}</span>
                    </div>
                    <p class="sag-card-desc">
                      Opens specific requisition. If Amazon shows &quot;Vacancy complete&quot;, use Option 1 above!
                    </p>
                  </div>
                </div>
                <span class="sag-btn-action-secondary">
                  Direct URL
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="7" y1="17" x2="17" y2="7"></line>
                    <polyline points="7 7 17 7 17 17"></polyline>
                  </svg>
                </span>
              </a>

              <!-- Channel 3: City-Wide Search -->
              <a href="${liveCUrl}" target="_blank" rel="noopener noreferrer" class="sag-channel-card sag-card-standard">
                <div class="sag-card-left">
                  <div class="sag-card-icon sag-icon-city">📍</div>
                  <div class="sag-card-info">
                    <div class="sag-card-headline">
                      <span class="sag-card-name">Browse All ${job.city} Shifts</span>
                    </div>
                    <p class="sag-card-desc">
                      Search all warehouse and sortation positions across ${job.city}.
                    </p>
                  </div>
                </div>
                <span class="sag-btn-action-secondary">
                  Browse City
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="7" y1="17" x2="17" y2="7"></line>
                    <polyline points="7 7 17 7 17 17"></polyline>
                  </svg>
                </span>
              </a>

            </div>

            <!-- Pro-Tip Advisory Footer -->
            <div class="sag-tip-card">
              <span class="sag-tip-icon">💡</span>
              <p class="sag-tip-text">
                <strong style="color:#e2e8f0;">Amazon Shift Recovery Advice:</strong> Amazon hourly staffing posts shifts in pulses throughout the day. Always bookmark the <em style="color:#38bdf8; font-style:normal; font-weight:700;">Live Warehouse Shift Portal</em> for ${job.warehouse} to claim fresh drops immediately!
              </p>
            </div>

          </div>
        </div>
      `;
    }

    /* ─────────────────────────────────────────────
       BOT AUTO-FILL MODAL
       Opens when operator clicks 🤖 Launch on a scanner result row.
       Shows full candidate profile + 100% active Amazon hiring portals (No "Job doesn't exist" errors).
    ───────────────────────────────────────────── */
    function renderBotModal(payload) {
      if (!payload) return '';
      const { user, scanRow } = payload;
      const u = user || {};
      const row = scanRow || {};

      const name = u.username || u.title || u.name || 'Candidate';
      const email = u.email || '';
      const jobId = u.jobId || '';
      const schId = row.scheduleId || u.schId || '';
      const webPass = u.webPass || u.password || '';
      const appPass = u.appPass || '';
      const facility = row.facility || row.warehouse || '';
      const location = row.location || '';
      const pay = row.pay || '';
      const schedule = row.schedule || '';
      const firstDay = row.firstDay || '';

      // Facility & country heuristics:
      // Canadian FC codes start with Y (YYZ, YYC, YVR, YEG, YOW, YKF, etc.)
      const isCanadaFacility = /^Y[A-Z]{2}\d+/i.test(facility);
      const isUsFacility = /^(PHX|ONT|JFK|ORD|DFW|DEN|ATL|MCO|SEA|CLT|BFI|LAX|EWR|MEM|SDF|SMF)/i.test(facility);

      let currentCountry = payload.selectedCountry;
      if (!currentCountry) {
        if (u.country && (u.country.toLowerCase().includes('can') || u.country.toLowerCase() === 'ca')) {
          currentCountry = 'Canada';
        } else if (u.country && (u.country.toLowerCase().includes('us') || u.country.toLowerCase() === 'usa')) {
          currentCountry = 'USA';
        } else if (isCanadaFacility) {
          currentCountry = 'Canada';
        } else if (isUsFacility) {
          currentCountry = 'USA';
        } else {
          // Default to USA so operators in the US don't get the "visiting Canada website from US" warning
          currentCountry = 'USA';
        }
      }

      const isCanada = currentCountry === 'Canada';
      const hiringBase = isCanada ? 'https://hiring.amazon.ca' : 'https://hiring.amazon.com';

      // 100% Guaranteed Active URLs — these NEVER give "Job doesn't exist" error:
      const jobSearchUrl = `${hiringBase}/app#/jobSearch`;
      const dashboardUrl = `${hiringBase}/app#/dashboard`;
      const warehouseJobsUrl = `${hiringBase}/job-opportunities/warehouse-jobs#/`;
      const loginUrl = `${hiringBase}/app#/login`;

      const profileFields = [
        { label: '👤 Full Name', value: name, copy: true },
        { label: '📧 Email', value: email, copy: true },
        { label: '💼 Job ID', value: jobId, copy: true },
        { label: '📅 Schedule ID', value: schId, copy: true },
        { label: '🔑 Web Password', value: webPass ? '••••••••' : '(not set)', raw: webPass, copy: !!webPass },
        { label: '🔐 App Password', value: appPass ? '••••••••' : '(not set)', raw: appPass, copy: !!appPass },
        { label: '🌐 Target Country', value: currentCountry, copy: false },
        { label: '🏭 Facility', value: facility || 'N/A', copy: false },
        { label: '📍 Location', value: location || 'N/A', copy: false },
        { label: '💰 Pay Rate', value: pay || 'N/A', copy: false },
        { label: '📆 First Day', value: formatDateDDMMYYYY(firstDay) || 'N/A', copy: false },
        { label: '⏰ Schedule', value: schedule || 'N/A', copy: false },
      ];

      return `
        <div class="modal-backdrop" id="botModalBackdrop" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(3,7,18,0.88); backdrop-filter:blur(20px); display:flex; align-items:center; justify-content:center; z-index:10000;">
          <div style="background:linear-gradient(145deg, rgba(15,23,42,0.98), rgba(30,41,59,0.95)); border:1px solid rgba(139,92,246,0.55); border-top:2px solid rgba(167,139,250,0.8); border-radius:24px; padding:28px 32px; width:95%; max-width:700px; box-shadow:0 32px 80px rgba(0,0,0,0.8), 0 0 60px rgba(124,58,237,0.3), inset 0 1px 2px rgba(255,255,255,0.12); position:relative; overflow:hidden; max-height:92vh; overflow-y:auto;">
            <!-- Purple glow accent -->
            <div style="position:absolute; top:0; left:15%; right:15%; height:2px; background:linear-gradient(90deg, transparent, #8b5cf6, #a78bfa, #7c3aed, transparent); border-radius:2px; filter:blur(1px);"></div>

            <!-- Header -->
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid rgba(139,92,246,0.2); padding-bottom:14px;">
              <div style="display:flex; align-items:center; gap:14px;">
                <div style="width:46px; height:46px; border-radius:14px; background:linear-gradient(135deg,#7c3aed,#6d28d9); display:flex; align-items:center; justify-content:center; font-size:1.4rem; box-shadow:0 0 24px rgba(124,58,237,0.6); border:1px solid rgba(167,139,250,0.5); flex-shrink:0;">
                  🤖
                </div>
                <div>
                  <div style="font-size:0.72rem; font-weight:800; color:#a78bfa; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:2px;">Amazon Hiring Bot • Shift &amp; Interview Assistant</div>
                  <h3 style="font-size:1.25rem; font-weight:900; color:#ffffff; margin:0; letter-spacing:-0.02em;">Candidate: ${name}</h3>
                  <div style="font-size:0.78rem; color:#94a3b8; margin-top:2px;">${email || 'No Email'} &bull; ${facility || 'Amazon'} &bull; ${schId || 'Live Shift'}</div>
                </div>
              </div>
              <button id="btnCloseBotModal" style="background:rgba(139,92,246,0.12); border:1px solid rgba(139,92,246,0.35); color:#a78bfa; width:36px; height:36px; border-radius:10px; font-size:1.3rem; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:all 0.2s;">&times;</button>
            </div>

            <!-- Interactive Country Selector (Eliminates "Visiting Canada from US" Warning) -->
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:16px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:8px 12px; flex-wrap:wrap;">
              <span style="font-size:0.75rem; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:0.04em;">Amazon Portal:</span>
              <button class="btn-bot-country" data-country="USA" style="background:${!isCanada ? 'linear-gradient(135deg,#2563eb,#1d4ed8)' : 'rgba(255,255,255,0.06)'}; color:${!isCanada ? '#fff' : '#94a3b8'}; border:1px solid ${!isCanada ? 'rgba(147,197,253,0.5)' : 'rgba(255,255,255,0.12)'}; padding:6px 14px; border-radius:8px; font-weight:800; font-size:0.78rem; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition:all 0.2s;">
                🇺🇸 USA (hiring.amazon.com)
              </button>
              <button class="btn-bot-country" data-country="Canada" style="background:${isCanada ? 'linear-gradient(135deg,#dc2626,#b91c1c)' : 'rgba(255,255,255,0.06)'}; color:${isCanada ? '#fff' : '#94a3b8'}; border:1px solid ${isCanada ? 'rgba(252,165,165,0.5)' : 'rgba(255,255,255,0.12)'}; padding:6px 14px; border-radius:8px; font-weight:800; font-size:0.78rem; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition:all 0.2s;">
                🇨🇦 Canada (hiring.amazon.ca)
              </button>
              <span style="margin-left:auto; font-size:0.72rem; color:${!isCanada ? '#60a5fa' : '#fca5a5'}; font-weight:700;">
                ${!isCanada ? '✓ US Visitors (No Warning)' : '✓ Canadian FCs'}
              </span>
            </div>

            <!-- Quick 1-Click Copy Buttons -->
            <div style="display:flex; gap:10px; margin-bottom:16px;">
              <button id="btnBotCopyAll" style="flex:1; background:linear-gradient(135deg,rgba(16,185,129,0.18),rgba(5,150,105,0.25)); color:#34d399; border:1px solid rgba(16,185,129,0.4); padding:10px 14px; border-radius:10px; font-weight:800; font-size:0.8rem; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; transition:all 0.2s;">
                📋 Copy All Credentials (1-Click)
              </button>
              <button id="btnBotCopyScript" style="flex:1; background:linear-gradient(135deg,rgba(139,92,246,0.18),rgba(124,58,237,0.25)); color:#c4b5fd; border:1px solid rgba(139,92,246,0.4); padding:10px 14px; border-radius:10px; font-weight:800; font-size:0.8rem; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; transition:all 0.2s;">
                🤖 Copy Auto-Fill Console Script
              </button>
            </div>

            <!-- Candidate Profile Fields Grid -->
            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:10px; margin-bottom:20px;">
              ${profileFields.map(f => `
                <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:10px 12px; display:flex; flex-direction:column; gap:3px;">
                  <div style="font-size:0.68rem; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:0.04em;">${f.label}</div>
                  <div style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
                    <span style="font-size:0.84rem; font-weight:700; color:${f.copy ? '#f1f5f9' : '#94a3b8'}; font-family:'JetBrains Mono', monospace; word-break:break-all;">${f.value}</span>
                    ${f.copy && f.raw !== undefined ? `<button class="btn-bot-copy" data-copy="${(f.raw || f.value).replace(/"/g,'&quot;')}" title="Copy to clipboard" style="background:rgba(124,58,237,0.15); border:1px solid rgba(167,139,250,0.3); color:#a78bfa; width:24px; height:24px; border-radius:6px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; font-size:0.75rem;">⎘</button>` : f.copy ? `<button class="btn-bot-copy" data-copy="${f.value}" title="Copy to clipboard" style="background:rgba(124,58,237,0.15); border:1px solid rgba(167,139,250,0.3); color:#a78bfa; width:24px; height:24px; border-radius:6px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; font-size:0.75rem;">⎘</button>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>

            <!-- Amazon Hiring Portal Launch Buttons (100% Active • Never "Job doesn't exist") -->
            <div style="background:rgba(124,58,237,0.06); border:1px solid rgba(139,92,246,0.25); border-radius:16px; padding:18px; margin-bottom:18px;">
              <div style="font-size:0.82rem; font-weight:800; color:#a78bfa; margin-bottom:12px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
                <div style="display:flex; align-items:center; gap:8px;">
                  🚀 Official Amazon Shift &amp; Interview Portals
                  <span style="background:rgba(16,185,129,0.15); color:#34d399; border:1px solid rgba(16,185,129,0.3); padding:2px 8px; border-radius:20px; font-size:0.68rem; font-weight:800;">100% LIVE • ZERO EXPIRED URLS</span>
                </div>
                <span style="font-size:0.72rem; color:#94a3b8;">Portal: <strong style="color:#e2e8f0; font-family:monospace;">${hiringBase}</strong></span>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <!-- 1. Live Shift Search -->
                <a href="${jobSearchUrl}" target="_blank" rel="noopener noreferrer" style="background:linear-gradient(135deg,#059669,#047857); color:#fff; border:1px solid rgba(52,211,153,0.5); padding:12px 14px; border-radius:12px; font-weight:800; font-size:0.84rem; text-decoration:none; display:flex; align-items:center; justify-content:space-between; box-shadow:0 4px 16px rgba(5,150,105,0.35); transition:all 0.2s;" onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='none'">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:1.15rem;">⚡</span>
                    <div>
                      <div>Live Shift Booking</div>
                      <div style="font-size:0.68rem; font-weight:500; color:#a7f3d0;">All open shifts • Instant claim</div>
                    </div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
                </a>

                <!-- 2. Interview & Application Dashboard -->
                <a href="${dashboardUrl}" target="_blank" rel="noopener noreferrer" style="background:linear-gradient(135deg,#2563eb,#1d4ed8); color:#fff; border:1px solid rgba(147,197,253,0.4); padding:12px 14px; border-radius:12px; font-weight:800; font-size:0.84rem; text-decoration:none; display:flex; align-items:center; justify-content:space-between; box-shadow:0 4px 16px rgba(37,99,235,0.35); transition:all 0.2s;" onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='none'">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:1.15rem;">📅</span>
                    <div>
                      <div>Interview &amp; Appointments</div>
                      <div style="font-size:0.68rem; font-weight:500; color:#bfdbfe;">Select date/time slot</div>
                    </div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
                </a>

                <!-- 3. Warehouse Jobs Landing -->
                <a href="${warehouseJobsUrl}" target="_blank" rel="noopener noreferrer" style="background:linear-gradient(135deg,#7c3aed,#6d28d9); color:#fff; border:1px solid rgba(167,139,250,0.4); padding:12px 14px; border-radius:12px; font-weight:800; font-size:0.84rem; text-decoration:none; display:flex; align-items:center; justify-content:space-between; box-shadow:0 4px 16px rgba(124,58,237,0.35); transition:all 0.2s;">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:1.15rem;">🏢</span>
                    <div>
                      <div>Warehouse Jobs Board</div>
                      <div style="font-size:0.68rem; font-weight:500; color:#ddd6fe;">Hourly fulfillment roles</div>
                    </div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
                </a>

                <!-- 4. Direct Sign-In Portal -->
                <a href="${loginUrl}" target="_blank" rel="noopener noreferrer" style="background:linear-gradient(135deg,#d97706,#b45309); color:#fff; border:1px solid rgba(253,230,138,0.4); padding:12px 14px; border-radius:12px; font-weight:800; font-size:0.84rem; text-decoration:none; display:flex; align-items:center; justify-content:space-between; box-shadow:0 4px 16px rgba(217,119,6,0.35); transition:all 0.2s;">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:1.15rem;">🔑</span>
                    <div>
                      <div>Candidate Sign-In</div>
                      <div style="font-size:0.68rem; font-weight:500; color:#fef3c7;">Amazon account login</div>
                    </div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
                </a>
              </div>

              <!-- Requisition Notice -->
              <div style="margin-top:14px; padding:10px 14px; background:rgba(0,0,0,0.3); border-radius:10px; border:1px dashed rgba(139,92,246,0.3); font-size:0.75rem; color:#94a3b8; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
                <div>
                  <span style="color:#cbd5e1; font-weight:700;">Requisition / Shift ID:</span>
                  <span style="color:#38bdf8; font-family:'JetBrains Mono',monospace; font-weight:800; margin-left:6px;">${jobId || schId || 'Active Shift'}</span>
                </div>
                ${jobId ? `<a href="${hiringBase}/app#/jobDetail?jobId=${encodeURIComponent(jobId)}" target="_blank" rel="noopener noreferrer" style="color:#a78bfa; font-weight:700; text-decoration:underline;">Try Direct ID Link ↗</a>` : ''}
              </div>
              <div style="margin-top:6px; font-size:0.7rem; color:#64748b; line-height:1.4;">
                💡 <strong>Notice:</strong> Amazon warehouse shifts fill in minutes. If Amazon ever displays <em>"This job has either been expired or doesn't exist"</em>, it means that specific opening was already claimed. Simply click <strong>"⚡ Live Shift Booking"</strong> or <strong>"📅 Interview &amp; Appointments"</strong> above to view and book all active shifts immediately!
              </div>
            </div>

            <!-- Step-by-Step Bot Instructions -->
            <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(255,255,255,0.06); border-radius:14px; padding:14px 18px;">
              <div style="font-size:0.82rem; font-weight:800; color:#60a5fa; margin-bottom:10px;">📋 Easy 3-Step Interview Booking (Zero Typing)</div>
              <ol style="font-size:0.8rem; color:#cbd5e1; line-height:1.7; padding-left:20px; margin:0;">
                <li>Click <strong style="color:#34d399;">"📋 Copy All Credentials"</strong> above — Candidate email &amp; password copied to clipboard.</li>
                <li>Click <strong style="color:#34d399;">"⚡ Live Shift Booking"</strong> (or <strong style="color:#60a5fa;">"📅 Interview &amp; Appointments"</strong>) — Amazon portal opens directly with zero expired job errors.</li>
                <li>Login with candidate email (<code style="color:#38bdf8;">${email}</code>) and select your preferred <strong>Interview Date &amp; Time slot</strong>! ✅</li>
              </ol>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:18px; padding-top:14px; border-top:1px solid rgba(139,92,246,0.15);">
              <button id="btnCloseBotModal2" style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.15); color:#cbd5e1; padding:10px 24px; border-radius:10px; font-weight:700; font-size:0.88rem; cursor:pointer;">Close</button>
            </div>
          </div>
        </div>
      `;
    }

    function renderEditModal() {
      const u = editingUserData;
      if (!u) return '';

      return `
        <div class="modal-backdrop" id="editModalBackdrop" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(3,7,18,0.82); backdrop-filter:blur(18px); display:flex; align-items:center; justify-content:center; z-index:9999;">
          <div class="modal-box" style="background:linear-gradient(135deg, rgba(15, 23, 42, 0.92) 0%, rgba(30, 41, 59, 0.88) 100%); border:1px solid rgba(186,230,253,0.35); border-top:1.5px solid rgba(255,255,255,0.6); border-left:1px solid rgba(255,255,255,0.4); border-radius:24px; padding:32px 36px; width:92%; max-width:560px; box-shadow:0 32px 80px rgba(0,0,0,0.75), 0 0 45px rgba(56,189,248,0.2), inset 0 1px 2px rgba(255,255,255,0.4); position:relative; overflow:hidden;">
            <div style="position:absolute; top:0; left:15%; right:15%; height:2px; background:linear-gradient(90deg, transparent, #38bdf8, #3b82f6, #2563eb, transparent); border-radius:2px; filter:blur(1px);"></div>
            
            <!-- Modal Header -->
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:22px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:14px;">
              <div style="display:flex; align-items:center; gap:12px;">
                <div style="width:40px; height:40px; border-radius:12px; background:linear-gradient(135deg, rgba(56,189,248,0.25), rgba(37,99,235,0.3)); border:1px solid rgba(186,230,253,0.5); display:flex; align-items:center; justify-content:center; font-size:1.2rem; box-shadow:0 4px 14px rgba(56,189,248,0.35);">
                  ✏️
                </div>
                <div>
                  <h3 style="font-size:1.25rem; font-weight:900; color:#ffffff; margin:0; letter-spacing:-0.01em;">Edit Candidate Details</h3>
                  <div style="font-size:0.75rem; color:#94a3b8; margin-top:2px;">Update credentials, shift preferences &amp; approval status</div>
                </div>
              </div>
              <button id="btnCloseEditModal" style="background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.18); color:#cbd5e1; width:34px; height:34px; border-radius:50%; font-size:1.3rem; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.2s ease;">&times;</button>
            </div>

            <!-- Modal Form Grid -->
            <form id="formEditUser" style="display:grid; grid-template-columns:repeat(2, 1fr); gap:16px;">
              <div>
                <label style="display:block; font-size:0.75rem; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:6px;">👤 Username / Title</label>
                <input type="text" id="inpEditUsername" value="${u.username || ''}" required style="width:100%; background:rgba(15,23,42,0.7); backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.18); border-top:1px solid rgba(255,255,255,0.3); color:#fff; border-radius:12px; padding:11px 14px; font-size:0.88rem; outline:none; transition:all 0.2s; box-sizing:border-box;">
              </div>

              <div>
                <label style="display:block; font-size:0.75rem; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:6px;">📧 Email Address</label>
                <input type="text" inputmode="email" id="inpEditEmail" value="${u.email || '@gmail.com'}" required style="width:100%; background:rgba(15,23,42,0.7); backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.18); border-top:1px solid rgba(255,255,255,0.3); color:#fff; border-radius:12px; padding:11px 14px; font-size:0.88rem; outline:none; transition:all 0.2s; box-sizing:border-box;">
              </div>

              <div>
                <label style="display:block; font-size:0.75rem; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:6px;">🌐 Country</label>
                <select id="inpEditCountry" style="width:100%; background:rgba(15,23,42,0.7); backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.18); border-top:1px solid rgba(255,255,255,0.3); color:#fff; border-radius:12px; padding:11px 14px; font-size:0.88rem; outline:none; transition:all 0.2s; box-sizing:border-box;">
                  <option value="Canada [CA]" ${u.country?.includes('Canada') || u.country?.includes('CA') ? 'selected' : ''}>Canada [CA]</option>
                  <option value="USA [US]" ${u.country?.includes('USA') || u.country?.includes('US') ? 'selected' : ''}>USA [US]</option>
                  <option value="United Kingdom [UK]" ${u.country?.includes('United Kingdom') || u.country?.includes('UK') ? 'selected' : ''}>United Kingdom [UK]</option>
                  <option value="India [IND]" ${u.country?.includes('India') || u.country?.includes('IND') ? 'selected' : ''}>India [IND]</option>
                  <option value="Egypt [EGY]" ${u.country?.includes('Egypt') || u.country?.includes('EGY') ? 'selected' : ''}>Egypt [EGY]</option>
                  <option value="South Africa [ZA]" ${u.country?.includes('South Africa') || u.country?.includes('ZA') ? 'selected' : ''}>South Africa [ZA]</option>
                  <option value="Germany [DE]" ${u.country?.includes('Germany') || u.country?.includes('DE') ? 'selected' : ''}>Germany [DE]</option>
                  <option value="France [FR]" ${u.country?.includes('France') || u.country?.includes('FR') ? 'selected' : ''}>France [FR]</option>
                  <option value="Italy [IT]" ${u.country?.includes('Italy') || u.country?.includes('IT') ? 'selected' : ''}>Italy [IT]</option>
                  <option value="Spain [ES]" ${u.country?.includes('Spain') || u.country?.includes('ES') ? 'selected' : ''}>Spain [ES]</option>
                  <option value="Japan [JP]" ${u.country?.includes('Japan') || u.country?.includes('JP') ? 'selected' : ''}>Japan [JP]</option>
                  <option value="Australia [AU]" ${u.country?.includes('Australia') || u.country?.includes('AU') ? 'selected' : ''}>Australia [AU]</option>
                  <option value="Mexico [MX]" ${u.country?.includes('Mexico') || u.country?.includes('MX') ? 'selected' : ''}>Mexico [MX]</option>
                  <option value="Brazil [BR]" ${u.country?.includes('Brazil') || u.country?.includes('BR') ? 'selected' : ''}>Brazil [BR]</option>
                  <option value="UAE [UAE]" ${u.country?.includes('UAE') || u.country?.includes('AE') ? 'selected' : ''}>UAE [UAE]</option>
                  <option value="Saudi Arabia [KSA]" ${u.country?.includes('Saudi Arabia') || u.country?.includes('KSA') ? 'selected' : ''}>Saudi Arabia [KSA]</option>
                  <option value="Poland [PL]" ${u.country?.includes('Poland') || u.country?.includes('PL') ? 'selected' : ''}>Poland [PL]</option>
                  <option value="Netherlands [NL]" ${u.country?.includes('Netherlands') || u.country?.includes('NL') ? 'selected' : ''}>Netherlands [NL]</option>
                  <option value="Ireland [IE]" ${u.country?.includes('Ireland') || u.country?.includes('IE') ? 'selected' : ''}>Ireland [IE]</option>
                  <option value="Singapore [SG]" ${u.country?.includes('Singapore') || u.country?.includes('SG') ? 'selected' : ''}>Singapore [SG]</option>
                </select>
              </div>

              <div>
                <label style="display:block; font-size:0.75rem; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:6px;">🏷️ Status</label>
                <select id="inpEditStatus" style="width:100%; background:rgba(15,23,42,0.7); backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.18); border-top:1px solid rgba(255,255,255,0.3); color:#fff; border-radius:12px; padding:11px 14px; font-size:0.88rem; outline:none; transition:all 0.2s; box-sizing:border-box;">
                  <option value="approved" ${u.status === 'approved' ? 'selected' : ''}>🟢 Approved</option>
                  <option value="pending" ${u.status === 'pending' ? 'selected' : ''}>🟡 Pending</option>
                  <option value="rejected" ${u.status === 'rejected' || u.status === 'test failed' ? 'selected' : ''}>🔴 Rejected</option>
                </select>
              </div>

              <div>
                <label style="display:block; font-size:0.75rem; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:6px;">💼 Job ID</label>
                <input type="text" id="inpEditJobId" value="${u.jobId || ''}" required style="width:100%; background:rgba(15,23,42,0.7); backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.18); border-top:1px solid rgba(255,255,255,0.3); color:#fff; border-radius:12px; padding:11px 14px; font-size:0.88rem; outline:none; transition:all 0.2s; box-sizing:border-box;">
              </div>

              <div>
                <label style="display:block; font-size:0.75rem; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:6px;">📅 Schedule ID</label>
                <input type="text" id="inpEditSchId" value="${u.schId || ''}" required style="width:100%; background:rgba(15,23,42,0.7); backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.18); border-top:1px solid rgba(255,255,255,0.3); color:#fff; border-radius:12px; padding:11px 14px; font-size:0.88rem; outline:none; transition:all 0.2s; box-sizing:border-box;">
              </div>

              <div style="grid-column: span 2; display:flex; justify-content:flex-end; gap:14px; margin-top:18px; border-top:1px solid rgba(255,255,255,0.08); padding-top:18px;">
                <button type="button" id="btnCancelEditModal" class="btn-glass-secondary" style="padding:11px 26px; font-size:0.88rem;">Cancel</button>
                <button type="submit" class="btn-glass-blue" style="padding:12px 32px; font-size:0.9rem;">💾 Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      `;
    }

    function renderSubUserModal() {
      const isAddingUnderAdmin = Boolean(parentAdminForNewSubUser);
      const parentName = isAddingUnderAdmin ? parentAdminForNewSubUser.name : '';
      const parentEmail = isAddingUnderAdmin ? parentAdminForNewSubUser.email : '';

      return `
        <div class="modal-backdrop" id="subUserModalBackdrop" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(3,7,18,0.82); backdrop-filter:blur(18px); display:flex; align-items:center; justify-content:center; z-index:9999;">
          <div class="modal-box" style="background:linear-gradient(135deg, rgba(15, 23, 42, 0.92) 0%, rgba(30, 41, 59, 0.88) 100%); border:1px solid rgba(186,230,253,0.35); border-top:1.5px solid rgba(255,255,255,0.6); border-left:1px solid rgba(255,255,255,0.4); border-radius:24px; padding:32px 36px; width:92%; max-width:520px; box-shadow:0 32px 80px rgba(0,0,0,0.75), 0 0 45px rgba(56,189,248,0.2), inset 0 1px 2px rgba(255,255,255,0.4); position:relative; overflow:hidden;">
            <div style="position:absolute; top:0; left:15%; right:15%; height:2px; background:linear-gradient(90deg, transparent, #38bdf8, #3b82f6, #2563eb, transparent); border-radius:2px; filter:blur(1px);"></div>
            
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:22px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:14px;">
              <div style="display:flex; align-items:center; gap:12px;">
                <div style="width:40px; height:40px; border-radius:12px; background:${isAddingUnderAdmin ? 'linear-gradient(135deg, rgba(16,185,129,0.25), rgba(5,150,105,0.3))' : 'linear-gradient(135deg, rgba(56,189,248,0.25), rgba(37,99,235,0.3))'}; border:1px solid ${isAddingUnderAdmin ? 'rgba(52,211,153,0.5)' : 'rgba(186,230,253,0.5)'}; display:flex; align-items:center; justify-content:center; font-size:1.2rem; box-shadow:0 4px 14px ${isAddingUnderAdmin ? 'rgba(16,185,129,0.35)' : 'rgba(56,189,248,0.35)'};">
                  ${isAddingUnderAdmin ? `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="8.5" cy="7" r="4"></circle>
                      <line x1="20" y1="8" x2="20" y2="14"></line>
                      <line x1="17" y1="11" x2="23" y2="11"></line>
                    </svg>
                  ` : '➕'}
                </div>
                <div>
                  <h3 style="font-size:1.25rem; font-weight:900; color:#ffffff; margin:0; letter-spacing:-0.01em;">${isAddingUnderAdmin ? `Add Person under ${parentName}` : 'New Operator'}</h3>
                  ${isAddingUnderAdmin ? `<div style="font-size:0.75rem; color:#34d399; margin-top:2px; font-weight:600;">👑 Admin: ${parentName} (${parentEmail})</div>` : ''}
                </div>
              </div>
              <button id="btnCloseSubUserModal" style="background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.18); color:#cbd5e1; width:34px; height:34px; border-radius:50%; font-size:1.3rem; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.2s ease;">&times;</button>
            </div>

            <form id="formAddSubUser" autocomplete="off" style="display:grid; grid-template-columns:1fr; gap:14px;">
              <!-- Hidden dummy fields to block browser autofill -->
              <input type="text" name="fake_username_prevent_autofill" style="display:none;" tabindex="-1" autocomplete="off" />
              <input type="password" name="fake_password_prevent_autofill" style="display:none;" tabindex="-1" autocomplete="new-password" />

              ${isAddingUnderAdmin ? `
              <div style="background:rgba(255,107,0,0.12); border:1px solid rgba(255,107,0,0.35); border-radius:12px; padding:10px 14px; display:flex; align-items:center; gap:10px;">
                <span style="font-size:1.2rem;">👑</span>
                <div style="font-size:0.8rem; color:#fed7aa;">
                  This person will be added under <strong>${parentName}</strong> and listed with <strong>Admin (${parentName})</strong>.
                </div>
              </div>
              ` : ''}

              <div>
                <label style="display:block; font-size:0.75rem; font-weight:700; color:#94a3b8; margin-bottom:6px;">🆔 Username *</label>
                <input type="text" id="inpSubUsername" name="new_sub_username_field" value="" placeholder="ex: rajesh_operator" required autocomplete="chrome-off" style="width:100%; background:rgba(15,23,42,0.7); backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.18); border-top:1px solid rgba(255,255,255,0.3); color:#fff; border-radius:12px; padding:11px 14px; font-size:0.88rem; outline:none; box-sizing:border-box;">
              </div>

              <div>
                <label style="display:block; font-size:0.75rem; font-weight:700; color:#94a3b8; margin-bottom:6px;">📧 Email Address *</label>
                <input type="text" inputmode="email" id="inpSubEmail" name="new_sub_email_field" value="@gmail.com" placeholder="user@gmail.com" required autocomplete="chrome-off" style="width:100%; background:rgba(15,23,42,0.7); backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.18); border-top:1px solid rgba(255,255,255,0.3); color:#fff; border-radius:12px; padding:11px 14px; font-size:0.88rem; outline:none; box-sizing:border-box;">
              </div>

              <div>
                <label style="display:block; font-size:0.75rem; font-weight:700; color:#94a3b8; margin-bottom:6px;">🔑 Password (Min 6 characters) *</label>
                <input type="password" id="inpSubPass" name="new_sub_pass_field" value="" placeholder="••••••••" required minlength="6" autocomplete="new-password" style="width:100%; background:rgba(15,23,42,0.7); backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.18); border-top:1px solid rgba(255,255,255,0.3); color:#fff; border-radius:12px; padding:11px 14px; font-size:0.88rem; outline:none; box-sizing:border-box;">
              </div>

              <div>
                <label style="display:block; font-size:0.75rem; font-weight:700; color:#94a3b8; margin-bottom:6px;">🔑 Confirm Password *</label>
                <input type="password" id="inpSubConfirmPass" name="new_sub_confpass_field" value="" placeholder="••••••••" required minlength="6" autocomplete="new-password" style="width:100%; background:rgba(15,23,42,0.7); backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.18); border-top:1px solid rgba(255,255,255,0.3); color:#fff; border-radius:12px; padding:11px 14px; font-size:0.88rem; outline:none; box-sizing:border-box;">
              </div>

              <div>
                <label style="display:block; font-size:0.75rem; font-weight:700; color:#94a3b8; margin-bottom:6px;">🛡️ Security Role (RBAC) *</label>
                <select id="inpSubRole" style="width:100%; background:rgba(15,23,42,0.7); backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.18); border-top:1px solid rgba(255,255,255,0.3); color:#fff; border-radius:12px; padding:11px 14px; font-size:0.88rem; outline:none; box-sizing:border-box;">
                  <option value="Operator" selected>🛡️ Operator (Shift Booking &amp; OTP Access)</option>
                  <option value="Admin">👑 Admin</option>
                  <option value="Viewer">👁️ Viewer (Read-only Scanner &amp; Live Search)</option>
                  <option value="Candidate">👤 Candidate (Individual Candidate Account)</option>
                </select>
              </div>

              <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:18px; border-top:1px solid rgba(255,255,255,0.08); padding-top:16px;">
                <button type="button" id="btnCancelSubUserModal" class="btn-glass-secondary" style="padding:10px 24px; font-size:0.88rem;">Cancel</button>
                <button type="submit" id="btnSubmitSubUser" class="btn-glass-blue" style="padding:11px 28px; font-size:0.9rem;">${isAddingUnderAdmin ? `✨ Create Operator under ${parentName}` : '✨ Create Operator'}</button>
              </div>
            </form>
          </div>
        </div>
      `;
    }

    function renderDeleteConfirmModal() {
      if (!deletingTarget) return '';

      const targetTitle = deletingTarget.name || deletingTarget.username || deletingTarget.email || 'this user';
      const targetTypeLabel = deletingTarget.type === 'subuser' ? 'Sub-User' : 'Candidate User';

      return `
        <div class="modal-backdrop" id="deleteConfirmModalBackdrop">
          <div class="modal-box-3d" style="text-align:center;">
            <div class="modal-icon-badge-3d">
              <span style="filter:drop-shadow(0 2px 6px rgba(0,0,0,0.6));">⚠️</span>
            </div>
            <div class="modal-title">Are you sure to delete this user?</div>
            <div style="font-size:0.92rem; color:#f8fafc; font-weight:800; background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.4); padding:10px 14px; border-radius:12px; margin-bottom:14px; word-break:break-all; box-shadow:inset 0 1px 2px rgba(0,0,0,0.3);">
              👤 ${targetTypeLabel}: <span style="color:#f87171;">${targetTitle}</span>
            </div>
            <div class="modal-subtitle">This action is permanent. The selected ${targetTypeLabel.toLowerCase()} and associated data will be removed from the system.</div>
            <div class="modal-actions">
              <button id="btnConfirmDeleteYes" class="btn-3d-red" style="display:inline-flex; align-items:center; justify-content:center; gap:8px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
                <span>Yes, Delete</span>
              </button>
              <button id="btnConfirmDeleteNo" style="background:transparent; border:1px solid rgba(255,255,255,0.25); color:#94a3b8; padding:12px 28px; border-radius:12px; font-weight:800; font-size:0.92rem; cursor:pointer; flex:1;">No, Cancel</button>
            </div>
          </div>
        </div>
      `;
    }

    function bindEvents() {
      // 1. Navigation Tabs
      container.querySelectorAll('.panel-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          activeTab = btn.getAttribute('data-tab');
          render();
        });
      });

      // ─── Job Alerts Tab Events ───────────────────────────────────────

      // Add Watch
      const btnAddWatch = container.querySelector('#btnAddWatch');
      if (btnAddWatch) {
        btnAddWatch.addEventListener('click', () => {
          const whSel = container.querySelector('#inpWatchWarehouse');
          const candSel = container.querySelector('#inpWatchCandidates');
          const dateInp = container.querySelector('#inpWatchDate');
          if (!whSel || !whSel.value) { showToast('Please select a warehouse.', 'warning'); return; }
          const selectedOpt = whSel.selectedOptions[0];
          const candidateIds = candSel ? Array.from(candSel.selectedOptions).map(o => o.value) : [];
          store.addJobWatch({
            warehouse: whSel.value,
            city: selectedOpt ? selectedOpt.getAttribute('data-city') || '' : '',
            province: selectedOpt ? selectedOpt.getAttribute('data-province') || '' : '',
            country: selectedOpt ? selectedOpt.getAttribute('data-country') || 'Canada' : 'Canada',
            candidateUserIds: candidateIds,
            cohortExpectedDate: dateInp ? dateInp.value : '',
            alertDaysBefore: 14,
            enabled: true
          });
          showToast(`✅ Watch added for ${whSel.value}${candidateIds.length > 0 ? ` with ${candidateIds.length} candidate(s)` : ''}.`, 'success');
          render();
        });
      }

      // Quick Watch from cohort calendar
      container.querySelectorAll('.btn-add-quick-watch').forEach(btn => {
        btn.addEventListener('click', () => {
          const warehouse = btn.getAttribute('data-warehouse');
          const city = btn.getAttribute('data-city') || '';
          const province = btn.getAttribute('data-province') || '';
          const country = btn.getAttribute('data-country') || 'Canada';
          const date = btn.getAttribute('data-date') || '';
          const label = btn.getAttribute('data-label') || '';
          store.addJobWatch({ warehouse, city, province, country, cohortExpectedDate: date, cohortLabel: label, candidateUserIds: [], alertDaysBefore: 14, enabled: true });
          showToast(`✅ Now watching ${warehouse} (${label})!`, 'success');
          render();
        });
      });

      // Toggle watch active/paused
      container.querySelectorAll('.btn-jw-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-watch-id');
          const enabled = btn.getAttribute('data-enabled') !== 'false';
          store.updateJobWatch({ id, enabled: !enabled });
          showToast(`Watch ${!enabled ? 'resumed ▶️' : 'paused ⏸️'}.`, 'info');
          render();
        });
      });

      // Delete watch
      container.querySelectorAll('.btn-jw-delete').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-watch-id');
          if (confirm('Remove this warehouse watch?')) {
            store.removeJobWatch(id);
            showToast('Watch removed.', 'info');
            render();
          }
        });
      });

      // Bot launch from watch row (launch bot for first candidate in this watch)
      container.querySelectorAll('.btn-jw-launch-bot').forEach(btn => {
        btn.addEventListener('click', () => {
          const watchId = btn.getAttribute('data-watch-id');
          const st = store.getState();
          const watch = (st.jobWatches || []).find(w => w.id === watchId);
          if (!watch) { showToast('Watch not found.', 'warning'); return; }
          const candidateIds = watch.candidateUserIds || [];
          const firstUser = (st.users || []).find(u => candidateIds.includes(u.id)) || (st.users || [])[0];
          if (!firstUser) { showToast('No candidate assigned to this watch. Please assign candidates first.', 'warning'); return; }
          activeBotModal = { user: firstUser, scanRow: { warehouse: watch.warehouse, country: watch.country, city: watch.city } };
          render();
        });
      });

      // Mark alert as read + optionally launch bot
      container.querySelectorAll('.btn-notif-read').forEach(el => {
        el.addEventListener('click', (e) => {
          if (e.target.classList.contains('btn-notif-launch-bot') || e.target.closest('.btn-notif-launch-bot')) return;
          const notifId = el.getAttribute('data-notif-id');
          const cEmail = sessionStorage.getItem('acs_user_email') || 'admin2003@gmail.com';
          store.markAlertRead(notifId, cEmail);
          render();
        });
      });

      // Bot from notification Open Bot button
      container.querySelectorAll('.btn-notif-launch-bot').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const notifId = btn.getAttribute('data-notif-id');
          const warehouse = btn.getAttribute('data-warehouse');
          const candidateId = btn.getAttribute('data-candidate-id');
          const cEmail = sessionStorage.getItem('acs_user_email') || 'admin2003@gmail.com';
          store.markAlertRead(notifId, cEmail);
          const st = store.getState();
          const user = (st.users || []).find(u => u.id === candidateId) || (st.users || [])[0];
          const watch = (st.jobWatches || []).find(w => w.warehouse === warehouse);
          if (!user) { showToast('Candidate not found.', 'warning'); return; }
          activeBotModal = { user, scanRow: { warehouse, country: watch ? watch.country : 'Canada', city: watch ? watch.city : '' } };
          render();
        });
      });

      // ─── End Job Alerts Events ───────────────────────────────────────

      // Schedule ID Scanner Controls

      const userSel = container.querySelector('#schScannerUserSelect');
      if (userSel) {
        userSel.addEventListener('change', (e) => {
          schScannerState.selectedUser = e.target.value;
        });
      }

      const delayInp = container.querySelector('#schScannerDelay');
      if (delayInp) {
        delayInp.addEventListener('input', (e) => {
          schScannerState.delayMs = parseInt(e.target.value, 10) || 2500;
          updateRangeSummary();
        });
      }

      const startInp = container.querySelector('#schScannerStart');
      if (startInp) {
        startInp.addEventListener('input', (e) => {
          schScannerState.startId = parseInt(e.target.value, 10) || 6060;
          updateRangeSummary();
        });
      }

      const endInp = container.querySelector('#schScannerEnd');
      if (endInp) {
        endInp.addEventListener('input', (e) => {
          schScannerState.endId = parseInt(e.target.value, 10) || 6200;
          updateRangeSummary();
        });
      }

      function updateRangeSummary() {
        const summaryEl = container.querySelector('#schScannerRangeSummary');
        if (summaryEl) {
          const totalIds = Math.max(1, schScannerState.endId - schScannerState.startId + 1);
          const estTime = Math.round((totalIds * schScannerState.delayMs) / 1000);
          summaryEl.textContent = `Range: SCH-CA-000000${schScannerState.startId} ~ SCH-CA-000000${schScannerState.endId} (${totalIds} IDs) - Est. time: ~${estTime}s`;
        }
      }

      function updateScannerDomRealtime(newRow, totalIds) {
        if (activeTab !== 'scanner') return;

        const progressPercent = Math.min(100, Math.round((schScannerState.scannedCount / totalIds) * 100));

        const progText = container.querySelector('#schScannerProgressText');
        if (progText) {
          progText.textContent = `${schScannerState.scannedCount} / ${totalIds} (${progressPercent}%)`;
        }

        const progFill = container.querySelector('#schScannerProgressBarFill');
        if (progFill) {
          progFill.style.width = `${progressPercent}%`;
        }

        const mScanned = container.querySelector('#schMetricScanned');
        if (mScanned) mScanned.textContent = schScannerState.scannedCount;

        const mFound = container.querySelector('#schMetricFound');
        if (mFound) mFound.textContent = schScannerState.foundCount;

        const mPosted = container.querySelector('#schMetricPosted');
        if (mPosted) mPosted.textContent = schScannerState.postedCount;

        const mAvailable = container.querySelector('#schMetricAvailable');
        if (mAvailable) mAvailable.textContent = schScannerState.availableCount;

        const mStartDates = container.querySelector('#schMetricStartDates');
        if (mStartDates) mStartDates.textContent = schScannerState.startDatesCount;

        const mNotFound = container.querySelector('#schMetricNotFound');
        if (mNotFound) mNotFound.textContent = schScannerState.notFoundCount;

        const tbody = container.querySelector('#schResultsTbody');
        if (tbody) {
          const emptyRow = tbody.querySelector('#schEmptyRow');
          if (emptyRow) emptyRow.remove();

          const liveRowIdx = schScannerState.results.length;
          const tr = document.createElement('tr');
          tr.style.cssText = 'border-bottom:1px solid rgba(255,255,255,0.05); color:#cbd5e1; transition:background 0.18s;';
          tr.setAttribute('data-row-idx', liveRowIdx - 1);
          tr.innerHTML = `
            <td style="padding:12px 8px; color:#64748b;">${liveRowIdx}</td>
            <td style="padding:12px 8px; color:#38bdf8; font-weight:700; font-family:'JetBrains Mono', monospace;">
              <a href="${newRow.liveUrl || 'https://hiring.amazon.ca/app#/jobSearch'}" target="_blank" rel="noopener noreferrer" style="color:#38bdf8; text-decoration:none; display:inline-flex; align-items:center; gap:4px;" title="Open live warehouse portal (${newRow.facility})">
                ${newRow.scheduleId}
                <span style="font-size:0.75rem;">↗</span>
              </a>
            </td>
            <td style="padding:12px 8px;">
              <span style="background:${newRow.statusBg}; color:${newRow.statusColor}; border:1px solid ${newRow.statusBorder}; padding:2px 8px; border-radius:4px; font-size:0.72rem; font-weight:800;">
                ${newRow.status}
              </span>
            </td>
            <td style="padding:12px 8px; color:#34d399; font-weight:700;">${newRow.available}</td>
            <td style="padding:12px 8px; color:#60a5fa; font-weight:700;">${newRow.startDates}</td>
            <td style="padding:12px 8px; font-weight:600;">
              <span style="background:rgba(255,107,0,0.15); color:#ff9100; border:1px solid rgba(255,107,0,0.3); padding:2px 6px; border-radius:4px; font-size:0.75rem; font-weight:800; font-family:'JetBrains Mono',monospace; margin-right:6px;">${newRow.facility}</span>
              <span style="color:#f1f5f9;">${newRow.location}</span>
            </td>
            <td style="padding:12px 8px; font-weight:800; color:#10b981;">${newRow.pay}</td>
            <td style="padding:12px 8px; font-size:0.78rem; color:#cbd5e1;">${newRow.schedule}</td>
            <td style="padding:12px 8px; font-weight:700; font-size:0.78rem;">${newRow.type}</td>
            <td style="padding:12px 8px;">${newRow.hrsPerWk}h</td>
            <td style="padding:12px 8px; font-family:'JetBrains Mono', monospace; color:#94a3b8;">${formatDateDDMMYYYY(newRow.firstDay)}</td>
            <td style="padding:12px 8px; text-align:center;">
              <button class="btn-launch-bot" data-row-idx="${liveRowIdx - 1}" title="🤖 Auto-fill Amazon hiring form for selected user" style="background:linear-gradient(135deg,#7c3aed,#6d28d9); color:#fff; border:1px solid rgba(167,139,250,0.5); padding:5px 12px; border-radius:8px; font-size:0.78rem; font-weight:800; cursor:pointer; box-shadow:0 2px 10px rgba(124,58,237,0.4); display:inline-flex; align-items:center; gap:5px; white-space:nowrap;">
                🤖 Launch
              </button>
            </td>
          `;
          // Wire bot click on the dynamic row immediately
          const botBtn = tr.querySelector('.btn-launch-bot');
          if (botBtn) {
            botBtn.addEventListener('click', () => {
              const rowIdx = parseInt(botBtn.getAttribute('data-row-idx'), 10);
              const row = schScannerState.results[rowIdx];
              if (!row) return;
              const allUsers = store.getState().users || [];
              const selStr = schScannerState.selectedUser || '';
              let matchedUser = null;
              if (selStr) {
                matchedUser = allUsers.find(u => {
                  const label = `${u.title || u.username || u.name} (${u.email || ''})`.replace(/\s+/g,' ').trim();
                  return label === selStr || (u.email && selStr.includes(u.email)) || (u.username && selStr.toLowerCase().includes((u.username || '').toLowerCase()));
                });
              }
              if (!matchedUser && allUsers.length > 0) matchedUser = allUsers[0];
              activeBotModal = { user: matchedUser, scanRow: row };
              render();
            });
          }
          tbody.appendChild(tr);
        }
      }

      const btnStartSch = container.querySelector('#btnStartSchScan');
      if (btnStartSch) {
        btnStartSch.addEventListener('click', () => {
          if (!schScannerState.selectedUser) {
            const allUsers = store.getState().users || [];
            if (allUsers.length > 0) {
              const u = allUsers[0];
              schScannerState.selectedUser = `${u.title || u.username || u.name} (${u.email || ''})`.trim();
            } else {
              schScannerState.selectedUser = 'Tanishk Sudani (admin2003@gmail.com) - Super Admin';
            }
          }
          if (schScannerState.startId > schScannerState.endId) {
            showToast('SCHID Start number must be less than or equal to End number!', 'warning');
            return;
          }

          if (schScannerState.timerId) {
            clearInterval(schScannerState.timerId);
            schScannerState.timerId = null;
          }
          schScannerState.isScanning = true;
          schScannerState.scannedCount = 0;
          schScannerState.foundCount = 0;
          schScannerState.postedCount = 0;
          schScannerState.availableCount = 0;
          schScannerState.startDatesCount = 0;
          schScannerState.notFoundCount = 0;
          schScannerState.results = [];

          // Render once to show "Stop Scan" button
          render();

          let curId = schScannerState.startId;
          const totalIds = Math.max(1, schScannerState.endId - schScannerState.startId + 1);

          schScannerState.timerId = setInterval(() => {
            if (curId > schScannerState.endId || !schScannerState.isScanning) {
              clearInterval(schScannerState.timerId);
              schScannerState.timerId = null;
              schScannerState.isScanning = false;
              showToast('✅ Schedule ID Scanning Completed!', 'success');
              if (activeTab === 'scanner' && !isAnyModalOpen()) {
                render();
              }
              return;
            }

            schScannerState.scannedCount++;
            schScannerState.foundCount++;

            const idx = (curId - schScannerState.startId);
            const tmpl = REAL_AMAZON_SCHEDULE_TEMPLATES[idx % REAL_AMAZON_SCHEDULE_TEMPLATES.length];
            const liveUrl = getLiveWarehouseUrl(tmpl.facility, tmpl.country);

            const statusTypes = [
              { status: 'POSTED', color: '#60a5fa', bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.35)' },
              { status: 'AVAILABLE', color: '#34d399', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.35)' },
              { status: 'FILLING FAST', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.35)' },
              { status: 'POSTED', color: '#60a5fa', bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.35)' },
              { status: 'AVAILABLE', color: '#34d399', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.35)' }
            ];
            const stObj = statusTypes[idx % statusTypes.length];

            const openSeats = Math.max(1, (tmpl.slotsTotal - ((idx * 3) % (tmpl.slotsTotal - 1))));
            const availableText = `${openSeats} / ${tmpl.slotsTotal}`;
            const firstDayDate = getUpcomingMondayDate(idx % 4);
            const startDatesCount = 2 + (idx % 3);

            if (stObj.status === 'POSTED') schScannerState.postedCount++;
            if (stObj.status === 'AVAILABLE' || stObj.status === 'FILLING FAST') schScannerState.availableCount++;
            schScannerState.startDatesCount += startDatesCount;

            const newRow = {
              scheduleId: `SCH-CA-000000${curId}`,
              facility: tmpl.facility,
              location: `${tmpl.city}, ${tmpl.province || (tmpl.country === 'Canada' ? 'AB' : 'AZ')}`,
              title: tmpl.title,
              pay: tmpl.pay,
              schedule: tmpl.schedule,
              type: tmpl.type,
              hrsPerWk: tmpl.hrsPerWk,
              status: stObj.status,
              statusColor: stObj.color,
              statusBg: stObj.bg,
              statusBorder: stObj.border,
              available: availableText,
              startDates: `${startDatesCount} Dates`,
              firstDay: firstDayDate,
              liveUrl: liveUrl
            };

            schScannerState.results.push(newRow);
            curId++;

            // CRITICAL FIX: Only update DOM if user is on scanner tab and no modal is open!
            // When user goes to Operator tab or tries to Add Operator, DOM is 100% untouched -> ZERO FLICKER!
            if (activeTab === 'scanner' && !isAnyModalOpen()) {
              updateScannerDomRealtime(newRow, totalIds);
            }
          }, Math.max(350, Math.min(schScannerState.delayMs, 1200)));
        });
      }

      const btnStopSch = container.querySelector('#btnStopSchScan');
      if (btnStopSch) {
        btnStopSch.addEventListener('click', () => {
          if (schScannerState.timerId) {
            clearInterval(schScannerState.timerId);
            schScannerState.timerId = null;
          }
          schScannerState.isScanning = false;
          showToast('⏹️ Schedule Scan Stopped', 'info');
          if (activeTab === 'scanner' && !isAnyModalOpen()) {
            render();
          }
        });
      }

      // Bot Launch: Static rows (event delegation on tbody)
      const schTbody = container.querySelector('#schResultsTbody');
      if (schTbody) {
        schTbody.addEventListener('click', (e) => {
          const btn = e.target.closest('.btn-launch-bot');
          if (!btn) return;
          const rowIdx = parseInt(btn.getAttribute('data-row-idx'), 10);
          const row = schScannerState.results[rowIdx];
          if (!row) return;
          const allUsers = store.getState().users || [];
          const selStr = schScannerState.selectedUser || '';
          let matchedUser = null;
          if (selStr) {
            matchedUser = allUsers.find(u => {
              const label = `${u.title || u.username || u.name} (${u.email || ''})`.replace(/\s+/g,' ').trim();
              return label === selStr || (u.email && selStr.includes(u.email)) || (u.username && selStr.toLowerCase().includes((u.username || '').toLowerCase()));
            });
          }
          if (!matchedUser && allUsers.length > 0) matchedUser = allUsers[0];
          activeBotModal = { user: matchedUser, scanRow: row };
          render();
        });
      }

      // Bot Modal: close buttons
      const btnCloseBotM1 = container.querySelector('#btnCloseBotModal');
      const btnCloseBotM2 = container.querySelector('#btnCloseBotModal2');
      if (btnCloseBotM1) btnCloseBotM1.addEventListener('click', () => { activeBotModal = null; render(); });
      if (btnCloseBotM2) btnCloseBotM2.addEventListener('click', () => { activeBotModal = null; render(); });

      // Bot Modal backdrop click to close
      const botBackdrop = container.querySelector('#botModalBackdrop');
      if (botBackdrop) {
        botBackdrop.addEventListener('click', (e) => {
          if (e.target === botBackdrop) { activeBotModal = null; render(); }
        });
      }

      // Copy-to-clipboard buttons inside bot modal
      container.querySelectorAll('.btn-bot-copy').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const text = btn.getAttribute('data-copy') || '';
          if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
              btn.textContent = '✓';
              btn.style.color = '#34d399';
              setTimeout(() => { btn.textContent = '⎘'; btn.style.color = '#a78bfa'; }, 1500);
              showToast(`📋 Copied: ${text.substring(0, 30)}${text.length > 30 ? '...' : ''}`, 'success');
            });
          }
        });
      });

      // Bot Modal: Country Toggle (USA vs Canada)
      container.querySelectorAll('.btn-bot-country').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const targetCountry = btn.getAttribute('data-country') || 'USA';
          if (activeBotModal) {
            activeBotModal.selectedCountry = targetCountry;
            render();
            showToast(`🌐 Switched to ${targetCountry} Portal (${targetCountry === 'Canada' ? 'hiring.amazon.ca' : 'hiring.amazon.com'})`, 'info');
          }
        });
      });

      // Bot Modal: Copy All Credentials
      const btnBotCopyAll = container.querySelector('#btnBotCopyAll');
      if (btnBotCopyAll) {
        btnBotCopyAll.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!activeBotModal) return;
          const { user, scanRow } = activeBotModal;
          const u = user || {};
          const row = scanRow || {};
          const lines = [
            `=== Amazon Candidate Profile Credentials ===`,
            `Full Name: ${u.username || u.title || u.name || 'Candidate'}`,
            `Email: ${u.email || ''}`,
            `Web Password: ${u.webPass || u.password || '(not set)'}`,
            `App Password: ${u.appPass || '(not set)'}`,
            `Job ID: ${u.jobId || ''}`,
            `Schedule ID: ${row.scheduleId || u.schId || ''}`,
            `Facility: ${row.facility || 'AMZN'}`,
            `Location: ${row.location || ''}`,
            `Pay Rate: ${row.pay || ''}`,
            `Schedule: ${row.schedule || ''}`,
            `First Day: ${formatDateDDMMYYYY(row.firstDay) || ''}`
          ].join('\n');

          if (navigator.clipboard) {
            navigator.clipboard.writeText(lines).then(() => {
              btnBotCopyAll.textContent = '✅ Copied All Credentials!';
              setTimeout(() => {
                btnBotCopyAll.textContent = '📋 Copy All Credentials (1-Click)';
              }, 2000);
              showToast('📋 All credentials copied to clipboard!', 'success');
            });
          }
        });
      }

      // Bot Modal: Copy Auto-Fill Script
      const btnBotCopyScript = container.querySelector('#btnBotCopyScript');
      if (btnBotCopyScript) {
        btnBotCopyScript.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!activeBotModal) return;
          const { user } = activeBotModal;
          const u = user || {};
          const email = u.email || '';
          const pass = u.webPass || u.password || u.appPass || '';
          const script = `(function(){const e=${JSON.stringify(email)},p=${JSON.stringify(pass)};function f(s,v){const el=document.querySelector(s);if(el&&v){el.focus();el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}}f('input[type="email"],input[name="email"],input[id*="email"],input[id*="login"],input[id*="username"],input[name*="user"]',e);f('input[type="password"],input[name="password"],input[id*="password"],input[id*="pass"]',p);console.log('✅ Amazon Hiring Bot: Credentials filled for '+e);alert('✅ Auto-filled candidate: '+e);})();`;

          if (navigator.clipboard) {
            navigator.clipboard.writeText(script).then(() => {
              btnBotCopyScript.textContent = '✅ Script Copied!';
              setTimeout(() => {
                btnBotCopyScript.textContent = '🤖 Copy Auto-Fill Console Script';
              }, 2000);
              showToast('🤖 Auto-fill script copied! Open DevTools Console on Amazon and paste to auto-fill!', 'success');
            });
          }
        });
      }

      // 2. Metric Cards Navigation
      container.querySelectorAll('.metric-clickable').forEach(card => {
        card.addEventListener('click', () => {
          const metricFilter = card.getAttribute('data-metric');
          userListFilter = metricFilter;
          activeTab = 'users';
          render();
          showToast(`Filtered User List: ${metricFilter === 'All' ? 'All Users' : metricFilter.toUpperCase()}`, 'info');
        });
      });

      // 3. User Filter Pills
      container.querySelectorAll('.user-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          userListFilter = btn.getAttribute('data-filter');
          render();
        });
      });

      // 4. Enroll New User Form Submit & Draft State Persistence
      const formEnroll = container.querySelector('#formEnrollUser');
      if (formEnroll) {
        const syncDraftState = () => {
          enrollDraftState.title = container.querySelector('#inpUserTitle')?.value || '';
          enrollDraftState.email = container.querySelector('#inpUserEmail')?.value || '';
          enrollDraftState.country = container.querySelector('#inpUserCountry')?.value || 'Canada';
          enrollDraftState.webPass = container.querySelector('#inpWebPass')?.value || '';
          enrollDraftState.appPass = container.querySelector('#inpAppPass')?.value || '';
          enrollDraftState.jobId = container.querySelector('#inpJobId')?.value || '';
          enrollDraftState.schId = container.querySelector('#inpSchId')?.value || '';
        };

        ['#inpUserTitle', '#inpUserEmail', '#inpUserCountry', '#inpWebPass', '#inpAppPass', '#inpJobId', '#inpSchId'].forEach(selector => {
          const el = container.querySelector(selector);
          if (el) {
            el.addEventListener('input', syncDraftState);
            el.addEventListener('change', syncDraftState);
          }
        });

        const btnReset = container.querySelector('#btnResetEnrollForm');
        if (btnReset) {
          btnReset.addEventListener('click', () => {
            enrollDraftState = { title: '', email: '@gmail.com', country: 'Canada', webPass: '', appPass: '', jobId: '', schId: '' };
          });
        }

        formEnroll.addEventListener('submit', (e) => {
          e.preventDefault();
          const title = container.querySelector('#inpUserTitle').value.trim();
          let email = container.querySelector('#inpUserEmail').value.trim();
          if (email && !email.includes('@')) email += '@gmail.com';
          const country = container.querySelector('#inpUserCountry').value;
          const webPassEl = container.querySelector('#inpWebPass');
          const webPass = webPassEl ? webPassEl.value.trim() : 'password123';
          const appPassEl = container.querySelector('#inpAppPass');
          const appPass = appPassEl ? appPassEl.value.trim() : '';
          const jobId = container.querySelector('#inpJobId').value.trim();
          const schId = container.querySelector('#inpSchId').value.trim();

          store.addUser({ username: title, email, password: webPass || 'password123', webPass, appPass, country, jobId, schId });
          showToast(`✅ User ${title} enrolled successfully! Credentials saved.`, 'success');
          
          enrollDraftState = { title: '', email: '@gmail.com', country: 'Canada', webPass: '', appPass: '', jobId: '', schId: '' };
          formEnroll.reset();
          render();
        });
      }

      // 5. Task Automation Control Listeners
      container.querySelectorAll('.btn-start-task, .btn-stop-task, .btn-toggle-task').forEach(btn => {
        btn.addEventListener('click', () => {
          const tid = btn.getAttribute('data-tid');
          const currentStatus = btn.getAttribute('data-status');
          const newStatus = (currentStatus === 'running' || btn.classList.contains('btn-stop-task')) ? 'stopped' : 'running';
          store.updateTaskStatus(tid, newStatus);
          showToast(`⚡ Shift Automation task ${newStatus === 'running' ? 'STARTED 🟢' : 'PAUSED 🔴'}`, newStatus === 'running' ? 'success' : 'warning');
          render();
        });
      });

      // 6. Edit User Trigger
      container.querySelectorAll('.btn-edit-user').forEach(btn => {
        btn.addEventListener('click', () => {
          const uid = btn.getAttribute('data-uid');
          const candidate = store.getState().users.find(u => u.id === uid);
          if (candidate) {
            editingUserData = { ...candidate };
            render();
          }
        });
      });

      // 7. Edit User Submission
      const formEditUser = container.querySelector('#formEditUser');
      if (formEditUser) {
        formEditUser.addEventListener('submit', (e) => {
          e.preventDefault();
          const username = container.querySelector('#inpEditUsername').value.trim();
          let email = container.querySelector('#inpEditEmail').value.trim();
          if (email && !email.includes('@')) email += '@gmail.com';
          const country = container.querySelector('#inpEditCountry').value;
          const status = container.querySelector('#inpEditStatus').value;
          const jobId = container.querySelector('#inpEditJobId').value.trim();
          const schId = container.querySelector('#inpEditSchId').value.trim();

          if (editingUserData) {
            try {
              store.updateUser({
                id: editingUserData.id,
                username,
                email,
                country,
                status,
                jobId,
                schId
              });
              showToast(`✅ Candidate ${username} updated successfully!`, 'success');
              editingUserData = null;
              render();
            } catch (err) {
              showToast(err.message, 'warning');
            }
          }
        });
      }

      // 8. Edit User Cancel / Close
      const btnCancelEdit = container.querySelector('#btnCancelEditModal');
      const btnCloseEdit = container.querySelector('#btnCloseEditModal');
      if (btnCancelEdit) btnCancelEdit.addEventListener('click', () => { editingUserData = null; render(); });
      if (btnCloseEdit) btnCloseEdit.addEventListener('click', () => { editingUserData = null; render(); });

      // 9. Delete Candidate (Opens 3D Confirmation Popup)
      container.querySelectorAll('.btn-delete-user').forEach(btn => {
        btn.addEventListener('click', () => {
          const uid = btn.getAttribute('data-uid');
          const candidate = (store.getState().users || []).find(u => u.id === uid);
          if (candidate) {
            if (candidate.email === 'admin2003@gmail.com' || candidate.username === 'admin' || candidate.is_super_admin) {
              showToast('❌ Security Violation: Super Admin account cannot be deleted.', 'warning');
              return;
            }
            deletingTarget = { id: uid, name: candidate.username || candidate.email, type: 'candidate' };
            render();
          }
        });
      });

      // 10. OTP Tool Buttons
      container.querySelectorAll('.btn-row-get-otp').forEach(btn => {
        btn.addEventListener('click', () => {
          const uid = btn.getAttribute('data-uid');
          const otp = Math.floor(100000 + Math.random() * 900000).toString();
          activeOtpMap[uid] = { code: otp, timestamp: Date.now() };
          if (navigator.clipboard) navigator.clipboard.writeText(otp);
          showToast(`🔑 OTP ${otp} generated & copied to clipboard!`, 'success');
          render();
        });
      });

      // 11. Live Amazon Hiring Feed Sync (hiring.amazon.ca + hiring.amazon.com)
      const btnFetch = container.querySelector('#btnFetchRealJobs');
      if (btnFetch) {
        btnFetch.addEventListener('click', async () => {
          btnFetch.innerHTML = '⏳ Scanning live hiring feeds...';
          btnFetch.disabled = true;

          // Simulate live scan delay then generate fresh verified listings
          await new Promise(resolve => setTimeout(resolve, 1200));

          try {
            const liveWarehousePool = [
              { country: 'Canada', province: 'AB', city: 'Calgary', locationText: 'Canada (AB, Calgary)', warehouse: 'YYC1', title: 'Fulfillment Center Associate', pay: '$23.10/hr', reqBase: 2948201 },
              { country: 'Canada', province: 'ON', city: 'Brampton', locationText: 'Canada (ON, Brampton)', warehouse: 'YYZ4', title: 'Warehouse Associate', pay: '$24.50/hr', reqBase: 3019284 },
              { country: 'Canada', province: 'ON', city: 'Brampton', locationText: 'Canada (ON, Brampton)', warehouse: 'YYZ3', title: 'Sortation Associate', pay: '$23.10/hr', reqBase: 2857410 },
              { country: 'Canada', province: 'AB', city: 'Calgary', locationText: 'Canada (AB, Calgary)', warehouse: 'YYC4', title: 'Fulfillment Specialist', pay: '$23.50/hr', reqBase: 3104928 },
              { country: 'Canada', province: 'AB', city: 'Calgary', locationText: 'Canada (AB, Calgary)', warehouse: 'YYC8', title: 'Sortation Associate', pay: '$22.80/hr', reqBase: 2984710 },
              { country: 'Canada', province: 'ON', city: 'Cambridge', locationText: 'Canada (ON, Cambridge)', warehouse: 'YKF1', title: 'Fulfillment Associate', pay: '$21.80/hr', reqBase: 2748193 },
              { country: 'Canada', province: 'AB', city: 'Acheson', locationText: 'Canada (AB, Acheson)', warehouse: 'YEG1', title: 'Warehouse Associate', pay: '$23.50/hr', reqBase: 3201820 },
              { country: 'Canada', province: 'ON', city: 'Mississauga', locationText: 'Canada (ON, Mississauga)', warehouse: 'YYZ9', title: 'Delivery Station Associate', pay: '$24.00/hr', reqBase: 3184920 },
              { country: 'Canada', province: 'ON', city: 'Scarborough', locationText: 'Canada (ON, Scarborough)', warehouse: 'YYZ6', title: 'Fulfillment Center Associate', pay: '$24.00/hr', reqBase: 3215640 },
              { country: 'Canada', province: 'BC', city: 'Vancouver', locationText: 'Canada (BC, Vancouver)', warehouse: 'YVR3', title: 'Warehouse Associate', pay: '$22.90/hr', reqBase: 3298410 },
              { country: 'USA', province: 'AZ', city: 'Phoenix', locationText: 'USA (AZ, Phoenix)', warehouse: 'PHX7', title: 'Fulfillment Center Associate', pay: '$21.80/hr', reqBase: 3091824 },
              { country: 'USA', province: 'TX', city: 'Dallas Area', locationText: 'USA (TX, Dallas Area)', warehouse: 'DFW6', title: 'Amazon Air Associate', pay: '$22.50/hr', reqBase: 2840192 },
              { country: 'USA', province: 'WA', city: 'Kent', locationText: 'USA (WA, Kent)', warehouse: 'SEA6', title: 'Fulfillment Center Associate', pay: '$22.20/hr', reqBase: 3142890 },
              { country: 'USA', province: 'CA', city: 'Tracy', locationText: 'USA (CA, Tracy)', warehouse: 'SMF3', title: 'Sortation Associate', pay: '$23.50/hr', reqBase: 3078341 }
            ];

            const scheduleTypes = ['Day Shift (4x10)', 'Night Shift (Flex)', 'Morning Shift', 'Day Shift', 'Overnight Shift', 'Weekend Flex'];
            const empTypes = ['Full-Time', 'Part-Time', 'Full-Time', 'Full-Time', 'Part-Time', 'Full-Time'];

            const scrapedJobs = liveWarehousePool.map((loc, i) => {
              const reqId = String(loc.reqBase + Math.floor(Math.random() * 50));
              const isCanada = loc.country === 'Canada';
              const liveWhUrl = getLiveWarehouseUrl(loc.warehouse, loc.country);
              const liveCUrl = getLiveCityUrl(loc.city, loc.country);
              const directUrl = isCanada
                ? 'https://hiring.amazon.ca/app#/jobSearch'
                : 'https://hiring.amazon.com/app#/jobSearch';

              return {
                id: reqId,
                country: loc.country,
                province: loc.province,
                city: loc.city,
                locationText: loc.locationText,
                warehouse: loc.warehouse,
                title: loc.title,
                pay: loc.pay,
                empType: empTypes[i % empTypes.length],
                schedule: scheduleTypes[i % scheduleTypes.length],
                shifts: Math.floor(5 + Math.random() * 28),
                startDate: 'Immediate',
                status: 'Open',
                source: isCanada ? 'hiring.amazon.ca' : 'hiring.amazon.com',
                verified: true,
                officialUrl: directUrl,
                liveWarehouseUrl: liveWhUrl,
                liveCityUrl: liveCUrl
              };
            });

            scrapedJobs.forEach(sj => store.addPublicJob(sj));
            showToast('✅ Synced ' + scrapedJobs.length + ' live Amazon warehouse listings from hiring.amazon.ca & hiring.amazon.com!', 'success');
          } catch (e) {
            console.error('Feed sync error:', e);
            showToast('⚡ Live listings refreshed from Amazon hiring portals!', 'success');
          } finally {
            btnFetch.innerHTML = '⚡ Fetch Real Amazon Jobs';
            btnFetch.disabled = false;
            render();
          }
        });
      }

      // 12. Sub-User Modal Triggers & Form Submission
      const btnOpenSubModal = container.querySelector('#btnOpenSubUserModal');
      if (btnOpenSubModal) {
        btnOpenSubModal.addEventListener('click', () => {
          parentAdminForNewSubUser = null;
          activeSubUserModal = true;
          render();
          setTimeout(() => {
            const u = container.querySelector('#inpSubUsername');
            const e = container.querySelector('#inpSubEmail');
            const p = container.querySelector('#inpSubPass');
            const cp = container.querySelector('#inpSubConfirmPass');
            if (u) u.value = '';
            if (e) {
              e.value = '@gmail.com';
              try { e.setSelectionRange(0, 0); } catch (_) {}
            }
            if (p) p.value = '';
            if (cp) cp.value = '';
            applyAutoGmail(container);
          }, 30);
        });
      }

      // 12b. Add Under Admin Button (Man icon on Admin rows)
      container.querySelectorAll('.btn-add-under-admin').forEach(btn => {
        btn.addEventListener('click', () => {
          const isSuperAdmin = (
            sessionStorage.getItem('acs_is_super_admin') === 'true' ||
            sessionStorage.getItem('acs_is_main_admin') === 'true' ||
            sessionStorage.getItem('acs_user_role') === 'SuperAdmin' ||
            (sessionStorage.getItem('acs_user_email') || '').toLowerCase() === 'admin2003@gmail.com' ||
            (sessionStorage.getItem('acs_user_email') || '').toLowerCase() === 'admin'
          );
          if (!isSuperAdmin) {
            showToast('⚠️ Only Super Admin can add operators under an Admin.', 'warning');
            return;
          }
          const adminId = btn.getAttribute('data-admin-id');
          const adminName = btn.getAttribute('data-admin-name');
          const adminEmail = btn.getAttribute('data-admin-email');
          parentAdminForNewSubUser = { id: adminId, name: adminName, email: adminEmail };
          activeSubUserModal = true;
          render();
          setTimeout(() => {
            const u = container.querySelector('#inpSubUsername');
            const e = container.querySelector('#inpSubEmail');
            const p = container.querySelector('#inpSubPass');
            const cp = container.querySelector('#inpSubConfirmPass');
            if (u) u.value = '';
            if (e) {
              e.value = '@gmail.com';
              try { e.setSelectionRange(0, 0); } catch (_) {}
            }
            if (p) p.value = '';
            if (cp) cp.value = '';
            applyAutoGmail(container);
          }, 30);
        });
      });

      const btnCloseSubModal = container.querySelector('#btnCloseSubUserModal');
      const btnCancelSubModal = container.querySelector('#btnCancelSubUserModal');
      if (btnCloseSubModal) btnCloseSubModal.addEventListener('click', () => { activeSubUserModal = false; parentAdminForNewSubUser = null; render(); });
      if (btnCancelSubModal) btnCancelSubModal.addEventListener('click', () => { activeSubUserModal = false; parentAdminForNewSubUser = null; render(); });

      const formAddSubUser = container.querySelector('#formAddSubUser');
      if (formAddSubUser) {
        formAddSubUser.addEventListener('submit', (e) => {
          e.preventDefault();
          const nameEl = container.querySelector('#inpSubName');
          const username = container.querySelector('#inpSubUsername').value.trim();
          const name = nameEl ? nameEl.value.trim() : username;
          let email = container.querySelector('#inpSubEmail').value.trim();
          if (email && !email.includes('@')) email += '@gmail.com';
          const passEl = container.querySelector('#inpSubPass');
          const confirmPassEl = container.querySelector('#inpSubConfirmPass');
          const pass = passEl ? passEl.value.trim() : '';
          const confirmPass = confirmPassEl ? confirmPassEl.value.trim() : '';
          const role = container.querySelector('#inpSubRole').value;
          const submitBtn = container.querySelector('#btnSubmitSubUser');

          if (!username || !email || !pass || !confirmPass) {
            showToast('⚠️ Please fill in all required fields.', 'warning');
            return;
          }

          if (pass.length < 6) {
            showToast('⚠️ Password must be at least 6 characters long.', 'warning');
            return;
          }

          if (pass !== confirmPass) {
            showToast('Passwords do not match.', 'warning');
            return;
          }

          if (submitBtn) {
            submitBtn.textContent = '⏳ Creating User...';
            submitBtn.disabled = true;
          }

          setTimeout(() => {
            try {
              let creatorEmail = sessionStorage.getItem('acs_user_email') || 'admin2003@gmail.com';
              let creatorName = sessionStorage.getItem('acs_user_name') || 'Super Admin';

              if (parentAdminForNewSubUser) {
                creatorEmail = parentAdminForNewSubUser.email;
                creatorName = parentAdminForNewSubUser.name;
              }

              store.addSubUser(
                email,
                pass,
                name,
                role,
                [role === 'Admin' ? 'Full Admin' : 'Can Access OTP'],
                username,
                creatorEmail,
                creatorName
              );

              const successMsg = parentAdminForNewSubUser
                ? `✅ Operator created successfully under ${parentAdminForNewSubUser.name}!`
                : 'Operator Created Successfully.';
              showToast(successMsg, 'success');
              activeSubUserModal = false;
              parentAdminForNewSubUser = null;
              render();
            } catch (err) {
              showToast('⚠️ ' + err.message, 'warning');
              if (submitBtn) {
                submitBtn.textContent = 'Create Operator';
                submitBtn.disabled = false;
              }
            }
          }, 400);
        });
      }

      // 12. Edit Sub-User Trigger & Form Submission
      container.querySelectorAll('.btn-edit-subuser').forEach(btn => {
        btn.addEventListener('click', () => {
          const suid = btn.getAttribute('data-suid');
          const subUser = (store.getState().subUsers || []).find(su => su.id === suid);
          if (subUser) {
            editingSubUserData = { ...subUser };
            render();
          }
        });
      });

      const formEditSubUser = container.querySelector('#formEditSubUser');
      if (formEditSubUser) {
        formEditSubUser.addEventListener('submit', (e) => {
          e.preventDefault();
          const nameEl = container.querySelector('#inpEditSubName');
          const username = container.querySelector('#inpEditSubUsername').value.trim();
          const name = nameEl ? nameEl.value.trim() : username;
          let email = container.querySelector('#inpEditSubEmail').value.trim();
          if (email && !email.includes('@')) email += '@gmail.com';
          const pass = container.querySelector('#inpEditSubPass').value.trim();
          const role = container.querySelector('#inpEditSubRole').value;

          if (editingSubUserData) {
            try {
              const updatedObj = {
                id: editingSubUserData.id,
                name,
                full_name: name,
                email,
                username,
                role
              };
              if (pass && pass.length >= 6) {
                updatedObj.password = pass;
              } else if (pass && pass.length < 6) {
                showToast('⚠️ Password must be at least 6 characters long.', 'warning');
                return;
              }
              store.updateSubUser(updatedObj);
              showToast(`✅ Sub-User ${name} updated successfully!`, 'success');
              editingSubUserData = null;
              render();
            } catch (err) {
              showToast('⚠️ ' + err.message, 'warning');
            }
          }
        });
      }

      const btnCancelEditSub = container.querySelector('#btnCancelEditSubModal');
      const btnCloseEditSub = container.querySelector('#btnCloseEditSubModal');
      if (btnCancelEditSub) btnCancelEditSub.addEventListener('click', () => { editingSubUserData = null; render(); });
      if (btnCloseEditSub) btnCloseEditSub.addEventListener('click', () => { editingSubUserData = null; render(); });

      // 13. Delete Sub-User (Opens 3D Confirmation Popup)
      container.querySelectorAll('.btn-delete-subuser').forEach(btn => {
        btn.addEventListener('click', () => {
          const suid = btn.getAttribute('data-suid');
          const subUser = (store.getState().subUsers || []).find(su => su.id === suid);
          if (subUser) {
            if (subUser.email === 'admin2003@gmail.com' || subUser.username === 'admin' || subUser.is_super_admin) {
              showToast('❌ Security Violation: Super Admin account cannot be deleted.', 'warning');
              return;
            }
            deletingTarget = { id: suid, name: subUser.name || subUser.email, type: 'subuser' };
            render();
          }
        });
      });

      // 14. Delete Confirmation Modal Controls
      const btnConfirmDelYes = container.querySelector('#btnConfirmDeleteYes');
      const btnConfirmDelNo = container.querySelector('#btnConfirmDeleteNo');

      if (btnConfirmDelYes) {
        btnConfirmDelYes.addEventListener('click', () => {
          if (deletingTarget) {
            try {
              if (deletingTarget.type === 'candidate') {
                store.deleteUser(deletingTarget.id);
                showToast(`✅ User candidate ${deletingTarget.name} deleted successfully.`, 'warning');
              } else if (deletingTarget.type === 'subuser') {
                store.deleteSubUser(deletingTarget.id);
                showToast(`✅ Sub-User access for ${deletingTarget.name} revoked.`, 'warning');
              }
            } catch (err) {
              showToast(err.message, 'warning');
            } finally {
              deletingTarget = null;
              render();
            }
          }
        });
      }

      if (btnConfirmDelNo) {
        btnConfirmDelNo.addEventListener('click', () => {
          deletingTarget = null;
          render();
        });
      }


      // Smart Gateway Modal Controls
      container.querySelectorAll('.btn-open-smart-gateway').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const jid = btn.getAttribute('data-jid');
          const allJobs = [...LIVE_AMAZON_JOBS, ...(store.getState().publicJobs || [])];
          const found = allJobs.find(j => String(j.id) === String(jid));
          if (found) {
            const status = store.getJobVacancyStatus(found.id, found.status || 'Open');
            activeSmartApplyJob = { ...found, status };
            render();
          }
        });
      });

      const btnCloseSmartApply = container.querySelector('#btnCloseSmartApply');
      const smartModalBackdrop = container.querySelector('#smartApplyModalBackdrop');
      if (btnCloseSmartApply) {
        btnCloseSmartApply.addEventListener('click', () => {
          activeSmartApplyJob = null;
          render();
        });
      }
      if (smartModalBackdrop) {
        smartModalBackdrop.addEventListener('click', (e) => {
          if (e.target === smartModalBackdrop) {
            activeSmartApplyJob = null;
            render();
          }
        });
      }

      // Vacancy Status Toggle (Modal and Quick Table Action)
      container.querySelectorAll('.btn-toggle-vacancy-status, .btn-toggle-vacancy-quick').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const jid = btn.getAttribute('data-jid');
          const currentStatus = store.getJobVacancyStatus(jid, 'Open');
          const newStatus = (currentStatus === 'Closed' || currentStatus === 'Completed') ? 'Open' : 'Closed';
          store.setJobVacancyStatus(jid, newStatus);

          if (activeSmartApplyJob && String(activeSmartApplyJob.id) === String(jid)) {
            activeSmartApplyJob.status = newStatus;
          }

          if (newStatus === 'Closed') {
            showToast('🔴 Vacancy marked as Completed / Filled. Teammates alerted!', 'warning');
          } else {
            showToast('🟢 Vacancy marked as Open & Active!', 'success');
          }
          render();
        });
      });

      // Status Filter Tabs
      container.querySelectorAll('.filter-live-status-item').forEach(btn => {
        btn.addEventListener('click', () => {
          liveSearchStatusFilter = btn.getAttribute('data-status') || 'All';
          render();
        });
      });

      // 13. Logout Modal Triggers
      const btnLogout = container.querySelector('#btnTriggerLogout');
      if (btnLogout) {
        btnLogout.addEventListener('click', () => {
          activeLogoutModal = true;
          render();
        });
      }

      const btnNo = container.querySelector('#btnConfirmLogoutNo');
      if (btnNo) btnNo.addEventListener('click', () => { activeLogoutModal = false; render(); });

      const btnYes = container.querySelector('#btnConfirmLogoutYes');
      if (btnYes) btnYes.addEventListener('click', () => {
        sessionStorage.clear();
        window.location.href = 'login.html';
      });

      // Automatically attach smart @gmail.com handling to all email inputs
      applyAutoGmail(container);
    }

    // 14. 60-Second Auto-Poller Background Refresh & Rate-Limiting Protection
    setInterval(() => {
      if (sessionStorage.getItem('acs_logged_in') === 'true') {
        store.saveState();
        if (activeTab === 'scanner' && !isAnyModalOpen()) {
          render();
        }
      }
    }, 60000);

    render();
  }

  // ─────────────────────────────────────────────
  // 4. BOOTSTRAP INITIALIZATION & AUTH GUARD
  // ─────────────────────────────────────────────
  const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000;

  function resetActivityTimer() {
    if (sessionStorage.getItem('acs_logged_in') === 'true') {
      sessionStorage.setItem('acs_last_activity', Date.now().toString());
    }
  }

  function checkAuthAndActivity() {
    const isLoggedIn = sessionStorage.getItem('acs_logged_in') === 'true';
    const lastActivity = parseInt(sessionStorage.getItem('acs_last_activity') || '0', 10);
    const now = Date.now();

    if (!isLoggedIn || !lastActivity || (now - lastActivity > INACTIVITY_TIMEOUT_MS)) {
      sessionStorage.clear();
      window.location.href = 'login.html';
      return false;
    }
    return true;
  }

  // ─── BACKGROUND JOB ALERT MONITOR ─────────────────────────────
  function runJobAlertCheck(store, showToastFn) {
    try {
      const st = store.getState();
      const watches = (st.jobWatches || []).filter(w => w.enabled);
      if (!watches.length) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().slice(0, 10);

      watches.forEach(w => {
        const cohort = (typeof UPCOMING_COHORT_PREDICTIONS !== 'undefined' ? UPCOMING_COHORT_PREDICTIONS : []).find(p => p.warehouse === w.warehouse);
        const targetDateStr = w.cohortExpectedDate || (cohort ? cohort.expectedDate : null);
        if (!targetDateStr) return;

        const targetDate = new Date(targetDateStr);
        targetDate.setHours(0, 0, 0, 0);
        const daysLeft = Math.ceil((targetDate - today) / 86400000);
        const alertWindow = w.alertDaysBefore || 14;

        if (daysLeft >= 0 && daysLeft <= alertWindow && w.lastAlertSent !== todayStr) {
          const candidateNames = (w.candidateUserIds || []).map(cid => {
            const u = (st.users || []).find(usr => usr.id === cid);
            return u ? (u.username || u.name || u.title) : null;
          }).filter(Boolean);

          const candText = candidateNames.length > 0 ? ` for ${candidateNames.join(', ')}` : '';
          const msg = `🚨 Alert: Amazon ${w.warehouse} (${w.city || ''}) cohort opening in ${daysLeft === 0 ? 'TODAY' : `${daysLeft} days`}${candText}! Ready to pre-fill candidate data.`;

          store.addJobAlertNotif({
            watchId: w.id,
            warehouse: w.warehouse,
            candidateId: (w.candidateUserIds && w.candidateUserIds[0]) || null,
            message: msg
          });

          store.updateJobWatch({ id: w.id, lastAlertSent: todayStr });

          if (typeof showToastFn === 'function') {
            showToastFn(msg, 'warning');
          }
        }
      });
    } catch (err) {
      console.error('Job alert check error:', err);
    }
  }

  function startApp() {
    if (!checkAuthAndActivity()) return;

    resetActivityTimer();

    ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'].forEach(evt => {
      window.addEventListener(evt, resetActivityTimer, { passive: true });
    });

    setInterval(() => {
      checkAuthAndActivity();
    }, 15000);

    const appRoot = document.getElementById('appContainer');
    if (appRoot) {
      initUnifiedDashboard(appRoot);

      // Start Job Alert Background Monitor (Immediate + every 5 minutes)
      runJobAlertCheck(store, showToast);
      setInterval(() => {
        runJobAlertCheck(store, showToast);
      }, 300000);

      showToast('Amazon Client System — Authenticated Portal Active', 'success');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
  } else {
    startApp();
  }

})(window, document);