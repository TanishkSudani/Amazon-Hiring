/* Central State Management Store with LocalStorage Persistence */

const STORAGE_KEY = 'AMAZON_AUTOMATION_SYSTEM_STATE_V1';

// Initial Seed Data matching screenshots
// Initial Seed Data matching screenshots (DD/MM/YYYY format)
const defaultState = {
  users: [
    { id: '1', email: 'vishantsutaria4@gmail.com', password: 'password123', webPass: 'password123', username: 'vishanh st thomas day', country: 'Canada', jobId: 'JOB-CA-000000552', schId: 'SCH-CA-000006122', status: 'pending', submittedDate: '21/07/2026' },
    { id: '2', email: 'rajeshkumar2026am@gmail.com', password: 'password123', webPass: 'password123', username: 'rajesh cambridge day', country: 'Canada', jobId: 'JOB-CA-000000573', schId: 'SCH-CA-000006066', status: 'approved', submittedDate: '21/07/2026' },
    { id: '3', email: 'jangidmanojkumar94@gmail.com', password: 'password123', webPass: 'password123', username: 'Manoj calgary day 4169030715', country: 'Canada', jobId: 'JOB-CA-000000586', schId: 'SCH-CA-000006086', status: 'test failed', submittedDate: '20/07/2026' },
    { id: '4', email: 'sutharmamt2001k@gmail.com', password: 'password123', webPass: 'password123', username: 'mamte calgary day 6477162898', country: 'Canada', jobId: 'JOB-CA-000000586', schId: 'SCH-CA-000006095', status: 'approved', submittedDate: '20/07/2026' },
    { id: '5', email: 'davemaharshi01@gmail.com', password: 'password123', webPass: 'password123', username: 'Dave Acheson night +1 (289) 925-2294', country: 'Canada', jobId: 'JOB-CA-000000557', schId: 'SCH-CA-000006545', status: 'approved', submittedDate: '20/07/2026' },
    { id: '6', email: 'jasrajbhullar33@gmail.com', password: 'password123', webPass: 'password123', username: 'jasraj calgary any full', country: 'Canada', jobId: 'JOB-CA-000000586', schId: 'SCH-CA-000006080', status: 'approved', submittedDate: '19/07/2026' },
    { id: '7', email: 'priyapatel1925@gmail.com', password: 'password123', webPass: 'password123', username: 'Priya Acheson night', country: 'Canada', jobId: 'JOB-CA-000000557', schId: 'SCH-CA-000006082', status: 'approved', submittedDate: '19/07/2026' }
  ],
  agentCustomers: [
    { id: 'c1', name: 'John Doe', phone: '+1 234 567 8900', email: 'user@example.com', pin: '163207', gmailAppPass: 'xxxx-xxxx-xxxx-xxxx', cities: ['CALGARY, AB', 'ACHESON, AB'], status: 'pending', created: '21/07/2026 12:24 PM' },
    { id: 'c2', name: 'Krina Patel', phone: '+1 416 998 1234', email: 'krinapatel1661@gmail.com', pin: '151611', gmailAppPass: 'app-pass-secret', cities: ['BRAMPTON, ON', 'MISSISSAUGA, ON'], status: 'pending', created: '03/07/2026 05:00:22 PM' },
    { id: 'c3', name: 'Avtar Singh', phone: '+1 587 332 9901', email: 'avtarsingh771122@gmail.com', pin: '771122', gmailAppPass: 'app-pass-secret', cities: ['HAMILTON, ON'], status: 'approved', created: '14/07/2026 05:31:56 PM' },
    { id: 'c4', name: 'Nimesh Patel', phone: '+1 647 112 3344', email: '04031994nimesh@gmail.com', pin: '190723', gmailAppPass: 'app-pass-secret', cities: ['CALGARY, AB'], status: 'approved', created: '11/07/2026 09:50:07 AM' },
    { id: 'c5', name: 'Bhargav Patel', phone: '+1 416 887 2200', email: 'bhargavpatel762001@gmail.com', pin: '163207', gmailAppPass: 'app-pass-secret', cities: ['BRAMPTON, ON', 'ETOBICOKE, ON'], status: 'confirmed', created: '27/05/2026 12:59:22 AM' },
    { id: 'c6', name: 'Aneri Madhavi', phone: '+1 368 440 9911', email: 'madhavianeri@gmail.com', pin: '300904', gmailAppPass: 'app-pass-secret', cities: ['BRAMPTON, ON', 'MISSISSAUGA, ON'], status: 'confirmed', created: '26/05/2026 06:01:45 PM' }
  ],
  tasks: [
    { id: 't1', userName: 'Komal cambridge any', email: 'komalvinayak003@gmail.com', jobId: 'JOB-CA-000000573', schId: 'SCH-CA-000006095', status: 'stopped', startTime: '-' },
    { id: 't2', userName: 'nima cambridge day', email: 'patelnima304@gmail.com', jobId: 'JOB-CA-000000573', schId: 'SCH-CA-000006086', status: 'stopped', startTime: '-' },
    { id: 't3', userName: 'Akash cambridge', email: 'berotakash0618@gmail.com', jobId: 'JOB-CA-000000573', schId: 'SCH-CA-000006086', status: 'stopped', startTime: '-' },
    { id: 't4', userName: 'Manoj calgary day 4169030715', email: 'jangidmanojkumar94@gmail.com', jobId: 'JOB-CA-000000586', schId: 'SCH-CA-000006006', status: 'running', startTime: '20/07/2026 06:38:36 PM' }
  ],
  publicJobs: [],
  subUsers: [
    { id: 'su_1', email: 'operator@amazon.com', password: 'password123', name: 'Shift Operator', role: 'Operator', permissions: ['Can Access OTP'], status: 'Active', created: '01/07/2026' }
  ],
  reviewRequests: [],
  activeScanner: {
    running: false,
    selectedUser: '',
    delayMs: 2500,
    startId: 6060,
    endId: 6200,
    currentProgress: 0,
    scannedCount: 0,
    foundCount: 0,
    postedCount: 0,
    availableCount: 0,
    startDatesCount: 0,
    notFoundCount: 0,
    results: []
  }
};

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

  const cCreatorEmail = (candidate.creator_email || '').trim().toLowerCase();
  const cCreatedBy = (candidate.created_by || '').trim().toLowerCase();
  const cCreatorName = (candidate.creator_name || '').trim().toLowerCase();

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

        return {
          ...defaultState,
          ...parsed,
          subUsers: Array.isArray(parsed.subUsers) && parsed.subUsers.length > 0 ? parsed.subUsers : defaultState.subUsers,
          publicJobs: Array.isArray(parsed.publicJobs) ? parsed.publicJobs : [],
          users: finalUsers,
          agentCustomers: Array.isArray(parsed.agentCustomers) ? parsed.agentCustomers : defaultState.agentCustomers,
          tasks: finalTasks
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
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(listener => listener(this.state));
  }

  // Mutations
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
      role: 'Candidate',
      submittedDate: (function() {
        const d = new Date();
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        return `${day}/${month}/${d.getFullYear()}`;
      })()
    };
    this.state.users.unshift(newUser);

    // Create corresponding task
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

  addAgentCustomer(customerData) {
    const newCust = {
      id: 'c_' + Date.now(),
      ...customerData,
      status: 'pending',
      created: new Date().toLocaleString()
    };
    this.state.agentCustomers.unshift(newCust);
    this.saveState();
    return newCust;
  }

  updateTaskStatus(taskId, status) {
    const task = this.state.tasks.find(t => t.id === taskId);
    if (task) {
      task.status = status;
      task.startTime = status === 'running' ? new Date().toLocaleString() : '-';
      this.saveState();
    }
  }

  updateTaskIds(taskId, jobId, schId) {
    const task = this.state.tasks.find(t => t.id === taskId);
    if (task) {
      task.jobId = jobId;
      task.schId = schId;
      this.saveState();
    }
  }

  removeUser(userId) {
    this.state.users = this.state.users.filter(u => u.id !== userId);
    this.saveState();
  }

  deleteUser(userId) {
    this.removeUser(userId);
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

  updateUser(updatedData) {
    if (updatedData.email === 'admin2003@gmail.com' || updatedData.username === 'admin') {
      if (updatedData.role && updatedData.role !== 'SuperAdmin' && updatedData.role !== 'Admin') {
        throw new Error('❌ Security Violation: Super Admin account role cannot be downgraded.');
      }
    }
    const idx = this.state.users.findIndex(u => u.id === updatedData.id);
    if (idx !== -1) {
      const oldUser = this.state.users[idx];
      const mergedUser = { ...oldUser, ...updatedData, updated_at: new Date().toISOString() };
      this.state.users[idx] = mergedUser;

      // Sync corresponding task
      const taskIdx = (this.state.tasks || []).findIndex(t => t.email === oldUser.email || t.userName === oldUser.username);
      if (taskIdx !== -1) {
        this.state.tasks[taskIdx] = {
          ...this.state.tasks[taskIdx],
          userName: mergedUser.username || mergedUser.name || this.state.tasks[taskIdx].userName,
          email: mergedUser.email || this.state.tasks[taskIdx].email,
          jobId: mergedUser.jobId || this.state.tasks[taskIdx].jobId,
          schId: mergedUser.schId || this.state.tasks[taskIdx].schId
        };
      }

      this.saveState();
    }
  }

  updateUserStatus(userId, status) {
    const user = this.state.users.find(u => u.id === userId);
    if (user) {
      if (user.email === 'admin2003@gmail.com' || user.username === 'admin') {
        throw new Error('❌ Security Violation: Super Admin status cannot be altered.');
      }
      user.status = status;
      user.updated_at = new Date().toISOString();
      this.saveState();
    }
  }

  addSubUser(email, password = 'password123', name = '', role = 'Operator', permissions = ['Can Access OTP'], username = '', createdBy = null, creatorName = null) {
    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = (username || name || email.split('@')[0]).trim().toLowerCase();
    const sessionEmail = typeof sessionStorage !== 'undefined' ? (sessionStorage.getItem('acs_user_email') || '').trim().toLowerCase() : '';
    const sessionName = typeof sessionStorage !== 'undefined' ? (sessionStorage.getItem('acs_user_name') || '').trim() : '';

    const creatorEmail = (createdBy && createdBy.includes('@'))
      ? createdBy.toLowerCase()
      : (createdBy || sessionEmail || 'admin2003@gmail.com');
    const assignedCreatorName = creatorName || (createdBy && !createdBy.includes('@') ? createdBy : (sessionName || 'Super Admin'));

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

    const dNow = new Date();
    const createdDateFormatted = `${String(dNow.getDate()).padStart(2, '0')}/${String(dNow.getMonth() + 1).padStart(2, '0')}/${dNow.getFullYear()}`;

    const newSubUser = {
      id: 'su_' + Date.now(),
      full_name: name || cleanUsername,
      name: name || cleanUsername,
      email: cleanEmail,
      username: cleanUsername,
      password: password || 'password123',
      role,
      permissions,
      status: 'Active',
      created_by: creatorEmail,
      creator_email: creatorEmail,
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
    const subList = Array.isArray(this.state.subUsers) ? this.state.subUsers : [];
    const subUser = subList.find(su => (su.email && su.email.trim().toLowerCase() === cleanEmail) || (su.username && su.username.trim().toLowerCase() === cleanEmail) || (su.name && su.name.trim().toLowerCase() === cleanEmail));
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

    const scopedUsers = (state.users || []).filter(u =>
      isCandidateAllowed(u, userRole, cleanCurrentEmail, currentUserName, subordinateSet)
    );

    const scopedTasks = (state.tasks || []).filter(t =>
      isCandidateAllowed(t, userRole, cleanCurrentEmail, currentUserName, subordinateSet)
    );

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

  addPublicJob(jobData) {
    const isCanada = jobData.country === 'Canada' || !jobData.country || String(jobData.country).toLowerCase().includes('can');
    const wh = (jobData.warehouse || '').trim();
    const liveWhUrl = jobData.liveWarehouseUrl || (isCanada ? (wh ? ('https://hiring.amazon.ca/app#/jobSearch?keyword=' + encodeURIComponent(wh)) : 'https://hiring.amazon.ca/app#/jobSearch') : (wh ? ('https://hiring.amazon.com/app#/jobSearch?keyword=' + encodeURIComponent(wh)) : 'https://hiring.amazon.com/app#/jobSearch'));
    const liveCUrl = jobData.liveCityUrl || (isCanada ? ('https://hiring.amazon.ca/app#/jobSearch?keyword=' + encodeURIComponent(jobData.city || '')) : ('https://hiring.amazon.com/app#/jobSearch?keyword=' + encodeURIComponent(jobData.city || '')));

    const newJob = {
      id: (jobData.id && !jobData.id.startsWith('pj_')) ? jobData.id : ('AMZN-' + Math.floor(2000000 + Math.random() * 1500000)),
      ...jobData,
      liveWarehouseUrl: liveWhUrl,
      liveCityUrl: liveCUrl,
      officialUrl: jobData.officialUrl || liveWhUrl,
      status: jobData.status || 'Open',
      postedDate: (function() {
        const d = new Date();
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        return `${day}/${month}/${d.getFullYear()}`;
      })()
    };
    const existingIdx = (this.state.publicJobs || []).findIndex(j => String(j.id) === String(newJob.id));
    if (existingIdx !== -1) {
      this.state.publicJobs[existingIdx] = { ...this.state.publicJobs[existingIdx], ...newJob };
    } else {
      this.state.publicJobs.unshift(newJob);
    }
    this.saveState();
    return newJob;
  }

  setPublicJobs(jobsList) {
    this.state.publicJobs = jobsList;
    this.saveState();
  }
}

export const store = new StateStore();
