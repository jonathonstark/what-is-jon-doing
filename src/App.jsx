import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';

const REPO_OWNER = "jonathonstark";
const REPO_NAME = "what-is-jon-doing";
const FILE_PATH = "public/data/tasks.json";

export default function App() {
  const [data, setData] = useState({ 
    lastUpdated: '', 
    statusBlurb: "Focusing on submittal reviews, specification compliance, and active structural calculations this week.",
    projects: [] 
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Active Tab State: 'summary' | 'dashboard'
  const [activeTab, setActiveTab] = useState('summary');

  // Search & Filter State (Dashboard View)
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Auth & Admin Drawer State
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [githubToken, setGithubToken] = useState(() => localStorage.getItem('jon_gh_token') || '');
  const [fileSha, setFileSha] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState({ type: '', msg: '' });

  // Form state for admin edits
  const [editStatusBlurb, setEditStatusBlurb] = useState('');
  const [editProjects, setEditProjects] = useState([]);

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`./data/tasks.json?t=${Date.now()}`);
      if (!res.ok) throw new Error('Failed to load project data');
      const json = await res.json();
      
      const defaultBlurb = json.statusBlurb || "Currently updating priorities and task deliverables.";
      
      setData({
        lastUpdated: json.lastUpdated || '',
        statusBlurb: defaultBlurb,
        projects: json.projects || []
      });
      setEditStatusBlurb(defaultBlurb);
      setEditProjects(json.projects || []);

      fetchFileSha();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchFileSha = async () => {
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`);
      if (res.ok) {
        const fileData = await res.json();
        setFileSha(fileData.sha);
      }
    } catch (e) {
      console.warn("Could not fetch file SHA.", e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleTokenSave = (token) => {
    setGithubToken(token);
    localStorage.setItem('jon_gh_token', token);
  };

  // Commit updated JSON to GitHub API
  const handleSaveToGitHub = async () => {
    if (!githubToken) {
      setSaveStatus({ type: 'error', msg: 'Please enter a GitHub Personal Access Token.' });
      return;
    }

    setIsSaving(true);
    setSaveStatus({ type: 'info', msg: 'Committing changes to GitHub...' });

    try {
      const updatedData = {
        lastUpdated: new Date().toISOString().split('T')[0],
        statusBlurb: editStatusBlurb,
        projects: editProjects
      };

      const jsonString = JSON.stringify(updatedData, null, 2);
      const bytes = new TextEncoder().encode(jsonString);
      const contentEncoded = btoa(String.fromCharCode(...bytes));

      let currentSha = fileSha;
      if (!currentSha) {
        const shaRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`, {
          headers: { Authorization: `Bearer ${githubToken}` }
        });
        if (shaRes.ok) {
          const shaData = await shaRes.json();
          currentSha = shaData.sha;
        }
      }

      const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify({
          message: `Update tasks, status blurb, and project statuses [Dashboard Admin]`,
          content: contentEncoded,
          sha: currentSha
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'GitHub API update failed.');
      }

      const result = await res.json();
      setFileSha(result.content.sha);
      setData(updatedData);
      setSaveStatus({ type: 'success', msg: 'Successfully committed to GitHub! Rebuilding deployment...' });
      setTimeout(() => setSaveStatus({ type: '', msg: '' }), 4000);
    } catch (err) {
      setSaveStatus({ type: 'error', msg: `Save failed: ${err.message}` });
    } finally {
      setIsSaving(false);
    }
  };

  // Dashboard filtering logic
  const filteredProjects = useMemo(() => {
    return (data.projects || []).filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                            (p.projectNumber && p.projectNumber.toLowerCase().includes(search.toLowerCase())) ||
                            (p.currentStatus && p.currentStatus.toLowerCase().includes(search.toLowerCase())) ||
                            p.description.toLowerCase().includes(search.toLowerCase()) ||
                            p.category.toLowerCase().includes(search.toLowerCase()) ||
                            p.tasks.some(t => t.text.toLowerCase().includes(search.toLowerCase()));
      const matchesPriority = priorityFilter === 'All' || p.priority === priorityFilter;
      const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
      return matchesSearch && matchesPriority && matchesStatus;
    });
  }, [data, search, priorityFilter, statusFilter]);

  // Priority sorting for Summary view
  const summaryProjectsByPriority = useMemo(() => {
    const priorityOrder = { 'High': 1, 'Medium': 2, 'Low': 3 };
    return [...(data.projects || [])].sort((a, b) => {
      const pA = priorityOrder[a.priority] || 4;
      const pB = priorityOrder[b.priority] || 4;
      return pA - pB;
    });
  }, [data]);

  // Get next 2 unchecked subtasks sorted by due date
  const getNextTwoTasks = (tasks = []) => {
    return tasks
      .filter(t => !t.completed)
      .sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
      })
      .slice(0, 2);
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'High': return 'bg-red-50 text-red-700 border-red-200';
      case 'Medium': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Low': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'In Progress': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'In Review': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Planned': return 'bg-slate-100 text-slate-600 border-slate-200';
      case 'Completed': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  // Helper function to find the latest date among subtasks
  const getLatestTaskDate = (tasks) => {
    if (!tasks || tasks.length === 0) return null;
    const validDates = tasks
      .map(t => t.dueDate)
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a));
    return validDates[0] || null;
  };

  // State Updaters
  const handleAddProject = () => {
    const today = new Date().toISOString().split('T')[0];
    const newProjNum = `PRJ-${String((editProjects.length || 0) + 1).padStart(3, '0')}`;
    const newProj = {
      id: `proj-${Date.now()}`,
      projectNumber: newProjNum,
      name: "New Project Title",
      category: "General",
      priority: "Medium",
      status: "Planned",
      currentStatus: "Initial setup underway.",
      dueDate: today,
      description: "Brief project description...",
      tasks: [{ id: `t-${Date.now()}`, text: "Initial subtask", completed: false, dueDate: today }]
    };
    setEditProjects(prev => [newProj, ...prev]);
  };

  const handleUpdateProjectField = (index, field, value) => {
    setEditProjects(prev => prev.map((proj, pIdx) => 
      pIdx === index ? { ...proj, [field]: value } : proj
    ));
  };

  const handleAddTask = (projIndex) => {
    const defaultDate = editProjects[projIndex]?.dueDate || new Date().toISOString().split('T')[0];
    setEditProjects(prev => prev.map((proj, pIdx) => {
      if (pIdx !== projIndex) return proj;
      const updatedTasks = [...(proj.tasks || []), { id: `t-${Date.now()}`, text: "New task item", completed: false, dueDate: defaultDate }];
      const latestDate = getLatestTaskDate(updatedTasks);
      return {
        ...proj,
        tasks: updatedTasks,
        dueDate: latestDate || proj.dueDate
      };
    }));
  };

  const handleUpdateTaskText = (projIndex, taskIndex, text) => {
    setEditProjects(prev => prev.map((proj, pIdx) => {
      if (pIdx !== projIndex) return proj;
      return {
        ...proj,
        tasks: proj.tasks.map((t, tIdx) => tIdx === taskIndex ? { ...t, text } : t)
      };
    }));
  };

  const handleUpdateTaskDate = (projIndex, taskIndex, dueDate) => {
    setEditProjects(prev => prev.map((proj, pIdx) => {
      if (pIdx !== projIndex) return proj;
      const updatedTasks = proj.tasks.map((t, tIdx) => tIdx === taskIndex ? { ...t, dueDate } : t);
      const latestDate = getLatestTaskDate(updatedTasks);
      return {
        ...proj,
        tasks: updatedTasks,
        dueDate: latestDate || proj.dueDate
      };
    }));
  };

  const handleToggleTask = (projIndex, taskIndex) => {
    setEditProjects(prev => prev.map((proj, pIdx) => {
      if (pIdx !== projIndex) return proj;
      return {
        ...proj,
        tasks: proj.tasks.map((t, tIdx) => tIdx === taskIndex ? { ...t, completed: !t.completed } : t)
      };
    }));
  };

  const handleDeleteTask = (projIndex, taskIndex) => {
    setEditProjects(prev => prev.map((proj, pIdx) => {
      if (pIdx !== projIndex) return proj;
      const updatedTasks = proj.tasks.filter((_, tIdx) => tIdx !== taskIndex);
      const latestDate = getLatestTaskDate(updatedTasks);
      return {
        ...proj,
        tasks: updatedTasks,
        dueDate: latestDate || proj.dueDate
      };
    }));
  };

  const handleDeleteProject = (projIndex) => {
    if (confirm("Are you sure you want to delete this project?")) {
      setEditProjects(prev => prev.filter((_, pIdx) => pIdx !== projIndex));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Top Navbar */}
      <nav className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow">
                JS
              </div>
              <div className="hidden sm:block">
                <h1 className="font-bold text-base leading-snug">What is Jon Doing?</h1>
                <p className="text-xs text-slate-400">Engineering Task & Status Tracker</p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
              <button
                onClick={() => setActiveTab('summary')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                  activeTab === 'summary' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
                }`}
              >
                Status Summary
              </button>
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                  activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
                }`}
              >
                Project Dashboard
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <span className="hidden lg:inline-block text-xs text-slate-400">
              {data.lastUpdated && `Updated: ${data.lastUpdated}`}
            </span>
            <button
              onClick={() => setIsAdminOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Jon's Admin Panel
            </button>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-6">

        {/* TAB 1: LANDING PAGE STATUS SUMMARY */}
        {activeTab === 'summary' && (
          <div className="space-y-6">
            {/* Status Blurb Banner */}
            <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-slate-900 rounded-xl p-5 text-white shadow-md border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1 max-w-3xl">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-[11px] font-bold text-blue-300 uppercase tracking-wider">Current Focus & Overview</span>
                </div>
                <p className="text-sm md:text-base font-medium text-slate-100 leading-snug">
                  "{data.statusBlurb}"
                </p>
              </div>
              <div className="shrink-0 text-xs text-slate-400 bg-slate-800/80 border border-slate-700/60 px-3 py-2 rounded-lg self-start md:self-auto">
                Ordered by <strong className="text-amber-400">Priority</strong> (High → Low)
              </div>
            </div>

            {/* Compact Project List */}
            {!loading && !error && (
              <div className="space-y-2.5">
                {summaryProjectsByPriority.map((project) => {
                  const upcomingTasks = getNextTwoTasks(project.tasks);

                  return (
                    <div
                      key={project.id}
                      className="bg-white rounded-lg border border-slate-200 px-4 py-3 shadow-sm hover:border-slate-300 transition flex flex-col md:flex-row md:items-center justify-between gap-3 min-h-[64px]"
                    >
                      {/* Left Block: Identifiers, Title, Current Status */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {project.projectNumber && (
                            <span className="text-[11px] font-mono font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                              {project.projectNumber}
                            </span>
                          )}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getPriorityBadge(project.priority)}`}>
                            {project.priority} Priority
                          </span>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${getStatusBadge(project.status)}`}>
                            {project.status}
                          </span>
                          <h3 className="font-bold text-slate-900 text-sm truncate leading-tight">
                            {project.name}
                          </h3>
                        </div>

                        {/* Project Current Status Line */}
                        {project.currentStatus && (
                          <p className="text-xs text-slate-600 line-clamp-1">
                            <strong className="text-slate-800 font-semibold">Focus:</strong> {project.currentStatus}
                          </p>
                        )}
                      </div>

                      {/* Right Block: Next 2 Unchecked Subtasks */}
                      <div className="md:w-80 shrink-0 bg-slate-50 p-2 rounded-md border border-slate-100 text-xs space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Next Subtasks ({upcomingTasks.length})
                        </span>
                        {upcomingTasks.length > 0 ? (
                          <ul className="space-y-1">
                            {upcomingTasks.map((task) => (
                              <li key={task.id} className="flex items-center justify-between gap-2 text-slate-700">
                                <span className="truncate text-[11px] font-medium">
                                  • {task.text}
                                </span>
                                {task.dueDate && (
                                  <span className="text-[9px] text-slate-400 font-mono shrink-0">
                                    {task.dueDate}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-[11px] text-slate-400 italic">No remaining subtasks</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: FULL PROJECT DASHBOARD GRID */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Search and Filters */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="relative w-full md:w-80">
                <input
                  type="text"
                  placeholder="Search project #, title, status..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                />
                <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                  <span className="text-xs font-bold text-slate-400 uppercase px-2">Priority:</span>
                  {['All', 'High', 'Medium', 'Low'].map((p) => (
                    <button
                      key={p}
                      onClick={() => setPriorityFilter(p)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${
                        priorityFilter === p ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                  <span className="text-xs font-bold text-slate-400 uppercase px-2">Status:</span>
                  {['All', 'In Progress', 'In Review', 'Planned'].map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${
                        statusFilter === s ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Dashboard Grid */}
            {!loading && !error && (
              filteredProjects.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredProjects.map((project) => {
                    const totalTasks = project.tasks?.length || 0;
                    const completedTasks = project.tasks?.filter(t => t.completed).length || 0;
                    const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

                    return (
                      <div
                        key={project.id}
                        className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between overflow-hidden"
                      >
                        <div className="p-5 space-y-4">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {project.projectNumber && (
                                <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                                  {project.projectNumber}
                                </span>
                              )}
                              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                {project.category}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${getPriorityBadge(project.priority)}`}>
                                {project.priority}
                              </span>
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-md border ${getStatusBadge(project.status)}`}>
                                {project.status}
                              </span>
                            </div>
                          </div>

                          <div>
                            <h3 className="font-bold text-slate-900 text-lg leading-snug">{project.name}</h3>
                            {project.currentStatus && (
                              <p className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-100 mt-2">
                                <strong>Focus:</strong> {project.currentStatus}
                              </p>
                            )}
                            <p className="text-slate-600 text-xs mt-2 leading-relaxed">{project.description}</p>
                          </div>

                          {totalTasks > 0 && (
                            <div className="space-y-1 pt-1">
                              <div className="flex justify-between text-xs text-slate-500 font-medium">
                                <span>Progress ({completedTasks}/{totalTasks})</span>
                                <span>{progressPct}%</span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-600 rounded-full transition-all duration-300"
                                  style={{ width: `${progressPct}%` }}
                                />
                              </div>
                            </div>
                          )}

                          <div className="space-y-2 pt-2 border-t border-slate-100">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Deliverables</span>
                            <ul className="space-y-2">
                              {project.tasks?.map((task) => (
                                <li key={task.id} className="flex items-start justify-between gap-2 text-xs text-slate-700">
                                  <div className="flex items-start gap-2 min-w-0">
                                    <span className={`mt-0.5 w-3.5 h-3.5 rounded flex items-center justify-center border shrink-0 ${
                                      task.completed ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'
                                    }`}>
                                      {task.completed && (
                                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </span>
                                    <span className={`truncate ${task.completed ? 'line-through text-slate-400' : ''}`}>
                                      {task.text}
                                    </span>
                                  </div>
                                  {task.dueDate && (
                                    <span className="text-[10px] font-medium text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                                      {task.dueDate}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500 flex justify-between items-center">
                          <span>Target Date:</span>
                          <strong className="text-slate-700 font-semibold">{project.dueDate}</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
                  <p className="text-slate-500 text-sm">No matching projects found.</p>
                  <button
                    onClick={() => { setSearch(''); setPriorityFilter('All'); setStatusFilter('All'); }}
                    className="mt-2 text-xs text-blue-600 font-semibold hover:underline"
                  >
                    Reset Filters
                  </button>
                </div>
              )
            )}
          </div>
        )}
      </main>

      {/* Admin Panel Drawer */}
      {isAdminOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between sticky top-0 z-10">
              <div>
                <h2 className="text-lg font-bold">Jon's Task Management Panel</h2>
                <p className="text-xs text-slate-400 mt-0.5">Edit projects, subtasks & status blurbs</p>
              </div>
              <button
                onClick={() => setIsAdminOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6 flex-1">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2 text-xs text-amber-900">
                <label className="font-bold block text-amber-950">GitHub Personal Access Token (PAT):</label>
                <p className="text-amber-800">
                  Required to authenticate write commits to <code>{REPO_OWNER}/{REPO_NAME}</code>.
                </p>
                <input
                  type="password"
                  placeholder="github_pat_xxxxxxxxxxxxxxxx"
                  value={githubToken}
                  onChange={(e) => handleTokenSave(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-md font-mono text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {saveStatus.msg && (
                <div className={`p-3 rounded-lg text-xs font-medium border ${
                  saveStatus.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' :
                  saveStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  'bg-blue-50 text-blue-700 border-blue-200'
                }`}>
                  {saveStatus.msg}
                </div>
              )}

              {/* Status Blurb Editor */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <label className="text-xs font-bold text-slate-800 block">Landing Page Overall Status Blurb:</label>
                <textarea
                  rows={2}
                  value={editStatusBlurb}
                  onChange={(e) => setEditStatusBlurb(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="State your overall focus across all engineering tasks..."
                />
              </div>

              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="font-bold text-slate-800 text-sm">Manage Projects ({editProjects.length})</h3>
                <button
                  onClick={handleAddProject}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition shadow-sm"
                >
                  + Add New Project
                </button>
              </div>

              <div className="space-y-6">
                {editProjects.map((proj, pIdx) => (
                  <div key={proj.id || pIdx} className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-4">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
                      <span className="text-xs font-bold text-slate-500">Project #{pIdx + 1}</span>
                      <button
                        onClick={() => handleDeleteProject(pIdx)}
                        className="text-xs text-red-600 hover:underline font-semibold"
                      >
                        Delete Project
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-600 block mb-1">Project Number</label>
                        <input
                          type="text"
                          placeholder="PRJ-001"
                          value={proj.projectNumber || ''}
                          onChange={(e) => handleUpdateProjectField(pIdx, 'projectNumber', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-mono font-semibold"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-600 block mb-1">Project Name</label>
                        <input
                          type="text"
                          value={proj.name}
                          onChange={(e) => handleUpdateProjectField(pIdx, 'name', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-xs font-semibold text-slate-600 block mb-1">
                          Current Focus / Quick Status <span className="text-slate-400 font-normal">(Visible on Landing Page)</span>
                        </label>
                        <input
                          type="text"
                          value={proj.currentStatus || ''}
                          onChange={(e) => handleUpdateProjectField(pIdx, 'currentStatus', e.target.value)}
                          placeholder="e.g. Completing deck overhang calculations..."
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-medium"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-600 block mb-1">Category</label>
                        <input
                          type="text"
                          value={proj.category}
                          onChange={(e) => handleUpdateProjectField(pIdx, 'category', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-600 block mb-1">Priority</label>
                        <select
                          value={proj.priority}
                          onChange={(e) => handleUpdateProjectField(pIdx, 'priority', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs"
                        >
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-xs font-semibold text-slate-600 block mb-1">Status</label>
                        <select
                          value={proj.status}
                          onChange={(e) => handleUpdateProjectField(pIdx, 'status', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs"
                        >
                          <option value="In Progress">In Progress</option>
                          <option value="In Review">In Review</option>
                          <option value="Planned">Planned</option>
                          <option value="Completed">Completed</option>
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-xs font-semibold text-slate-600 block mb-1">
                          Project Target Due Date
                        </label>
                        <input
                          type="date"
                          value={proj.dueDate}
                          onChange={(e) => handleUpdateProjectField(pIdx, 'dueDate', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-medium"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-xs font-semibold text-slate-600 block mb-1">Full Description</label>
                        <textarea
                          rows={2}
                          value={proj.description}
                          onChange={(e) => handleUpdateProjectField(pIdx, 'description', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-200">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-600">Subtasks / Deliverables</span>
                        <button
                          onClick={() => handleAddTask(pIdx)}
                          className="text-xs text-blue-600 hover:underline font-semibold"
                        >
                          + Add Subtask
                        </button>
                      </div>

                      <div className="space-y-2">
                        {proj.tasks?.map((task, tIdx) => (
                          <div key={task.id || tIdx} className="flex items-center gap-2 bg-white p-2 border border-slate-200 rounded-lg">
                            <input
                              type="checkbox"
                              checked={task.completed}
                              onChange={() => handleToggleTask(pIdx, tIdx)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <input
                              type="text"
                              placeholder="Subtask description..."
                              value={task.text}
                              onChange={(e) => handleUpdateTaskText(pIdx, tIdx, e.target.value)}
                              className="flex-1 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs"
                            />
                            <input
                              type="date"
                              value={task.dueDate || ''}
                              onChange={(e) => handleUpdateTaskDate(pIdx, tIdx, e.target.value)}
                              className="px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs shrink-0"
                            />
                            <button
                              onClick={() => handleDeleteTask(pIdx, tIdx)}
                              className="text-slate-400 hover:text-red-600 p-1 shrink-0"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-slate-100 border-t border-slate-200 sticky bottom-0 flex justify-end gap-3">
              <button
                onClick={() => setIsAdminOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveToGitHub}
                disabled={isSaving}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white text-xs font-bold rounded-lg shadow transition"
              >
                {isSaving ? 'Committing...' : 'Commit & Publish to GitHub'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement && !rootElement.innerHTML) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
