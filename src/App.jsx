import React, { useState, useEffect, useMemo } from 'react';

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

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Direct Inline Editing / Expanded States
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [isEditingBlurb, setIsEditingBlurb] = useState(false);

  // Drag and Drop State
  const [draggedIndex, setDraggedIndex] = useState(null);

  // Auth & GitHub Commit State
  const [githubToken, setGithubToken] = useState(() => localStorage.getItem('jon_gh_token') || '');
  const [fileSha, setFileSha] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState({ type: '', msg: '' });

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

  const handleTokenChange = (token) => {
    setGithubToken(token);
    localStorage.setItem('jon_gh_token', token);
  };

  // Commit updated JSON to GitHub API directly
  const handleSaveToGitHub = async () => {
    if (!githubToken) {
      setSaveStatus({ type: 'error', msg: 'Enter a GitHub Personal Access Token to commit changes.' });
      return;
    }

    setIsSaving(true);
    setSaveStatus({ type: 'info', msg: 'Committing updates to GitHub...' });

    try {
      const updatedData = {
        lastUpdated: new Date().toISOString().split('T')[0],
        statusBlurb: data.statusBlurb,
        projects: data.projects
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
          message: `Update projects, subtasks, and project ordering directly via Dashboard`,
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
      setHasUnsavedChanges(false);
      setSaveStatus({ type: 'success', msg: 'Changes committed! Live site updating...' });
      setTimeout(() => setSaveStatus({ type: '', msg: '' }), 4000);
    } catch (err) {
      setSaveStatus({ type: 'error', msg: `Save failed: ${err.message}` });
    } finally {
      setIsSaving(false);
    }
  };

  // State mutation helper
  const updateProjectsState = (updater) => {
    setData(prev => ({
      ...prev,
      projects: typeof updater === 'function' ? updater(prev.projects) : updater
    }));
    setHasUnsavedChanges(true);
  };

  // Reordering Logic
  const moveProject = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= data.projects.length) return;
    updateProjectsState(prev => {
      const updated = [...prev];
      const [movedItem] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, movedItem);
      return updated;
    });
  };

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;
    moveProject(draggedIndex, targetIndex);
    setDraggedIndex(null);
  };

  // Helper function to find latest date among subtasks
  const getLatestTaskDate = (tasks) => {
    if (!tasks || tasks.length === 0) return null;
    const validDates = tasks
      .map(t => t.dueDate)
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a));
    return validDates[0] || null;
  };

  // Project Level Actions
  const handleAddProject = () => {
    const today = new Date().toISOString().split('T')[0];
    const newProjNum = `PRJ-${String((data.projects.length || 0) + 1).padStart(3, '0')}`;
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
    updateProjectsState(prev => [newProj, ...prev]);
    setEditingProjectId(newProj.id);
  };

  const handleUpdateProjectField = (projId, field, value) => {
    updateProjectsState(prev => prev.map(p => p.id === projId ? { ...p, [field]: value } : p));
  };

  const handleDeleteProject = (projId) => {
    if (confirm("Are you sure you want to delete this project?")) {
      updateProjectsState(prev => prev.filter(p => p.id !== projId));
    }
  };

  // Subtask Level Actions
  const handleToggleTask = (projId, taskId) => {
    updateProjectsState(prev => prev.map(p => {
      if (p.id !== projId) return p;
      return {
        ...p,
        tasks: p.tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t)
      };
    }));
  };

  const handleAddTask = (projId) => {
    const today = new Date().toISOString().split('T')[0];
    updateProjectsState(prev => prev.map(p => {
      if (p.id !== projId) return p;
      const updatedTasks = [...(p.tasks || []), { id: `t-${Date.now()}`, text: "New subtask item", completed: false, dueDate: p.dueDate || today }];
      return {
        ...p,
        tasks: updatedTasks,
        dueDate: getLatestTaskDate(updatedTasks) || p.dueDate
      };
    }));
  };

  const handleUpdateTaskText = (projId, taskId, text) => {
    updateProjectsState(prev => prev.map(p => {
      if (p.id !== projId) return p;
      return {
        ...p,
        tasks: p.tasks.map(t => t.id === taskId ? { ...t, text } : t)
      };
    }));
  };

  const handleUpdateTaskDate = (projId, taskId, dueDate) => {
    updateProjectsState(prev => prev.map(p => {
      if (p.id !== projId) return p;
      const updatedTasks = p.tasks.map(t => t.id === taskId ? { ...t, dueDate } : t);
      return {
        ...p,
        tasks: updatedTasks,
        dueDate: getLatestTaskDate(updatedTasks) || p.dueDate
      };
    }));
  };

  const handleDeleteTask = (projId, taskId) => {
    updateProjectsState(prev => prev.map(p => {
      if (p.id !== projId) return p;
      const updatedTasks = p.tasks.filter(t => t.id !== taskId);
      return {
        ...p,
        tasks: updatedTasks,
        dueDate: getLatestTaskDate(updatedTasks) || p.dueDate
      };
    }));
  };

  // Dashboard filtering logic (preserves raw order when filters are default)
  const filteredProjectsWithIndices = useMemo(() => {
    return (data.projects || [])
      .map((project, originalIndex) => ({ project, originalIndex }))
      .filter(({ project }) => {
        const matchesSearch = project.name.toLowerCase().includes(search.toLowerCase()) ||
                              (project.projectNumber && project.projectNumber.toLowerCase().includes(search.toLowerCase())) ||
                              (project.currentStatus && project.currentStatus.toLowerCase().includes(search.toLowerCase())) ||
                              project.description.toLowerCase().includes(search.toLowerCase()) ||
                              project.category.toLowerCase().includes(search.toLowerCase()) ||
                              project.tasks.some(t => t.text.toLowerCase().includes(search.toLowerCase()));
        const matchesPriority = priorityFilter === 'All' || project.priority === priorityFilter;
        const matchesStatus = statusFilter === 'All' || project.status === statusFilter;
        return matchesSearch && matchesPriority && matchesStatus;
      });
  }, [data, search, priorityFilter, statusFilter]);

  // Check if reordering is allowed (reordering disabled while filtering)
  const isReorderingAllowed = search === '' && priorityFilter === 'All' && statusFilter === 'All';

  // Priority sorting for Summary view
  const summaryProjectsByPriority = useMemo(() => {
    const priorityOrder = { 'High': 1, 'Medium': 2, 'Low': 3 };
    return [...(data.projects || [])]
      .filter(project => project.tasks && project.tasks.some(task => !task.completed))
      .sort((a, b) => (priorityOrder[a.priority] || 4) - (priorityOrder[b.priority] || 4));
  }, [data]);

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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
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
            {hasUnsavedChanges && (
              <span className="text-xs font-bold text-amber-400 bg-amber-950/80 border border-amber-700 px-2.5 py-1 rounded-md animate-pulse">
                Unsaved Changes
              </span>
            )}
          </div>
        </div>
      </nav>

      {/* Direct Commit Header Control Bar */}
      <div className="bg-slate-800 text-white border-b border-slate-700 py-2.5 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="font-semibold text-slate-300 shrink-0">GitHub Token:</span>
            <input
              type="password"
              placeholder="github_pat_xxxx"
              value={githubToken}
              onChange={(e) => handleTokenChange(e.target.value)}
              className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-full sm:w-56"
            />
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
            {saveStatus.msg && (
              <span className={`text-xs font-medium ${
                saveStatus.type === 'error' ? 'text-red-400' :
                saveStatus.type === 'success' ? 'text-emerald-400' : 'text-blue-300'
              }`}>
                {saveStatus.msg}
              </span>
            )}

            <button
              onClick={handleSaveToGitHub}
              disabled={isSaving || !hasUnsavedChanges}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition shadow-sm flex items-center gap-1.5 ${
                hasUnsavedChanges 
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer' 
                  : 'bg-slate-700 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isSaving ? 'Saving...' : 'Commit & Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-6">

        {/* TAB 1: STATUS SUMMARY */}
        {activeTab === 'summary' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-slate-900 rounded-xl p-5 text-white shadow-md border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-[11px] font-bold text-blue-300 uppercase tracking-wider">Current Focus & Overview</span>
                </div>
                <button
                  onClick={() => setIsEditingBlurb(!isEditingBlurb)}
                  className="text-xs text-blue-300 hover:text-white underline font-medium"
                >
                  {isEditingBlurb ? 'Done Editing' : 'Edit Focus Statement'}
                </button>
              </div>

              {isEditingBlurb ? (
                <textarea
                  rows={2}
                  value={data.statusBlurb}
                  onChange={(e) => {
                    setData(prev => ({ ...prev, statusBlurb: e.target.value }));
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-sm md:text-base font-medium text-slate-100 leading-snug">
                  "{data.statusBlurb}"
                </p>
              )}
            </div>

            <div className="space-y-2.5">
              {summaryProjectsByPriority.map((project) => {
                const upcomingTasks = getNextTwoTasks(project.tasks);

                return (
                  <div
                    key={project.id}
                    className="bg-white rounded-lg border border-slate-200 px-4 py-3 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 min-h-[64px]"
                  >
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

                      {project.currentStatus && (
                        <p className="text-xs text-slate-600 line-clamp-1">
                          <strong className="text-slate-800 font-semibold">Focus:</strong> {project.currentStatus}
                        </p>
                      )}
                    </div>

                    <div className="md:w-80 shrink-0 bg-slate-50 p-2.5 rounded-md border border-slate-100 text-xs space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Active Deliverables ({upcomingTasks.length})
                      </span>
                      {upcomingTasks.length > 0 ? (
                        <ul className="space-y-1.5">
                          {upcomingTasks.map((task) => (
                            <li key={task.id} className="flex items-center justify-between gap-2 text-slate-700">
                              <label className="flex items-center gap-2 min-w-0 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={task.completed}
                                  onChange={() => handleToggleTask(project.id, task.id)}
                                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className={`truncate text-[11px] font-medium ${task.completed ? 'line-through text-slate-400' : ''}`}>
                                  {task.text}
                                </span>
                              </label>
                              {task.dueDate && (
                                <span className="text-[9px] text-slate-400 font-mono shrink-0">
                                  {task.dueDate}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[11px] text-slate-400 italic">No remaining active subtasks</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: INLINE EDITABLE PROJECT DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="relative w-full md:w-80">
                <input
                  type="text"
                  placeholder="Search projects or subtasks..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                />
                <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 w-full md:w-auto">
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                  <span className="text-xs font-bold text-slate-400 uppercase px-1">Priority:</span>
                  {['All', 'High', 'Medium', 'Low'].map((p) => (
                    <button
                      key={p}
                      onClick={() => setPriorityFilter(p)}
                      className={`px-2 py-1 text-xs font-medium rounded-md transition ${
                        priorityFilter === p ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleAddProject}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-sm flex items-center gap-1 shrink-0"
                >
                  + Add Project
                </button>
              </div>
            </div>

            {!isReorderingAllowed && (
              <p className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded border border-amber-200">
                <strong>Note:</strong> Reordering via drag-and-drop or arrows is disabled while active search/filters are applied.
              </p>
            )}

            {/* Dashboard Cards with Drag and Drop & Rank Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjectsWithIndices.map(({ project, originalIndex }) => {
                const isEditing = editingProjectId === project.id;
                const totalTasks = project.tasks?.length || 0;
                const completedTasks = project.tasks?.filter(t => t.completed).length || 0;
                const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

                return (
                  <div
                    key={project.id}
                    draggable={isReorderingAllowed}
                    onDragStart={(e) => handleDragStart(e, originalIndex)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, originalIndex)}
                    className={`bg-white rounded-xl border transition flex flex-col justify-between overflow-hidden shadow-sm ${
                      isEditing ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200 hover:border-slate-300'
                    } ${draggedIndex === originalIndex ? 'opacity-40 border-dashed border-blue-400' : ''}`}
                  >
                    <div className="p-5 space-y-4">
                      {/* Card Header Controls + Drag/Order Handle */}
                      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        {isReorderingAllowed && (
                          <div className="flex items-center gap-1 text-slate-400">
                            <span 
                              className="cursor-grab active:cursor-grabbing p-1 hover:text-slate-700 hover:bg-slate-100 rounded"
                              title="Drag to reorder"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M7 4a1 1 0 100-2 1 1 0 000 2zm6 0a1 1 0 100-2 1 1 0 000 2zm-6 6a1 1 0 100-2 1 1 0 000 2zm6 0a1 1 0 100-2 1 1 0 000 2zm-6 6a1 1 0 100-2 1 1 0 000 2zm6 0a1 1 0 100-2 1 1 0 000 2z"/>
                              </svg>
                            </span>
                            <div className="flex flex-col text-[10px] leading-tight">
                              <button
                                onClick={() => moveProject(originalIndex, originalIndex - 1)}
                                disabled={originalIndex === 0}
                                className="hover:text-blue-600 disabled:opacity-30 disabled:hover:text-slate-400 font-bold"
                                title="Move up"
                              >
                                ▲
                              </button>
                              <button
                                onClick={() => moveProject(originalIndex, originalIndex + 1)}
                                disabled={originalIndex === data.projects.length - 1}
                                className="hover:text-blue-600 disabled:opacity-30 disabled:hover:text-slate-400 font-bold"
                                title="Move down"
                              >
                                ▼
                              </button>
                            </div>
                          </div>
                        )}

                        {isEditing ? (
                          <div className="flex items-center gap-2 w-full">
                            <input
                              type="text"
                              value={project.projectNumber || ''}
                              onChange={(e) => handleUpdateProjectField(project.id, 'projectNumber', e.target.value)}
                              placeholder="PRJ-001"
                              className="w-20 px-2 py-1 border border-slate-300 rounded text-xs font-mono font-bold"
                            />
                            <select
                              value={project.priority}
                              onChange={(e) => handleUpdateProjectField(project.id, 'priority', e.target.value)}
                              className="px-2 py-1 border border-slate-300 rounded text-xs font-semibold"
                            >
                              <option value="High">High</option>
                              <option value="Medium">Medium</option>
                              <option value="Low">Low</option>
                            </select>
                            <select
                              value={project.status}
                              onChange={(e) => handleUpdateProjectField(project.id, 'status', e.target.value)}
                              className="px-2 py-1 border border-slate-300 rounded text-xs font-semibold"
                            >
                              <option value="Planned">Planned</option>
                              <option value="In Progress">In Progress</option>
                              <option value="In Review">In Review</option>
                              <option value="Completed">Completed</option>
                            </select>
                          </div>
                        ) : (
                          <>
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
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${getPriorityBadge(project.priority)}`}>
                                {project.priority}
                              </span>
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-md border ${getStatusBadge(project.status)}`}>
                                {project.status}
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Main Fields */}
                      <div className="space-y-2">
                        {isEditing ? (
                          <div className="space-y-2">
                            <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase">Project Title</label>
                              <input
                                type="text"
                                value={project.name}
                                onChange={(e) => handleUpdateProjectField(project.id, 'name', e.target.value)}
                                className="w-full px-2 py-1 border border-slate-300 rounded text-sm font-bold"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase">Focus Line</label>
                              <input
                                type="text"
                                value={project.currentStatus || ''}
                                onChange={(e) => handleUpdateProjectField(project.id, 'currentStatus', e.target.value)}
                                className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase">Description</label>
                              <textarea
                                rows={2}
                                value={project.description || ''}
                                onChange={(e) => handleUpdateProjectField(project.id, 'description', e.target.value)}
                                className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                              />
                            </div>
                          </div>
                        ) : (
                          <>
                            <h3 className="font-bold text-slate-900 text-base leading-snug">{project.name}</h3>
                            {project.currentStatus && (
                              <p className="text-xs font-medium text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded border border-blue-100">
                                <strong>Focus:</strong> {project.currentStatus}
                              </p>
                            )}
                            <p className="text-slate-600 text-xs leading-relaxed">{project.description}</p>
                          </>
                        )}
                      </div>

                      {/* Progress Bar */}
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

                      {/* Subtasks Section */}
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Subtasks</span>
                          <button
                            onClick={() => handleAddTask(project.id)}
                            className="text-xs text-blue-600 font-bold hover:underline"
                          >
                            + Add Subtask
                          </button>
                        </div>

                        <ul className="space-y-2">
                          {project.tasks?.map((task) => (
                            <li key={task.id} className="flex items-center justify-between gap-2 text-xs text-slate-700 bg-slate-50 p-2 rounded border border-slate-100">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={task.completed}
                                  onChange={() => handleToggleTask(project.id, task.id)}
                                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
                                />
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={task.text}
                                    onChange={(e) => handleUpdateTaskText(project.id, task.id, e.target.value)}
                                    className="w-full px-1.5 py-0.5 border border-slate-200 rounded text-xs"
                                  />
                                ) : (
                                  <span className={`truncate ${task.completed ? 'line-through text-slate-400' : 'font-medium'}`}>
                                    {task.text}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {isEditing ? (
                                  <input
                                    type="date"
                                    value={task.dueDate || ''}
                                    onChange={(e) => handleUpdateTaskDate(project.id, task.id, e.target.value)}
                                    className="text-[10px] border border-slate-200 rounded px-1 py-0.5 font-mono"
                                  />
                                ) : (
                                  task.dueDate && (
                                    <span className="text-[10px] font-medium text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                      {task.dueDate}
                                    </span>
                                  )
                                )}
                                {isEditing && (
                                  <button
                                    onClick={() => handleDeleteTask(project.id, task.id)}
                                    className="text-red-500 hover:text-red-700 font-bold px-1"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Footer Controls per Card */}
                    <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 text-xs flex justify-between items-center">
                      <button
                        onClick={() => setEditingProjectId(isEditing ? null : project.id)}
                        className="text-blue-600 hover:text-blue-800 font-bold"
                      >
                        {isEditing ? 'Done Editing' : 'Edit Details'}
                      </button>

                      {isEditing && (
                        <button
                          onClick={() => handleDeleteProject(project.id)}
                          className="text-red-600 hover:text-red-800 font-semibold"
                        >
                          Delete Project
                        </button>
                      )}

                      {!isEditing && (
                        <span className="text-slate-500">
                          Target: <strong className="text-slate-700 font-semibold">{project.dueDate}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
