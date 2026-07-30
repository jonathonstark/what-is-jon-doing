import React, { useState, useMemo, useEffect } from 'react';

// Configuration
const REPO_OWNER = 'your-github-username';
const REPO_NAME = 'your-repo-name';
const FILE_PATH = 'public/data/tasks.json';

const STATUS_COLORS = {
  'In Progress': 'bg-blue-100 text-blue-800 border-blue-200',
  'In Review': 'bg-purple-100 text-purple-800 border-purple-200',
  'Waiting': 'bg-amber-100 text-amber-800 border-amber-200',
  'Planned': 'bg-slate-100 text-slate-700 border-slate-200',
  'Completed': 'bg-emerald-100 text-emerald-800 border-emerald-200'
};

export default function JonsDashboard() {
  const [data, setData] = useState({ statusBlurb: '', projects: [] });
  const [projects, setProjects] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Auth & View States
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [githubToken, setGithubToken] = useState('');
  const [showTokenPrompt, setShowTokenPrompt] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Filters & Tabs
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'summary'
  const [viewMode, setViewMode] = useState('active'); // 'active' | 'archived' | 'all'
  const [searchQuery, setSearchQuery] = useState('');
  const [newSubtaskTexts, setNewSubtaskTexts] = useState({});

  // Initial Fetch
  useEffect(() => {
    fetch('data/tasks.json')
      .then((res) => res.json())
      .then((jsonData) => {
        setData(jsonData);
        setProjects(jsonData.projects || []);
      })
      .catch((err) => console.error('Failed to load project data:', err));
  }, []);

  // Track Unsaved Changes
  const markDirty = (updatedProjects) => {
    setProjects(updatedProjects);
    setHasUnsavedChanges(true);
  };

  // Safe Base64 Unicode Encoder
  const safeBtoa = (str) => {
    return btoa(
      encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) =>
        String.fromCharCode('0x' + p1)
      )
    );
  };

  // GitHub Batch Save Handler
  const handleSaveToGitHub = async () => {
  try {
    const REPO_OWNER = 'jonathonstark';
    const REPO_NAME = 'what-is-jon-doing';
    const FILE_PATH = 'public/data/tasks.json'; // Or 'data/tasks.json' depending on repo layout
    const GITHUB_TOKEN = githubToken; // Your Personal Access Token from state/localStorage

    // 1. Fetch the LATEST file metadata directly from GitHub API to get the current SHA
    const fileRes = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
      {
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (!fileRes.ok) {
      throw new Error(`Failed to fetch latest SHA: ${fileRes.statusText}`);
    }

    const fileData = await fileRes.json();
    const latestSha = fileData.sha; // Get the fresh SHA!

    // 2. Prepare updated tasks data (with an updated lastUpdated date)
    const updatedData = {
      ...tasksData,
      lastUpdated: new Date().toISOString().split('T')[0],
    };

    // Helper function to safely base64 encode UTF-8 JSON strings
    const safeBtoa = (str) =>
      btoa(
        encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) =>
          String.fromCharCode('0x' + p1)
        )
      );

    // 3. Commit the file back to GitHub using the fresh SHA
    const commitRes = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          message: 'Update tasks.json via Dashboard',
          content: safeBtoa(JSON.stringify(updatedData, null, 2)),
          sha: latestSha, // <-- Fresh SHA ensures GitHub accepts the commit!
        }),
      }
    );

    if (!commitRes.ok) {
      const errData = await commitRes.json();
      throw new Error(errData.message || 'Failed to commit changes');
    }

    const commitData = await commitRes.json();
    console.log('Successfully committed to GitHub!', commitData);
    
    // Update local state with latest data
    setTasksData(updatedData);
    alert('Tasks successfully saved and committed to GitHub!');

  } catch (error) {
    console.error('Error committing to GitHub:', error);
    alert(`Commit failed: ${error.message}`);
  }
};

  // Inline Card Edit Handlers
  const handleProjectChange = (pIdx, field, value) => {
    const updated = [...projects];
    updated[pIdx] = { ...updated[pIdx], [field]: value };
    markDirty(updated);
  };

  const handleToggleSubtask = (pIdx, tIdx) => {
    const updated = [...projects];
    const task = updated[pIdx].tasks[tIdx];
    task.completed = !task.completed;
    markDirty(updated);
  };

  const handleSubtaskTextChange = (pIdx, tIdx, text) => {
    const updated = [...projects];
    updated[pIdx].tasks[tIdx].text = text;
    markDirty(updated);
  };

  const handleAddSubtaskInline = (pIdx) => {
    const text = (newSubtaskTexts[pIdx] || '').trim();
    if (!text) return;

    const updated = [...projects];
    if (!updated[pIdx].tasks) updated[pIdx].tasks = [];
    
    updated[pIdx].tasks.push({
      id: `task-${Date.now()}`,
      text: text,
      completed: false
    });

    setNewSubtaskTexts({ ...newSubtaskTexts, [pIdx]: '' });
    markDirty(updated);
  };

  const handleDeleteSubtask = (pIdx, tIdx) => {
    const updated = [...projects];
    updated[pIdx].tasks.splice(tIdx, 1);
    markDirty(updated);
  };

  const handleCreateNewProject = () => {
    const newProj = {
      id: `proj-${Date.now()}`,
      projectNumber: `PRJ-00${projects.length + 1}`,
      name: 'New Project',
      category: 'General',
      priority: 'Medium',
      status: 'In Progress',
      dueDate: new Date().toISOString().split('T')[0],
      currentStatus: 'Just initiated...',
      tasks: []
    };
    markDirty([newProj, ...projects]);
  };

  // Filtered Projects View
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      // Active vs Archived filtering
      if (viewMode === 'active' && p.status === 'Completed') return false;
      if (viewMode === 'archived' && p.status !== 'Completed') return false;

      // Search Query
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.projectNumber && p.projectNumber.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q))
      );
    });
  }, [projects, viewMode, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 pb-24">
      {/* Top Header */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold tracking-tight">Jon's Dashboard</h1>
            <span className="text-xs font-mono bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700">
              {projects.filter((p) => p.status !== 'Completed').length} Active
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Admin Lock Toggle */}
            <button
              onClick={() => {
                if (!isAdminUnlocked && !githubToken) {
                  setShowTokenPrompt(true);
                } else {
                  setIsAdminUnlocked(!isAdminUnlocked);
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                isAdminUnlocked
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {isAdminUnlocked ? '🔓 Edit Mode Enabled' : '🔒 Locked (Viewer Mode)'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Navigation & Controls Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            {/* Segmented View Mode Filter */}
            <div className="bg-slate-200 p-1 rounded-lg flex text-xs font-semibold">
              <button
                onClick={() => setViewMode('active')}
                className={`px-3 py-1.5 rounded-md transition ${
                  viewMode === 'active' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setViewMode('archived')}
                className={`px-3 py-1.5 rounded-md transition ${
                  viewMode === 'archived' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Archived
              </button>
              <button
                onClick={() => setViewMode('all')}
                className={`px-3 py-1.5 rounded-md transition ${
                  viewMode === 'all' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Projects
              </button>
            </div>

            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-48 sm:w-64"
            />
          </div>

          {isAdminUnlocked && (
            <button
              onClick={handleCreateNewProject}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow transition"
            >
              + Create New Project
            </button>
          )}
        </div>

        {/* Project Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => {
            const originalIndex = projects.findIndex((p) => p.id === project.id);

            return (
              <div
                key={project.id || originalIndex}
                className={`bg-white border rounded-xl shadow-sm hover:shadow-md transition flex flex-col justify-between overflow-hidden ${
                  project.status === 'Completed' ? 'opacity-75 bg-slate-50 border-slate-200' : 'border-slate-200'
                }`}
              >
                {/* Card Header */}
                <div className="p-4 border-b border-slate-100 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    {/* Project Number & Name */}
                    <div className="flex-1">
                      {isAdminUnlocked ? (
                        <div className="flex gap-1.5 mb-1">
                          <input
                            type="text"
                            value={project.projectNumber || ''}
                            onChange={(e) => handleProjectChange(originalIndex, 'projectNumber', e.target.value)}
                            placeholder="PRJ-000"
                            className="w-20 px-1.5 py-0.5 text-xs font-mono font-bold border border-slate-300 rounded bg-slate-50"
                          />
                          <input
                            type="text"
                            value={project.name}
                            onChange={(e) => handleProjectChange(originalIndex, 'name', e.target.value)}
                            className="flex-1 px-1.5 py-0.5 text-xs font-bold border border-slate-300 rounded bg-slate-50"
                          />
                        </div>
                      ) : (
                        <div>
                          <span className="text-[10px] font-mono font-bold text-slate-400 block">
                            {project.projectNumber}
                          </span>
                          <h3 className="font-bold text-slate-900 text-sm leading-snug">{project.name}</h3>
                        </div>
                      )}
                    </div>

                    {/* Status Badge / Selector */}
                    {isAdminUnlocked ? (
                      <select
                        value={project.status}
                        onChange={(e) => handleProjectChange(originalIndex, 'status', e.target.value)}
                        className={`text-xs font-semibold px-2 py-1 rounded-md border ${STATUS_COLORS[project.status] || 'bg-slate-100'}`}
                      >
                        <option value="In Progress">In Progress</option>
                        <option value="In Review">In Review</option>
                        <option value="Waiting">Waiting</option>
                        <option value="Planned">Planned</option>
                        <option value="Completed">Completed</option>
                      </select>
                    ) : (
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                          STATUS_COLORS[project.status] || 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {project.status}
                      </span>
                    )}
                  </div>

                  {/* Focus / Status Line */}
                  {isAdminUnlocked ? (
                    <input
                      type="text"
                      value={project.currentStatus || ''}
                      onChange={(e) => handleProjectChange(originalIndex, 'currentStatus', e.target.value)}
                      placeholder="Current status focus line..."
                      className="w-full text-xs italic border border-slate-300 rounded px-2 py-1 bg-slate-50"
                    />
                  ) : (
                    project.currentStatus && (
                      <p className="text-xs text-slate-600 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                        "{project.currentStatus}"
                      </p>
                    )
                  )}
                </div>

                {/* Subtasks Section */}
                <div className="p-4 flex-1 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <span>Deliverables</span>
                    <span>
                      {project.tasks?.filter((t) => t.completed).length || 0}/
                      {project.tasks?.length || 0}
                    </span>
                  </div>

                  <ul className="space-y-1.5">
                    {project.tasks?.map((task, tIdx) => (
                      <li key={task.id || tIdx} className="flex items-center gap-2 group">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() => handleToggleSubtask(originalIndex, tIdx)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                        />
                        {isAdminUnlocked ? (
                          <input
                            type="text"
                            value={task.text}
                            onChange={(e) => handleSubtaskTextChange(originalIndex, tIdx, e.target.value)}
                            className={`flex-1 text-xs border border-slate-200 rounded px-1.5 py-0.5 ${
                              task.completed ? 'line-through text-slate-400' : 'text-slate-700'
                            }`}
                          />
                        ) : (
                          <span
                            className={`text-xs flex-1 ${
                              task.completed ? 'line-through text-slate-400' : 'text-slate-700'
                            }`}
                          >
                            {task.text}
                          </span>
                        )}

                        {isAdminUnlocked && (
                          <button
                            onClick={() => handleDeleteSubtask(originalIndex, tIdx)}
                            className="text-slate-300 hover:text-red-500 text-xs opacity-0 group-hover:opacity-100 transition px-1"
                          >
                            ✕
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>

                  {/* Inline Add Subtask Input */}
                  {isAdminUnlocked && (
                    <div className="pt-2 flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder="+ Add subtask (press Enter)..."
                        value={newSubtaskTexts[originalIndex] || ''}
                        onChange={(e) =>
                          setNewSubtaskTexts({ ...newSubtaskTexts, [originalIndex]: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddSubtaskInline(originalIndex);
                        }}
                        className="flex-1 text-xs border border-slate-200 rounded px-2 py-1 bg-slate-50 focus:bg-white outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* Card Footer */}
                <div className="p-3 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                  <span className="font-medium">Priority: {project.priority}</span>
                  <span className="font-mono">Due: {project.dueDate || 'N/A'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Floating Save & Commit Bar */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-4 z-50 border border-slate-700 animate-bounce-short">
          <div className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse"></span>
            <span>You have unsaved edits</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setProjects(data.projects || []);
                setHasUnsavedChanges(false);
              }}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded"
            >
              Discard
            </button>
            <button
              onClick={handleSaveToGitHub}
              disabled={isSaving}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 text-white font-semibold text-xs rounded-full transition shadow-lg"
            >
              {isSaving ? 'Committing...' : 'Save & Publish Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Token Modal */}
      {showTokenPrompt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Unlock Jon's Dashboard</h3>
            <p className="text-xs text-slate-600">
              Enter your GitHub Personal Access Token to make in-place edits directly to{' '}
              <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">tasks.json</code>.
            </p>
            <input
              type="password"
              placeholder="ghp_xxxxxxxxxxxx"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg p-2 font-mono outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowTokenPrompt(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (githubToken.trim()) {
                    setIsAdminUnlocked(true);
                    setShowTokenPrompt(false);
                  }
                }}
                className="px-4 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700"
              >
                Unlock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
